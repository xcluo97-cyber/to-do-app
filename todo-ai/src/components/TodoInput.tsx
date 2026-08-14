import React from "react";

interface TodoInputProps {
  input: string;
  onInputChange: (value: string) => void;
  dueDate: string;
  onDueDateChange: (value: string) => void;
  onAddTodo: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
}

export default function TodoInput({
  input,
  onInputChange,
  dueDate,
  onDueDateChange,
  onAddTodo,
  onKeyPress,
}: TodoInputProps) {
  return (
    <div className="mb-6 space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyPress={onKeyPress}
          placeholder="Add a new task..."
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-slate-700 dark:text-white"
        />
        <button
          onClick={onAddTodo}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          Add
        </button>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Due Date (optional)
        </label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => onDueDateChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-slate-700 dark:text-white"
        />
      </div>
    </div>
  );
}
