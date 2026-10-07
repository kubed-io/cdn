import { afterEach, describe, expect, it } from 'vitest';

import type { KdTable } from '../../src/kd';
import { mount, shadow, update } from './mount';

const grid = (el: KdTable) =>
  [...shadow(el).querySelectorAll('tr')].map((tr) => [...tr.children].map((c) => c.textContent?.trim()));

describe('kd-table', () => {
  afterEach(() => document.body.replaceChildren());

  it('renders columns and rows from the data attribute', async () => {
    const data = {
      columns: [{ key: 'reason', label: 'Reason' }, { key: 'n', label: 'Count', align: 'right' }],
      rows: [{ reason: 'Pulled', n: 2, extra: 'hidden' }, { reason: { text: 'BackOff', tone: 'warning' }, n: 7 }],
    };
    const el = await mount<KdTable>(`<kd-table data='${JSON.stringify(data)}'></kd-table>`);
    expect(grid(el)).toEqual([
      ['Reason', 'Count'],
      ['Pulled', '2'],
      ['BackOff', '7'],
    ]);
    expect(shadow(el).querySelector('td.right')?.textContent?.trim()).toBe('2');
    expect(shadow(el).querySelector('kd-pill')?.getAttribute('tone')).toBe('warning');
  });

  it('takes bare rows from the property, deriving the columns', async () => {
    const el = await mount<KdTable>(`<kd-table></kd-table>`);
    await update(el, { data: [{ a: 1 }, { b: 2, a: 3 }] });
    expect(grid(el)).toEqual([
      ['a', 'b'],
      ['1', ''],
      ['3', '2'],
    ]);
  });

  it('shows the empty text with no rows', async () => {
    const el = await mount<KdTable>(`<kd-table data='{"rows":[]}'></kd-table>`);
    expect(shadow(el).querySelector('.none')?.textContent).toBe('none');
    await update(el, { empty: 'No events' });
    expect(shadow(el).querySelector('.none')?.textContent).toBe('No events');
  });
});
