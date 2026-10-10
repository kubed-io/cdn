import { afterEach, describe, expect, it } from 'vitest';

import type { KdCard } from '../../src/kd';
import { mount, shadow, update } from './mount';

describe('kd-card', () => {
  afterEach(() => document.body.replaceChildren());

  it('draws the accent and dot only with a tone', async () => {
    const el = await mount<KdCard>(`<kd-card></kd-card>`);
    await update(el, { data: { name: 'app', tone: 'error' } });
    expect(shadow(el).querySelector('article')?.className).toBe('card error');
    expect(shadow(el).querySelector('.dot')).not.toBeNull();
    await update(el, { data: { name: 'app' } });
    expect(shadow(el).querySelector('article')?.className).toBe('card');
    expect(shadow(el).querySelector('.dot')).toBeNull();
    // Not a tone: no accent, no dot.
    await update(el, { data: { name: 'app', tone: 'Running' as never } });
    expect(shadow(el).querySelector('article')?.className).toBe('card');
    expect(shadow(el).querySelector('.dot')).toBeNull();
  });

  it('renders name, icon, cells, state and message', async () => {
    const el = await mount<KdCard>(`<kd-card></kd-card>`);
    await update(el, {
      data: {
        name: 'app',
        icon: '📦',
        tone: 'warning',
        cells: [{ text: 'v1.2', tone: 'info' }],
        state: 'Waiting',
        message: 'ImagePullBackOff',
      },
    });
    const root = shadow(el);
    expect(root.querySelector('.name')?.textContent).toBe('app');
    expect(root.querySelector('.icon')?.textContent).toBe('📦');
    expect(root.querySelector('.head kd-pill')?.getAttribute('tone')).toBe('info');
    expect(root.querySelector('.state')?.textContent).toBe('Waiting');
    expect(root.querySelector('.message')?.textContent).toBe('ImagePullBackOff');
  });

  it('projects its body, with or without data', async () => {
    const el = await mount<KdCard>(`<kd-card><p id="b">x</p></kd-card>`);
    const slot = shadow(el).querySelector('slot');
    expect(slot?.assignedElements().map((e) => e.id)).toEqual(['b']);
  });

  it('leaves out an empty header', async () => {
    const el = await mount<KdCard>(`<kd-card></kd-card>`);
    await update(el, { data: { state: 'Running', tone: 'success' } });
    expect(shadow(el).querySelector('.head')).toBeNull();
    expect(shadow(el).querySelector('.state')?.textContent).toBe('Running');
  });
});
