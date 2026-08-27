"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { TodoInput, TodoList, TodoStats, TodoChatBox } from "@/src/components";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  due_date?: string | null;
}

export default function Home() {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchTodos = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/todos");
      if (response.ok) {
        const data = await response.json();
        setTodos(data);
      } else if (response.status === 401) {
        setTodos([]);
      }
    } catch (error) {
      console.error("Failed to fetch todos:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthLoaded) {
      return;
    }

    if (isSignedIn) {
      fetchTodos();
    } else {
      setTodos([]);
      setIsLoading(false);
    }
  }, [isAuthLoaded, isSignedIn, fetchTodos]);

  const addTodo = async () => {
    if (input.trim()) {
      try {
        const response = await fetch("/api/todos", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: input,
            due_date: dueDate || null,
          }),
        });

        if (response.ok) {
          const newTodo = await response.json();
          setTodos([newTodo, ...todos]);
          setInput("");
          setDueDate("");
        }
      } catch (error) {
        console.error("Failed to add todo:", error);
      }
    }
  };

  const toggleTodo = async (id: string) => {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;

    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ completed: !todo.completed }),
      });

      if (response.ok) {
        const updatedTodo = await response.json();
        setTodos(todos.map((t) => (t.id === id ? updatedTodo : t)));
      }
    } catch (error) {
      console.error("Failed to toggle todo:", error);
    }
  };

  const updateTodo = async (
    id: string,
    updates: { title?: string; due_date?: string | null }
  ) => {
    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const updatedTodo = await response.json();
        setTodos((prev) => prev.map((todo) => (todo.id === id ? updatedTodo : todo)));
      }
    } catch (error) {
      console.error("Failed to update todo:", error);
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setTodos(todos.filter((todo) => todo.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete todo:", error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      addTodo();
    }
  };

  const completedCount = todos.filter((todo) => todo.completed).length;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#f0fdf4] to-[#dcfce7] py-8 px-4">
      <main className="w-full max-w-md bg-white rounded-lg shadow-xl p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-bold text-gray-800">My To-Do List</h1>

          <div className="flex items-center gap-2">
            <Link
              href="/calendar"
              className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
            >
              📅 Calendar
            </Link>
          </div>
        </div>

        <p className="mb-6 text-center text-sm text-gray-600">
          {completedCount} of {todos.length} completed
        </p>

        <TodoInput
          input={input}
          onInputChange={setInput}
          dueDate={dueDate}
          onDueDateChange={setDueDate}
          onAddTodo={addTodo}
          onKeyPress={handleKeyPress}
        />

        <TodoList
          todos={todos}
          onToggleTodo={toggleTodo}
          onDeleteTodo={deleteTodo}
          onUpdateTodo={updateTodo}
        />

        <TodoChatBox
          onTodoCreated={(todo) => {
            setTodos((prev) => [todo, ...prev]);
          }}
          onTodoUpdated={(todo) => {
            setTodos((prev) => prev.map((item) => (item.id === todo.id ? todo : item)));
          }}
          onTodoDeleted={(id) => {
            setTodos((prev) => prev.filter((todo) => todo.id !== id));
          }}
        />

        {todos.length > 0 && (
          <TodoStats completedCount={completedCount} totalCount={todos.length} />
        )}
      </main>
    </div>
  );
}
