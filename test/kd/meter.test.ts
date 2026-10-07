import { afterEach, describe, expect, it } from 'vitest';

import type { KdMeter } from '../../src/kd';
import { mount, shadow, update } from './mount';

const q = (el: KdMeter, s: string) => shadow(el).querySelector(s) as HTMLElement | null;

describe('kd-meter', () => {
  afterEach(() => document.body.replaceChildren());

  it('fills against the largest mark and lists the marks', async () => {
    const data = {
      value: 384,
      unit: 'Mi',
      marks: [
        { label: 'request', value: 256 },
        { label: 'limit', value: 512, tone: 'error' },
      ],
    };
    const el = await mount<KdMeter>(`<kd-meter data='${JSON.stringify(data)}'></kd-meter>`);
    expect(q(el, '.fill')?.style.width).toBe('75%');
    expect(q(el, '.fill')?.className).toBe('fill primary');
    const marks = [...shadow(el).querySelectorAll('.track .mark')] as HTMLElement[];
    // Each mark's left edge is clamped so one at the maximum stays inside the track.
    expect(marks.map((m) => m.style.left)).toEqual(['calc(50% - 1px)', 'calc(100% - 2px)']);
    expect(marks.map((m) => m.className)).toEqual(['mark neutral', 'mark error']);
    const legend = [...q(el, '.legend')!.children].map((c) => c.textContent?.replace(/\s+/g, ' ').trim());
    expect(legend).toEqual(['384Mi', 'request 256Mi', 'limit 512Mi']);
    expect(q(el, '[role=meter]')?.getAttribute('aria-valuenow')).toBe('384');
  });

  it('takes the tone of the highest toned mark reached, and honours max', async () => {
    const el = await mount<KdMeter>(`<kd-meter></kd-meter>`);
    await update(el, {
      data: {
        value: 90,
        max: 200,
        marks: [
          { label: 'warn', value: 50, tone: 'warning' },
          { label: 'limit', value: 80, tone: 'error' },
        ],
      },
    });
    expect(q(el, '.fill')?.className).toBe('fill error');
    expect(q(el, '.fill')?.style.width).toBe('45%');
  });

  it('shows only the marks without a value', async () => {
    const el = await mount<KdMeter>(`<kd-meter></kd-meter>`);
    await update(el, { data: { value: null, marks: [{ label: 'limit', value: 1 }] } });
    expect(q(el, '.fill')).toBeNull();
    expect(q(el, '.value')?.textContent).toBe('–');
    expect(q(el, '[role=meter]')?.hasAttribute('aria-valuenow')).toBe(false);
  });
});
