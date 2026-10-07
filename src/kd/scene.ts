// The Grafana page helpers: the live dashboard scene behind `__grafanaSceneContext`,
// read and driven from panel code. Typed against only the parts used here. Scene
// method names survive Grafana's minification; class names do not, so nothing here
// checks a constructor.
//
// Every helper takes the page (its Window, or any node in it) and none touches
// `window` at import: Business Text hides `window` from plugin code, and
// `context.element` is the way back to it.

/** The page: its Window, or any node in it (a panel's `context.element`). */
export type Page = Window | Node;

export interface VariableOption {
  value: unknown;
  label?: string;
}

/** A dashboard variable: a dropdown has `changeValueTo` and options, a text box `setValue`. */
export interface SceneVariable {
  state: { name?: string; options?: VariableOption[] };
  getValue(): unknown;
  changeValueTo?(value: unknown, text?: unknown): void;
  setValue?(value: string): void;
}

export interface VariableSet {
  getByName(name: string): SceneVariable | undefined;
}

export interface RawRange {
  from: string;
  to: string;
}

/** SceneTimeRange: `from`/`to` are the raw picker strings, `value` the evaluated dates. */
export interface SceneTimeRange {
  state: { from?: unknown; to?: unknown; value?: { from?: unknown; to?: unknown } };
  onTimeRangeChange?(range: { raw: RawRange; from: string; to: string }): void;
  updateFromUrl?(raw: RawRange): void;
}

export interface RefreshPicker {
  state: { refresh?: string; intervals?: string[] };
  setState(patch: { refresh: string }): void;
}

/** Any scene object, for walking the graph. */
export interface SceneNode {
  state: any;
  parent?: SceneNode | null;
  setState?(patch: Record<string, unknown>): void;
  forEachChild?(fn: (child: SceneNode) => void): void;
}

export interface DashboardScene extends SceneNode {
  state: {
    $variables?: VariableSet;
    $timeRange?: SceneTimeRange;
    controls?: unknown;
    refreshPicker?: unknown;
    body?: SceneNode;
    [key: string]: unknown;
  };
}

/** A tab or a collapsible row, and the panels it holds (`panel-N` keys). */
export interface Group {
  name: string;
  kind: 'tab' | 'row';
  open: boolean;
  /** False for a row with a hidden header: always on screen, nothing to open. */
  focusable: boolean;
  panels: string[];
  show(): void;
}

export interface Focused {
  group: string;
  kind: 'tab' | 'row';
  panel: number | null;
}

export interface TimeWindow {
  from: string;
  to: string;
  fromIso: string;
  toIso: string;
}

const WARN = '[kd]';

/** The page's Window, from the Window itself or any node in it. */
export function pageWindow(page: Page | null | undefined): Window | null {
  if (!page) return null;
  if ('nodeType' in page) {
    const doc = page.nodeType === 9 ? (page as Document) : page.ownerDocument;
    return doc?.defaultView ?? null;
  }
  return page;
}

/** The dashboard scene, or null off a dashboard (or outside Grafana). */
export function scene(page: Page | null | undefined): DashboardScene | null {
  const win = pageWindow(page) as (Window & { __grafanaSceneContext?: DashboardScene }) | null;
  return win?.__grafanaSceneContext ?? null;
}

// --- variables ---------------------------------------------------------------

export function variable(page: Page, name: string): SceneVariable | null {
  return scene(page)?.state.$variables?.getByName(name) ?? null;
}

/** A variable's value as text: a multi-value joins with commas; missing is ''. */
export function variableValue(page: Page, name: string): string {
  const v = variable(page, name);
  if (!v) return '';
  const value = v.getValue();
  return Array.isArray(value) ? value.join(',') : String(value ?? '');
}

/**
 * Sets one variable. A dropdown takes one of its own options (or an `$__all`
 * value); anything else is refused, because Grafana would store it and show a
 * blank picker. A text box takes any value.
 *
 * @returns the value set, or null when nothing changed
 */
