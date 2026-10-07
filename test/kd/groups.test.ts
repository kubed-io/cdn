import { afterEach, describe, expect, it } from 'vitest';

import type { KdData, KdGroups } from '../../src/kd';
import { mount, shadow, update } from './mount';

const LABELS = {
  'app.kubernetes.io/name': 'web',
  app: 'web',
  'pod-template-hash': '7d9c',
  'app.kubernetes.io/part-of': 'shop',
  'helm.sh/chart': 'web-1.0.0',
  flag: '',
};

describe('kd-groups', () => {
  afterEach(() => document.body.replaceChildren());

  it('groups labels by prefix as pills, unprefixed first without a header', async () => {
    const el = await mount<KdGroups>(`<kd-groups data='${JSON.stringify(LABELS)}'></kd-groups>`);
    const groups = [...shadow(el).querySelectorAll('.group')];
    expect(groups.map((g) => g.querySelector('.head')?.textContent ?? '')).toEqual(['', 'app.kubernetes.io', 'helm.sh']);
    const pills = [...groups[0].querySelectorAll('kd-pill')];
    expect(pills.map((p) => p.textContent)).toEqual(['app=web', 'pod-template-hash=7d9c', 'flag']);
    expect(pills[0].getAttribute('tone')).toBe('info');
    const prefixed = groups[1].querySelector('kd-pill');
    expect(prefixed?.textContent).toBe('name=web');
    expect(prefixed?.getAttribute('title')).toBe('app.kubernetes.io/name');
  });

  it('re-renders with new data and says none when empty', async () => {
    const el = await mount<KdGroups>(`<kd-groups></kd-groups>`);
    await update(el, { data: { a: '1' } });
    expect(shadow(el).querySelectorAll('kd-pill').length).toBe(1);
    await update(el, { data: {} });
    expect(shadow(el).querySelector('.none')?.textContent).toBe('none');
  });

  it('shows annotations as a tree, folding JSON values into kd-data', async () => {
    const config = JSON.stringify({ apiVersion: 'v1', kind: 'Service', metadata: { name: 'web' } });
    const el = await mount<KdGroups>(`<kd-groups mode="tree"></kd-groups>`);
    await update(el, {
      data: {
        'kubectl.kubernetes.io/last-applied-configuration': config,
        'deployment.kubernetes.io/revision': '3',
        note: 'plain',
        brace: '{not json',
        'kubectl.kubernetes.io/restartedAt': '2026-10-07T10:00:00Z',
      },
    });
    const rows = [...shadow(el).querySelectorAll('tr')];
    const heads = rows.filter((r) => r.classList.contains('head')).map((r) => r.textContent);
    expect(heads).toEqual(['deployment.kubernetes.io', 'kubectl.kubernetes.io']);
    // Unprefixed first, without a header row or a twig.
    expect(rows[0].querySelector('code')?.textContent).toBe('note');
    expect(rows[0].querySelector('.twig')).toBeNull();
    expect(rows[1].querySelector('.v')?.textContent?.trim()).toBe('{not json');
    const kubectl = rows.slice(rows.findIndex((r) => r.textContent === 'kubectl.kubernetes.io') + 1);
    expect(kubectl.map((r) => r.querySelector('.twig')?.textContent)).toEqual(['├', '└']);
    const data = kubectl[0].querySelector('kd-data') as KdData;
    expect(data.data).toEqual(JSON.parse(config));
    expect(kubectl[1].querySelector('kd-data')).toBeNull();
  });

  it('clips a very long plain value', async () => {
    const el = await mount<KdGroups>(`<kd-groups mode="tree"></kd-groups>`);
    await update(el, { data: { long: 'x'.repeat(700) } });
    expect(shadow(el).querySelector('.v')?.textContent?.trim()).toBe(`${'x'.repeat(600)} …`);
  });
});
