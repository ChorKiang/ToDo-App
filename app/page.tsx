'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications, REMINDER_OPTIONS } from '@/lib/hooks/useNotifications';

// ---- Types ----
type Priority = 'high' | 'medium' | 'low';
type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface Subtask { id: number; todo_id: number; title: string; completed: boolean; position: number; created_at: string; }
interface Tag { id: number; user_id: number; name: string; color: string; created_at: string; }
interface Todo {
  id: number; title: string; description?: string | null; completed: boolean; due_date?: string | null;
  created_at: string; updated_at: string; priority: Priority; is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null; reminder_minutes: number | null;
  last_notification_sent: string | null; subtasks: Subtask[]; tags: Tag[];
}
interface Template {
  id: number; name: string; description?: string | null; category?: string | null; title: string;
  notes?: string | null; priority: Priority; is_recurring: boolean; recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null; due_date_offset_days: number | null; subtasks_json: string | null;
}

// ---- Constants ----
const PRIORITY_WEIGHT: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const PRIORITY_STYLES: Record<Priority, string> = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
};
const PRESET_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280'];

// ---- Utility functions ----
function getSingaporeNow() { return new Date(); }

function isOverdue(todo: Todo): boolean {
  if (todo.completed || !todo.due_date) return false;
  return new Date(todo.due_date) < new Date();
}

function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    const pw = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    if (pw !== 0) return pw;
    if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

