import { NextRequest, NextResponse } from 'next/server';
import { subtaskDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const { title } = await request.json();

  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });
  if (title.trim().length > 500) return NextResponse.json({ error: 'Title too long' }, { status: 400 });

  try {
    const subtask = subtaskDB.create(Number(id), session.userId, { title });
    return NextResponse.json(subtask, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }
}
