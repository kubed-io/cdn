import { expect, it } from 'vitest';

// A kd-mask from an earlier release owns the tag for the whole page session
// (define() keeps the first definition). kd-reveal must still reach it.
class OldMask extends HTMLElement {
  shown = false;
}
customElements.define('kd-mask', OldMask);

it('reveals masks defined by an earlier release', async () => {
  await import('../../src/kd');
  document.body.innerHTML = `<div><kd-reveal></kd-reveal><kd-mask value="a"></kd-mask></div>`;
  const reveal = document.querySelector('kd-reveal') as HTMLElement & { updateComplete: Promise<unknown> };
  await reveal.updateComplete;
  reveal.shadowRoot!.querySelector('button')!.click();
  expect((document.querySelector('kd-mask') as OldMask).shown).toBe(true);
});
