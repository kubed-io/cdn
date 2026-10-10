import { afterEach, describe, expect, it } from 'vitest';

import type { KdAccordion } from '../../src/kd';
import { mount, shadow } from './mount';

const heads = (el: KdAccordion) =>
  [...shadow(el).querySelectorAll('button')].map((b) => ({
    label: b.querySelector('.label')?.textContent,
    count: b.querySelector('.count')?.textContent ?? null,
    expanded: b.getAttribute('aria-expanded'),
    empty: b.classList.contains('empty'),
  }));
const open = (el: KdAccordion) => [...shadow(el).querySelectorAll('[role="region"]')].map((r) => !r.hasAttribute('hidden'));

describe('kd-accordion', () => {
  afterEach(() => {
    document.body.replaceChildren();
    sessionStorage.clear();
  });

  it('heads every child section with its label and count, open unless empty or collapsed', async () => {
    const el = await mount<KdAccordion>(`<kd-accordion>
      <section label="Scopes" count="11">a</section>
      <section label="Authorization" count="0">b</section>
      <section label="Advanced" collapsed>c</section>
      <section label="Roles" count="0" open>d</section>
    </kd-accordion>`);
    expect(heads(el)).toEqual([
      { label: 'Scopes', count: '11', expanded: 'true', empty: false },
      { label: 'Authorization', count: '0', expanded: 'false', empty: true },
      { label: 'Advanced', count: null, expanded: 'false', empty: false },
      { label: 'Roles', count: '0', expanded: 'true', empty: true },
    ]);
    expect(open(el)).toEqual([true, false, false, true]);
    const slots = [...shadow(el).querySelectorAll('slot')];
    expect(slots.map((s) => s.assignedElements()[0]?.textContent)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('toggles a section and says so', async () => {
    const el = await mount<KdAccordion>(`<kd-accordion><section label="A">a</section><section label="B">b</section></kd-accordion>`);
    const seen: unknown[] = [];
    el.addEventListener('change', (e) => seen.push((e as CustomEvent).detail));
    shadow(el).querySelectorAll('button')[0].click();
    await el.updateComplete;
    expect(open(el)).toEqual([false, true]);
    expect(seen).toEqual([{ label: 'A', index: 0, open: false }]);
  });

  it('remembers what was open by key, across a recreated element', async () => {
    const markup = `<kd-accordion key="acc"><section label="A">a</section><section label="B" collapsed>b</section></kd-accordion>`;
    let el = await mount<KdAccordion>(markup);
    shadow(el).querySelectorAll('button')[1].click();
    await el.updateComplete;
    shadow(el).querySelectorAll('button')[0].click();
    await el.updateComplete;
    document.body.replaceChildren();
    el = await mount<KdAccordion>(markup);
    expect(open(el)).toEqual([false, true]);
  });

  it('picks up sections added later', async () => {
    const el = await mount<KdAccordion>(`<kd-accordion><section label="A">a</section></kd-accordion>`);
    el.insertAdjacentHTML('beforeend', '<section label="B" count="2">b</section>');
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(heads(el).map((h) => h.label)).toEqual(['A', 'B']);
  });
});