export function setVariable(page: Page, name: string, value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const v = variable(page, name);
  if (!v) return null;
  const want = String(value);
  if (String(v.getValue()) === want) return null;
  try {
    if (typeof v.changeValueTo === 'function') {
      const option = want.includes('__all')
        ? { value, label: 'All' }
        : (v.state.options ?? []).find((o) => String(o.value) === want);
      if (!option) {
        console.warn(`${WARN} ignoring ${name}=${want}: not one of its options`);
        return null;
      }
      v.changeValueTo(option.value, option.label);
      return want;
    }
    if (typeof v.setValue === 'function') {
      v.setValue(want);
      return want;
    }
  } catch (e) {
    console.warn(`${WARN} could not set ${name}`, e);
  }
  return null;
}

/**
 * Sets the `allowed` names found in `values`, one at a time in `allowed`'s
 * order (order can matter: a variable that starts a job goes last).
 *
 * @returns what really changed, which is not always what was asked for
 */
export function setVariables(page: Page, values: Record<string, unknown>, allowed: string[]): Record<string, string> {
  const applied: Record<string, string> = {};
  for (const name of allowed) {
    const set = setVariable(page, name, values[name]);
    if (set !== null) applied[name] = set;
  }
  return applied;
}

// --- time range ----------------------------------------------------------------

function iso(date: unknown): string {
  try {
    const d = date as { toISOString?(): string } | null | undefined;
    return typeof d?.toISOString === 'function' ? d.toISOString() : '';
  } catch {
    return '';
  }
}

/** The window on screen: raw (`now-24h`, what a person reads) and ISO (what a query needs). */
export function timeRange(page: Page): TimeWindow | null {
  const t = scene(page)?.state.$timeRange;
  if (!t) return null;
  const { from, to, value } = t.state ?? {};
  return {
    from: from == null ? '' : String(from),
    to: to == null ? '' : String(to),
    fromIso: iso(value?.from),
    toIso: iso(value?.to),
  };
}

/**
 * Moves the time picker, both ends in one call: `onTimeRangeChange` reads only
 * `raw`, evaluates it and pushes the URL, so a reload keeps the window. A
 * missing end keeps the picker's current one.
 *
 * @returns the raw window set, or null
 */
export function setTimeRange(page: Page, from?: string | null, to?: string | null): RawRange | null {
  const t = scene(page)?.state.$timeRange;
  const now = timeRange(page);
  if (!t || !now) return null;
  const raw = { from: from || now.from, to: to || now.to };
  try {
    if (typeof t.onTimeRangeChange === 'function') t.onTimeRangeChange({ raw, from: raw.from, to: raw.to });
    else if (typeof t.updateFromUrl === 'function') t.updateFromUrl(raw);
    else {
      console.warn(`${WARN} no settable time range on this scene`);
      return null;
    }
    return raw;
  } catch (e) {
    console.warn(`${WARN} could not set the time range`, e);
    return null;
  }
}

// --- refresh -------------------------------------------------------------------

const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/** `5m` -> 300. Off, empty or unreadable is 0. */
export function intervalSeconds(interval: string | null | undefined): number {
  const m = /^([0-9]+)([smhd])$/.exec(String(interval ?? '').trim());
  return m ? Number(m[1]) * UNIT_SECONDS[m[2]] : 0;
}

// The picker hangs off the root or off the controls object depending on the
// scene, so take whichever candidate actually carries `refresh`.
function refreshPicker(page: Page): RefreshPicker | null {
  const s = scene(page);
  if (!s) return null;
  const controls = s.state.controls as { state?: { refreshPicker?: unknown } } | unknown[] | undefined;
  const seen: unknown[] = [s.state.refreshPicker];
  if (Array.isArray(controls)) seen.push(...controls);
  else if (controls?.state) seen.push(controls.state.refreshPicker);
  const found = seen.find((x) => {
    const st = (x as { state?: object } | null)?.state;
    return !!st && 'refresh' in st;
  });
  return (found as RefreshPicker | undefined) ?? null;
}

/** The refresh interval: `''` when auto-refresh is off, null when there is no picker. */
export function refresh(page: Page): string | null {
  const p = refreshPicker(page);
  return p ? String(p.state.refresh ?? '') : null;
}

/** The intervals this dashboard's picker offers. Anything else renders it blank. */
export function refreshIntervals(page: Page): string[] {
  return [...(refreshPicker(page)?.state.intervals ?? [])];
}

