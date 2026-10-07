import { afterEach, describe, expect, it } from 'vitest';

import type { KdPill } from '../../src/kd';
import { mount, shadow, update } from './mount';

describe('kd-pill', () => {
  afterEach(() => document.body.replaceChildren());

  it('slots its text and maps the tone to a class', async () => {
    const el = await mount<KdPill>(`<kd-pill tone="success" title="all ready">Running</kd-pill>`);
    expect(el.textContent).toBe('Running');
    expect(el.title).toBe('all ready');
    expect(shadow(el).querySelector('span')?.className).toBe('success');
    expect(shadow(el).querySelector('slot')).not.toBeNull();
  });

  it('is neutral without a tone or with an unknown one', async () => {
    const el = await mount<KdPill>(`<kd-pill>x</kd-pill>`);
    expect(shadow(el).querySelector('span')?.className).toBe('neutral');
    await update(el, { tone: 'purple' as never });
    expect(shadow(el).querySelector('span')?.className).toBe('neutral');
    await update(el, { tone: 'error' });
    expect(shadow(el).querySelector('span')?.className).toBe('error');
  });
});
