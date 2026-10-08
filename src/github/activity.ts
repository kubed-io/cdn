// The Repo dashboard's activity joins, as pure functions: code-server events
// counted per path hash (Loki), and Claude Code's Edit/Write tool calls turned
// into lines added and removed. Each ends as numeric stats on kd-files entries,
// which the explorer rolls up per folder.
import { trimSlashes } from './urls';
import type { Entry } from '../kd/files/types';
import type { FileColumn } from '../kd/files/explorer';
import { pathHash } from './hash';

/** code-server's event names, and the stat each one counts. */
export const ACTIVITY_EVENTS: Readonly<Record<string, 'opened' | 'viewed' | 'saved'>> = {
  fileGet: 'opened',
  editorOpened: 'viewed',
  filePUT: 'saved',
};

export interface Activity {
  opened: number;
  viewed: number;
  saved: number;
}

export interface ClaudeEdit {
  added: number;
  removed: number;
  /** Tool calls. */
  edits: number;
  /** 1 when some counts were estimated from a cut-off event. */
  estimated: number;
}

/** The columns for activity stats and size, in the Files tab's order. */
export const ACTIVITY_COLUMNS: FileColumn[] = [
  { key: 'opened', label: 'Opened', icon: '📂 ', tone: 'info', title: 'Opened in an editor tab (code-server)' },
  { key: 'viewed', label: 'Viewed', icon: '👁 ', tone: 'primary', title: 'Shown in an editor (code-server)' },
  { key: 'saved', label: 'Saved', icon: '💾 ', tone: 'success', title: 'Saved (code-server)' },
  { key: 'added', label: 'Added', icon: '+', tone: 'success', title: 'Lines Claude Code added' },
  { key: 'removed', label: 'Removed', icon: '−', tone: 'error', title: 'Lines Claude Code removed' },
  { key: 'size', label: 'Size', kind: 'size' },
];

type Row = Record<string, unknown>;

const rowsOf = (data: unknown): Row[] =>
  Array.isArray(data)
    ? (data.flatMap((x) => (Array.isArray(x) ? x : [x])).filter((r) => !!r && typeof r === 'object') as Row[])
    : [];

/**
 * Where code-server sees a repository's files: `/projects/<owner>/<name>/`
 * and `/projects/<name>/`, both checkouts counted.
 */
export function projectPrefixes(repo: string, root = '/projects'): string[] {
  const base = `/${trimSlashes(root)}`;
  const name = repo.split('/').pop() ?? repo;
  return [...new Set([`${base}/${repo}/`, `${base}/${name}/`])];
}

// A Loki metric row keeps its number under `Value…` (or `value`).
function rowValue(r: Row): number {
  const key = Object.keys(r).find((k) => /^Value/.test(k));
  return Number(key ? r[key] : r.value) || 0;
}

/** Event counts by path hash, from rows `{fhash, event, Value}`. */
export function activityByHash(data: unknown): Map<number, Activity> {
  const out = new Map<number, Activity>();
  for (const r of rowsOf(data)) {
    const stat = ACTIVITY_EVENTS[String(r.event)];
    if (r.fhash === undefined || r.fhash === null || r.fhash === '' || !stat) continue;
    const hash = Number(r.fhash);
    const a = out.get(hash) ?? { opened: 0, viewed: 0, saved: 0 };
    a[stat] += rowValue(r);
    out.set(hash, a);
  }
  return out;
}

/** Activity per repository path, summed over every prefix a checkout may sit at; paths with none are left out. */
export function activityStats(data: unknown, paths: Iterable<string>, prefixes: string[]): Record<string, Activity> {
  const seen = activityByHash(data);
  const out: Record<string, Activity> = {};
  if (!seen.size) return out;
  for (const path of paths) {
    const t = { opened: 0, viewed: 0, saved: 0 };
    for (const p of prefixes) {
      const a = seen.get(pathHash(p + path));
      if (!a) continue;
      t.opened += a.opened;
      t.viewed += a.viewed;
      t.saved += a.saved;
    }
    if (t.opened || t.viewed || t.saved) out[path] = t;
  }
  return out;
}

/** Lines in a text, a final newline not counting as one more. */
export function lineCount(text: string | null | undefined): number {
  return text ? text.replace(/\n$/, '').split('\n').length : 0;
}

/**
 * Lines added and removed going from `a` to `b`, by longest common
 * subsequence; past 250 000 line pairs, everything is counted as replaced.
 */