/**
 * The offered interval nearest `want`, on a log scale because the steps are
 * multiplicative (10m is nearer 15m than 5m). A tie goes to the slower one:
 * fewer queries is the cheaper mistake.
 */
export function snapInterval(want: string, offered: string[]): string | null {
  const target = intervalSeconds(want);
  if (!target) return null;
  let best: string | null = null;
  let bestScore = Infinity;
  let bestSeconds = 0;
  for (const candidate of offered) {
    const seconds = intervalSeconds(candidate);
    if (!seconds) continue;
    const score = Math.abs(Math.log(seconds / target));
    if (score < bestScore - 1e-9 || (Math.abs(score - bestScore) < 1e-9 && seconds > bestSeconds)) {
      best = candidate;
      bestScore = score;
      bestSeconds = seconds;
    }
  }
  return best;
}

/**
 * Sets auto-refresh. An interval the picker does not offer is not an error to
 * Grafana - it is stored, the picker goes blank and refreshing stops - so it is
 * snapped to the nearest offered one.
 *
 * @returns what was set (`off` or an interval), or null
 */
export function setRefresh(page: Page, value: string): string | null {
  const p = refreshPicker(page);
  if (!p) return null;
  const want = String(value ?? '').trim();
  try {
    if (want === '' || want === 'off') {
      p.setState({ refresh: '' });
      return 'off';
    }
    const offered = p.state.intervals ?? [];
    const best = offered.includes(want) ? want : snapInterval(want, offered);
    if (!best) {
      console.warn(`${WARN} ignoring unusable refresh ${want}`);
      return null;
    }
    if (best !== want) console.warn(`${WARN} ${want} is not offered on this dashboard; using ${best}`);
    p.setState({ refresh: best });
    return best;
  } catch (e) {
    console.warn(`${WARN} could not set refresh`, e);
    return null;
  }
}

// --- groups and focus ----------------------------------------------------------

const PANEL_KEY = /^panel-[0-9]+$/;

