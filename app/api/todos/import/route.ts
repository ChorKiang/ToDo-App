import { NextRequest, NextResponse } from 'next/server';
import { todoDB, tagDB, subtaskDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json();

  if (!body || body.version !== '1.0' || !Array.isArray(body.todos) || !Array.isArray(body.tags)) {
    return NextResponse.json({ error: 'Invalid export format' }, { status: 400 });
  }

  // Remap tags
  const tagIdMap: Record<number, number> = {};
  for (const exportedTag of body.tags) {
    if (!exportedTag.name?.trim()) continue;
    const existing = tagDB.getByName(session.userId, exportedTag.name);
    if (existing) {
      tagIdMap[exportedTag.id] = existing.id;
    } else {
      const newTag = tagDB.create(session.userId, { name: exportedTag.name, color: exportedTag.color ?? '#3B82F6' });
      tagIdMap[exportedTag.id] = newTag.id;
    }
  }

  let importedTodoCount = 0;
  for (const exportedTodo of body.todos) {
    if (!exportedTodo.title?.trim()) continue;

    const todo = todoDB.create(session.userId, {
      title: exportedTodo.title,
      description: exportedTodo.description,
      due_date: exportedTodo.due_date,
      priority: exportedTodo.priority ?? 'medium',
      is_recurring: exportedTodo.is_recurring ?? false,
      recurrence_pattern: exportedTodo.recurrence_pattern,
      reminder_minutes: exportedTodo.reminder_minutes,
    });

    if (exportedTodo.completed) {
      todoDB.update(session.userId, todo.id, { completed: true });
    }

    for (const sub of exportedTodo.subtasks ?? []) {
      if (sub.title?.trim()) {
        const s = subtaskDB.create(todo.id, session.userId, { title: sub.title });
        if (sub.completed) {
          subtaskDB.update(s.id, todo.id, session.userId, { completed: true });
        }
      }
    }

    for (const oldTagId of exportedTodo.tag_ids ?? []) {
      const newTagId = tagIdMap[oldTagId];
      if (newTagId) tagDB.addToTodo(session.userId, todo.id, newTagId);
    }

    importedTodoCount++;
  }

  return NextResponse.json({ imported: { todos: importedTodoCount, tags: Object.keys(tagIdMap).length } });
}
export const dynamic = 'force-dynamic';
