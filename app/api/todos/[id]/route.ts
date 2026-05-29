import { NextRequest, NextResponse } from 'next/server';
import { todoDB, tagDB, subtaskDB } from '@/lib/db';
import type { Priority, RecurrencePattern } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { calculateNextDueDate } from '@/lib/timezone';

const VALID_PRIORITIES: Priority[] = ['high', 'medium', 'low'];
const VALID_PATTERNS: RecurrencePattern[] = ['daily', 'weekly', 'monthly', 'yearly'];
const VALID_REMINDERS = [15, 30, 60, 120, 1440, 2880, 10080];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const todo = todoDB.getById(session.userId, Number(id));
  if (!todo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(todo);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const todoId = Number(id);

  const existing = todoDB.getById(session.userId, todoId);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const { title, description, completed, due_date, priority, is_recurring, recurrence_pattern, reminder_minutes } = body;

  if (title !== undefined && !title?.trim()) {
    return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
  }

  if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
  }

  if (reminder_minutes !== null && reminder_minutes !== undefined) {
    if (!VALID_REMINDERS.includes(reminder_minutes)) {
      return NextResponse.json({ error: 'Invalid reminder_minutes value' }, { status: 400 });
    }
  }

  const updated = todoDB.update(session.userId, todoId, {
    title, description, completed, due_date,
    priority, is_recurring, recurrence_pattern,
    reminder_minutes: reminder_minutes !== undefined ? reminder_minutes : undefined,
  });

  // Handle recurring: create next instance when completing
  if (completed && existing.is_recurring && existing.recurrence_pattern && existing.due_date) {
    const nextDueDate = calculateNextDueDate(existing.due_date, existing.recurrence_pattern);
    const currentTags = tagDB.getForTodo(session.userId, todoId);

    const nextTodo = todoDB.create(session.userId, {
      title: existing.title,
      description: existing.description,
      priority: existing.priority,
      due_date: nextDueDate,
      is_recurring: true,
      recurrence_pattern: existing.recurrence_pattern,
      reminder_minutes: existing.reminder_minutes ?? null,
    });

    for (const tag of currentTags) {
      tagDB.addToTodo(session.userId, nextTodo.id, tag.id);
    }

    // Copy subtasks
    for (const subtask of existing.subtasks) {
      subtaskDB.create(nextTodo.id, session.userId, { title: subtask.title });
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const deleted = todoDB.delete(session.userId, Number(id));
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
