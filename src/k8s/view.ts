// The Handlebars helpers the k8s-* views' string-HTML panels share: the events table and the
// Events tab the title bar and the summaries add. A panel's helpers code is one line,
//
//   return import(context.grafana.replaceVariables('${assets}') + '/k8s.js').then((k8s) => k8s.registerViewHelpers(context));
//
// Business Text awaits a promise from the helpers code before it compiles the template.

type Helper = (...args: any[]) => unknown;

/** The parts of Business Text's helpers `context` the view helpers read. */
export interface ViewContext {
  handlebars: { registerHelper(name: string, helper: Helper): void };
  grafana: { timeRange: { to: { valueOf(): number } } };
}

/** An event row from Loki: its line, its time and its labels (a JSON string or an object). */
interface EventLine {
  Line?: string;
  body?: string;
  Time?: number | string;
  timestamp?: number | string;
  labels?: string | Record<string, string>;
  section?: string;
  html?: string;
}

// Reasons the events table shows as warnings.
const WARN = /^(BackOff|Failed|Unhealthy|Evicted|OOM|Killing|Preempt|ExceededGracePeriod|NetworkNotReady|NodeNotReady|InspectFailed|ErrImage|ProbeWarning|FreeDiskSpaceFailed)/;
// The wider set the Events count reads.
const EVWARN = /^(BackOff|Failed|Unhealthy|Evicted|OOM|Killing|Preempt|ExceededGracePeriod|NetworkNotReady|NodeNotReady|InspectFailed|ErrImage|ProbeWarning|FreeDiskSpaceFailed|Sync|BadConfig|Error)/;

// Business Text runs Markdown over the result, so its inline markers are encoded too.
const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: unknown): string =>
  String(s == null ? '' : s).replace(/[&<>"*_`~\\[\]]/g, (c) => ESCAPES[c] || '&#' + c.charCodeAt(0) + ';');

const dur = (s: number): string =>
  s < 60 ? Math.round(s) + 's' : s < 3600 ? Math.floor(s / 60) + 'm' : s < 86400 ? Math.floor(s / 3600) + 'h' : Math.floor(s / 86400) + 'd';

const labelsOf = (r: EventLine): Record<string, string> =>
  (typeof r.labels === 'string' ? JSON.parse(r.labels) : r.labels) || {};

const flat = (frames: unknown): EventLine[] => ([] as EventLine[]).concat(...((frames as EventLine[][]) || []));
const evRows = (frames: unknown): EventLine[] => flat(frames).filter((r) => r && r.Line !== undefined);
const jqRow = (frames: unknown, section: string): EventLine | undefined => flat(frames).find((r) => r && r.section === section);

function evCount(rows: EventLine[]): { n: number; warn: boolean } {
  const seen: Record<string, 1> = {};
  let warn = false;
  for (const r of rows) {
    const l = labelsOf(r);
    seen[(l.kind || '') + '/' + (l.name || '') + '\u0000' + (l.reason || '') + '\u0000' + r.Line] = 1;
    warn = warn || EVWARN.test(l.reason || '');
  }
  return { n: Object.keys(seen).length, warn };
}

// The index of the </div> that closes the <div ...> starting at i.
function closeOf(h: string, i: number): number {
  const re = /<div\b|<\/div>/g;
  re.lastIndex = i;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(h))) {
    if (m[0] === '</div>') {
      depth -= 1;
      if (depth === 0) return m.index;
    } else {
      depth += 1;
    }
  }
  return -1;
}