function calculateProgress(subtasks: Subtask[]) {
  const total = subtasks.length;
  const completed = subtasks.filter(s => s.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percent };
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function formatDateForInput(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---- Components ----
function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_STYLES[priority]}`}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}

function TagBadge({ tag, onClick }: { tag: Tag; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-0.5 rounded-full text-xs font-medium text-white transition-opacity hover:opacity-80"
      style={{ backgroundColor: tag.color }}
      title={onClick ? `Filter by: ${tag.name}` : tag.name}
      type="button"
    >
      {tag.name}
    </button>
  );
}

function ProgressBar({ subtasks }: { subtasks: Subtask[] }) {
  if (subtasks.length === 0) return null;
  const { completed, total, percent } = calculateProgress(subtasks);
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>{completed}/{total} completed ({percent}%)</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${percent === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm max-w-sm ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
      {message}
      <button onClick={onClose} className="ml-3 opacity-70 hover:opacity-100">✕</button>
    </div>
  );
}

// ---- Main Page ----
export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Search & filter
  const [rawSearch, setRawSearch] = useState('');
  const searchQuery = useDebounce(rawSearch, 300);
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [activeTagFilter, setActiveTagFilter] = useState<Tag | null>(null);

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editTodo, setEditTodo] = useState<Todo | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [showManageTags, setShowManageTags] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState<Todo | null>(null);
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<number>>(new Set());

  const { permission, requestPermission, startPolling } = useNotifications();

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  }, []);

  const fetchTodos = useCallback(async () => {
    const res = await fetch('/api/todos');
    if (res.ok) setTodos(await res.json());
  }, []);

  const fetchTags = useCallback(async () => {
    const res = await fetch('/api/tags');
    if (res.ok) setTags(await res.json());
  }, []);

  const fetchTemplates = useCallback(async () => {
    const res = await fetch('/api/templates');
    if (res.ok) setTemplates(await res.json());
  }, []);

  useEffect(() => {
    fetch('/api/auth/me').then(async r => {
      if (!r.ok) { router.push('/login'); return; }
      const data = await r.json();
      setUser(data);
      await Promise.all([fetchTodos(), fetchTags(), fetchTemplates()]);
      setLoading(false);
    }).catch(() => router.push('/login'));
  }, [router, fetchTodos, fetchTags, fetchTemplates]);

  useEffect(() => {
    if (!user) return;
    const intervalId = startPolling();
    return () => clearInterval(intervalId);
  }, [user, startPolling]);

  // ---- Filtering ----
  function applyFilters(allTodos: Todo[]): Todo[] {
    return allTodos.filter(todo => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = todo.title.toLowerCase().includes(q);
        const matchesTag = todo.tags.some(t => t.name.toLowerCase().includes(q));
        if (!matchesTitle && !matchesTag) return false;
      }
      if (priorityFilter !== 'all' && todo.priority !== priorityFilter) return false;
      if (activeTagFilter && !todo.tags.some(t => t.id === activeTagFilter.id)) return false;
      return true;
    });
  }

  function clearAllFilters() {
    setRawSearch('');
    setPriorityFilter('all');
    setActiveTagFilter(null);
  }

  const hasActiveFilters = rawSearch !== '' || priorityFilter !== 'all' || activeTagFilter !== null;
  const filteredTodos = applyFilters(todos);
  const overdueTodos = sortTodos(filteredTodos.filter(t => isOverdue(t)));
  const activeTodos = sortTodos(filteredTodos.filter(t => !t.completed && !isOverdue(t)));
  const completedTodos = [...filteredTodos.filter(t => t.completed)].sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  // ---- Handlers ----
  async function handleToggleComplete(todo: Todo) {
    const newCompleted = !todo.completed;
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, completed: newCompleted } : t));
    const res = await fetch(`/api/todos/${todo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: newCompleted }),
    });
    if (!res.ok) {
      setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, completed: !newCompleted } : t));
      showToast('Failed to update todo', 'error');
    } else {
      await fetchTodos();
    }
  }

  async function handleDelete(id: number) {
    setTodos(prev => prev.filter(t => t.id !== id));
    const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      showToast('Failed to delete todo', 'error');
      await fetchTodos();
    }
    setDeleteConfirm(null);
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  // ---- Export / Import ----
  async function handleExport() {
    const res = await fetch('/api/todos/export');
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `todos-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch {
      showToast('Import failed: file is not valid JSON', 'error');
      return;
    }
    const d = data as Record<string, unknown>;
    if (!d || d.version !== '1.0' || !Array.isArray(d.todos) || !Array.isArray(d.tags)) {
      showToast('Import failed: invalid export format', 'error');
      return;
    }
    const res = await fetch('/api/todos/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: text,
    });
    const result = await res.json();
    if (!res.ok) { showToast(`Import failed: ${result.error}`, 'error'); return; }
    showToast(`Imported ${result.imported.todos} todos and ${result.imported.tags} tags`);
    await fetchTodos();
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-500 dark:text-gray-400">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">📋 Todo App</h1>
            <a href="/calendar" className="text-sm text-blue-600 hover:underline dark:text-blue-400">Calendar</a>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {permission !== 'granted' && typeof Notification !== 'undefined' && (
              <button onClick={requestPermission} className="text-xs px-2 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 rounded-lg hover:opacity-80">
                🔔 Enable Notifications
              </button>
            )}
            <button onClick={handleExport} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">⬇️ Export</button>
            <label className="cursor-pointer text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
              ⬆️ Import
              <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>
            <button onClick={() => setShowTemplates(true)} className="text-xs px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded-lg hover:opacity-80">📋 Templates</button>
            <button onClick={() => setShowManageTags(true)} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">🏷️ Tags</button>
            <button onClick={() => { setEditTodo(null); setShowForm(true); }} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">+ New Todo</button>
            <span className="text-xs text-gray-500 dark:text-gray-400">{user?.username}</span>
            <button onClick={handleLogout} className="text-xs px-2 py-1 text-red-600 dark:text-red-400 hover:underline">Logout</button>
          </div>
        </div>

        {/* Search & filters */}
        <div className="max-w-4xl mx-auto px-4 pb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <input
              type="search"
              value={rawSearch}
              onChange={e => setRawSearch(e.target.value)}
              placeholder="Search todos…"
              className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Search todos"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
            {rawSearch && (
              <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs" onClick={() => setRawSearch('')} aria-label="Clear search">✕</button>
            )}
          </div>
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value as Priority | 'all')}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 focus:outline-none"
            aria-label="Filter by priority"
          >
            <option value="all">All Priorities</option>
            <option value="high">🔴 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🔵 Low</option>
          </select>
        </div>

        {/* Active filters */}
        {hasActiveFilters && (
          <div className="max-w-4xl mx-auto px-4 pb-2 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 dark:text-gray-400">Filters:</span>
            {searchQuery && (
              <span className="filter-chip">Search: &ldquo;{searchQuery}&rdquo; <button onClick={() => setRawSearch('')} className="ml-1">✕</button></span>
            )}
            {priorityFilter !== 'all' && (
              <span className="filter-chip">Priority: {priorityFilter} <button onClick={() => setPriorityFilter('all')} className="ml-1">✕</button></span>
            )}
            {activeTagFilter && (
              <span className="filter-chip flex items-center gap-1">
                Tag: <TagBadge tag={activeTagFilter} />
                <button onClick={() => setActiveTagFilter(null)} className="ml-1">✕</button>
              </span>
            )}
            <button onClick={clearAllFilters} className="text-xs text-red-500 hover:underline">Clear all</button>
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {filteredTodos.length === 0 && todos.length > 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg">No todos match your filters.</p>
            <button onClick={clearAllFilters} className="mt-2 text-blue-500 hover:underline text-sm">Clear filters</button>
          </div>
        )}

        {todos.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg">No todos yet.</p>
            <button onClick={() => setShowForm(true)} className="mt-2 text-blue-500 hover:underline text-sm">Create your first todo</button>
          </div>
        )}

        {overdueTodos.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-2">🔴 Overdue ({overdueTodos.length})</h2>
            <div className="space-y-2">
              {overdueTodos.map(todo => (
                <TodoCard key={todo.id} todo={todo} tags={tags}
                  onToggle={() => handleToggleComplete(todo)}
                  onEdit={() => { setEditTodo(todo); setShowForm(true); }}
                  onDelete={() => setDeleteConfirm(todo.id)}
                  onTagClick={setActiveTagFilter}
                  onSaveTemplate={() => setShowSaveTemplate(todo)}
                  expandedSubtasks={expandedSubtasks} setExpandedSubtasks={setExpandedSubtasks}
                  onRefresh={fetchTodos} showToast={showToast} overdue />
              ))}
            </div>
          </section>
        )}

        {activeTodos.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">📋 Active ({activeTodos.length})</h2>
            <div className="space-y-2">
              {activeTodos.map(todo => (
                <TodoCard key={todo.id} todo={todo} tags={tags}
                  onToggle={() => handleToggleComplete(todo)}
                  onEdit={() => { setEditTodo(todo); setShowForm(true); }}
                  onDelete={() => setDeleteConfirm(todo.id)}
                  onTagClick={setActiveTagFilter}
                  onSaveTemplate={() => setShowSaveTemplate(todo)}
                  expandedSubtasks={expandedSubtasks} setExpandedSubtasks={setExpandedSubtasks}
                  onRefresh={fetchTodos} showToast={showToast} />
              ))}
            </div>
          </section>
        )}

        {completedTodos.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide mb-2">✅ Completed ({completedTodos.length})</h2>
            <div className="space-y-2">
              {completedTodos.map(todo => (
                <TodoCard key={todo.id} todo={todo} tags={tags}
                  onToggle={() => handleToggleComplete(todo)}
                  onEdit={() => { setEditTodo(todo); setShowForm(true); }}
                  onDelete={() => setDeleteConfirm(todo.id)}
                  onTagClick={setActiveTagFilter}
                  onSaveTemplate={() => setShowSaveTemplate(todo)}
                  expandedSubtasks={expandedSubtasks} setExpandedSubtasks={setExpandedSubtasks}
                  onRefresh={fetchTodos} showToast={showToast} />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Modals */}
      {showForm && (
        <TodoFormModal
          todo={editTodo}
          tags={tags}
          onClose={() => { setShowForm(false); setEditTodo(null); }}
          onSave={async (data) => {
            const url = editTodo ? `/api/todos/${editTodo.id}` : '/api/todos';
            const method = editTodo ? 'PUT' : 'POST';
            const res = await fetch(url, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });
            const result = await res.json();
            if (!res.ok) { showToast(result.error || 'Failed to save todo', 'error'); return; }

            // Update tag associations
            if (data.tagIds !== undefined) {
              await fetch(`/api/todos/${result.id}/tags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tagIds: data.tagIds }),
              });
            }

            await fetchTodos();
            setShowForm(false);
            setEditTodo(null);
            showToast(editTodo ? 'Todo updated' : 'Todo created');
          }}
        />
      )}

      {deleteConfirm !== null && (
        <div className="modal-overlay">
          <div className="modal-content max-w-sm">
            <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Delete this todo?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">This will also delete all subtasks and tag associations. This action cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {showManageTags && (
        <ManageTagsModal tags={tags} onClose={() => setShowManageTags(false)} onRefresh={fetchTags} showToast={showToast} />
      )}

      {showTemplates && (
        <TemplatesModal
          templates={templates}
          onClose={() => setShowTemplates(false)}
          onRefresh={fetchTemplates}
          onUse={async (templateId) => {
            const res = await fetch(`/api/templates/${templateId}/use`, { method: 'POST' });
            if (!res.ok) { showToast('Failed to create from template', 'error'); return; }
            await fetchTodos();
            setShowTemplates(false);
            showToast('Todo created from template');
          }}
          showToast={showToast}
        />
      )}

      {showSaveTemplate && (
        <SaveTemplateModal
          todo={showSaveTemplate}
          onClose={() => setShowSaveTemplate(null)}
          onSave={async (name, description, category) => {
            const todo = showSaveTemplate;
            const subtasks = todo.subtasks.map((s, i) => ({ title: s.title, position: i }));
            let due_date_offset_days: number | null = null;
            if (todo.due_date) {
              const diff = new Date(todo.due_date).getTime() - getSingaporeNow().getTime();
              due_date_offset_days = Math.max(0, Math.round(diff / 86_400_000));
            }
            const res = await fetch('/api/templates', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name, description, category,
                title: todo.title, notes: todo.description,
                priority: todo.priority, is_recurring: todo.is_recurring,
                recurrence_pattern: todo.recurrence_pattern, reminder_minutes: todo.reminder_minutes,
                due_date_offset_days, subtasks,
              }),
            });
            if (!res.ok) { showToast('Failed to save template', 'error'); return; }
            await fetchTemplates();
            setShowSaveTemplate(null);
            showToast('Template saved');
          }}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ---- TodoCard ----
