import React from "react";
import TodoItem from "./TodoItem";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  due_date?: string | null;
}

interface TodoListProps {
  todos: Todo[];
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
}

export default function TodoList({
  todos,
  onToggleTodo,
  onDeleteTodo,
}: TodoListProps) {
  return (
    <div className="space-y-2">
      {todos.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">
          No tasks yet. Add one to get started!
        </p>
      ) : (
        todos.map((todo) => (
          <TodoItem
            key={todo.id}
            id={todo.id}
            title={todo.title}
            completed={todo.completed}
            dueDate={todo.due_date}
            onToggle={onToggleTodo}
            onDelete={onDeleteTodo}
          />
        ))
      )}
    </div>
  );
}
