{
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"*_`~\\[\]]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] || '&#' + c.charCodeAt(0) + ';');
const WARN = /^(BackOff|Failed|Unhealthy|Evicted|OOM|Killing|Preempt|ExceededGracePeriod|NetworkNotReady|NodeNotReady|InspectFailed|ErrImage|ProbeWarning|FreeDiskSpaceFailed)/;
const dur = (s) => s < 60 ? Math.round(s) + 's' : s < 3600 ? Math.floor(s / 60) + 'm' : s < 86400 ? Math.floor(s / 3600) + 'h' : Math.floor(s / 86400) + 'd';
const pill = (t, c) => `<span class="pill" style="--c:${c}">${esc(t)}</span>`;
context.handlebars.registerHelper('events', (rows) => {
  const now = context.grafana.timeRange.to.valueOf();
  const groups = [];
  const seen = {};
  for (const r of rows || []) {
    const l = (typeof r.labels === 'string' ? JSON.parse(r.labels) : r.labels) || {};
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
  const body = groups.map((g) => {
    const warn = WARN.test(g.reason);
    // it sits in the summary now, so it is narrow: warnings show by the reason's colour, the source is its tooltip
    return `<tr><td><span class="pill" style="--c:${warn ? '#f2495c' : '#5794f2'}" title="${warn ? 'Warning' : 'Normal'}${g.src ? ' · from ' + esc(g.src) : ''}">${esc(g.reason)}</span></td>`
      + `<td>${esc(g.msg)}</td><td class="n">${g.n > 1 ? '×' + g.n : ''}</td>`
      + `<td class="when">${dur((now - g.last) / 1000)} ago${g.n > 1 ? ' <span class="dim">(first ' + dur((now - g.first) / 1000) + ')</span>' : ''}</td>`
      + '</tr>';
  }).join('');
  return '<table class="st ev"><thead><tr><th>reason</th><th>message</th><th></th><th>last seen</th></tr></thead>'
    + `<tbody>${body}</tbody></table>`;
});
}
{
const EVWARN = /^(BackOff|Failed|Unhealthy|Evicted|OOM|Killing|Preempt|ExceededGracePeriod|NetworkNotReady|NodeNotReady|InspectFailed|ErrImage|ProbeWarning|FreeDiskSpaceFailed|Sync|BadConfig|Error)/;
const evRows = (frames) => [].concat(...(frames || [])).filter((r) => r && r.Line !== undefined);
const jqRow = (frames, section) => [].concat(...(frames || [])).find((r) => r && r.section === section);
const evCount = (rows) => {
  const seen = {};
  let warn = false;
  for (const r of rows) {
    const l = (typeof r.labels === 'string' ? JSON.parse(r.labels) : r.labels) || {};
    seen[(l.kind || '') + '/' + (l.name || '') + '\u0000' + (l.reason || '') + '\u0000' + r.Line] = 1;
    warn = warn || EVWARN.test(l.reason || '');
  }
  return { n: Object.keys(seen).length, warn };
};
// the index of the </div> that closes the <div ...> starting at i
const closeOf = (h, i) => {
  const re = /<div\b|<\/div>/g;
  re.lastIndex = i;
  let depth = 0;
  let m;
  while ((m = re.exec(h))) {
    if (m[0] === '</div>') { depth -= 1; if (depth === 0) return m.index; } else { depth += 1; }
  }
  return -1;
};
// the masthead: just the object's head row - the count lives on the summary's Events tab (Dr K: that is all it needs)
context.handlebars.registerHelper('evhead', (frames) => (jqRow(frames, 'head') || {}).html || '');
// add an Events tab to a summary's CSS tabs: a radio, a label and a pane (the .ctabs rules are positional)
context.handlebars.registerHelper('evtabs', (html, frames) => {
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
  const table = context.handlebars.helpers.events(rows);
  return pe < 0 ? h : h.slice(0, pe) + `<div class="pane">${table}</div>` + h.slice(pe);
});
context.handlebars.registerHelper('evsum', (frames) => context.handlebars.helpers.evtabs((jqRow(frames, 'summary') || {}).html, frames));
context.handlebars.registerHelper('evcount', (frames) => evCount(evRows(frames)).n);
context.handlebars.registerHelper('evtable', (frames) => context.handlebars.helpers.events(evRows(frames)));
}
