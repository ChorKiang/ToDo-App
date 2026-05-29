import { NextRequest, NextResponse } from 'next/server';
import { templateDB, todoDB, subtaskDB } from '@/lib/db';
import type { TemplateSubtask } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getSingaporeNow } from '@/lib/timezone';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;

  const template = templateDB.getById(session.userId, Number(id));
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let due_date: string | undefined;
  if (template.due_date_offset_days != null) {
    const date = getSingaporeNow();
    date.setDate(date.getDate() + template.due_date_offset_days);
    due_date = date.toISOString();
  }

  const todo = todoDB.create(session.userId, {
    title: template.title,
    description: template.notes,
    priority: template.priority,
    due_date: due_date || null,
    is_recurring: template.is_recurring,
    recurrence_pattern: template.recurrence_pattern,
    reminder_minutes: template.reminder_minutes,
  });

  const subtasks: TemplateSubtask[] = JSON.parse(template.subtasks_json ?? '[]');
  for (const s of subtasks) {
    subtaskDB.create(todo.id, session.userId, { title: s.title });
  }

  return NextResponse.json(todo, { status: 201 });
}
