"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TodoInput, TodoList, TodoStats } from "@/src/components";

interface Todo {
  id: number;
  text: string;
  completed: boolean;
  dueDate: string | null;
}

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load todos from localStorage on mount
  useEffect(() => {
    const savedTodos = localStorage.getItem("todos");
    if (savedTodos) {
      setTodos(JSON.parse(savedTodos));
    }
    setIsLoaded(true);
  }, []);

  // Save todos to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("todos", JSON.stringify(todos));
    }
  }, [todos, isLoaded]);

  const addTodo = () => {
    if (input.trim()) {
      const newTodo: Todo = {
        id: Date.now(),
        text: input,
        completed: false,
        dueDate: dueDate || null,
      };
      setTodos([...todos, newTodo]);
      setInput("");
      setDueDate("");
    }
  };

  const toggleTodo = (id: number) => {
    setTodos(
      todos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const deleteTodo = (id: number) => {
    setTodos(todos.filter((todo) => todo.id !== id));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      addTodo();
    }
  };

  const completedCount = todos.filter((todo) => todo.completed).length;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#f0fdf4] to-[#dcfce7] dark:from-slate-900 dark:to-slate-800 py-8 px-4">
      <main className="w-full max-w-md bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            My To-Do List
          </h1>
          <Link
            href="/calendar"
            className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm"
          >
            📅 Calendar
          </Link>
        </div>
        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-6">
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
        />

        {todos.length > 0 && (
          <TodoStats completedCount={completedCount} totalCount={todos.length} />
        )}
      </main>
    </div>
  );
}
