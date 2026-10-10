import { html } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';

import type { KdSplit, SplitItem } from '../../src/kd';
import { mount, shadow, update } from './mount';

const ITEMS: SplitItem[] = [
  { id: 'a', label: 'alpha', cells: [{ text: 'default', tone: 'success' }] },
  { id: 'b', label: 'beta', sub: 'second' },
  { id: 'c', label: 'gamma' },
];
const list = (el: KdSplit) =>
  [...shadow(el).querySelectorAll('[role="option"]')].map((o) => ({
    label: o.querySelector('.label')?.textContent,
    selected: o.getAttribute('aria-selected'),
  }));
const detail = (el: KdSplit) => shadow(el).querySelector('.detail')?.textContent?.replace(/\s+/g, ' ').trim();

describe('kd-split', () => {
  afterEach(() => {
    document.body.replaceChildren();
    sessionStorage.clear();
  });

  it('lists the items and shows the first one by default', async () => {
    const el = await mount<KdSplit>(`<kd-split></kd-split>`);
    await update(el, { items: ITEMS, detail: (item) => html`<b>${item.label}</b>` });
    expect(list(el)).toEqual([
      { label: 'alpha', selected: 'true' },
      { label: 'beta', selected: 'false' },
      { label: 'gamma', selected: 'false' },
    ]);
    expect(shadow(el).querySelector('[role="option"] kd-pill')?.getAttribute('tone')).toBe('success');
    expect(shadow(el).querySelectorAll('[role="option"] .sub')[0]?.textContent).toBe('second');
    expect(detail(el)).toBe('alpha');
  });

  it('selects on click and on arrow keys, and says so', async () => {
    const el = await mount<KdSplit>(`<kd-split></kd-split>`);
    await update(el, { items: ITEMS, detail: (item) => item.label });
    const seen: unknown[] = [];
    el.addEventListener('change', (e) => seen.push((e as CustomEvent).detail.id));
    shadow(el).querySelectorAll<HTMLElement>('[role="option"]')[1].click();
    await el.updateComplete;
    expect(detail(el)).toBe('beta');
    shadow(el).querySelector('[role="listbox"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    expect(detail(el)).toBe('gamma');
    shadow(el).querySelector('[role="listbox"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    expect(detail(el)).toBe('gamma');
    expect(seen).toEqual(['b', 'c']);
  });

  it('remembers the selection by key, and falls back to the first when it is gone', async () => {
    let el = await mount<KdSplit>(`<kd-split key="sp"></kd-split>`);
    await update(el, { items: ITEMS, detail: (item) => item.label });
    shadow(el).querySelectorAll<HTMLElement>('[role="option"]')[2].click();
    await el.updateComplete;
    document.body.replaceChildren();
    el = await mount<KdSplit>(`<kd-split key="sp"></kd-split>`);
    await update(el, { items: ITEMS, detail: (item) => item.label });
    expect(detail(el)).toBe('gamma');
    await update(el, { items: ITEMS.slice(0, 2) });
    expect(detail(el)).toBe('alpha');
  });

  it('says so when there is nothing to list', async () => {
    const el = await mount<KdSplit>(`<kd-split empty="No mappers."></kd-split>`);
    await update(el, { items: [] });
    expect(shadow(el).textContent?.trim()).toBe('No mappers.');
    expect(shadow(el).querySelector('[role="listbox"]')).toBeNull();
  });
});