// Every panel under a layout, including those in closed tabs, which have no DOM
// but are in the scene graph.
function panelKeysIn(node: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<unknown>();
  const walk = (o: unknown): void => {
    if (!o || typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    const st = (o as SceneNode).state;
    if (!st || typeof st !== 'object') return;
    if (typeof st.key === 'string' && PANEL_KEY.test(st.key)) {
      out.push(st.key);
      return;
    }
    for (const v of Object.values(st)) {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object' && 'state' in v) walk(v);
    }
  };
  walk(node);
  return out;
}

/**
 * The dashboard's tabs and collapsible rows, in order. A v2 dashboard is a list
 * of rows; a row holds panels or a tabs manager, and both are groups here,
 * because to the person looking at it either way some panels show and others
 * do not.
 */
export function groups(page: Page): Group[] {
  const rows = scene(page)?.state.body?.state?.rows;
  if (!Array.isArray(rows)) return [];
  const out: Group[] = [];
  for (const row of rows as SceneNode[]) {
    const layout = row.state.layout;
    if (layout && typeof layout.switchToTab === 'function') {
      const current = typeof layout.getCurrentTab === 'function' ? layout.getCurrentTab() : null;
      for (const tab of (layout.state.tabs ?? []) as SceneNode[]) {
        out.push({
          name: tab.state.title || 'Untitled',
          kind: 'tab',
          open: tab === current,
          focusable: true,
          panels: panelKeysIn(tab.state.layout),
          show: () => layout.switchToTab(tab),
        });
      }
      continue;
    }
    const r = row as SceneNode & { getCollapsedState?(): boolean; setCollapsedState?(collapsed: boolean): void };
    const pinned = row.state.hideHeader === true;
    const collapsed = typeof r.getCollapsedState === 'function' && r.getCollapsedState();
    out.push({
      name: row.state.title || 'Header',
      kind: 'row',
      open: pinned || !collapsed,
      focusable: !pinned,
      panels: panelKeysIn(layout),
      show: () => {
        if (!pinned && typeof r.setCollapsedState === 'function') r.setCollapsedState(false);
      },
    });
  }
  return out;
}

/**
 * Brings a panel or a group on screen. `target` is a panel id (`5`, `panel-5`)
 * or a group name; either way its group is opened, so the caller never needs
 * to know whether that is a tab or a row. A panel is then scrolled to, retrying
 * over animation frames because a tab that was closed mounts a beat later.
 */
export function focusPanel(page: Page, target: string | number | null | undefined): Focused | null {
  const win = pageWindow(page);
  const want = String(target ?? '').trim();
  if (!win || !want) return null;
  const key = /^(panel-)?[0-9]+$/.test(want) ? `panel-${want.replace(/^panel-/, '')}` : null;
  const all = groups(win);
  const group = key
    ? all.find((g) => g.panels.includes(key))
    : all.find((g) => g.name.toLowerCase() === want.toLowerCase());
  if (!group || !group.focusable) {
    console.warn(`${WARN} nothing focusable for ${want}`);
    return null;
  }
  try {
    group.show();
  } catch (e) {
    console.warn(`${WARN} could not open ${group.name}`, e);
    return null;
  }
  if (key) {
    let tries = 20;
    const scroll = (): void => {
      const el = win.document.querySelector(`[data-viz-panel-key="${key}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      else if (--tries > 0) win.requestAnimationFrame(scroll);
    };
    win.requestAnimationFrame(scroll);
  }
  return { group: group.name, kind: group.kind, panel: key ? Number(key.slice(6)) : null };
}

// --- fit -----------------------------------------------------------------------

/** What `fitPanel` reads from Business Text's `context`. */
export interface FitContext {
  grafana?: { replaceVariables?(text: string): string };
  /** The panel id or key, when `content` is not inside the panel's own DOM. */
  panel?: string | number;
}

/**
 * Grid rows needed for `px` of content. A grid item of height h spans 38h - 8
 * px; `pad` covers the panel's own padding (12 with Business Text's `.dt-row`
 * padding set to `4px 0 0`).
 */
export function gridHeight(px: number, pad = 12): number {
  return Math.max(1, Math.ceil((px + pad) / 38));
}

// A repeat's clones share their panel key; each sits under a scene object whose
// local $variables hold that clone's value.
function repeatMatches(item: SceneNode, replace: ((text: string) => string) | undefined, root: SceneNode): boolean {
  if (!replace) return true;
  for (let p: SceneNode | null | undefined = item; p && p !== root; p = p.parent) {
    const vars = p.state?.$variables?.state?.variables as SceneVariable[] | undefined;
    if (!Array.isArray(vars) || !vars.length) continue;
    return vars.every((v) => {
      const name = v.state.name;
      return !name || String(v.getValue()) === replace(`\${${name}}`);
    });
  }
  return true;
}

/**
 * Fits a panel's grid height to its content. Grafana has none of its own, but
 * the grid item is reachable in the scene: setting its height changes state
 * only, and the grid relays out once its parent gets a new children list. Live
 * only, never saved; a no-op when the height is already right, so it is safe in
 * an `afterRender` that runs twice per refresh.
 *
 * @param content the element to measure, inside the panel
 * @returns the height set or kept, or null when the panel was not found
 */
export function fitPanel(content: HTMLElement, context: FitContext = {}): number | null {
  const root = scene(content);
  const given = context.panel == null ? null : String(context.panel);
  const key = given
    ? `panel-${given.replace(/^panel-/, '')}`
    : content.closest('[data-viz-panel-key]')?.getAttribute('data-viz-panel-key');
  if (!root || !key) return null;

  const items: SceneNode[] = [];
  const walk = (o: SceneNode): void => {
    if (o.state?.body?.state?.key === key && 'height' in o.state) {
      items.push(o);
      return;
    }
    o.forEachChild?.(walk);
  };
  walk(root);
  const replace = context.grafana?.replaceVariables?.bind(context.grafana);
  const item = items.length > 1 ? items.find((i) => repeatMatches(i, replace, root)) : items[0];
  if (!item) return null;

  const h = gridHeight(content.offsetHeight);
  if (item.state.height !== h) {
    item.setState?.({ height: h });
    const parent = item.parent;
    if (parent?.setState && Array.isArray(parent.state?.children)) parent.setState({ children: [...parent.state.children] });
  }
  return h;
}
