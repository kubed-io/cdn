import { css, html, type PropertyValues } from 'lit';

import { define } from '../define';
import { KdElement, base } from '../element';

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
