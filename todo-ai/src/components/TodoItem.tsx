import React, { useEffect, useState } from "react";

interface TodoItemProps {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string | null;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: { title?: string; due_date?: string | null }) => void;
}

export default function TodoItem({
  id,
  title,
  completed,
  dueDate,
  onToggle,
  onDelete,
  onUpdate,
}: TodoItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftDueDate, setDraftDueDate] = useState(dueDate ?? "");

  useEffect(() => {
    setDraftTitle(title);
    setDraftDueDate(dueDate ?? "");
  }, [title, dueDate]);

  const handleSave = () => {
    const trimmedTitle = draftTitle.trim();

    if (!trimmedTitle) {
      return;
    }

    onUpdate(id, {
      title: trimmedTitle,
      due_date: draftDueDate || null,
    });
    setIsEditing(false);
  };

  return (
    <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 transition-colors hover:bg-gray-100">
      <input
        type="checkbox"
        checked={completed}
        onChange={() => onToggle(id)}
        className="h-5 w-5 cursor-pointer text-primary-600"
      />

      {isEditing ? (
        <div className="flex flex-1 flex-col gap-2">
          <input
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-black"
          />
          <input
            type="date"
            value={draftDueDate}
            onChange={(e) => setDraftDueDate(e.target.value)}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-black"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftTitle(title);
                setDraftDueDate(dueDate ?? "");
                setIsEditing(false);
              }}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1">
            <p className={`${completed ? "text-gray-500 line-through" : "text-gray-800"}`}>
              {title}
            </p>
            {dueDate && <p className="text-xs text-gray-500">Due: {dueDate}</p>}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(id)}
              className="text-xl font-bold text-red-600 transition-colors hover:text-red-700"
              aria-label={`Delete ${title}`}
            >
              ×
            </button>
          </div>
        </>
      )}
    </div>
  );
}
