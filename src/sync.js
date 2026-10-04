import { supabase } from './supabase';

// Each wine / history entry is one row: (user_id, id) plus the whole entry as
// jsonb. Changes are pushed as a diff against the last snapshot the server
// confirmed, so edits made offline are sent on the next successful sync.

const TABLES = { inventory: 'wines', history: 'history' };

const baselineKey = (userId, kind) => `wine-cellar-synced-${kind}-${userId}`;

// Map of id -> JSON string, used to detect changed entries cheaply.
export const snapshot = (items) =>
  Object.fromEntries(items.map(item => [String(item.id), JSON.stringify(item)]));

export const loadBaseline = (userId, kind) => {
  try {
    const stored = localStorage.getItem(baselineKey(userId, kind));
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const saveBaseline = (userId, kind, snap) => {
  try {
    localStorage.setItem(baselineKey(userId, kind), JSON.stringify(snap));
  } catch (e) {
    console.error('Failed to save sync state:', e);
  }
};

export const clearBaselines = (userId) => {
  Object.keys(TABLES).forEach(kind => localStorage.removeItem(baselineKey(userId, kind)));
};

export const fetchAll = async (kind) => {
  const { data, error } = await supabase
    .from(TABLES[kind])
    .select('data')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return data.map(row => row.data);
};

// Pushes the difference between `baseline` and `items`; returns the new baseline.
export const pushChanges = async (userId, kind, baseline, items) => {
  const next = snapshot(items);
  const table = TABLES[kind];

  const changed = items.filter(item => baseline[String(item.id)] !== next[String(item.id)]);
  const removed = Object.keys(baseline).filter(id => !(id in next));

  if (changed.length > 0) {
    const { error } = await supabase.from(table).upsert(
      changed.map(item => ({ user_id: userId, id: String(item.id), data: item, updated_at: new Date().toISOString() })),
      { onConflict: 'user_id,id' }
    );
    if (error) throw error;
  }

  if (removed.length > 0) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId).in('id', removed);
    if (error) throw error;
  }

  return next;
};
