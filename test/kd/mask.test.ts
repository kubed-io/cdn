import { afterEach, describe, expect, it } from 'vitest';

import type { KdMask } from '../../src/kd';
import { mount, shadow, update } from './mount';

describe('kd-mask', () => {
  afterEach(() => document.body.replaceChildren());

  it('hides the value until clicked, and hides it again', async () => {
    const el = await mount<KdMask>(`<kd-mask value="s3cret"></kd-mask>`);
    expect(shadow(el).textContent).not.toContain('s3cret');
    shadow(el).querySelector('button')!.click();
    await el.updateComplete;
    expect(shadow(el).querySelector('code')?.textContent).toBe('s3cret');
    shadow(el).querySelector<HTMLButtonElement>('button.hide')!.click();
    await el.updateComplete;
    expect(shadow(el).textContent).not.toContain('s3cret');
  });

  it('starts hidden again when the value changes', async () => {
    const el = await mount<KdMask>(`<kd-mask value="one"></kd-mask>`);
    shadow(el).querySelector('button')!.click();
    await el.updateComplete;
    await update(el, { value: 'two' });
    expect(shadow(el).textContent).not.toContain('two');
    expect(shadow(el).querySelector('.dots')).not.toBeNull();
  });

  it('never puts the value in a tooltip or attribute of its own', async () => {
    const el = await mount<KdMask>(`<kd-mask value="s3cret"></kd-mask>`);
    shadow(el).querySelector('button')!.click();
    await el.updateComplete;
    for (const node of shadow(el).querySelectorAll('*')) {
      for (const attr of node.attributes) expect(attr.value).not.toContain('s3cret');
    }
  });
});
