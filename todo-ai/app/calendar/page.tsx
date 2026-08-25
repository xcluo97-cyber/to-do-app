import Calendar from "@/src/components/Calendar";
import Link from "next/link";

export default function CalendarPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#f0fdf4] to-[#dcfce7] py-8 px-4">
      <main className="flex flex-col items-center gap-6 w-full">
        <Link
          href="/"
          className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
        >
          ← Back to To-Do
        </Link>
        <Calendar />
      </main>
    </div>
  );
}
