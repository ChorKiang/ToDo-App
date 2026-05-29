'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

type Priority = 'high' | 'medium' | 'low';
interface Todo {
  id: number; title: string; completed: boolean; due_date?: string | null;
  priority: Priority; tags: { id: number; name: string; color: string }[];
}
interface Holiday { id: number; date: string; name: string; }
interface CalendarDay {
  date: Date; dateStr: string; isCurrentMonth: boolean; isToday: boolean;
  isWeekend: boolean; todos: Todo[]; holidays: Holiday[];
}

const PRIORITY_STYLES: Record<Priority, string> = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
};

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    acc[k] = acc[k] ?? [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

function generateCalendar(year: number, month: number, todos: Todo[], holidays: Holiday[]): CalendarDay[][] {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const todosByDate = groupBy(todos.filter(t => t.due_date), t => t.due_date!.slice(0, 10));
  const holidaysByDate = groupBy(holidays, h => h.date);

  const today = new Date().toISOString().slice(0, 10);
  const weeks: CalendarDay[][] = [];
  let week: CalendarDay[] = [];

  const start = new Date(firstDay);
  start.setDate(start.getDate() - start.getDay());

  const end = new Date(lastDay);
  end.setDate(end.getDate() + (6 - end.getDay()));

  const cursor = new Date(start);
  while (cursor <= end) {
    const dateStr = cursor.toISOString().slice(0, 10);
    week.push({
      date: new Date(cursor),
      dateStr,
      isCurrentMonth: cursor.getMonth() === month - 1,
      isToday: dateStr === today,
      isWeekend: cursor.getDay() === 0 || cursor.getDay() === 6,
      todos: todosByDate[dateStr] ?? [],
      holidays: holidaysByDate[dateStr] ?? [],
    });
    if (week.length === 7) { weeks.push(week); week = []; }
    cursor.setDate(cursor.getDate() + 1);
  }
  return weeks;
}

function CalendarContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const now = new Date();
  const monthParam = searchParams.get('month');
  const [year, month] = monthParam
    ? monthParam.split('-').map(Number)
    : [now.getFullYear(), now.getMonth() + 1];

  const [todos, setTodos] = useState<Todo[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const [todosRes, holidaysRes] = await Promise.all([
      fetch('/api/todos'),
      fetch(`/api/holidays?month=${monthStr}`),
    ]);
    if (todosRes.ok) setTodos(await todosRes.json());
    if (holidaysRes.ok) {
      const data = await holidaysRes.json();
      setHolidays(data.holidays ?? []);
    }
    setLoading(false);
  }, [year, month]);

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (!r.ok) router.push('/login');
      else fetchData();
    }).catch(() => router.push('/login'));
  }, [router, fetchData]);

  function navigateMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    router.push(`/calendar?month=${y}-${m}`);
  }

  function goToToday() {
    const n = new Date();
    router.push(`/calendar?month=${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`);
  }

  const weeks = generateCalendar(year, month, todos, holidays);
  const monthName = new Date(year, month - 1, 1).toLocaleString('en-SG', { month: 'long', year: 'numeric' });
  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <a href="/" className="text-sm text-blue-600 hover:underline dark:text-blue-400">← Back</a>
            <h1 className="text-xl font-bold">📅 Calendar</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigateMonth(-1)} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">← Prev</button>
            <span className="text-sm font-semibold min-w-36 text-center">{monthName}</span>
            <button onClick={() => navigateMonth(1)} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">Next →</button>
            <button onClick={goToToday} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Today</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading…</div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
              {dayHeaders.map((day, i) => (
                <div
                  key={day}
                  className={`py-2 text-center text-xs font-semibold uppercase tracking-wide ${i === 0 || i === 6 ? 'text-blue-500 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7">
                {week.map(day => (
                  <div
                    key={day.dateStr}
                    onClick={() => setSelectedDay(day)}
                    className={[
                      'min-h-20 p-1.5 border-b border-r border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                      !day.isCurrentMonth && 'bg-gray-50 dark:bg-gray-800/50',
                      day.isWeekend && day.isCurrentMonth && 'bg-blue-50/40 dark:bg-blue-900/10',
                      day.isToday && 'ring-2 ring-inset ring-blue-500',
                    ].filter(Boolean).join(' ')}
                  >
                    <span className={[
                      'text-sm font-medium inline-flex items-center justify-center w-7 h-7 rounded-full',
                      day.isToday ? 'bg-blue-500 text-white' : !day.isCurrentMonth ? 'text-gray-400 dark:text-gray-600' : 'text-gray-700 dark:text-gray-300',
                    ].join(' ')}>
                      {day.date.getDate()}
                    </span>

                    {day.holidays.map(h => (
                      <p key={h.id} className="text-xs text-red-600 dark:text-red-400 truncate leading-tight mt-0.5">{h.name}</p>
                    ))}

                    {day.todos.length > 0 && (
                      <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full mt-0.5">
                        {day.todos.length}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Day detail modal */}
      {selectedDay && (
        <div className="modal-overlay" onClick={() => setSelectedDay(null)}>
          <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                {selectedDay.date.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </h2>
              <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            {selectedDay.holidays.map(h => (
              <p key={h.id} className="text-sm text-red-600 dark:text-red-400 mb-1">🎌 {h.name}</p>
            ))}

            {selectedDay.todos.length === 0 && selectedDay.holidays.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No todos or holidays on this day.</p>
            )}

            <div className="space-y-2 mt-2">
              {selectedDay.todos.map(todo => (
                <div key={todo.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                  <input type="checkbox" checked={todo.completed} readOnly className="accent-blue-600" />
                  <span className={`text-sm flex-1 ${todo.completed ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>
                    {todo.title}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${PRIORITY_STYLES[todo.priority]}`}>
                    {todo.priority}
                  </span>
                </div>
              ))}
            </div>

            <button onClick={() => setSelectedDay(null)} className="mt-4 w-full text-sm text-center text-gray-500 hover:underline">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
      <CalendarContent />
    </Suspense>
  );
}
