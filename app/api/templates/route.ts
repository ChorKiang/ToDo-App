import { NextRequest, NextResponse } from 'next/server';
import { templateDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  return NextResponse.json(templateDB.getAll(session.userId));
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json();
  if (!body.name?.trim()) return NextResponse.json({ error: 'Template name required' }, { status: 400 });
  if (!body.title?.trim()) return NextResponse.json({ error: 'Template title required' }, { status: 400 });

  const template = templateDB.create(session.userId, {
    name: body.name,
    description: body.description,
    category: body.category,
    title: body.title,
    notes: body.notes,
    priority: body.priority || 'medium',
    is_recurring: !!body.is_recurring,
    recurrence_pattern: body.recurrence_pattern || null,
    reminder_minutes: body.reminder_minutes ?? null,
    due_date_offset_days: body.due_date_offset_days ?? null,
    subtasks: body.subtasks ?? [],
  });

  return NextResponse.json(template, { status: 201 });
}
export const dynamic = 'force-dynamic';
