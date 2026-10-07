import { afterEach, describe, expect, it } from 'vitest';

import type { KdTile } from '../../src/kd';
import { mount, shadow, update } from './mount';

describe('kd-tile', () => {
  afterEach(() => document.body.replaceChildren());

  it('renders an emoji tile linking in the same tab', async () => {
    const el = await mount<KdTile>(`<kd-tile icon="🤖" label="Ask" href="/d/n8n"></kd-tile>`);
    const a = shadow(el).querySelector('a');
    expect(a?.getAttribute('href')).toBe('/d/n8n');
    expect(a?.hasAttribute('target')).toBe(false);
    expect(shadow(el).querySelector('span.icon')?.textContent).toBe('🤖');
    expect(shadow(el).querySelector('.label')?.textContent).toBe('Ask');
  });

  it('opens an http link in a new tab and shows an image icon', async () => {
    const el = await mount<KdTile>(`<kd-tile></kd-tile>`);
    await update(el, { icon: 'https://x/n8n.svg', label: 'n8n', href: 'https://n8n.example/' });
    expect(shadow(el).querySelector('a')?.getAttribute('target')).toBe('_blank');
    expect(shadow(el).querySelector('img.icon')?.getAttribute('src')).toBe('https://x/n8n.svg');
  });

  it('is not a link without a safe href', async () => {
    const el = await mount<KdTile>(`<kd-tile label="x" href="javascript:alert(1)"></kd-tile>`);
    expect(shadow(el).querySelector('a')).toBeNull();
  });
});
