import { css, html } from 'lit';

import { define } from '../define';
import { KdElement, base } from '../element';
import { revealAll } from './mask';

/**
 * One toggle for every `kd-mask` in its parent, including masks inside other
 * elements' shadow roots. Masks still toggle one at a time, and the values
 * never leave them. Removing a shown toggle hides what it revealed.
 *
 * `<div><kd-reveal></kd-reveal> <kd-sheet …></kd-sheet></div>`
 */
export class KdReveal extends KdElement {
  static override properties = { shown: { state: true } };
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
        color: var(--kd-text-2, inherit);
        font: inherit;
        cursor: pointer;
      }
      button[aria-pressed='true'] {
        color: var(--kd-primary, inherit);
      }
    `,
  ];

  declare shown: boolean;
  #scope: Node | null = null;

  constructor() {
    super();
    this.shown = false;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.shown && this.#scope) revealAll(this.#scope, false);
    this.shown = false;
  }

  #toggle(): void {
    this.shown = !this.shown;
    this.#scope = this.parentNode;
    if (this.#scope) revealAll(this.#scope, this.shown);
  }

  override render() {
    return html`<button type="button" aria-label="show all" aria-pressed=${this.shown ? 'true' : 'false'} @click=${() => this.#toggle()}>
      ${this.shown ? '◉' : '○'}
    </button>`;
  }
}

define('kd-reveal', KdReveal);
