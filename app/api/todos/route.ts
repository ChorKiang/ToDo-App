import { NextRequest, NextResponse } from 'next/server';
import { todoDB } from '@/lib/db';
import type { Priority, RecurrencePattern } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getSingaporeNow } from '@/lib/timezone';

const VALID_PRIORITIES: Priority[] = ['high', 'medium', 'low'];
const VALID_PATTERNS: RecurrencePattern[] = ['daily', 'weekly', 'monthly', 'yearly'];
const VALID_REMINDERS = [15, 30, 60, 120, 1440, 2880, 10080];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const todos = todoDB.getAll(session.userId);
  return NextResponse.json(todos);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json();
  const { title, description, due_date, priority, is_recurring, recurrence_pattern, reminder_minutes } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }
  if (title.trim().length > 500) {
    return NextResponse.json({ error: 'Title too long (max 500 chars)' }, { status: 400 });
  }

  if (due_date) {
    const now = getSingaporeNow();
    const due = new Date(due_date);
    if (due.getTime() <= now.getTime() + 60_000) {
      return NextResponse.json({ error: 'Due date must be at least 1 minute in the future' }, { status: 400 });
    }
  }

  if (priority && !VALID_PRIORITIES.includes(priority)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
  }

  if (is_recurring) {
    if (!due_date) return NextResponse.json({ error: 'Recurring todos require a due date' }, { status: 400 });
    if (!recurrence_pattern || !VALID_PATTERNS.includes(recurrence_pattern)) {
      return NextResponse.json({ error: 'Invalid recurrence pattern' }, { status: 400 });
    }
  }

  if (reminder_minutes !== null && reminder_minutes !== undefined) {
    if (!VALID_REMINDERS.includes(reminder_minutes)) {
      return NextResponse.json({ error: 'Invalid reminder_minutes value' }, { status: 400 });
    }
    if (!due_date) {
      return NextResponse.json({ error: 'Reminder requires a due date' }, { status: 400 });
    }
  }

  const todo = todoDB.create(session.userId, {
    title,
    description: description || null,
    due_date: due_date || null,
    priority: priority || 'medium',
    is_recurring: !!is_recurring,
    recurrence_pattern: recurrence_pattern || null,
    reminder_minutes: reminder_minutes ?? null,
  });

  return NextResponse.json(todo, { status: 201 });
}
export const dynamic = 'force-dynamic';
