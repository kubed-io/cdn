import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { KdMask, KdReveal } from '../../src/kd';
import { settle, shadow } from './mount';

// #box holds the reveal, a mask, and a mask inside another shadow root; c sits outside.
let box: HTMLElement;
let reveal: KdReveal;
let a: KdMask;
let b: KdMask;
let c: KdMask;

const shownValue = (m: KdMask) => shadow(m).querySelector('code')?.textContent ?? null;
const click = async (el: Element, selector = 'button') => {
  shadow(el).querySelector<HTMLButtonElement>(selector)!.click();
  await settle(el);
};
const all = () => Promise.all([a, b, c].map((m) => settle(m)));

describe('kd-reveal', () => {
  beforeEach(async () => {
    document.body.innerHTML = `<div id="box"><kd-reveal></kd-reveal><kd-mask value="a"></kd-mask><div id="host"></div></div>
      <kd-mask value="c"></kd-mask>`;
    box = document.getElementById('box')!;
    const host = document.getElementById('host')!.attachShadow({ mode: 'open' });
    host.innerHTML = `<kd-mask value="b"></kd-mask>`;
    reveal = box.querySelector('kd-reveal')!;
    a = box.querySelector('kd-mask')!;
    b = host.querySelector('kd-mask')!;
    c = document.body.querySelector(':scope > kd-mask')!;
    await settle(reveal);
    await all();
  });
  afterEach(() => document.body.replaceChildren());

  it('reveals every mask in its parent, through shadow roots', async () => {
    await click(reveal);
    await all();
    expect([shownValue(a), shownValue(b), shownValue(c)]).toEqual(['a', 'b', null]);
  });

  it('hides them again', async () => {
    const button = () => shadow(reveal).querySelector('button')!;
    expect(button().getAttribute('aria-pressed')).toBe('false');
    await click(reveal);
    expect(button().getAttribute('aria-pressed')).toBe('true');
    await click(reveal);
    await all();
    expect(button().getAttribute('aria-pressed')).toBe('false');
    expect([shownValue(a), shownValue(b)]).toEqual([null, null]);
  });

  it('does not stop single masks toggling', async () => {
    await click(reveal);
    await all();
    await click(a, 'button.hide');
    await all();
    expect([shownValue(a), shownValue(b)]).toEqual([null, 'b']);
  });

  it('a mask connected later starts hidden', async () => {
    await click(reveal);
    box.insertAdjacentHTML('beforeend', '<kd-mask value="d"></kd-mask>');
    const d = box.querySelector<KdMask>('kd-mask[value="d"]')!;
    await settle(d);
    expect(shownValue(d)).toBeNull();
  });

  it('hides what it revealed when it is removed', async () => {
    await click(reveal);
    await all();
    reveal.remove();
    await all();
    expect([shownValue(a), shownValue(b)]).toEqual([null, null]);
  });

  it('never copies a value out', async () => {
    await click(reveal);
    await all();
    const attrs = [reveal, a, b, c].flatMap((el) =>
      [...el.attributes].filter((x) => x.name !== 'value').map((x) => x.value),
    );
    expect(attrs.join(' ')).not.toMatch(/\b[ab]\b/);
    expect(shadow(reveal).textContent).not.toMatch(/\b[ab]\b/);
  });
});
