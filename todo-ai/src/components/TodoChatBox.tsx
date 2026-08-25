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
}

interface ParsedTask {
  title: string;
  due_date: string | null;
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

function parseTaskFromModelContent(content: string): ParsedTask {
  const rawJson = extractJsonObject(content);
  const parsed = JSON.parse(rawJson) as Partial<ParsedTask>;

  if (typeof parsed.title !== "string" || parsed.title.trim().length === 0) {
    throw new Error("Model response is missing a valid title.");
  }

  if (!isValidDueDate(parsed.due_date)) {
    throw new Error("Model response has an invalid due_date format.");
  }

  return {
    title: parsed.title.trim(),
    due_date: parsed.due_date,
  };
}

export default function TodoChatBox({ onTodoCreated }: TodoChatBoxProps) {
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
                "Convert user intent into one todo task. Return exactly one JSON object and nothing else. Use this exact shape: {\"title\": string, \"due_date\": string | null}. due_date must be YYYY-MM-DD or null.",
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

      if (typeof modelContent !== "string") {
        throw new Error("AI response did not include message content.");
      }

      const parsedTask = parseTaskFromModelContent(modelContent);
      setStatus("Creating task...");

      const createResponse = await fetch("/api/todos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsedTask),
      });

      const createData = await createResponse.json();

      if (!createResponse.ok) {
        throw new Error(createData?.error || "Failed to create task.");
      }

      onTodoCreated(createData);
      setPrompt("");
      setStatus("Task created.");
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