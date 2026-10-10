import { css, html, type PropertyValues } from 'lit';

import { define } from '../define';
import { KdElement, base } from '../element';

/**
 * Shows or hides every `kd-mask` inside `container`, looking into open shadow
 * roots; returns how many changed. It finds masks in the DOM rather than in a
 * registry, so it also reaches masks of an earlier release that owns the tag.
 */
export function revealAll(container: Node, shown: boolean): number {
  let changed = 0;
  const visit = (root: Element | ShadowRoot | Document | DocumentFragment) => {
    for (const el of root.querySelectorAll('*')) {
      if (el.localName === 'kd-mask' && (el as KdMask).shown !== shown) {
        (el as KdMask).shown = shown;
        changed++;
      }
      if (el.shadowRoot) visit(el.shadowRoot);
    }
  };
  if ('querySelectorAll' in container) visit(container as Element);
  return changed;
}

/**
 * A secret value, hidden until clicked. The value never reaches a tooltip, the
 * console or any other attribute, and the dots do not give away its length.
 *
 * `<kd-mask value="{{password}}"></kd-mask>`
 */
export class KdMask extends KdElement {
  static override properties = { value: {}, shown: { state: true } };
  static override styles = [
    base,
    css`
      :host {
        display: inline-block;
      }
      button {
        padding: 0;
        border: none;
        background: none;
        color: inherit;
        font: inherit;
        cursor: pointer;
      }
      .dots {
        color: var(--kd-text-2, inherit);
        letter-spacing: 0.1em;
      }
      code {
        font-family: var(--kd-font-mono, monospace);
        font-size: 12px;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
        user-select: all;
      }
      .hide {
        margin-left: 6px;
        color: var(--kd-text-dim, inherit);
      }
    `,
  ];

  declare value: string | undefined;
  declare shown: boolean;

  constructor() {
    super();
    this.shown = false;
  }

  // A new value starts hidden again.
  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('value') && changed.get('value') !== undefined) this.shown = false;
  }

  override render() {
    if (!this.shown) {
      return html`<button type="button" aria-label="show" @click=${() => (this.shown = true)}>
        <span class="dots">••••••••</span>
      </button>`;
    }
    return html`<code>${this.value ?? ''}</code
      ><button type="button" class="hide" aria-label="hide" @click=${() => (this.shown = false)}>×</button>`;
  }
}

define('kd-mask', KdMask);
