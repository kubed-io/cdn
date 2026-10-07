import { VERSION } from '../kd/define';
import { focusPanel } from '../kd/scene';
import { settings, type ChatConfig, type Settings } from './config';
import { wrapFetch, type ChatHandle, type ChatWindow } from './fetch';
import { cleanHistory } from './history';
import { chatMetadata } from './metadata';
import { applyState, applyToolCalls, type ToolCalls } from './state';
import { controlFilter } from './stream';
import { STYLES } from './styles';

export type CreateChat = (options: Record<string, unknown>) => unknown;
export type ChatLoader = (url: string) => Promise<{ createChat: CreateChat }>;

// dist/ on purpose, for both files: the package root's chat.bundle.es.js has no
// stream reader, and its style.css has no .chat-inputs rules.
export const chatBundle = (version: string): string => `https://cdn.jsdelivr.net/npm/@n8n/chat@${version}/dist/chat.bundle.es.js`;
export const chatStyle = (version: string): string => `https://cdn.jsdelivr.net/npm/@n8n/chat@${version}/dist/style.css`;

const CONTROLS = '[data-testid="data-testid dashboard controls"]';
const NARROW = 900;

/** Injects the tile's page-global stylesheet once; a newer build's replaces an older one's. */
export function injectStyles(doc: Document): void {
  let style = doc.head.querySelector<HTMLStyleElement>('style[data-n8n-chat-tile]');
  if (style?.dataset.n8nChatTile === VERSION) return;
  if (!style) {
    style = doc.createElement('style');
    doc.head.append(style);
  }
  style.dataset.n8nChatTile = VERSION;
  style.textContent = STYLES;
}

function chatStylesheet(doc: Document, version: string): void {
  const href = chatStyle(version);
  let link = doc.head.querySelector<HTMLLinkElement>('link[data-n8n-chat-style]');
  if (link?.getAttribute('href') === href) return;
  if (!link) {
    link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.setAttribute('data-n8n-chat-style', '');
    doc.head.append(link);
  }
  link.href = href;
}

/** Fills the tile: an `<a>` with `.icon` and `.label` children, or a `<kd-tile>` by its attributes. */
export function fillTile(tile: Element, s: Pick<Settings, 'icon' | 'label' | 'link'>): void {
  const external = /^https?:/.test(s.link);
  if (tile.localName === 'kd-tile') {
    for (const [name, value] of [['icon', s.icon], ['label', s.label], ['href', s.link]]) {
      if (value) tile.setAttribute(name, value);
      else tile.removeAttribute(name);
    }
    return;
  }
  const icon = tile.querySelector('.icon');
  if (icon) {
    if (/^(https?:)?\//.test(s.icon)) {
      const img = tile.ownerDocument.createElement('img');
      img.src = s.icon;
      img.alt = '';
      icon.replaceChildren(img);
    } else {
      icon.textContent = s.icon;
    }
  }
  const label = tile.querySelector('.label');
  if (label) label.textContent = s.label;
  if (s.link) tile.setAttribute('href', s.link);
  else tile.removeAttribute('href');
  if (external) {
    tile.setAttribute('target', '_blank');
    tile.setAttribute('rel', 'noopener');
  } else {
    tile.removeAttribute('target');
    tile.removeAttribute('rel');
  }
}

/**
 * Pins the chat window's top under Grafana's controls row, which is measured
 * because it grows when the variables wrap and is absent in a kiosk embed. With
 * no row, or below 900px, the inline values go so the stylesheet's apply.
 */
export function fitChat(win: Window): void {
  const doc = win.document;
  const root = doc.getElementById('n8n-chat');
  if (!root) return;
  const wrapper = root.querySelector('.chat-window-wrapper');
  const box = doc.querySelector(CONTROLS)?.getBoundingClientRect();
  if (!wrapper || !box || !box.height || win.innerWidth <= NARROW) {
    root.style.removeProperty('--n8n-chat-top');
    root.style.removeProperty('--n8n-chat-reserve');
    return;
  }
  const cs = win.getComputedStyle(wrapper);
  const toggle = root.querySelector('.chat-window-toggle');
  const reserve =
    (parseFloat(cs.bottom) || 14) +
    (toggle ? toggle.getBoundingClientRect().height : 64) +
    (parseFloat(cs.rowGap || cs.gap) || 14);
  root.style.setProperty('--n8n-chat-top', `${Math.round(box.bottom + 10)}px`);
  root.style.setProperty('--n8n-chat-reserve', `${Math.round(reserve)}px`);
}

