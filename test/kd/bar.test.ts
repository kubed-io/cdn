import { afterEach, describe, expect, it } from 'vitest';

import type { KdBar } from '../../src/kd';
import { mount, shadow, update } from './mount';

describe('kd-bar', () => {
  afterEach(() => document.body.replaceChildren());

  it('renders icon, eyebrow and title from the data attribute', async () => {
    const el = await mount<KdBar>(`<kd-bar data='{"icon":"https://x/pod.svg","eyebrow":"Pod","title":"web-0"}'></kd-bar>`);
    expect(shadow(el).querySelector('img.icon')?.getAttribute('src')).toBe('https://x/pod.svg');
    expect(shadow(el).querySelector('.eyebrow')?.textContent?.trim()).toBe('Pod');
    expect(shadow(el).querySelector('.title')?.textContent).toBe('web-0');
    expect(shadow(el).querySelector('.chain')).toBeNull();
  });

  it('renders chips and a breadcrumb chain from the property', async () => {
    const el = await mount<KdBar>(`<kd-bar></kd-bar>`);
    await update(el, {
      data: {
        icon: '🐘',
        eyebrow: ['StatefulSet ·', { dashboard: 'k8s-namespace', vars: { app_namespace: 'db' }, text: 'db' }],
        title: 'postgresql',
        chips: [{ text: '1/1 ready', tone: 'success' }, null],
        chain: [
          { dashboard: 'k8s-workload', text: 'postgresql' },
          { dashboard: 'k8s-pod', text: 'postgresql-0' },
        ],
      },
    });
    expect(shadow(el).querySelector('span.icon')?.textContent).toBe('🐘');
    expect(shadow(el).querySelector('.eyebrow kd-link')).not.toBeNull();
    expect(shadow(el).querySelectorAll('.chips kd-pill').length).toBe(1);
    expect(shadow(el).querySelectorAll('.chain kd-link').length).toBe(2);
    expect(shadow(el).querySelectorAll('.chain .sep').length).toBe(1);

    await update(el, { data: { title: 'other' } });
    expect(shadow(el).querySelector('.title')?.textContent).toBe('other');
    expect(shadow(el).querySelector('.eyebrow')).toBeNull();
    expect(shadow(el).querySelector('.icon')).toBeNull();
  });
});
