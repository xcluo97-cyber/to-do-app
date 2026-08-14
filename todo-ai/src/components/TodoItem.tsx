import React from "react";

interface TodoItemProps {
  id: number;
  text: string;
  completed: boolean;
  dueDate: string | null;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}

export default function TodoItem({
  id,
  text,
  completed,
  dueDate,
  onToggle,
  onDelete,
}: TodoItemProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday =
      date.toDateString() === today.toDateString();
    const isTomorrow =
      date.toDateString() === tomorrow.toDateString();
    const isPast = date < today && !isToday;

    if (isToday) return "Today";
    if (isTomorrow) return "Tomorrow";
    if (isPast) return `Overdue: ${date.toLocaleDateString()}`;
    return date.toLocaleDateString();
  };

  const isOverdue = dueDate && new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString();

  return (
    <div
      className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
    >
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={completed}
          onChange={() => onToggle(id)}
          className="w-5 h-5 text-primary-600 cursor-pointer"
        />
        <span
          className={`flex-1 ${
            completed
              ? "line-through text-gray-500 dark:text-gray-400"
              : "text-gray-800 dark:text-white"
          }`}
        >
          {text}
        </span>
        <button
          onClick={() => onDelete(id)}
          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-bold transition-colors"
        >
          ×
        </button>
      </div>
      {dueDate && (
        <div className={`text-xs ml-8 ${
          isOverdue
            ? "text-red-600 dark:text-red-400 font-semibold"
            : "text-gray-500 dark:text-gray-400"
        }`}>
          📅 {formatDate(dueDate)}
        </div>
      )}
    </div>
  );
}
