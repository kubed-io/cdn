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
});
