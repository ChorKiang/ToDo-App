import { NextRequest, NextResponse } from 'next/server';
import { tagDB, todoDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const todoId = Number(id);

  const todo = todoDB.getById(session.userId, todoId);
  if (!todo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { tagIds } = await request.json();
  tagDB.setForTodo(session.userId, todoId, tagIds ?? []);
  const tags = tagDB.getForTodo(session.userId, todoId);
  return NextResponse.json({ tags });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const todoId = Number(id);

  const todo = todoDB.getById(session.userId, todoId);
  if (!todo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { tagId } = await request.json();
  tagDB.removeFromTodo(session.userId, todoId, tagId);
  const tags = tagDB.getForTodo(session.userId, todoId);
  return NextResponse.json({ tags });
}
