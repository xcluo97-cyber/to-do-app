"use client";

import React, { useState } from "react";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  due_date?: string | null;
}

interface TodoChatBoxProps {
  onTodoCreated: (todo: Todo) => void;
  onTodoUpdated: (todo: Todo) => void;
  onTodoDeleted: (id: string) => void;
}

interface ParsedTask {
  title: string;
  due_date: string | null;
}

interface TaskAction {
  decision: "add" | "modify" | "delete";
  id?: string;
  task?: Partial<ParsedTask> & { completed?: boolean };
}

function findFirstJsonObject(input: string): string | null {
  let start = -1;
  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === "\\") {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        start = i;
      }
      depth += 1;
      continue;
    }

    if (char === "}") {
      if (depth === 0) {
        continue;
      }

      depth -= 1;
      if (depth === 0 && start !== -1) {
        return input.slice(start, i + 1);
      }
    }
  }

  return null;
}

function extractJsonObject(content: string): string {
  const trimmed = content.trim();

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    const fencedJson = findFirstJsonObject(fencedMatch[1]);
    if (fencedJson) {
      return fencedJson;
    }
  }

  const inlineJson = findFirstJsonObject(trimmed);
  if (inlineJson) {
    return inlineJson;
  }

  throw new Error("Could not find JSON object in AI response.");
}

