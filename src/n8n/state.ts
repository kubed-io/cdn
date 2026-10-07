import { focusPanel, pageWindow, setRefresh, setTimeRange, setVariable, type Focused, type Page } from '../kd/scene';

/** Names in `chat_settable` that are not template variables. */
export const RESERVED = ['time_from', 'time_to', 'refresh', 'focus'];

// The read tool spells the window timeFrom/timeTo; the picker's names are time_from/time_to.
const ALIAS: Record<string, string> = { timeFrom: 'time_from', timeTo: 'time_to' };

// `.*` is the panel-data tool's "all databases" default; a dropdown's own
// all-value is $__all, so `.*` would match no option. It means nothing to set.
const NOT_A_VALUE = ['', '.*'];

export interface ToolCalls {
  tools?: { args?: Record<string, unknown> | null }[];
}

export interface DashboardState {
  /** Settable names to values; a later call in the turn wins. */
  vars: Record<string, string>;
  /** What to bring on screen: an explicit `focus`, else the last panel read. Null unless `focus` is settable. */
  focus: string | null;
}

/**
 * Maps a turn's tool calls onto the dashboard. An argument named like a
 * settable name IS that name, so no dashboard-specific mapping lives in n8n.
 * `panelId` is how the agent says which panel it read, so reading a panel is a
 * focus; an explicit `focus` argument beats it.
 */
export function readToolCalls(payload: ToolCalls | null | undefined, settable: string[]): DashboardState {
  const vars: Record<string, string> = {};
  let asked: string | null = null;
  let read: string | null = null;
  for (const call of payload?.tools ?? []) {
    for (const [key, value] of Object.entries(call?.args ?? {})) {
      if (value === null || value === undefined || NOT_A_VALUE.includes(String(value))) continue;
      if (key === 'panelId') read = String(value);
      else if (key === 'focus') asked = String(value);
      else {
        const name = ALIAS[key] ?? key;
        if (settable.includes(name)) vars[name] = String(value);
      }
    }
  }
  // Half a window would leave the picker inverted.
  if (vars.time_from && !vars.time_to) vars.time_to = 'now';
  return { vars, focus: settable.includes('focus') ? (asked ?? read) : null };
}

/**
 * Applies `values` to the page: only the `settable` names, in that order.
 * `refresh` snaps to an offered interval; `time_from`/`time_to` are applied
 * together at the end in one call, both ends reported even when one was asked
 * for. `focus` is not applied here.
 *
 * @returns what really changed, for the state card
 */
export function applyState(page: Page, values: Record<string, unknown> | null | undefined, settable: string[]): Record<string, string> {
  const applied: Record<string, string> = {};
  if (!values || typeof values !== 'object') return applied;
  let from: string | null = null;
  let to: string | null = null;
  for (const name of settable) {
    const value = values[name];
    if (value === undefined || value === null || value === '') continue;
    if (name === 'time_from') from = String(value);
    else if (name === 'time_to') to = String(value);
    else if (name === 'refresh') {
      const set = setRefresh(page, String(value));
      if (set !== null) applied.refresh = set;
    } else if (name !== 'focus') {
      const set = setVariable(page, name, value);
      if (set !== null) applied[name] = set;
    }
  }
  if (from || to) {
    const raw = setTimeRange(page, from, to);
    if (raw) {
      applied.time_from = raw.from;
      applied.time_to = raw.to;
    }
  }
  return applied;
}

/**
 * The card saying what the agent just did to the dashboard, or null when it
 * did nothing. Every value came from the model, so all of it is text, never
 * markup. The focused group is a button that goes back there.
 */
export function stateCard(
  doc: Document,
  applied: Record<string, string>,
  focused: Focused | null,
  onGo: (target: string) => void,
): HTMLElement | null {
  const chips: [string, string][] = [];
  if (applied.time_from || applied.time_to) {
    chips.push(['time', `${applied.time_from || 'now'} → ${applied.time_to || 'now'}`]);
  }
  for (const [k, v] of Object.entries(applied)) {
    if (k !== 'time_from' && k !== 'time_to') chips.push([k, v]);
  }
  if (!chips.length && !focused) return null;

  const card = doc.createElement('div');
  card.className = 'n8n-chat-state';
  const head = doc.createElement('span');
  head.className = 'ncs-head';
  head.textContent = focused && !chips.length ? 'Moved your dashboard' : 'Changed your dashboard';
  card.append(head);

  const chip = (tag: 'span' | 'button', label: string, value: string): HTMLElement => {
    const el = doc.createElement(tag);
    el.className = tag === 'button' ? 'ncs-chip ncs-go' : 'ncs-chip';
    if (tag === 'button') (el as HTMLButtonElement).type = 'button';
    const b = doc.createElement('b');
    b.textContent = label;
    const i = doc.createElement('i');
    i.textContent = value;
    el.append(b, i);
    card.append(el);
    return el;
  };
  for (const [label, value] of chips) chip('span', label, value);
  if (focused) {
    const where = focused.panel != null ? `${focused.group} · panel ${focused.panel}` : focused.group;
    const go = chip('button', focused.kind === 'tab' ? 'tab' : 'section', where);
    go.title = 'Show me that again';
    go.addEventListener('click', () => onGo(focused.panel != null ? String(focused.panel) : focused.group));
  }
  return card;
}

/**
 * Puts the card inside the last bot message. The widget's Vue list reorders
 * foreign children of the list itself to below every later message; inside a
 * message they are that message's own subtree and scroll away with its turn.
 */
export function placeCard(doc: Document, card: HTMLElement): boolean {
  const bots = doc.querySelectorAll('.chat-message-from-bot');
  const host = bots.length
    ? bots[bots.length - 1]
    : doc.querySelector('.chat-messages-list') || doc.querySelector('.chat-body');
  if (!host) return false;
  card.classList.toggle('ncs-loose', !bots.length);
  host.append(card);
  card.scrollIntoView?.({ block: 'nearest' });
  return true;
}

/** Applies one turn's control chunk: the settable values, then the focus, then the card. */
export function applyToolCalls(page: Page, payload: ToolCalls | null | undefined, settable: string[]): void {
  if (!settable.length) return;
  const state = readToolCalls(payload, settable);
  const applied = Object.keys(state.vars).length ? applyState(page, state.vars, settable) : {};
  const focused = state.focus ? focusPanel(page, state.focus) : null;
  const win = pageWindow(page);
  if (!win) return;
  const card = stateCard(win.document, applied, focused, (target) => focusPanel(win, target));
  // The control chunk ends the stream, but the widget may still be committing
  // the reply it belongs to.
  if (card) win.setTimeout(() => placeCard(win.document, card), 150);
}
