// Kubernetes events as Loki keeps them (one line per event, the object and
// reason as labels), folded into one row per object, reason and message.
import type { Cell } from '../kd/cell';
import type { TableColumn, TableData } from '../kd/elements/table';
import { refLink, namespaceLink } from './links';
import { duration } from './map';

/** The labels the kube-events source puts on each line. */
export interface EventLabels {
  kind?: string;
  name?: string;
  namespace?: string;
  objectAPIversion?: string;
  reason?: string;
  type?: string;
  sourcecomponent?: string;
  reportingcontroller?: string;
  [key: string]: unknown;
}

/** One Loki log row, as Business Text hands a frame's rows to a panel. */
export interface EventRow {
  labels?: EventLabels | string;
  Line?: string;
  body?: string;
  Time?: number | string;
  timestamp?: number | string;
  tsNs?: string;
  [key: string]: unknown;
}

/** One folded event. */
export interface EventGroup {
  kind: string;
  name: string;
  namespace: string;
  apiVersion: string;
  reason: string;
  message: string;
  /** The component that reported it. */
  source: string;
  warning: boolean;
  count: number;
  /** ms */
  first: number;
  /** ms */
  last: number;
}

/** Reasons that mean something went wrong, for sources whose lines carry no `type` label. */
export const WARNING_REASONS =
  /^(BackOff|Failed|Unhealthy|Evicted|OOM|Killing|Preempt|ExceededGracePeriod|NetworkNotReady|NodeNotReady|InspectFailed|ErrImage|ProbeWarning|FreeDiskSpaceFailed|BadConfig|Error)/;

/** Whether an event is a warning: its `type` label says so, or its reason does. */
export function isWarning(labels: EventLabels): boolean {
  return labels.type === 'Warning' || WARNING_REASONS.test(labels.reason ?? '');
}

interface FieldFrame {
  fields: { name: string; values: ArrayLike<unknown> | { toArray(): unknown[] } }[];
}

const isFieldFrame = (x: unknown): x is FieldFrame =>
  typeof x === 'object' && x !== null && Array.isArray((x as FieldFrame).fields);

function frameRows(frame: FieldFrame): EventRow[] {
  const columns = frame.fields.map((f) => ({
    name: f.name,
    values: Array.from('toArray' in f.values && typeof f.values.toArray === 'function' ? f.values.toArray() : (f.values as ArrayLike<unknown>)),
  }));
  const n = Math.max(0, ...columns.map((c) => c.values.length));
  return Array.from({ length: n }, (_, i) => Object.fromEntries(columns.map((c) => [c.name, c.values[i]])) as EventRow);
}

/**
 * The log rows in whatever Business Text or a query hands over: rows, an
 * array of frames' rows, or data frames with `fields`. Rows that are not log
 * lines (an Infinity query's rows in the same panel) are dropped.
 */
export function eventRows(input: unknown): EventRow[] {
  const out: EventRow[] = [];
  const visit = (x: unknown) => {
    if (Array.isArray(x)) x.forEach(visit);
    else if (isFieldFrame(x)) frameRows(x).forEach(visit);
    else if (typeof x === 'object' && x !== null && ((x as EventRow).Line !== undefined || (x as EventRow).body !== undefined)) {
      out.push(x as EventRow);
    }
  };
  visit(input);
  return out;
}

function labelsOf(row: EventRow): EventLabels {
  const l = row.labels;
  if (typeof l === 'string') {
    try {
      return (JSON.parse(l) as EventLabels) ?? {};
    } catch {
      return {};
    }
  }
  return l ?? {};
}

function timeOf(row: EventRow): number {
  if (row.tsNs) return Number(row.tsNs) / 1e6;
  const t = row.Time ?? row.timestamp;
  if (typeof t === 'number') return t;
  if (typeof t === 'string') {
    const n = Number(t);
    if (Number.isFinite(n)) return n > 1e14 ? n / 1e6 : n;
    return Date.parse(t);
  }
  return NaN;
}

/** Events folded by object, reason and message, the most recent first. */
export function foldEvents(input: unknown): EventGroup[] {
  const groups = new Map<string, EventGroup>();
  for (const row of eventRows(input)) {
    const l = labelsOf(row);
    const message = String(row.Line ?? row.body ?? '');
    const key = [l.kind ?? '', l.namespace ?? '', l.name ?? '', l.reason ?? '', message].join('\u0000');
    const t = timeOf(row);
    let g = groups.get(key);
    if (!g) {
      g = {
        kind: l.kind ?? '',
        name: l.name ?? '',
        namespace: l.namespace ?? '',
        apiVersion: l.objectAPIversion ?? '',
        reason: l.reason ?? '',
        message,
        source: l.sourcecomponent || l.reportingcontroller || '',
        warning: isWarning(l),
        count: 0,
        first: t,
        last: t,
      };
      groups.set(key, g);
    }
    g.count += 1;
    if (Number.isFinite(t)) {
      g.first = Number.isFinite(g.first) ? Math.min(g.first, t) : t;
      g.last = Number.isFinite(g.last) ? Math.max(g.last, t) : t;
    }
  }
  return [...groups.values()].sort((a, b) => (b.last || 0) - (a.last || 0));
}

/** Which optional columns an events table has. */
export interface EventColumns {
  /** The object each event is about, for a view of many objects (a namespace, a workload). */
  object?: boolean;
  /** The object's namespace, for a cluster-wide view (a node). */
  namespace?: boolean;
  /** The end of the time range, in ms: "last seen" is measured to it. */
  now?: number;
}

/** Folded events as `kd-table` data: reason pill, [namespace], [object], message, count, last seen. */
export function eventsTable(groups: EventGroup[], opt: EventColumns = {}): TableData {
  const now = opt.now ?? Date.now();
  const columns: TableColumn[] = [
    { key: 'reason', label: 'Reason', nowrap: true },
    ...(opt.namespace ? [{ key: 'namespace', label: 'Namespace' }] : []),
    ...(opt.object ? [{ key: 'object', label: 'Object' }] : []),
    { key: 'message', label: 'Message' },
    { key: 'count', label: '', align: 'right' as const, nowrap: true },
    { key: 'last', label: 'Last seen', nowrap: true },
  ];
  const ago = (t: number) => (Number.isFinite(t) ? `${duration((now - t) / 1000)} ago` : '');
  const rows = groups.map((g): Record<string, Cell> => ({
    reason: {
      text: g.reason || '?',
      tone: g.warning ? 'error' : 'info',
      title: `${g.warning ? 'Warning' : 'Normal'}${g.source ? ` · from ${g.source}` : ''}`,
    },
    namespace: g.namespace ? namespaceLink(g.namespace) : '',
    object: g.kind && g.name
      ? refLink({ kind: g.kind, name: g.name, namespace: g.namespace || undefined, apiVersion: g.apiVersion || undefined })
      : '',
    message: g.message,
    count: g.count > 1 ? `×${g.count}` : '',
    last: g.count > 1 && g.first !== g.last ? [ago(g.last), `(first ${ago(g.first).replace(/ ago$/, '')})`] : ago(g.last),
  }));
  return { columns, rows };
}
