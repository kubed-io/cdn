import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyState, applyToolCalls, placeCard, readToolCalls, stateCard } from '../../src/n8n';
import { dropdown, fakeScene, grid, row, tabs, textbox } from '../kd/fake-scene';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('readToolCalls', () => {
  const settable = ['pod', 'time_from', 'time_to', 'refresh', 'focus'];

  it('maps argument names onto settable names, the last call winning', () => {
    const state = readToolCalls(
      {
        tools: [
          { args: { pod: 'a', limit: 5, timeFrom: 'now-3h' } },
          { args: { pod: 'b', datname: '.*', refresh: '' } },
          { args: null },
        ],
      },
      settable,
    );
    expect(state.vars).toEqual({ pod: 'b', time_from: 'now-3h', time_to: 'now' });
  });

  it('follows the panel read, unless a focus was asked for', () => {
    expect(readToolCalls({ tools: [{ args: { panelId: 5 } }, { args: { panelId: 9 } }] }, settable).focus).toBe('9');
    expect(readToolCalls({ tools: [{ args: { focus: 'Storage' } }, { args: { panelId: 9 } }] }, settable).focus).toBe('Storage');
    expect(readToolCalls({ tools: [{ args: { panelId: 9 } }] }, ['pod']).focus).toBeNull();
    expect(readToolCalls(null, settable)).toEqual({ vars: {}, focus: null });
  });
});

describe('applyState', () => {
  it('applies settable names in order, the time window last and in one call', () => {
    const calls: string[] = [];
    const { win } = fakeScene({
      calls,
      variables: [dropdown('category', 'all', ['all', 'movies'], calls), textbox('pattern', '', calls)],
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const applied = applyState(
      win,
      { pattern: 'dune', time_from: 'now-3h', refresh: '10m', category: 'movies', focus: 'x', other: 'y' },
      ['category', 'time_from', 'refresh', 'pattern', 'focus'],
    );
    expect(calls).toEqual(['category=movies (MOVIES)', 'refresh 15m', 'pattern=dune', 'time now-3h..now']);
    expect(applied).toEqual({ category: 'movies', refresh: '15m', pattern: 'dune', time_from: 'now-3h', time_to: 'now' });
  });

  it('reports nothing it did not change', () => {
    const calls: string[] = [];
    const { win } = fakeScene({ calls, variables: [dropdown('pod', 'a', ['a'], calls)] });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(applyState(win, { pod: 'a' }, ['pod'])).toEqual({});
    expect(applyState(win, { pod: 'zzz' }, ['pod'])).toEqual({});
    expect(applyState(win, null, ['pod'])).toEqual({});
    expect(calls).toEqual([]);
  });
});

describe('the state card', () => {
  it('names the changes as text and offers the way back', () => {
    const doc = document;
    const go = vi.fn();
    const card = stateCard(doc, { time_from: 'now-3h', time_to: 'now', pod: '<b>x</b>' }, { group: 'Storage', kind: 'tab', panel: 7 }, go)!;
    expect(card.querySelector('.ncs-head')?.textContent).toBe('Changed your dashboard');
    expect([...card.querySelectorAll('.ncs-chip')].map((c) => c.textContent)).toEqual([
      'timenow-3h → now',
      'pod<b>x</b>',
      'tabStorage · panel 7',
    ]);
    expect(card.querySelector('b b')).toBeNull();
    card.querySelector<HTMLButtonElement>('button.ncs-go')!.click();
    expect(go).toHaveBeenCalledWith('7');
  });

  it('says moved when only the focus changed, and nothing when nothing did', () => {
    const card = stateCard(document, {}, { group: 'Logs', kind: 'row', panel: null }, () => {})!;
    expect(card.querySelector('.ncs-head')?.textContent).toBe('Moved your dashboard');
    expect(card.querySelector('button')?.textContent).toBe('sectionLogs');
    expect(stateCard(document, {}, null, () => {})).toBeNull();
  });

  it('goes inside the last bot message, or loose in the list', () => {
    document.body.innerHTML = '<div class="chat-messages-list"></div>';
    const loose = document.createElement('div');
    expect(placeCard(document, loose)).toBe(true);
    expect(loose.parentElement?.className).toBe('chat-messages-list');
    expect(loose.classList.contains('ncs-loose')).toBe(true);

    document.body.innerHTML =
      '<div class="chat-messages-list"><div class="chat-message-from-bot" id="a"></div><div class="chat-message-from-bot" id="b"></div></div>';
    const inside = document.createElement('div');
    placeCard(document, inside);
    expect(inside.parentElement?.id).toBe('b');
    expect(inside.classList.contains('ncs-loose')).toBe(false);
    document.body.innerHTML = '';
  });
});

describe('applyToolCalls', () => {
  it('sets, focuses, and appends the card after the reply settles', async () => {
    const calls: string[] = [];
    const { win } = fakeScene({
      calls,
      variables: [dropdown('pod', 'a', ['a', 'b'], calls)],
      rows: [row('', tabs([['Overview', grid(1)], ['Storage', grid(7)]], calls))],
    });
    win.document.body.innerHTML = '<div class="chat-messages-list"><div class="chat-message-from-bot"></div></div>';
    applyToolCalls(win, { tools: [{ args: { pod: 'b', panelId: 7 } }] }, ['pod', 'focus']);
    expect(calls).toEqual(['pod=b (B)', 'tab Storage']);
    expect(win.document.querySelector('.n8n-chat-state')).toBeNull();
    await new Promise((r) => setTimeout(r, 200));
    expect(win.document.querySelector('.chat-message-from-bot .n8n-chat-state')?.textContent).toContain('Storage');
  });

  it('does nothing on a dashboard with nothing settable', () => {
    const calls: string[] = [];
    const { win } = fakeScene({ calls, variables: [dropdown('pod', 'a', ['a', 'b'], calls)] });
    applyToolCalls(win, { tools: [{ args: { pod: 'b' } }] }, []);
    expect(calls).toEqual([]);
  });
});
