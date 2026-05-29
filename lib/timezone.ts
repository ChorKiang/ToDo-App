const SINGAPORE_TZ = 'Asia/Singapore';

export function getSingaporeNow(): Date {
  const now = new Date();
  // Return a Date that represents "now" — Date objects are always UTC internally,
  // but we expose Singapore-formatted strings via toSingaporeString helpers.
  return now;
}

export function formatSingaporeDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-SG', { timeZone: SINGAPORE_TZ });
}

export function toSingaporeDateString(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-CA', { timeZone: SINGAPORE_TZ }); // YYYY-MM-DD
}

export function calculateNextDueDate(currentDueDate: string, pattern: string): string {
  const date = new Date(currentDueDate);
  switch (pattern) {
    case 'daily':   date.setDate(date.getDate() + 1); break;
    case 'weekly':  date.setDate(date.getDate() + 7); break;
    case 'monthly': date.setMonth(date.getMonth() + 1); break;
    case 'yearly':  date.setFullYear(date.getFullYear() + 1); break;
  }
  return date.toISOString();
}
