import { afterEach, describe, expect, it } from 'vitest';

import type { KdStatus } from '../../src/kd';
import { mount, shadow, update } from './mount';

const badges = (el: KdStatus) =>
  [...shadow(el).querySelectorAll('.badge')].map((b) => ({
    cls: b.className,
    dot: b.querySelector('.dot')?.textContent,
    label: b.querySelector('.label')?.textContent,
  }));

describe('kd-status', () => {
  afterEach(() => document.body.replaceChildren());

  it('maps ok to tones and glyphs', async () => {
    const el = await mount<KdStatus>(`<kd-status></kd-status>`);
    await update(el, {
      data: {
        checks: [
          { label: 'a', ok: true },
          { label: 'b', ok: false },
          { label: 'c', ok: null },
          { label: 'd', ok: 'warning' },
          { label: 'e', ok: 'info' },
          // Not a tone: neutral, never dropped.
          { label: 'f', ok: 'Running' as never },
        ],
      },
    });
    expect(badges(el)).toEqual([
      { cls: 'badge success', dot: '✓', label: 'a' },
      { cls: 'badge error', dot: '✗', label: 'b' },
      { cls: 'badge warning', dot: '?', label: 'c' },
      { cls: 'badge warning', dot: '!', label: 'd' },
      { cls: 'badge info', dot: '•', label: 'e' },
      { cls: 'badge neutral', dot: '•', label: 'f' },
    ]);
  });

  it('shows detail under a failing check and as a tooltip on a passing one', async () => {
    const el = await mount<KdStatus>(`<kd-status></kd-status>`);
    await update(el, {
      data: {
        checks: [
          { label: 'Ready', ok: false, detail: 'containers not ready' },
          { label: 'Scheduled', ok: true, detail: 'on node-1' },
        ],
      },
    });
    const [failing, passing] = shadow(el).querySelectorAll('.badge');
    expect(failing.querySelector('.detail')?.textContent).toBe('containers not ready');
    expect(passing.querySelector('.detail')).toBeNull();
    expect(passing.getAttribute('title')).toBe('on node-1');
  });

  it('renders the headline through renderCell', async () => {
    const el = await mount<KdStatus>(`<kd-status></kd-status>`);
    await update(el, { data: { headline: [{ text: 'Running', tone: 'success' }, '2/3'] } });
    const headline = shadow(el).querySelector('.headline');
    const pills = headline?.querySelectorAll('kd-pill') ?? [];
    expect(pills).toHaveLength(1);
    expect(pills[0].getAttribute('tone')).toBe('success');
    expect(headline?.textContent).toContain('2/3');
  });

  it('keeps the given order and the when', async () => {
    const el = await mount<KdStatus>(`<kd-status></kd-status>`);
    await update(el, {
      data: { checks: [{ label: 'z', ok: true, when: '3m' }, { label: 'a', ok: true }, { label: 'm', ok: false }] },
    });
    expect(badges(el).map((b) => b.label)).toEqual(['z', 'a', 'm']);
    expect(shadow(el).querySelector('.when')?.textContent).toBe('3m');
  });

  it('renders nothing without data', async () => {
    const el = await mount<KdStatus>(`<kd-status></kd-status>`);
    for (const data of [undefined, {}, { checks: [] }]) {
      await update(el, { data });
      expect(shadow(el).querySelector('.headline')).toBeNull();
      expect(shadow(el).querySelector('.checks')).toBeNull();
    }
  });

  it('reads the data attribute', async () => {
    const el = await mount<KdStatus>(`<kd-status data='{"checks":[{"label":"Ready","ok":true}]}'></kd-status>`);
    expect(shadow(el).querySelectorAll('.badge')).toHaveLength(1);
  });
});
