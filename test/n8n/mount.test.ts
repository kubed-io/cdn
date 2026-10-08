import { afterEach, describe, expect, it, vi } from 'vitest';

import { CONTROL_NODE, mount, type ChatWindow } from '../../src/n8n';
import { dropdown, fakeScene } from '../kd/fake-scene';
import pkg from '../../package.json';

const CHAT = pkg.peerDependencies['@n8n/chat'];

const WEBHOOK = 'https://n8n.example/webhook/abc/chat';

function page(variables: any[] = [], calls: string[] = []) {
  const { win } = fakeScene({ variables, calls });
  win.document.body.innerHTML = '<a class="n8n-chat-tile" id="n8n-chat-tile"><div class="icon"></div><div class="label"></div></a>';
  // Capture the watcher instead of waiting a second for it.
  let watch: (() => void) | undefined;
  win.setInterval = ((fn: () => void) => {
    watch = fn;
    return 1;
  }) as any;
  const createChat = vi.fn((options: Record<string, unknown>) => {
    const root = win.document.createElement('div');
    root.id = 'n8n-chat';
    win.document.body.append(root);
    return options;
  });
  const loader = vi.fn(async (_url: string) => ({ createChat }));
  return { win: win as unknown as ChatWindow, createChat, loader, tick: () => watch?.() };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('mount', () => {
  it('fills the tile and leaves no chat without a webhook', async () => {
    const { win, loader } = page();
    win.document.body.insertAdjacentHTML('beforeend', '<div id="n8n-chat"></div>');
    await mount({ window: win, icon: '🐘', label: 'Postgres', link: 'https://www.postgresql.org' }, loader);
    const tile = win.document.getElementById('n8n-chat-tile')!;
    expect(tile.querySelector('.icon')?.textContent).toBe('🐘');
    expect(tile.querySelector('.label')?.textContent).toBe('Postgres');
    expect(tile.getAttribute('href')).toBe('https://www.postgresql.org');
    expect(tile.getAttribute('target')).toBe('_blank');
    expect(win.document.getElementById('n8n-chat')).toBeNull();
    expect(win.document.querySelectorAll('style[data-n8n-chat-tile]')).toHaveLength(1);
    expect(win.document.querySelector('link[data-n8n-chat-style]')).toBeNull();
    expect(loader).not.toHaveBeenCalled();
    expect(win.n8nChat).toBeNull();
    expect(typeof win.dashboardFocus).toBe('function');
  });

  it('shows an image icon and fills a kd-tile by attributes', async () => {
    const { win, loader } = page();
    await mount({ window: win, icon: '/public/img/x.svg', label: 'X', link: '/d/other' }, loader);
    const tile = win.document.getElementById('n8n-chat-tile')!;
    expect(tile.querySelector('.icon img')?.getAttribute('src')).toBe('/public/img/x.svg');
    expect(tile.getAttribute('target')).toBeNull();

    const kd = win.document.createElement('kd-tile');
    await mount({ window: win, tile: kd, icon: 'x', label: 'Y', link: '' }, loader);
    expect([kd.getAttribute('icon'), kd.getAttribute('label'), kd.hasAttribute('href')]).toEqual(['x', 'Y', false]);
  });

  it('creates one chat however often the panel re-runs it', async () => {
    const { win, createChat, loader } = page();
    const config = { window: win, webhook: WEBHOOK, auth: 'Basic dGVzdA==', title: 'Postgres', greeting: 'Hi|Ask me', stream: 'true' };
    await Promise.all([mount(config, loader), mount(config, loader)]);
    await mount(config, loader);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(loader).toHaveBeenCalledWith(`https://cdn.jsdelivr.net/npm/@n8n/chat@${CHAT}/dist/chat.bundle.es.js`);
    expect(createChat).toHaveBeenCalledTimes(1);
    expect(createChat.mock.calls[0][0]).toMatchObject({
      webhookUrl: WEBHOOK,
      webhookConfig: { headers: { Authorization: 'Basic dGVzdA==' } },
      enableStreaming: true,
      loadPreviousSession: true,
      initialMessages: ['Hi', 'Ask me'],
      i18n: { en: { title: 'Postgres', subtitle: '' } },
    });
    expect(win.document.querySelectorAll('#n8n-chat')).toHaveLength(1);
    expect(win.document.querySelectorAll('style[data-n8n-chat-tile]')).toHaveLength(1);
    expect(win.document.querySelector('link[data-n8n-chat-style]')?.getAttribute('href')).toBe(
      `https://cdn.jsdelivr.net/npm/@n8n/chat@${CHAT}/dist/style.css`,
    );
    expect(JSON.stringify(win.n8nChatMount)).not.toContain('dGVzdA');
  });

  it('replaces the chat when the settings change, and only the last mount creates one', async () => {
    const { win, createChat, loader } = page();
    await mount({ window: win, webhook: WEBHOOK }, loader);
    const first = mount({ window: win, webhook: WEBHOOK, title: 'A' }, loader);
    const second = mount({ window: win, webhook: WEBHOOK, title: 'B' }, loader);
    await Promise.all([first, second]);
    expect(createChat).toHaveBeenCalledTimes(2);
    expect(createChat.mock.calls[1][0]).toMatchObject({ i18n: { en: { title: 'B' } } });
    expect(win.document.querySelectorAll('#n8n-chat')).toHaveLength(1);
  });

  it('removes the chat when the page leaves the dashboard', async () => {
    const { win, loader, tick } = page();
    await mount({ window: win, webhook: WEBHOOK }, loader);
    tick();
    expect(win.document.getElementById('n8n-chat')).not.toBeNull();
    win.history.pushState({}, '', '/d/elsewhere/other');
    tick();
    expect(win.document.getElementById('n8n-chat')).toBeNull();
    expect(win.n8nChat).toBeNull();
  });

  it('removes a leftover chat when a dashboard has none', async () => {
    const { win, loader } = page();
    await mount({ window: win, webhook: WEBHOOK }, loader);
    await mount({ window: win, webhook: '' }, loader);
    expect(win.document.getElementById('n8n-chat')).toBeNull();
  });
});

describe('the fetch wrapper', () => {
  const ndjson = (...lines: unknown[]) => lines.map((l) => JSON.stringify(l) + '\n').join('');

  async function wired(settable = 'pod') {
    const calls: string[] = [];
    const p = page([dropdown('pod', 'a', ['a', 'b'], calls)], calls);
    const reply = { body: '' };
    const base = vi.fn(async () => new Response(reply.body, { status: 200, headers: { 'content-type': 'application/json' } }));
    p.win.fetch = base as any;
    await mount({ window: p.win, webhook: WEBHOOK, settable, stream: 'true' }, p.loader);
    return { ...p, calls, reply, base };
  }

  it('takes the control chunk out of the stream and applies it', async () => {
    const { win, calls, reply } = await wired();
    reply.body = ndjson(
      { type: 'item', content: 'Done.', metadata: { nodeName: 'Agent' } },
      { type: 'begin', metadata: { nodeName: CONTROL_NODE } },
      { type: 'item', content: JSON.stringify({ tools: [{ args: { pod: 'b' } }] }), metadata: { nodeName: CONTROL_NODE } },
    );
    const res = await win.fetch(WEBHOOK, { method: 'POST', body: JSON.stringify({ action: 'sendMessage', chatInput: 'hi' }) });
    expect(await res.text()).toBe(ndjson({ type: 'item', content: 'Done.', metadata: { nodeName: 'Agent' } }));
    expect(calls).toEqual(['pod=b (B)']);
  });

  it('cleans a reloaded session', async () => {
    const { win, reply } = await wired();
    reply.body = JSON.stringify({ data: [{ id: ['x', 'ToolMessage'], kwargs: { content: '{}' } }, { id: ['x', 'AIMessage'], kwargs: { content: 'hi' } }] });
    const res = await win.fetch(WEBHOOK, { method: 'POST', body: JSON.stringify({ action: 'loadPreviousSession' }) });
    expect(await res.json()).toEqual({ data: [{ id: ['x', 'AIMessage'], kwargs: { content: 'hi' } }] });
  });

  it('leaves every other request alone, and wraps fetch once', async () => {
    const { win, loader, reply, base } = await wired();
    reply.body = 'untouched';
    const wrapped = win.fetch;
    await mount({ window: win, webhook: WEBHOOK, settable: 'other' }, loader);
    expect(win.fetch).toBe(wrapped);
    expect(await (await win.fetch('https://grafana.example/api/ds/query', { body: '"sendMessage"' })).text()).toBe('untouched');
    expect(base).toHaveBeenCalledTimes(1);
  });
});
