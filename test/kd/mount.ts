import '../../src/kd';

import type { LitElement } from 'lit';

/** Waits for an element and every kd-* element in its shadow root to render. */
export async function settle(el: Element): Promise<void> {
  await (el as LitElement).updateComplete;
  const root = el.shadowRoot;
  if (!root) return;
  for (const inner of root.querySelectorAll('*')) {
    if (inner.localName.startsWith('kd-')) await settle(inner);
  }
}

/** Renders `markup` into the document and returns its first element, rendered. */
export async function mount<T extends Element>(markup: string): Promise<T> {
  const host = document.createElement('div');
  host.innerHTML = markup;
  document.body.append(host);
  const el = host.firstElementChild as T;
  await settle(el);
  return el;
}

/** Sets properties, then waits for the re-render. */
export async function update<T extends Element>(el: T, props: Partial<T>): Promise<T> {
  Object.assign(el, props);
  await settle(el);
  return el;
}

/** The shadow root, which every kd-* element has. */
export function shadow(el: Element): ShadowRoot {
  return el.shadowRoot as ShadowRoot;
}

/** Visible text of the shadow root, whitespace collapsed. */
export function text(el: Element): string {
  return (shadow(el).textContent ?? '').replace(/\s+/g, ' ').trim();
}
