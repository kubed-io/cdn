import { afterEach, describe, expect, it } from 'vitest';

import type { KdSteps } from '../../src/kd';
import { mount, shadow, update } from './mount';

const steps = (el: KdSteps) =>
  [...shadow(el).querySelectorAll('li')].map((li) => ({
    cls: li.className,
    dot: li.querySelector('.dot')?.textContent,
    label: li.querySelector('.label')?.textContent,
  }));

describe('kd-steps', () => {
  afterEach(() => document.body.replaceChildren());

  it('maps lifecycle words to tones and glyphs', async () => {
    const data = [
      { label: 'Scheduled', status: 'done', time: '2m' },
      { label: 'Pulling', status: 'active' },
      { label: 'Ready', status: 'failed', detail: 'readiness probe failed' },
      { label: 'Serving', status: 'pending' },
    ];
    const el = await mount<KdSteps>(`<kd-steps data='${JSON.stringify(data)}'></kd-steps>`);
    expect(steps(el)).toEqual([
      { cls: 'success reached', dot: '✓', label: 'Scheduled' },
      { cls: 'primary active', dot: '2', label: 'Pulling' },
      { cls: 'error', dot: '✗', label: 'Ready' },
      { cls: 'neutral', dot: '4', label: 'Serving' },
    ]);
    expect(shadow(el).querySelector('.time')?.textContent).toBe('2m');
    const failed = shadow(el).querySelectorAll('li')[2];
    expect(failed.getAttribute('title')).toBe('readiness probe failed');
    expect(failed.querySelector('.detail')?.textContent).toBe('readiness probe failed');
  });

  it('takes tones as statuses and re-renders from the property', async () => {
    const el = await mount<KdSteps>(`<kd-steps></kd-steps>`);
    await update(el, { data: [{ label: 'Unknown', status: 'warning' }, { label: 'Ok', status: 'success' }] });
    expect(steps(el)).toEqual([
      { cls: 'warning', dot: '!', label: 'Unknown' },
      { cls: 'success reached', dot: '✓', label: 'Ok' },
    ]);
    await update(el, { data: [] });
    expect(shadow(el).querySelector('ol')).toBeNull();
  });
});
