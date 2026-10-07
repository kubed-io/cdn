import { css, html } from 'lit';

import { define } from '../define';
import { KdElement, base } from '../element';
import { tone, tones, type Tone } from '../parts';

/**
 * A pill or badge. The slot is its text; `title` is the native tooltip.
 *
 * `<kd-pill tone="success" title="all containers ready">Running</kd-pill>`
 */
export class KdPill extends KdElement {
  static override properties = { tone: {} };
  static override styles = [
    base,
    tones,
    css`
      :host {
        display: inline-block;
        margin: 1px 4px 1px 0;
        vertical-align: baseline;
      }
      span {
        display: inline-block;
        padding: 0 8px;
        border: 1px solid var(--tone-line);
        border-radius: 10px;
        background: color-mix(in srgb, var(--tone) 14%, transparent);
        color: var(--tone-ink);
        font-size: 11px;
        line-height: 18px;
        white-space: nowrap;
      }
    `,
  ];

  declare tone: Tone | undefined;

  override render() {
    return html`<span class=${tone(this.tone)}><slot></slot></span>`;
  }
}

define('kd-pill', KdPill);
