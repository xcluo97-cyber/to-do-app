"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  due_date: string | null;
}

interface CalendarDay {
  date: number | null;
  isCurrentMonth: boolean;
  isToday: boolean;
  fullDate: Date | null;
}

export default function Calendar() {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [todos, setTodos] = useState<Todo[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoaded) {
      return;
    }

    if (!isSignedIn) {
      setTodos([]);
      return;
    }

    const fetchTodos = async () => {
      try {
        const response = await fetch("/api/todos");
        if (response.ok) {
          const data = await response.json();
          setTodos(data);
        } else if (response.status === 401) {
          setTodos([]);
        }
      } catch (error) {
        console.error("Failed to fetch todos for calendar:", error);
      }
    };

    fetchTodos();
  }, [isAuthLoaded, isSignedIn]);

  const getDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const formatDueDate = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const getTasksForDate = (date: Date): Todo[] => {
    const dateString = getDateKey(date);
    return todos.filter((todo) => todo.due_date === dateString && !todo.completed);
  };

  const getCalendarDays = (): CalendarDay[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOfMonth = getFirstDayOfMonth(year, month);
    const daysInPrevMonth = getDaysInMonth(year, month - 1);

    const days: CalendarDay[] = [];
    const today = new Date();

    // Previous month's days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      days.push({
        date: daysInPrevMonth - i,
        isCurrentMonth: false,
        isToday: false,
        fullDate: null,
      });
    }

    // Current month's days
    for (let i = 1; i <= daysInMonth; i++) {
      const fullDate = new Date(year, month, i);
      days.push({
        date: i,
        isCurrentMonth: true,
        isToday:
          i === today.getDate() &&
          month === today.getMonth() &&
          year === today.getFullYear(),
        fullDate,
      });
    }

    // Next month's days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: i,
        isCurrentMonth: false,
        isToday: false,
        fullDate: null,
      });
    }

    return days;
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const days = getCalendarDays();
  const monthYear = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="w-full max-w-4xl bg-white rounded-lg shadow-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={goToPreviousMonth}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          ← Previous
        </button>
        <h2 className="text-2xl font-bold text-gray-800">
          {monthYear}
        </h2>
        <button
          onClick={goToNextMonth}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          Next →
        </button>
      </div>

      {/* Today Button */}
      <div className="flex justify-center mb-6">
        <button
          onClick={goToToday}
          className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
        >
          Today
        </button>
      </div>

      {/* Week Days Header */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center font-bold text-gray-600 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-2 mb-6">
        {days.map((day, index) => {
          const tasksForDay = day.fullDate ? getTasksForDate(day.fullDate) : [];
          return (
            <div
              key={index}
              className={`min-h-24 p-2 rounded-lg border-2 transition-colors cursor-pointer ${
                day.isToday
                  ? "bg-primary-50 border-primary-600"
                  : day.isCurrentMonth
                    ? "bg-gray-50 border-gray-200 hover:bg-gray-100"
                    : "bg-gray-50 border-gray-100 text-gray-400"
              }`}
              onClick={() => {
                if (day.fullDate) {
                  setSelectedDate(getDateKey(day.fullDate));
                }
              }}
            >
              <div className="font-bold text-gray-800 mb-1">
                {day.date}
              </div>
              {tasksForDay.length > 0 && (
                <div className="space-y-1">
                  {tasksForDay.slice(0, 2).map((task) => (
                    <div
                      key={task.id}
                      className="bg-black text-white rounded px-2 py-1"
                    >
                      <p className="text-xs truncate">{task.title}</p>
                      {task.due_date && (
                        <p className="text-[10px] leading-tight opacity-90">
                          {formatDueDate(task.due_date)}
                        </p>
                      )}
                    </div>
                  ))}
                  {tasksForDay.length > 2 && (
                    <div className="text-xs text-primary-600 font-semibold">
                      +{tasksForDay.length - 2} more
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Task Details for Selected Date */}
      {selectedDate && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-bold text-gray-800 mb-3">
            Tasks for {new Date(selectedDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </h3>
          <div className="space-y-2">
            {todos
              .filter((todo) => todo.due_date === selectedDate && !todo.completed)
              .map((task) => (
                <div
                  key={task.id}
                  className="p-2 bg-white rounded border-l-4 border-primary-500 text-gray-800"
                >
                  <p>{task.title}</p>
                  {task.due_date && (
                    <p className="text-xs text-gray-500">Due: {task.due_date}</p>
                  )}
                </div>
              ))}
            {todos.filter((todo) => todo.due_date === selectedDate && !todo.completed).length === 0 && (
              <p className="text-gray-500">No tasks for this date</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
