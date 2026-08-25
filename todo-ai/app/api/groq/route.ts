import { NextRequest, NextResponse } from 'next/server'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_GROQ_MODEL = 'groq/compound'

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing GROQ_API_KEY environment variable' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { messages, temperature, max_tokens } = body

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Request body must include a non-empty messages array' },
        { status: 400 }
      )
    }

    const configuredModel = process.env.GROQ_MODEL?.trim()
    const model = configuredModel ? configuredModel : DEFAULT_GROQ_MODEL

    const groqResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        ...(temperature !== undefined ? { temperature } : {}),
        ...(max_tokens !== undefined ? { max_tokens } : {}),
      }),
    })

    const responseData = await groqResponse.json()

    if (!groqResponse.ok) {
      return NextResponse.json(
        {
          error: responseData?.error?.message || 'Groq API request failed',
          details: responseData,
        },
        { status: groqResponse.status }
      )
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('[groq][POST] unexpected error', error)
    return NextResponse.json(
      { error: 'Failed to complete Groq request' },
      { status: 500 }
    )
  }
}