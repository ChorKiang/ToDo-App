import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'todos.db')
  : path.join(process.cwd(), 'todos.db');

const db = new DatabaseSync(dbPath, { timeout: 5000 });

// Enable WAL mode and foreign keys
db.exec('PRAGMA journal_mode=WAL;');
db.exec('PRAGMA foreign_keys=ON;');
db.exec('PRAGMA busy_timeout=5000;');

// ---- Schema Setup ----
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS authenticators (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id         TEXT NOT NULL UNIQUE,
  credential_public_key TEXT NOT NULL,
  counter               INTEGER NOT NULL DEFAULT 0,
  transports            TEXT,
  created_at            TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_authenticators_user_id ON authenticators(user_id);
CREATE INDEX IF NOT EXISTS idx_authenticators_credential_id ON authenticators(credential_id);

CREATE TABLE IF NOT EXISTS todos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  completed   INTEGER NOT NULL DEFAULT 0,
  due_date    TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);

CREATE TABLE IF NOT EXISTS subtasks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  todo_id    INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  completed  INTEGER NOT NULL DEFAULT 0,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id ON subtasks(todo_id);

CREATE TABLE IF NOT EXISTS tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TEXT NOT NULL,
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS todo_tags (
  todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (todo_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_tags_todo_id ON todo_tags(todo_id);
CREATE INDEX IF NOT EXISTS idx_todo_tags_tag_id  ON todo_tags(tag_id);

CREATE TABLE IF NOT EXISTS templates (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  description          TEXT,
  category             TEXT,
  title                TEXT NOT NULL,
  notes                TEXT,
  priority             TEXT NOT NULL DEFAULT 'medium',
  is_recurring         INTEGER NOT NULL DEFAULT 0,
  recurrence_pattern   TEXT,
  reminder_minutes     INTEGER,
  due_date_offset_days INTEGER,
  subtasks_json        TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);

CREATE TABLE IF NOT EXISTS holidays (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);
`);

// Migration-safe ALTER TABLE additions
const alterColumns = [
  "ALTER TABLE todos ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'",
  'ALTER TABLE todos ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE todos ADD COLUMN recurrence_pattern TEXT',
  'ALTER TABLE todos ADD COLUMN reminder_minutes INTEGER',
  'ALTER TABLE todos ADD COLUMN last_notification_sent TEXT',
];
for (const sql of alterColumns) {
  try { db.exec(sql); } catch { /* column already exists */ }
}

// Seed Singapore holidays if empty
const holidayCount = db.prepare('SELECT COUNT(*) as count FROM holidays').get() as { count: number };
if (holidayCount.count === 0) {
  const insertHoliday = db.prepare('INSERT OR IGNORE INTO holidays (date, name) VALUES (?, ?)');
  const holidays2025 = [
    ['2025-01-01', "New Year's Day"],
    ['2025-01-29', 'Chinese New Year'],
    ['2025-01-30', 'Chinese New Year (Day 2)'],
    ['2025-04-18', 'Good Friday'],
    ['2025-05-01', 'Labour Day'],
    ['2025-05-12', 'Vesak Day'],
    ['2025-06-07', 'Hari Raya Haji'],
    ['2025-08-09', 'National Day'],
    ['2025-10-20', 'Deepavali'],
    ['2025-12-25', 'Christmas Day'],
  ];
  const holidays2026 = [
    ['2026-01-01', "New Year's Day"],
    ['2026-01-28', 'Chinese New Year'],
    ['2026-01-29', 'Chinese New Year (Day 2)'],
    ['2026-04-03', 'Good Friday'],
    ['2026-05-01', 'Labour Day'],
    ['2026-05-31', 'Vesak Day'],
    ['2026-05-27', 'Hari Raya Haji'],
    ['2026-08-09', 'National Day'],
    ['2026-11-08', 'Deepavali'],
    ['2026-12-25', 'Christmas Day'],
  ];
  for (const [date, name] of [...holidays2025, ...holidays2026]) {
    insertHoliday.run(date, name);
  }
}

export default db;

// ---- Types ----
export type Priority = 'high' | 'medium' | 'low';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface User { id: number; username: string; created_at: string; }
export interface Authenticator {
  id: number; user_id: number; credential_id: string;
  credential_public_key: string; counter: number; transports: string | null; created_at: string;
}
export interface Todo {
  id: number; user_id: number; title: string; description?: string | null;
  completed: boolean; due_date?: string | null; created_at: string; updated_at: string;
  priority: Priority; is_recurring: boolean; recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null; last_notification_sent: string | null;
  subtasks: Subtask[]; tags: Tag[];
}
export interface Subtask {
  id: number; todo_id: number; title: string; completed: boolean; position: number; created_at: string;
}
export interface Tag { id: number; user_id: number; name: string; color: string; created_at: string; }
export interface Template {
  id: number; user_id: number; name: string; description?: string | null; category?: string | null;
  title: string; notes?: string | null; priority: Priority; is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null; reminder_minutes: number | null;
  due_date_offset_days: number | null; subtasks_json: string | null; created_at: string; updated_at: string;
}
export interface TemplateSubtask { title: string; position: number; }
export interface Holiday { id: number; date: string; name: string; }

// ---- Helper: convert raw DB row to typed object ----
function toTodo(row: Record<string, unknown>, subtasks: Subtask[], tags: Tag[]): Todo {
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    title: String(row.title),
    description: row.description as string | null,
    completed: Number(row.completed) !== 0,
    due_date: row.due_date as string | null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    priority: (row.priority as Priority) || 'medium',
    is_recurring: Number(row.is_recurring) !== 0,
    recurrence_pattern: (row.recurrence_pattern as RecurrencePattern | null) || null,
    reminder_minutes: row.reminder_minutes !== null && row.reminder_minutes !== undefined ? Number(row.reminder_minutes) : null,
    last_notification_sent: row.last_notification_sent as string | null,
    subtasks,
    tags,
  };
}

function toSubtask(row: Record<string, unknown>): Subtask {
  return {
    id: Number(row.id),
    todo_id: Number(row.todo_id),
    title: String(row.title),
    completed: Number(row.completed) !== 0,
    position: Number(row.position),
    created_at: String(row.created_at),
  };
}

function toTag(row: Record<string, unknown>): Tag {
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    name: String(row.name),
    color: String(row.color),
    created_at: String(row.created_at),
  };
}

// ---- User DB ----
export const userDB = {
  create(username: string): User {
    const now = new Date().toISOString();
    const res = db.prepare('INSERT INTO users (username, created_at) VALUES (?, ?)').run(username, now);
    return { id: Number(res.lastInsertRowid), username, created_at: now };
  },
  getByUsername(username: string): User | null {
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as Record<string, unknown> | undefined;
    if (!row) return null;
    return { id: Number(row.id), username: String(row.username), created_at: String(row.created_at) };
  },
  getById(id: number): User | null {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return { id: Number(row.id), username: String(row.username), created_at: String(row.created_at) };
  },
};

// ---- Authenticator DB ----
export const authenticatorDB = {
  create(userId: number, data: { credential_id: string; credential_public_key: string; counter: number; transports?: string }): Authenticator {
    const now = new Date().toISOString();
    const res = db.prepare(
      'INSERT INTO authenticators (user_id, credential_id, credential_public_key, counter, transports, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, data.credential_id, data.credential_public_key, data.counter ?? 0, data.transports ?? null, now);
    return { id: Number(res.lastInsertRowid), user_id: userId, credential_id: data.credential_id, credential_public_key: data.credential_public_key, counter: data.counter ?? 0, transports: data.transports ?? null, created_at: now };
  },
  getByCredentialId(credentialId: string): Authenticator | null {
    const row = db.prepare('SELECT * FROM authenticators WHERE credential_id = ?').get(credentialId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return { id: Number(row.id), user_id: Number(row.user_id), credential_id: String(row.credential_id), credential_public_key: String(row.credential_public_key), counter: Number(row.counter) ?? 0, transports: row.transports as string | null, created_at: String(row.created_at) };
  },
  getByUserId(userId: number): Authenticator[] {
    const rows = db.prepare('SELECT * FROM authenticators WHERE user_id = ?').all(userId) as Record<string, unknown>[];
    return rows.map(r => ({ id: Number(r.id), user_id: Number(r.user_id), credential_id: String(r.credential_id), credential_public_key: String(r.credential_public_key), counter: Number(r.counter) ?? 0, transports: r.transports as string | null, created_at: String(r.created_at) }));
  },
  updateCounter(id: number, counter: number): void {
    db.prepare('UPDATE authenticators SET counter = ? WHERE id = ?').run(counter, id);
  },
};

// ---- Subtask DB ----
export const subtaskDB = {
  create(todoId: number, userId: number, input: { title: string }): Subtask {
    // verify todo belongs to user
    const todo = db.prepare('SELECT id FROM todos WHERE id = ? AND user_id = ?').get(todoId, userId);
    if (!todo) throw new Error('Todo not found');
    const now = new Date().toISOString();
    const maxPos = db.prepare('SELECT MAX(position) as m FROM subtasks WHERE todo_id = ?').get(todoId) as { m: number | null };
    const position = (maxPos.m ?? -1) + 1;
    const res = db.prepare('INSERT INTO subtasks (todo_id, title, completed, position, created_at) VALUES (?, ?, 0, ?, ?)').run(todoId, input.title.trim(), position, now);
    return { id: Number(res.lastInsertRowid), todo_id: todoId, title: input.title.trim(), completed: false, position, created_at: now };
  },
  getForTodo(todoId: number, userId: number): Subtask[] {
    const rows = db.prepare(
      'SELECT s.* FROM subtasks s JOIN todos t ON t.id = s.todo_id WHERE s.todo_id = ? AND t.user_id = ? ORDER BY s.position, s.id'
    ).all(todoId, userId) as Record<string, unknown>[];
    return rows.map(toSubtask);
  },
  update(id: number, todoId: number, userId: number, input: { title?: string; completed?: boolean }): Subtask | null {
    const row = db.prepare('SELECT s.* FROM subtasks s JOIN todos t ON t.id = s.todo_id WHERE s.id = ? AND s.todo_id = ? AND t.user_id = ?').get(id, todoId, userId) as Record<string, unknown> | undefined;
    if (!row) return null;
    const title = input.title !== undefined ? input.title.trim() : String(row.title);
    const completed = input.completed !== undefined ? (input.completed ? 1 : 0) : Number(row.completed);
    db.prepare('UPDATE subtasks SET title = ?, completed = ? WHERE id = ?').run(title, completed, id);
    return { ...toSubtask(row), title, completed: completed !== 0 };
  },
  delete(id: number, todoId: number, userId: number): boolean {
    const res = db.prepare('DELETE FROM subtasks WHERE id = ? AND todo_id = ? AND todo_id IN (SELECT id FROM todos WHERE user_id = ?)').run(id, todoId, userId);
    return res.changes > 0;
  },
};

// ---- Tag DB ----
export const tagDB = {
  create(userId: number, input: { name: string; color?: string }): Tag {
    const now = new Date().toISOString();
    const res = db.prepare('INSERT INTO tags (user_id, name, color, created_at) VALUES (?, ?, ?, ?)').run(userId, input.name.trim(), input.color || '#3B82F6', now);
    return { id: Number(res.lastInsertRowid), user_id: userId, name: input.name.trim(), color: input.color || '#3B82F6', created_at: now };
  },
  getAll(userId: number): Tag[] {
    const rows = db.prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name').all(userId) as Record<string, unknown>[];
    return rows.map(toTag);
  },
  getById(userId: number, id: number): Tag | null {
    const row = db.prepare('SELECT * FROM tags WHERE id = ? AND user_id = ?').get(id, userId) as Record<string, unknown> | undefined;
    return row ? toTag(row) : null;
  },
  getByName(userId: number, name: string): Tag | null {
    const row = db.prepare('SELECT * FROM tags WHERE user_id = ? AND name = ?').get(userId, name) as Record<string, unknown> | undefined;
    return row ? toTag(row) : null;
  },
  update(userId: number, id: number, input: { name?: string; color?: string }): Tag | null {
    const row = db.prepare('SELECT * FROM tags WHERE id = ? AND user_id = ?').get(id, userId) as Record<string, unknown> | undefined;
    if (!row) return null;
    const name = input.name !== undefined ? input.name.trim() : String(row.name);
    const color = input.color !== undefined ? input.color : String(row.color);
    db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ?').run(name, color, id);
    return { ...toTag(row), name, color };
  },
  delete(userId: number, id: number): boolean {
    const res = db.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').run(id, userId);
    return res.changes > 0;
  },
  getForTodo(userId: number, todoId: number): Tag[] {
    const rows = db.prepare(
      'SELECT t.* FROM tags t JOIN todo_tags tt ON tt.tag_id = t.id WHERE tt.todo_id = ? AND t.user_id = ? ORDER BY t.name'
    ).all(todoId, userId) as Record<string, unknown>[];
    return rows.map(toTag);
  },
  addToTodo(userId: number, todoId: number, tagId: number): void {
    try {
      db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)').run(todoId, tagId);
    } catch { /* already exists */ }
  },
  removeFromTodo(userId: number, todoId: number, tagId: number): void {
    db.prepare('DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?').run(todoId, tagId);
  },
  setForTodo(userId: number, todoId: number, tagIds: number[]): void {
    db.prepare('DELETE FROM todo_tags WHERE todo_id = ?').run(todoId);
    for (const tagId of tagIds) {
      db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)').run(todoId, tagId);
    }
  },
};

// ---- Todo DB ----
export interface CreateTodoInput {
  title: string; description?: string | null; due_date?: string | null;
  priority?: Priority; is_recurring?: boolean; recurrence_pattern?: RecurrencePattern | null;
  reminder_minutes?: number | null;
}
export interface UpdateTodoInput {
  title?: string; description?: string | null; completed?: boolean; due_date?: string | null;
  priority?: Priority; is_recurring?: boolean; recurrence_pattern?: RecurrencePattern | null;
  reminder_minutes?: number | null;
}

export const todoDB = {
  create(userId: number, input: CreateTodoInput): Todo {
    const now = new Date().toISOString();
    const res = db.prepare(`
      INSERT INTO todos (user_id, title, description, completed, due_date, created_at, updated_at, priority, is_recurring, recurrence_pattern, reminder_minutes)
      VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      input.title.trim(),
      input.description?.trim() || null,
      input.due_date || null,
      now, now,
      input.priority || 'medium',
      input.is_recurring ? 1 : 0,
      input.recurrence_pattern || null,
      input.reminder_minutes ?? null,
    );
    const id = Number(res.lastInsertRowid);
    const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as Record<string, unknown>;
    return toTodo(row, [], []);
  },
  getAll(userId: number): Todo[] {
    const rows = db.prepare('SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC').all(userId) as Record<string, unknown>[];
    return rows.map(row => {
      const subtasks = subtaskDB.getForTodo(Number(row.id), userId);
      const tags = tagDB.getForTodo(userId, Number(row.id));
      return toTodo(row, subtasks, tags);
    });
  },
  getById(userId: number, id: number): Todo | null {
    const row = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?').get(id, userId) as Record<string, unknown> | undefined;
    if (!row) return null;
    const subtasks = subtaskDB.getForTodo(id, userId);
    const tags = tagDB.getForTodo(userId, id);
    return toTodo(row, subtasks, tags);
  },
  update(userId: number, id: number, input: UpdateTodoInput): Todo | null {
    const row = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?').get(id, userId) as Record<string, unknown> | undefined;
    if (!row) return null;
    const now = new Date().toISOString();
    const title = input.title !== undefined ? input.title.trim() : String(row.title);
    const description = input.description !== undefined ? (input.description?.trim() || null) : row.description as string | null;
    const completed = input.completed !== undefined ? (input.completed ? 1 : 0) : Number(row.completed);
    const due_date = input.due_date !== undefined ? (input.due_date || null) : row.due_date as string | null;
    const priority = input.priority !== undefined ? input.priority : (row.priority as Priority) || 'medium';
    const is_recurring = input.is_recurring !== undefined ? (input.is_recurring ? 1 : 0) : Number(row.is_recurring);
    const recurrence_pattern = input.recurrence_pattern !== undefined ? (input.recurrence_pattern || null) : row.recurrence_pattern as string | null;
    const reminder_minutes = input.reminder_minutes !== undefined ? (input.reminder_minutes ?? null) : (row.reminder_minutes !== null && row.reminder_minutes !== undefined ? Number(row.reminder_minutes) : null);
    db.prepare(`
      UPDATE todos SET title=?, description=?, completed=?, due_date=?, updated_at=?, priority=?, is_recurring=?, recurrence_pattern=?, reminder_minutes=? WHERE id=?
    `).run(title, description, completed, due_date, now, priority, is_recurring, recurrence_pattern, reminder_minutes, id);
    const updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as Record<string, unknown>;
    const subtasks = subtaskDB.getForTodo(id, userId);
    const tags = tagDB.getForTodo(userId, id);
    return toTodo(updated, subtasks, tags);
  },
  delete(userId: number, id: number): boolean {
    const res = db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?').run(id, userId);
    return res.changes > 0;
  },
};

