import { NextResponse } from 'next/server';
import { notificationDB } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getSingaporeNow } from '@/lib/timezone';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const now = getSingaporeNow();
  const todos = notificationDB.getTodosNeedingNotification(session.userId, now.toISOString());

  for (const todo of todos) {
    notificationDB.markNotificationSent(todo.id, now.toISOString());
  }

  return NextResponse.json({ todos });
}
export const dynamic = 'force-dynamic';
