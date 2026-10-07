import { afterEach, describe, expect, it } from 'vitest';

import type { KdTabs } from '../../src/kd';
import { mount, shadow, update } from './mount';

const PANES = `<section label="Events" count="3">events</section><section label="YAML">yaml</section><section label="Logs">logs</section>`;

const tabs = (el: KdTabs) => [...shadow(el).querySelectorAll('button')];
const open = (el: KdTabs) =>
  [...shadow(el).querySelectorAll('[role=tabpanel]:not([hidden]) slot')].flatMap((slot) =>
    (slot as HTMLSlotElement).assignedElements().map((e) => e.textContent),
  );
const chosen = (el: KdTabs) => tabs(el).findIndex((b) => b.getAttribute('aria-selected') === 'true');

describe('kd-tabs', () => {
  afterEach(() => {
    document.body.replaceChildren();
    sessionStorage.clear();
  });

  it('labels a tab per child pane, with counts, opening the first', async () => {
    const el = await mount<KdTabs>(`<kd-tabs>${PANES}</kd-tabs>`);
    expect(tabs(el).map((b) => b.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['Events3', 'YAML', 'Logs']);
    expect(tabs(el)[0].querySelector('.count')?.textContent).toBe('3');
    expect(chosen(el)).toBe(0);
    expect(open(el)).toEqual(['events']);
  });

  it('selects by label or index, and on click', async () => {
    const el = await mount<KdTabs>(`<kd-tabs selected="Logs">${PANES}</kd-tabs>`);
    expect(open(el)).toEqual(['logs']);
    await update(el, { selected: '1' });
    expect(open(el)).toEqual(['yaml']);
    await update(el, { selected: 'nope' });
    expect(open(el)).toEqual(['events']);

    const changes: unknown[] = [];
    el.addEventListener('change', (e) => changes.push((e as CustomEvent).detail));
    tabs(el)[2].click();
    await el.updateComplete;
    expect(el.selected).toBe('Logs');
    expect(chosen(el)).toBe(2);
    expect(open(el)).toEqual(['logs']);
    expect(changes).toEqual([{ label: 'Logs', index: 2 }]);
  });

  it('remembers the selection per key across recreation', async () => {
    const first = await mount<KdTabs>(`<kd-tabs key="pod">${PANES}</kd-tabs>`);
    tabs(first)[1].click();
    await first.updateComplete;
    expect(sessionStorage.getItem('kd-tabs:pod')).toBe('YAML');
    first.remove();

    const again = await mount<KdTabs>(`<kd-tabs key="pod" selected="Events">${PANES}</kd-tabs>`);
    expect(open(again)).toEqual(['yaml']);
    const other = await mount<KdTabs>(`<kd-tabs key="node">${PANES}</kd-tabs>`);
    expect(open(other)).toEqual(['events']);
  });

  it('survives storage that throws', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    try {
      const el = await mount<KdTabs>(`<kd-tabs key="pod">${PANES}</kd-tabs>`);
      tabs(el)[2].click();
      await el.updateComplete;
      expect(open(el)).toEqual(['logs']);
    } finally {
      if (original) Object.defineProperty(window, 'sessionStorage', original);
    }
  });

  it('follows panes added and relabelled later', async () => {
    const el = await mount<KdTabs>(`<kd-tabs><section label="One">1</section></kd-tabs>`);
    const pane = document.createElement('section');
    pane.setAttribute('label', 'Two');
    el.append(pane);
    await new Promise((r) => setTimeout(r));
    await el.updateComplete;
    expect(tabs(el).map((b) => b.textContent?.trim())).toEqual(['One', 'Two']);
    await update(el, { selected: 'Two' });
    expect(shadow(el).querySelectorAll('[role=tabpanel]').length).toBe(2);
    expect((shadow(el).querySelectorAll('slot')[1] as HTMLSlotElement).assignedElements()).toEqual([pane]);
    pane.setAttribute('label', 'Deux');
    await new Promise((r) => setTimeout(r));
    await el.updateComplete;
    expect(tabs(el)[1].textContent?.trim()).toBe('Deux');
  });
});
