import Calendar from "@/src/components/Calendar";
import Link from "next/link";

export default function CalendarPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-slate-900 dark:to-slate-800 py-8 px-4">
      <main className="flex flex-col items-center gap-6 w-full">
        <Link
          href="/"
          className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
        >
          ← Back to To-Do
        </Link>
        <Calendar />
      </main>
    </div>
  );
}
