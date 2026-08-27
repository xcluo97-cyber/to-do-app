import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { ChatGroq } from '@langchain/groq'
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import { getSupabaseClient } from '@/lib/supabase'

const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile'
const ACCOUNT_WINDOW_MS = 24 * 60 * 60 * 1000

type AccountUsageRow = {
  user_id: string
  first_message: string | null
  count: number | null
}

type ChatMessageLike = {
  role: 'system' | 'user' | 'assistant'
  content: string | unknown
}

type TaskDecision = 'add' | 'modify' | 'delete'

type TaskActionResponse = {
  decision: TaskDecision
  id: string | null
  task: {
    title?: string
    due_date?: string | null
    completed?: boolean
  } | null
}

function findFirstJsonObject(input: string): string | null {
  let start = -1
  let depth = 0
  let inString = false
  let isEscaped = false

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]

    if (inString) {
      if (isEscaped) {
        isEscaped = false
      } else if (char === '\\') {
        isEscaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{') {
      if (depth === 0) start = i
      depth += 1
      continue
    }

    if (char === '}') {
      if (depth === 0) continue
      depth -= 1
      if (depth === 0 && start !== -1) {
        return input.slice(start, i + 1)
      }
    }
  }

  return null
}

function extractJsonObjectFromText(content: string): string {
  const trimmed = content.trim()

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenced?.[1]) {
    const fencedJson = findFirstJsonObject(fenced[1])
    if (fencedJson) return fencedJson
  }

  const inlineJson = findFirstJsonObject(trimmed)
  if (inlineJson) return inlineJson

  throw new Error('Could not find JSON object in AI response.')
}

function isValidDueDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function mapDecision(value: unknown): TaskDecision | null {
  if (typeof value !== 'string') return null

  const normalized = value.trim().toLowerCase()

  if (normalized === 'add' || normalized === 'create' || normalized === 'new') {
    return 'add'
  }

  if (normalized === 'modify' || normalized === 'update' || normalized === 'edit') {
    return 'modify'
  }

  if (normalized === 'delete' || normalized === 'remove' || normalized === 'clear') {
    return 'delete'
  }

  return null
}

function normalizeTaskActionResponse(rawContent: string): string {
  const rawJson = extractJsonObjectFromText(rawContent)
  const parsed = JSON.parse(rawJson) as Record<string, unknown>

  const decision =
    mapDecision(parsed.decision) ??
    mapDecision(parsed.action) ??
    mapDecision(parsed.intent) ??
    mapDecision(parsed.type)

  if (!decision) {
    throw new Error('AI response is missing a valid decision value.')
  }

  const parsedId = typeof parsed.id === 'string' && parsed.id.trim().length > 0 ? parsed.id.trim() : null
  const rawTask = parsed.task && typeof parsed.task === 'object' ? (parsed.task as Record<string, unknown>) : null

  if (decision === 'add') {
    const title = typeof rawTask?.title === 'string' ? rawTask.title.trim() : ''

    if (!title) {
      throw new Error('Add action is missing a valid title.')
    }

    const dueDate = isValidDueDate(rawTask?.due_date) ? rawTask.due_date : null

    const normalized: TaskActionResponse = {
      decision: 'add',
      id: null,
      task: {
        title,
        due_date: dueDate,
      },
    }

    return JSON.stringify(normalized)
  }

  if (decision === 'modify') {
    const normalizedTask: NonNullable<TaskActionResponse['task']> = {}

    if (typeof rawTask?.title === 'string') {
      const title = rawTask.title.trim()
      if (title) {
        normalizedTask.title = title
      }
    }

    if (rawTask && 'due_date' in rawTask) {
      normalizedTask.due_date = isValidDueDate(rawTask.due_date) ? rawTask.due_date : null
    }

    if (rawTask && 'completed' in rawTask) {
      normalizedTask.completed = Boolean(rawTask.completed)
    }

    if (!parsedId && Object.keys(normalizedTask).length === 0) {
      throw new Error('Modify action must include an id or updated task fields.')
    }

    const normalized: TaskActionResponse = {
      decision: 'modify',
      id: parsedId,
      task: normalizedTask,
    }

    return JSON.stringify(normalized)
  }

  if (!parsedId) {
    throw new Error('Delete action must include the id of the task to delete.')
  }

  const normalized: TaskActionResponse = {
    decision: 'delete',
    id: parsedId,
    task: null,
  }

  return JSON.stringify(normalized)
}

function toLangChainMessages(messages: ChatMessageLike[]) {
  return messages.map((message) => {
    const role = message.role
    const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content)

    switch (role) {
      case 'system':
        return new SystemMessage(content)
      case 'assistant':
        return new AIMessage(content)
      default:
        return new HumanMessage(content)
    }
  })
}

function getGroqDailyMessageLimit() {
  const rawLimit = process.env.GROQ_DAILY_MESSAGE_LIMIT
  const parsedLimit = Number(rawLimit)

  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
    throw new Error('Missing or invalid GROQ_DAILY_MESSAGE_LIMIT environment variable')
  }

  return parsedLimit
}

