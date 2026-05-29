import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import type { Holiday } from '@/lib/db';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const month = request.nextUrl.searchParams.get('month');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Invalid month format (expected YYYY-MM)' }, { status: 400 });
  }

  const rows = db.prepare(
    "SELECT * FROM holidays WHERE date LIKE ? ORDER BY date"
  ).all(`${month}-%`) as unknown as Holiday[];

  return NextResponse.json({ holidays: rows });
}
export const dynamic = 'force-dynamic';