// ---- Notification DB ----
export const notificationDB = {
  getTodosNeedingNotification(userId: number, nowIso: string): Todo[] {
    const rows = db.prepare(`
      SELECT * FROM todos
      WHERE user_id = ?
        AND completed = 0
        AND reminder_minutes IS NOT NULL
        AND due_date IS NOT NULL
        AND datetime(due_date, '-' || reminder_minutes || ' minutes') <= ?
        AND (last_notification_sent IS NULL
             OR datetime(last_notification_sent, '+' || reminder_minutes || ' minutes') <= ?)
    `).all(userId, nowIso, nowIso) as Record<string, unknown>[];
    return rows.map(row => toTodo(row, [], []));
  },
  markNotificationSent(id: number, nowIso: string): void {
    db.prepare('UPDATE todos SET last_notification_sent = ? WHERE id = ?').run(nowIso, id);
  },
};

// ---- Template DB ----
export interface CreateTemplateInput {
  name: string; description?: string; category?: string; title: string; notes?: string;
  priority: Priority; is_recurring: boolean; recurrence_pattern?: RecurrencePattern | null;
  reminder_minutes?: number | null; due_date_offset_days?: number | null; subtasks: TemplateSubtask[];
}

export const templateDB = {
  create(userId: number, input: CreateTemplateInput): Template {
    const now = new Date().toISOString();
    const subtasksJson = JSON.stringify(input.subtasks ?? []);
    const res = db.prepare(`
      INSERT INTO templates (user_id, name, description, category, title, notes, priority, is_recurring, recurrence_pattern, reminder_minutes, due_date_offset_days, subtasks_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId, input.name.trim(), input.description?.trim() || null, input.category?.trim() || null,
      input.title.trim(), input.notes?.trim() || null, input.priority || 'medium',
      input.is_recurring ? 1 : 0, input.recurrence_pattern || null,
      input.reminder_minutes ?? null, input.due_date_offset_days ?? null,
      subtasksJson, now, now
    );
    const id = Number(res.lastInsertRowid);
    const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as Record<string, unknown>;
    return toTemplate(row);
  },
  getAll(userId: number): Template[] {
    const rows = db.prepare('SELECT * FROM templates WHERE user_id = ? ORDER BY name').all(userId) as Record<string, unknown>[];
    return rows.map(toTemplate);
  },
  getById(userId: number, id: number): Template | null {
    const row = db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?').get(id, userId) as Record<string, unknown> | undefined;
    return row ? toTemplate(row) : null;
  },
  update(userId: number, id: number, input: Partial<CreateTemplateInput>): Template | null {
    const row = db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?').get(id, userId) as Record<string, unknown> | undefined;
    if (!row) return null;
    const now = new Date().toISOString();
    const subtasks = input.subtasks !== undefined ? JSON.stringify(input.subtasks) : String(row.subtasks_json ?? '[]');
    db.prepare(`
      UPDATE templates SET name=?, description=?, category=?, title=?, notes=?, priority=?, is_recurring=?, recurrence_pattern=?, reminder_minutes=?, due_date_offset_days=?, subtasks_json=?, updated_at=? WHERE id=?
    `).run(
      input.name?.trim() ?? String(row.name), input.description?.trim() ?? row.description as string | null,
      input.category?.trim() ?? row.category as string | null, input.title?.trim() ?? String(row.title),
      input.notes?.trim() ?? row.notes as string | null, input.priority ?? String(row.priority),
      input.is_recurring !== undefined ? (input.is_recurring ? 1 : 0) : Number(row.is_recurring),
      input.recurrence_pattern !== undefined ? (input.recurrence_pattern || null) : row.recurrence_pattern as string | null,
      input.reminder_minutes !== undefined ? (input.reminder_minutes ?? null) : (row.reminder_minutes !== null && row.reminder_minutes !== undefined ? Number(row.reminder_minutes) : null),
      input.due_date_offset_days !== undefined ? (input.due_date_offset_days ?? null) : (row.due_date_offset_days !== null && row.due_date_offset_days !== undefined ? Number(row.due_date_offset_days) : null),
      subtasks, now, id
    );
    const updated = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as Record<string, unknown>;
    return toTemplate(updated);
  },
  delete(userId: number, id: number): boolean {
    const res = db.prepare('DELETE FROM templates WHERE id = ? AND user_id = ?').run(id, userId);
    return res.changes > 0;
  },
};

function toTemplate(row: Record<string, unknown>): Template {
  return {
    id: Number(row.id), user_id: Number(row.user_id), name: String(row.name),
    description: row.description as string | null, category: row.category as string | null,
    title: String(row.title), notes: row.notes as string | null,
    priority: (row.priority as Priority) || 'medium',
    is_recurring: Number(row.is_recurring) !== 0,
    recurrence_pattern: (row.recurrence_pattern as RecurrencePattern | null) || null,
    reminder_minutes: row.reminder_minutes !== null && row.reminder_minutes !== undefined ? Number(row.reminder_minutes) : null,
    due_date_offset_days: row.due_date_offset_days !== null && row.due_date_offset_days !== undefined ? Number(row.due_date_offset_days) : null,
    subtasks_json: row.subtasks_json as string | null,
    created_at: String(row.created_at), updated_at: String(row.updated_at),
  };
}
