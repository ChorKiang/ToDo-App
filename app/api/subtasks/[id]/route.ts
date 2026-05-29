import { NextRequest, NextResponse } from 'next/server';
import { subtaskDB } from '@/lib/db';
import { getSession } from '@/lib/auth';
import db from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const subtaskId = Number(id);

  // Find the todo_id for this subtask
  const row = db.prepare('SELECT todo_id FROM subtasks WHERE id = ?').get(subtaskId) as { todo_id: number } | undefined;
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const updated = subtaskDB.update(subtaskId, row.todo_id, session.userId, body);
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const subtaskId = Number(id);

  const row = db.prepare('SELECT todo_id FROM subtasks WHERE id = ?').get(subtaskId) as { todo_id: number } | undefined;
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const deleted = subtaskDB.delete(subtaskId, row.todo_id, session.userId);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
