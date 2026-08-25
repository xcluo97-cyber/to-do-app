import React from "react";

interface TodoItemProps {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string | null;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function TodoItem({
  id,
  title,
  completed,
  dueDate,
  onToggle,
  onDelete,
}: TodoItemProps) {
  return (
    <div
      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
    >
      <input
        type="checkbox"
        checked={completed}
        onChange={() => onToggle(id)}
        className="w-5 h-5 text-primary-600 cursor-pointer"
      />
      <div className="flex-1">
        <p
          className={`${
            completed
              ? "line-through text-gray-500"
              : "text-gray-800"
          }`}
        >
          {title}
        </p>
        {dueDate && (
          <p className="text-xs text-gray-500">
            Due: {dueDate}
          </p>
        )}
      </div>
      <button
        onClick={() => onDelete(id)}
        className="text-red-600 hover:text-red-700 font-bold transition-colors"
      >
        ×
      </button>
    </div>
  );
}