function isValidDueDate(value: unknown): value is string | null {
  if (value === null) {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function looksLikeDeleteRequest(value: string): boolean {
  return /(^|\s)(delete|remove|clear|cancel|archive|drop|eliminate)\b/i.test(value);
}

function parseTaskActionFromModelContent(content: string): TaskAction {
  const rawJson = extractJsonObject(content);
  const parsed = JSON.parse(rawJson) as Partial<TaskAction>;

  if (parsed.decision !== "add" && parsed.decision !== "modify" && parsed.decision !== "delete") {
    throw new Error("Model response is missing a valid decision.");
  }

  if (parsed.decision === "add") {
    const task = parsed.task ?? {};

    if (typeof task.title !== "string" || task.title.trim().length === 0) {
      throw new Error("Add action is missing a valid title.");
    }

    if (looksLikeDeleteRequest(task.title)) {
      throw new Error("Delete-like requests are not valid add actions. Use a delete action with the existing task id.");
    }

    if (!isValidDueDate(task.due_date)) {
      throw new Error("Add action has an invalid due_date format.");
    }

    return {
      decision: "add",
      task: {
        title: task.title.trim(),
        due_date: task.due_date ?? null,
      },
    };
  }

  if (parsed.decision === "modify") {
    const task = parsed.task ?? {};

    if (!parsed.id && typeof task.title !== "string" && !task.due_date && task.completed === undefined) {
      throw new Error("Modify action must include an id or updated task fields.");
    }

    if (parsed.id) {
      return {
        decision: "modify",
        id: parsed.id,
        task: {
          ...(task.title !== undefined ? { title: task.title.trim() } : {}),
          ...(task.due_date !== undefined ? { due_date: task.due_date } : {}),
          ...(task.completed !== undefined ? { completed: Boolean(task.completed) } : {}),
        },
      };
    }

    if (typeof task.title === "string" && task.title.trim().length === 0) {
      throw new Error("Modify action has an empty title.");
    }

    if (task.due_date !== undefined && !isValidDueDate(task.due_date)) {
      throw new Error("Modify action has an invalid due_date format.");
    }

    return {
      decision: "modify",
      task: {
        ...(task.title !== undefined ? { title: task.title.trim() } : {}),
        ...(task.due_date !== undefined ? { due_date: task.due_date } : {}),
        ...(task.completed !== undefined ? { completed: Boolean(task.completed) } : {}),
      },
    };
  }

  if (typeof parsed.id !== "string" || parsed.id.trim().length === 0) {
    throw new Error("Delete action must include the id of the task to delete.");
  }

  return {
    decision: "delete",
    id: parsed.id,
  };
}

export default function TodoChatBox({
  onTodoCreated,
  onTodoUpdated,
  onTodoDeleted,
}: TodoChatBoxProps) {
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createTaskWithAI = async () => {
    if (!prompt.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setStatus("Thinking...");
    setError(null);

    try {
      const groqResponse = await fetch("/api/groq", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content:
                "You are a task intent classifier for a todo app. Return exactly one JSON object and nothing else. Use this exact shape: {\"decision\": \"add\" | \"modify\" | \"delete\", \"id\": string | null, \"task\": { \"title\": string, \"due_date\": string | null, \"completed\": boolean } | null }. Critical rules: 1) If the user asks to delete, remove, clear, cancel, archive, or drop a task, never create a new task. Instead, return a delete action using the existing task id from the current todo list. 2) If the user asks to modify a task, include the existing task id and only the fields to change. 3) For add, only create a new task when the request is clearly to add a new task, not a delete or modify instruction. 4) Never use a delete phrase as the title of a new task. 5) Always include the due_date field in the task object as either a real YYYY-MM-DD string or null. If the user does not mention a due date, use null. 6) Do not wrap in markdown.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.2,
        }),
      });

      const groqData = await groqResponse.json();

      if (!groqResponse.ok) {
        throw new Error(groqData?.error || "Failed to get AI response.");
      }

      const modelContent = groqData?.choices?.[0]?.message?.content;

      console.log("Groq response:", groqData);
      console.log("Parsed model content:", modelContent);

      if (typeof modelContent !== "string") {
        throw new Error("AI response did not include message content.");
      }

      const action = parseTaskActionFromModelContent(modelContent);

      if (action.decision === "add") {
        setStatus("Creating task...");

        const createResponse = await fetch("/api/todos", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: action.task?.title,
            due_date: action.task?.due_date ?? null,
          }),
        });

        const createData = await createResponse.json();

        if (!createResponse.ok) {
          throw new Error(createData?.error || "Failed to create task.");
        }

        onTodoCreated(createData);
        setPrompt("");
        setStatus("Task created.");
      } else if (action.decision === "modify") {
        if (!action.id) {
          throw new Error("AI modify action did not include a task id.");
        }

        setStatus("Updating task...");

        const updateResponse = await fetch(`/api/todos/${action.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(action.task ?? {}),
        });

        const updateData = await updateResponse.json();

        if (!updateResponse.ok) {
          throw new Error(updateData?.error || "Failed to update task.");
        }

        onTodoUpdated(updateData);
        setPrompt("");
        setStatus("Task updated.");
      } else {
        if (!action.id) {
          throw new Error("AI delete action did not include a task id.");
        }

        setStatus("Deleting task...");

        const deleteResponse = await fetch(`/api/todos/${action.id}`, {
          method: "DELETE",
        });

        const deleteData = await deleteResponse.json();

        if (!deleteResponse.ok) {
          throw new Error(deleteData?.error || "Failed to delete task.");
        }

        onTodoDeleted(action.id);
        setPrompt("");
        setStatus("Task deleted.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error.";
      setError(message);
      setStatus(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h2 className="text-lg font-semibold text-gray-800">AI Task Chat</h2>
      <p className="mt-1 text-sm text-gray-600">
        Describe a task naturally. The AI will return JSON, then we save it to Supabase.
      </p>

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              createTaskWithAI();
            }
          }}
          placeholder="Example: Remind me to submit taxes by April 10"
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-black"
          disabled={isSubmitting}
        />
        <button
          type="button"
          onClick={createTaskWithAI}
          disabled={isSubmitting || prompt.trim().length === 0}
          className="rounded-lg bg-black px-4 py-2 font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {isSubmitting ? "Working..." : "Create"}
        </button>
      </div>

      {status && <p className="mt-2 text-sm text-green-700">{status}</p>}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}