function parseTimestamp(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

async function enforceAndConsumeGroqQuota(userId: string) {
  const supabase = getSupabaseClient()
  const now = new Date()
  const nowIso = now.toISOString()
  const usageLimit = getGroqDailyMessageLimit()

  const { data: existingUsage, error: readUsageError } = await supabase
    .from('account')
    .select('user_id, first_message, count')
    .eq('user_id', userId)
    .maybeSingle<AccountUsageRow>()

  if (readUsageError) {
    throw new Error(readUsageError.message)
  }

  let firstMessageAt = now
  let currentCount = 0

  if (!existingUsage) {
    const { error: createUsageError } = await supabase
      .from('account')
      .insert([
        {
          user_id: userId,
          first_message: nowIso,
          count: 0,
        },
      ])

    if (createUsageError) {
      throw new Error(createUsageError.message)
    }
  } else {
    const parsedFirstMessage = parseTimestamp(existingUsage.first_message)
    firstMessageAt = parsedFirstMessage ?? now
    currentCount = typeof existingUsage.count === 'number' ? existingUsage.count : 0

    const hasExpiredWindow = now.getTime() - firstMessageAt.getTime() >= ACCOUNT_WINDOW_MS

    if (!parsedFirstMessage || hasExpiredWindow) {
      const { error: resetUsageError } = await supabase
        .from('account')
        .update({
          first_message: nowIso,
          count: 0,
        })
        .eq('user_id', userId)

      if (resetUsageError) {
        throw new Error(resetUsageError.message)
      }

      firstMessageAt = now
      currentCount = 0
    }
  }

  if (currentCount >= usageLimit) {
    return {
      allowed: false,
      limit: usageLimit,
      resetAt: new Date(firstMessageAt.getTime() + ACCOUNT_WINDOW_MS).toISOString(),
    } as const
  }

  const nextCount = currentCount + 1

  const { error: updateUsageError } = await supabase
    .from('account')
    .update({
      first_message: firstMessageAt.toISOString(),
      count: nextCount,
    })
    .eq('user_id', userId)

  if (updateUsageError) {
    throw new Error(updateUsageError.message)
  }

  return {
    allowed: true,
    limit: usageLimit,
    count: nextCount,
  } as const
}

async function getCurrentTasksFromSupabase(userId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('todo')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const apiKey = process.env.GROQ_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing GROQ_API_KEY environment variable' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { messages, temperature, max_tokens } = body as {
      messages?: ChatMessageLike[]
      temperature?: number
      max_tokens?: number
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Request body must include a non-empty messages array' },
        { status: 400 }
      )
    }

    const usageResult = await enforceAndConsumeGroqQuota(userId)

    if (!usageResult.allowed) {
      return NextResponse.json(
        {
          error: 'Daily Groq message limit reached',
          limit: usageResult.limit,
          resetAt: usageResult.resetAt,
        },
        { status: 429 }
      )
    }

    const configuredModel = process.env.GROQ_MODEL?.trim()
    const modelName = configuredModel || DEFAULT_GROQ_MODEL

    const model = new ChatGroq({
      apiKey,
      model: modelName,
      temperature: typeof temperature === 'number' ? temperature : 0.2,
      ...(typeof max_tokens === 'number' ? { maxTokens: max_tokens } : {}),
    })

    const currentTasks = await getCurrentTasksFromSupabase(userId)
    const serializedCurrentTasks = JSON.stringify(
      currentTasks.map((task) => ({
        id: task.id,
        title: task.title,
        completed: Boolean(task.completed),
        due_date: task.due_date ?? null,
      }))
    )

    const response = await model
      .withConfig({
        response_format: { type: 'json_object' },
      })
      .invoke(
        toLangChainMessages([
          {
            role: 'system',
            content: `Current todo list from Supabase: ${serializedCurrentTasks}. You are a task intent classifier for a todo app. Return exactly one JSON object and nothing else using this exact shape: {"decision":"add"|"modify"|"delete","id":string|null,"task":{"title":string,"due_date":string|null,"completed":boolean}|null}. Important routing rules: if the user asks to delete, remove, clear, cancel, archive, or drop a task, do not create a new task. Match the request to an existing task id from this list and return a delete action with that id. Never treat delete words as the title of a new task. Only create an add action when the user clearly wants a new task, not a delete or modify command. For every add or modify action, include due_date in the task object as YYYY-MM-DD or null; when no date is mentioned, use null.`,
          },
          ...messages,
        ])
      )
    const rawContent =
      typeof response.content === 'string'
        ? response.content
        : Array.isArray(response.content)
          ? response.content
              .map((part) => {
                if (typeof part === 'string') return part
                if (typeof part === 'object' && part !== null && 'text' in part) {
                  return String((part as { text?: string }).text ?? '')
                }
                return JSON.stringify(part)
              })
              .join('')
          : JSON.stringify(response.content)

    const content = normalizeTaskActionResponse(rawContent)

    return NextResponse.json({
      choices: [
        {
          message: {
            role: 'assistant',
            content,
          },
        },
      ],
    })
  } catch (error) {
    console.error('[groq][POST] unexpected error', error)
    return NextResponse.json(
      { error: 'Failed to complete Groq request' },
      { status: 500 }
    )
  }
}