/** The events table: one row per reason and message, newest first, with a count and when. */
function eventsTable(rows: EventLine[] | null | undefined, now: number): string {
  const groups: { reason: string; msg: string; src: string; first: number; last: number; n: number }[] = [];
  const seen: Record<string, (typeof groups)[number]> = {};
  for (const r of rows || []) {
    const l = labelsOf(r);
    const t = Number(r.Time ?? r.timestamp);
    const msg = r.Line ?? r.body ?? '';
    const k = (l.reason || '') + '\u0000' + msg;
    let g = seen[k];
    if (!g) {
      g = seen[k] = { reason: l.reason || '', msg, src: l.sourcecomponent || l.reportingcontroller || '', first: t, last: t, n: 0 };
      groups.push(g);
    }
    g.n += 1;
    g.first = Math.min(g.first, t);
    g.last = Math.max(g.last, t);
  }
  if (!groups.length) {
    return '<div class="none">No events in this time range</div>';
  }
  groups.sort((a, b) => b.last - a.last);
  const body = groups
    .map((g) => {
      const warn = WARN.test(g.reason);
      // it sits in the summary, so it is narrow: warnings show by the reason's colour, the source is its tooltip
      return `<tr><td><span class="pill" style="--c:${warn ? '#f2495c' : '#5794f2'}" title="${warn ? 'Warning' : 'Normal'}${g.src ? ' · from ' + esc(g.src) : ''}">${esc(g.reason)}</span></td>`
        + `<td>${esc(g.msg)}</td><td class="n">${g.n > 1 ? '×' + g.n : ''}</td>`
        + `<td class="when">${dur((now - g.last) / 1000)} ago${g.n > 1 ? ' <span class="dim">(first ' + dur((now - g.first) / 1000) + ')</span>' : ''}</td>`
        + '</tr>';
    })
    .join('');
  return '<table class="st ev"><thead><tr><th>reason</th><th>message</th><th></th><th>last seen</th></tr></thead>'
    + `<tbody>${body}</tbody></table>`;
}

/**
 * Adds an Events tab to a summary's CSS tabs: a radio, a label with the count and a pane with
 * the events table. The .ctabs rules are positional, so it goes last.
 */
function eventsTab(html: unknown, frames: unknown, now: number): string {
  let h = String(html || '');
  const name = (h.match(/<input type="radio" name="([^"]+)"/) || [])[1];
  const s = h.indexOf('<div class="strip">');
  if (!name || s < 0) return h;
  const rows = evRows(frames);
  const c = evCount(rows);
  h = h.slice(0, s) + `<input type="radio" name="${name}" id="${name}-ev"/>` + h.slice(s);
  const s2 = h.indexOf('<div class="strip">');
  const se = closeOf(h, s2);
  h = h.slice(0, se) + `<label for="${name}-ev">Events <span class="n">${c.n}</span></label>` + h.slice(se);
  const p = h.indexOf('<div class="panes">');
  const pe = p < 0 ? -1 : closeOf(h, p);
  const table = eventsTable(rows, now);
  return pe < 0 ? h : h.slice(0, pe) + `<div class="pane">${table}</div>` + h.slice(pe);
}

/**
 * Registers the view helpers on Business Text's `context.handlebars`: `events` (rows → table),
 * `evhead` (the title bar's head row), `evtabs` (a summary plus its Events tab), `evsum`,
 * `evcount` and `evtable`. "Now" is the end of the dashboard's time range.
 */
export function registerViewHelpers(context: ViewContext): void {
  const hb = context.handlebars;
  const now = (): number => context.grafana.timeRange.to.valueOf();
  hb.registerHelper('events', (rows: EventLine[]) => eventsTable(rows, now()));
  hb.registerHelper('evhead', (frames: unknown) => (jqRow(frames, 'head') || {}).html || '');
  hb.registerHelper('evtabs', (html: unknown, frames: unknown) => eventsTab(html, frames, now()));
  hb.registerHelper('evsum', (frames: unknown) => eventsTab((jqRow(frames, 'summary') || {}).html, frames, now()));
  hb.registerHelper('evcount', (frames: unknown) => evCount(evRows(frames)).n);
  hb.registerHelper('evtable', (frames: unknown) => eventsTable(evRows(frames), now()));
}
