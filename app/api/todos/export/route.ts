import { NextResponse } from 'next/server';
import { todoDB, tagDB } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getSingaporeNow } from '@/lib/timezone';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const todos = todoDB.getAll(session.userId);
  const tags = tagDB.getAll(session.userId);

  const exportData = {
    version: '1.0',
    exported_at: getSingaporeNow().toISOString(),
    tags: tags.map(t => ({ id: t.id, name: t.name, color: t.color })),
    todos: todos.map(todo => ({
      id: todo.id,
      title: todo.title,
      description: todo.description ?? null,
      completed: todo.completed,
      due_date: todo.due_date ?? null,
      priority: todo.priority,
      is_recurring: todo.is_recurring,
      recurrence_pattern: todo.recurrence_pattern ?? null,
      reminder_minutes: todo.reminder_minutes ?? null,
      created_at: todo.created_at,
      subtasks: todo.subtasks.map(s => ({ title: s.title, completed: s.completed, position: s.position })),
      tag_ids: todo.tags.map(t => t.id),
    })),
  };

  return NextResponse.json(exportData);
}
export const dynamic = 'force-dynamic';