function TodoCard({
  todo, tags, onToggle, onEdit, onDelete, onTagClick, onSaveTemplate,
  expandedSubtasks, setExpandedSubtasks, onRefresh, showToast, overdue,
}: {
  todo: Todo; tags: Tag[]; onToggle: () => void; onEdit: () => void; onDelete: () => void;
  onTagClick: (tag: Tag) => void; onSaveTemplate: () => void;
  expandedSubtasks: Set<number>; setExpandedSubtasks: React.Dispatch<React.SetStateAction<Set<number>>>;
  onRefresh: () => Promise<void>; showToast: (msg: string, type?: 'success' | 'error') => void; overdue?: boolean;
}) {
  const isExpanded = expandedSubtasks.has(todo.id);
  const [newSubtask, setNewSubtask] = useState('');
  const reminder = REMINDER_OPTIONS.find(o => o.value === todo.reminder_minutes);

  async function addSubtask() {
    if (!newSubtask.trim()) return;
    const res = await fetch(`/api/todos/${todo.id}/subtasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newSubtask.trim() }),
    });
    if (!res.ok) { showToast('Failed to add subtask', 'error'); return; }
    setNewSubtask('');
    await onRefresh();
  }

  async function toggleSubtask(subtask: Subtask) {
    await fetch(`/api/subtasks/${subtask.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !subtask.completed }),
    });
    await onRefresh();
  }

  async function deleteSubtask(subtaskId: number) {
    await fetch(`/api/subtasks/${subtaskId}`, { method: 'DELETE' });
    await onRefresh();
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border ${overdue ? 'border-red-300 dark:border-red-800' : 'border-gray-200 dark:border-gray-700'} p-4 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={onToggle}
          className="mt-1 w-4 h-4 rounded cursor-pointer accent-blue-600"
          aria-label={`Mark "${todo.title}" as ${todo.completed ? 'incomplete' : 'complete'}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`font-medium text-sm ${todo.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
              {todo.title}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={onSaveTemplate} title="Save as template" className="text-gray-400 hover:text-purple-500 text-xs px-1">📋</button>
              <button onClick={onEdit} title="Edit" className="text-gray-400 hover:text-blue-500 text-xs px-1" aria-label="Edit todo">✏️</button>
              <button onClick={onDelete} title="Delete" className="text-gray-400 hover:text-red-500 text-xs px-1" aria-label="Delete todo">🗑️</button>
            </div>
          </div>

          {todo.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{todo.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <PriorityBadge priority={todo.priority} />
            {todo.due_date && (
              <span className={`text-xs ${overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                📅 {new Date(todo.due_date).toLocaleString('en-SG', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            )}
            {todo.is_recurring && (
              <span className="text-xs text-gray-500 dark:text-gray-400">🔄 {todo.recurrence_pattern}</span>
            )}
            {todo.reminder_minutes && (
              <span className="text-xs text-gray-500 dark:text-gray-400">🔔 {reminder?.label ?? `${todo.reminder_minutes}m before`}</span>
            )}
            {todo.tags.map(tag => (
              <TagBadge key={tag.id} tag={tag} onClick={() => onTagClick(tag)} />
            ))}
          </div>

          {todo.subtasks.length > 0 && <ProgressBar subtasks={todo.subtasks} />}

          {/* Subtasks toggle */}
          <button
            onClick={() => setExpandedSubtasks(prev => {
              const next = new Set(prev);
              next.has(todo.id) ? next.delete(todo.id) : next.add(todo.id);
              return next;
            })}
            className="text-xs text-blue-500 hover:underline mt-2"
          >
            {isExpanded ? '▲ Hide' : '▼ Subtasks'} {todo.subtasks.length > 0 ? `(${todo.subtasks.length})` : ''}
          </button>

          {isExpanded && (
            <div className="mt-2 space-y-1">
              {todo.subtasks.map(subtask => (
                <div key={subtask.id} className="flex items-center gap-2 group">
                  <input
                    type="checkbox"
                    checked={subtask.completed}
                    onChange={() => toggleSubtask(subtask)}
                    className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                  />
                  <span className={`text-xs flex-1 ${subtask.completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {subtask.title}
                  </span>
                  <button
                    onClick={() => deleteSubtask(subtask.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-xs transition-opacity"
                    aria-label="Delete subtask"
                  >🗑️</button>
                </div>
              ))}
              <div className="flex gap-1 mt-1">
                <input
                  value={newSubtask}
                  onChange={e => setNewSubtask(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSubtask()}
                  placeholder="Add a subtask…"
                  className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button onClick={addSubtask} className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Add</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- TodoFormModal ----
function TodoFormModal({
  todo, tags, onClose, onSave,
}: {
  todo: Todo | null; tags: Tag[];
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [title, setTitle] = useState(todo?.title ?? '');
  const [description, setDescription] = useState(todo?.description ?? '');
  const [dueDate, setDueDate] = useState(formatDateForInput(todo?.due_date));
  const [priority, setPriority] = useState<Priority>(todo?.priority ?? 'medium');
  const [isRecurring, setIsRecurring] = useState(todo?.is_recurring ?? false);
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>(todo?.recurrence_pattern ?? 'daily');
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(todo?.reminder_minutes ?? null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(todo?.tags.map(t => t.id) ?? []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function toggleTag(tagId: number) {
    setSelectedTagIds(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    if (isRecurring && !dueDate) { setError('Due date required for recurring todos'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        priority,
        is_recurring: isRecurring,
        recurrence_pattern: isRecurring ? recurrencePattern : null,
        reminder_minutes: reminderMinutes,
        tagIds: selectedTagIds,
      });
    } catch {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{todo ? 'Edit Todo' : 'New Todo'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
        </div>

        {error && <div className="mb-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional notes…"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as Priority)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none"
              >
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🔵 Low</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={e => { setDueDate(e.target.value); if (!e.target.value) setReminderMinutes(null); }}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reminder</label>
            <select
              value={reminderMinutes ?? ''}
              onChange={e => setReminderMinutes(e.target.value ? Number(e.target.value) : null)}
              disabled={!dueDate}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              title={!dueDate ? 'Set a due date to enable reminders' : ''}
            >
              {REMINDER_OPTIONS.map(opt => (
                <option key={opt.label} value={opt.value ?? ''}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="accent-blue-600" />
              Repeat
            </label>
            {isRecurring && (
              <div className="mt-2">
                <select
                  value={recurrencePattern}
                  onChange={e => setRecurrencePattern(e.target.value as RecurrencePattern)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
                {!dueDate && <p className="text-xs text-red-500 mt-1">Due date required for recurring todos</p>}
              </div>
            )}
          </div>

          {tags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</label>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <label key={tag.id} className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTagIds.includes(tag.id)}
                      onChange={() => toggleTag(tag.id)}
                      className="accent-blue-600"
                    />
                    <TagBadge tag={tag} />
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : (todo ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- ManageTagsModal ----
function ManageTagsModal({ tags, onClose, onRefresh, showToast }: {
  tags: Tag[]; onClose: () => void; onRefresh: () => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  async function createTag() {
    if (!name.trim()) return;
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), color }),
    });
    const result = await res.json();
    if (!res.ok) { showToast(result.error || 'Failed to create tag', 'error'); return; }
    setName(''); setColor('#3B82F6');
    await onRefresh();
    showToast('Tag created');
  }

  async function updateTag() {
    if (!editingTag) return;
    const res = await fetch(`/api/tags/${editingTag.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim(), color: editColor }),
    });
    if (!res.ok) { showToast('Failed to update tag', 'error'); return; }
    setEditingTag(null);
    await onRefresh();
    showToast('Tag updated');
  }

  async function deleteTag(id: number) {
    const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' });
    if (!res.ok) { showToast('Failed to delete tag', 'error'); return; }
    await onRefresh();
    showToast('Tag deleted');
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Manage Tags</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createTag()}
            placeholder="Tag name…"
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" title="Pick color" />
          <button onClick={createTag} className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Create</button>
        </div>

        <div className="flex gap-1 mb-4 flex-wrap">
          {PRESET_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} className="w-6 h-6 rounded-full border-2 hover:scale-110 transition-transform" style={{ backgroundColor: c, borderColor: color === c ? 'black' : 'transparent' }} />
          ))}
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {tags.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No tags yet. Create one above.</p>}
          {tags.map(tag => (
            <div key={tag.id} className="flex items-center gap-2">
              {editingTag?.id === tag.id ? (
                <>
                  <input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                  <button onClick={updateTag} className="text-xs text-green-600 hover:underline">Save</button>
                  <button onClick={() => setEditingTag(null)} className="text-xs text-gray-500 hover:underline">Cancel</button>
                </>
              ) : (
                <>
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{tag.name}</span>
                  <button onClick={() => { setEditingTag(tag); setEditName(tag.name); setEditColor(tag.color); }} className="text-xs text-gray-400 hover:text-blue-500">✏️</button>
                  <button onClick={() => deleteTag(tag.id)} className="text-xs text-gray-400 hover:text-red-500">🗑️</button>
                </>
              )}
            </div>
          ))}
        </div>

        <button onClick={onClose} className="mt-4 w-full text-center text-sm text-gray-500 hover:underline">Done</button>
      </div>
    </div>
  );
}

// ---- TemplatesModal ----
function TemplatesModal({ templates, onClose, onRefresh, onUse, showToast }: {
  templates: Template[]; onClose: () => void; onRefresh: () => Promise<void>;
  onUse: (id: number) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState('');
  const categories = [...new Set(templates.map(t => t.category).filter(Boolean) as string[])];
  const filtered = categoryFilter ? templates.filter(t => t.category === categoryFilter) : templates;

  async function deleteTemplate(id: number) {
    const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    if (!res.ok) { showToast('Failed to delete template', 'error'); return; }
    await onRefresh();
    showToast('Template deleted');
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Use Template</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm mb-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none"
          >
            <option value="">All Categories</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        )}

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No templates yet. Save a todo as a template to get started.</p>}
          {filtered.map(template => {
            const subtasks: { title: string }[] = JSON.parse(template.subtasks_json ?? '[]');
            return (
              <div key={template.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-white">{template.name}</p>
                    {template.category && <span className="text-xs text-gray-500 dark:text-gray-400">[{template.category}]</span>}
                    <div className="flex flex-wrap gap-1 mt-1">
                      <PriorityBadge priority={template.priority} />
                      {template.is_recurring && <span className="text-xs text-gray-500">🔄 {template.recurrence_pattern}</span>}
                      {subtasks.length > 0 && <span className="text-xs text-gray-500">{subtasks.length} subtasks</span>}
                      {template.reminder_minutes && <span className="text-xs text-gray-500">🔔 {REMINDER_OPTIONS.find(o => o.value === template.reminder_minutes)?.label}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => onUse(template.id)} className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Use</button>
                    <button onClick={() => deleteTemplate(template.id)} className="text-xs text-gray-400 hover:text-red-500 px-1">🗑️</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={onClose} className="mt-4 w-full text-center text-sm text-gray-500 hover:underline">Close</button>
      </div>
    </div>
  );
}

// ---- SaveTemplateModal ----
function SaveTemplateModal({ todo, onClose, onSave }: {
  todo: Todo; onClose: () => void;
  onSave: (name: string, description: string, category: string) => Promise<void>;
}) {
  const [name, setName] = useState(todo.title);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onSave(name.trim(), description.trim(), category.trim());
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Save as Template</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description…"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <input
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="e.g. Work, Personal…"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none"
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
            <button type="submit" disabled={saving} className="px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
