import { afterEach, describe, expect, it } from 'vitest';

import type { KdSheet } from '../../src/kd';
import { mount, shadow, update } from './mount';

const pairs = (el: KdSheet) =>
  [...shadow(el).querySelectorAll('dt')].map((dt) => [dt.textContent, dt.nextElementSibling?.textContent?.trim()]);

describe('kd-sheet', () => {
  afterEach(() => document.body.replaceChildren());

  it('renders a plain object from the data attribute', async () => {
    const el = await mount<KdSheet>(`<kd-sheet data='{"Node":"node-1","Restarts":0,"IP":null}'></kd-sheet>`);
    expect(pairs(el)).toEqual([
      ['Node', 'node-1'],
      ['Restarts', '0'],
    ]);
  });

  it('renders rows from the property, in order, with cells', async () => {
    const el = await mount<KdSheet>(`<kd-sheet></kd-sheet>`);
    await update(el, {
      data: [
        { key: 'Phase', value: { text: 'Running', tone: 'success' } },
        { key: 'Image', value: { code: 'nginx:1.27' } },
        { key: 'Empty', value: '' },
        { key: 'Ports', value: [80, 443] },
      ],
    });
    expect(pairs(el).map(([k]) => k)).toEqual(['Phase', 'Image', 'Ports']);
    expect(shadow(el).querySelector('kd-pill')?.getAttribute('tone')).toBe('success');
    expect(shadow(el).querySelector('code')?.textContent).toBe('nginx:1.27');
    expect(shadow(el).querySelectorAll('.cells > span').length).toBe(2);

    await update(el, { data: { Phase: 'Pending' } });
    expect(pairs(el)).toEqual([['Phase', 'Pending']]);
  });

  it('lays rows out as label-over-value tiles', async () => {
    const el = await mount<KdSheet>(`<kd-sheet layout="grid"></kd-sheet>`);
    await update(el, {
      data: [
        { key: 'A', value: '1' },
        { key: 'B', value: '' },
        { key: 'C', value: '3', wide: true },
      ],
    });
    const cells = [...shadow(el).querySelectorAll('.grid > .cell')];
    expect(cells.map((c) => c.querySelector('.label')?.textContent)).toEqual(['A', 'C']);
    expect(cells.map((c) => c.querySelector('.value')?.textContent?.trim())).toEqual(['1', '3']);
    expect(cells[1].classList.contains('wide')).toBe(true);
    expect(cells[0].classList.contains('wide')).toBe(false);
  });

  it('renders nothing when every row is empty, in either layout', async () => {
    for (const layout of ['grid', 'list']) {
      const el = await mount<KdSheet>(`<kd-sheet layout="${layout}"></kd-sheet>`);
      await update(el, { data: [{ key: 'A', value: '' }, { key: 'B', value: null }] });
      expect(shadow(el).querySelector('.grid, dl'), layout).toBeNull();
    }
  });

  it('sets keys in monospace', async () => {
    const el = await mount<KdSheet>(`<kd-sheet mono data='{"PATH":"/bin"}'></kd-sheet>`);
    expect(shadow(el).querySelector('dl')?.classList.contains('mono')).toBe(true);
    await update(el, { mono: false });
    expect(shadow(el).querySelector('dl')?.classList.contains('mono')).toBe(false);
  });

  it('grid tiles shrink to a narrow panel', async () => {
    const { KdSheet } = await import('../../src/kd');
    const css = [KdSheet.styles].flat(Infinity).map((x) => String((x as { cssText?: string }).cssText ?? '')).join('');
    expect(css).toContain('minmax(min(190px, 100%), 1fr)');
  });
});