function removeChat(doc: Document): void {
  doc.querySelectorAll('#n8n-chat, .n8n-chat-widget').forEach((el) => el.remove());
}

function pageOf(config: ChatConfig): { win: ChatWindow; tile: Element | null } {
  const given = config.tile;
  if (given && typeof given === 'object') {
    return { win: (config.window ?? given.ownerDocument.defaultView ?? window) as ChatWindow, tile: given };
  }
  const win = (config.window ?? window) as ChatWindow;
  const tile =
    typeof given === 'string' ? win.document.querySelector(given) : given === null ? null : win.document.getElementById('n8n-chat-tile');
  return { win, tile };
}

const load: ChatLoader = (url) => import(/* @vite-ignore */ url);

/**
 * Mounts the chat tile and its n8n chat on the page.
 *
 * Idempotent: the core text panel re-runs its script on every mount, so a
 * repeat call for the same dashboard and settings keeps the chat that is there.
 * Grafana is a single-page app, so the chat lives on `<body>` only while the URL
 * stays on this dashboard. With no webhook it fills the tile and removes any
 * leftover chat.
 *
 * @returns once the chat is created (or at once, tile only)
 */
export function mount(config: ChatConfig = {}, loader: ChatLoader = load): Promise<void> {
  const { win, tile } = pageOf(config);
  const doc = win.document;
  const s = settings(config);

  injectStyles(doc);
  if (tile) fillTile(tile, s);
  win.dashboardFocus = (target) => focusPanel(win, target);

  if (!s.webhook) {
    removeChat(doc);
    win.clearInterval(win.n8nChatWatch);
    win.n8nChat = null;
    win.n8nChatMount = undefined;
    return Promise.resolve();
  }

  const home = win.location.pathname;
  const { auth: _auth, ...visible } = s;
  const key = JSON.stringify([home, visible]);
  const current = win.n8nChatMount;
  if (current?.key === key && (!current.done || doc.getElementById('n8n-chat'))) return current.ready;

  removeChat(doc);
  win.clearInterval(win.n8nChatWatch);
  win.n8nChatWatch = win.setInterval(() => {
    if (win.location.pathname !== home) {
      removeChat(doc);
      win.clearInterval(win.n8nChatWatch);
      win.n8nChat = null;
      win.n8nChatMount = undefined;
      return;
    }
    // Also re-measures the controls row, whose height changes fire no event.
    win.n8nChatFit?.();
  }, 1000);
  chatStylesheet(doc, s.chatVersion);
  if (!win.n8nChatResize) {
    win.n8nChatResize = true;
    win.addEventListener('resize', () => win.n8nChatFit?.());
  }

  const handle: ChatHandle = {
    webhook: s.webhook,
    settable: s.settable,
    stream: s.stream,
    setVariables: (vars, names) => applyState(win, vars, names),
    cleanHistory,
    filterStream: (body) => body.pipeThrough(controlFilter((payload) => applyToolCalls(win, payload as ToolCalls, s.settable))),
  };
  win.n8nChat = handle;
  wrapFetch(win);

  const state: NonNullable<ChatWindow['n8nChatMount']> = { key, done: false, ready: Promise.resolve() };
  win.n8nChatMount = state;
  state.ready = (async () => {
    try {
      // Imported after the setup above, so the page is ready before the bundle arrives.
      const { createChat } = await loader(chatBundle(s.chatVersion));
      // A later mount, or leaving the dashboard, while the bundle loaded.
      if (win.n8nChatMount !== state || win.location.pathname !== home) return;
      win.n8nChatFit = () => fitChat(win);
      createChat({
        webhookUrl: s.webhook,
        webhookConfig: { headers: s.auth ? { Authorization: s.auth } : {} },
        chatSessionKey: 'sessionId',
        loadPreviousSession: true,
        enableStreaming: s.stream,
        metadata: chatMetadata(win, s, home),
        showWelcomeScreen: true,
        initialMessages: s.greeting,
        i18n: { en: { title: s.title, subtitle: s.subtitle } },
      });
      // createChat mounts asynchronously.
      win.setTimeout(() => win.n8nChatFit?.(), 200);
    } finally {
      state.done = true;
    }
  })();
  return state.ready;
}