export function lineDiff(a: string | null | undefined, b: string | null | undefined): [added: number, removed: number] {
  const x = a ? a.split('\n') : [];
  const y = b ? b.split('\n') : [];
  if (x.length * y.length > 250000) return [y.length, x.length];
  let next = new Int32Array(y.length + 1);
  for (let i = x.length - 1; i >= 0; i -= 1) {
    const row = new Int32Array(y.length + 1);
    for (let j = y.length - 1; j >= 0; j -= 1) row[j] = x[i] === y[j] ? next[j + 1] + 1 : Math.max(next[j], row[j + 1]);
    next = row;
  }
  const common = next[0];
  return [y.length - common, x.length - common];
}

const TOOLS = new Set(['Edit', 'Write', 'MultiEdit']);

interface ToolInput {
  file_path?: string;
  content?: string;
  old_string?: string;
  new_string?: string;
  edits?: { old_string?: string; new_string?: string; content?: string }[];
}

/**
 * Claude Code's edits per repository path, from its Loki log rows (`Line`,
 * with the event's attributes in `labels`). An Edit or MultiEdit counts its
 * line diff, a Write its content as added. Inputs over about 1000 bytes arrive
 * cut off with a "…[N chars]" marker; theirs are estimated and flagged.
 */
export function claudeEdits(data: unknown, prefixes: string[]): Record<string, ClaudeEdit> {
  const relative = (abs: string): string | null => {
    for (const p of prefixes) if (abs.startsWith(p)) return abs.slice(p.length);
    return null;
  };
  const out: Record<string, ClaudeEdit> = {};
  for (const row of rowsOf(data)) {
    if (row.Line === undefined) continue;
    let labels: Row = {};
    try {
      labels = (typeof row.labels === 'string' ? JSON.parse(row.labels) : row.labels) ?? {};
    } catch {
      continue;
    }
    const tool = String(labels.tool_name ?? '');
    if (!TOOLS.has(tool) || !labels.tool_input) continue;
    const raw = String(labels.tool_input);
    let input: ToolInput | null = null;
    try {
      input = JSON.parse(raw) as ToolInput;
    } catch {
      // cut off
    }
    let path: string | undefined;
    let added = 0;
    let removed = 0;
    let estimated = 0;
    if (input && typeof input === 'object') {
      path = input.file_path;
      for (const e of input.edits ?? [input]) {
        if (tool === 'Write') added += lineCount(e.content);
        else {
          const [a, d] = lineDiff(e.old_string, e.new_string);
          added += a;
          removed += d;
        }
      }
    } else {
      path = /"file_path":"([^"]*)"/.exec(raw)?.[1];
      const more = Number(/…\[(\d+) chars\]/.exec(raw)?.[1]) || 0;
      const lines = (t: string) => (t.match(/\\n/g) ?? []).length + 1;
      const [oldPart, newPart] = raw.split('"new_string":"');
      estimated = 1;
      if (tool === 'Write') added = lines(raw.split('"content":"')[1] ?? '') + Math.round(more / 70);
      else {
        removed = newPart === undefined ? 0 : lines(oldPart.split('"old_string":"')[1] ?? '');
        added = lines(newPart ?? '') + Math.round(more / 70);
      }
    }
    const rel = path ? relative(path) : null;
    if (!rel) continue;
    const c = (out[rel] ??= { added: 0, removed: 0, edits: 0, estimated: 0 });
    c.added += added;
    c.removed += removed;
    c.edits += 1;
    c.estimated = c.estimated || estimated;
  }
  return out;
}

/** Entries with each map's numbers for their path merged into their stats (files only; folders roll up). */
export function withStats(entries: readonly Entry[], ...maps: Record<string, object>[]): Entry[] {
  return entries.map((entry) => {
    if (entry.type !== 'file') return entry;
    let stats: Record<string, number> | undefined;
    for (const map of maps) {
      const add = map[entry.path] as Record<string, unknown> | undefined;
      if (!add) continue;
      stats ??= { ...entry.stats };
      for (const [k, v] of Object.entries(add)) if (typeof v === 'number') stats[k] = (stats[k] ?? 0) + v;
    }
    return stats ? { ...entry, stats } : entry;
  });
}

/**
 * The Files tab's join in one call: code-server activity and Claude Code's
 * edits from the panel's frames, as stats on the tree's entries.
 */
export function withActivity(entries: readonly Entry[], data: unknown, repo: string, root?: string): Entry[] {
  const prefixes = projectPrefixes(repo, root);
  const files = entries.filter((e) => e.type === 'file').map((e) => e.path);
  return withStats(entries, activityStats(data, files, prefixes), claudeEdits(data, prefixes));
}
