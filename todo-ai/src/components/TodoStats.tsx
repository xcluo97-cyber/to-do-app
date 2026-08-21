import React from "react";

interface TodoStatsProps {
  completedCount: number;
  totalCount: number;
}

export default function TodoStats({
  completedCount,
  totalCount,
}: TodoStatsProps) {
  return (
    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-600 text-sm text-gray-600 dark:text-gray-400 space-y-1">
      <p>Total tasks: {totalCount}</p>
      <p>Completed: {completedCount}</p>
      <p>Remaining: {totalCount - completedCount}</p>
    </div>
  );
}
