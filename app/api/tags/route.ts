import { NextRequest, NextResponse } from 'next/server';
import { tagDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  return NextResponse.json(tagDB.getAll(session.userId));
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { name, color } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Tag name required' }, { status: 400 });
  if (name.trim().length > 50) return NextResponse.json({ error: 'Tag name too long (max 50)' }, { status: 400 });

  // Check uniqueness
  const existing = tagDB.getByName(session.userId, name.trim());
  if (existing) return NextResponse.json({ error: 'Tag name already exists' }, { status: 409 });

  const tag = tagDB.create(session.userId, { name, color });
  return NextResponse.json(tag, { status: 201 });
}
export const dynamic = 'force-dynamic';
