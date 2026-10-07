import { css, html, nothing } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

import { define } from '../define';
import { KdElement, base, json } from '../element';
import { tone, tones, type Tone } from '../parts';

export interface MeterMark {
  label: string;
  value: number;
  tone?: Tone;
}

export interface MeterData {
  /** The measured value; null or missing shows only the marks. */
  value?: number | null;
  /** The full scale; defaults to the largest of the value and the marks. */
  max?: number;
  /** Appended to every number as is, e.g. `Mi`, `m` or ` cores`. */
  unit?: string;
  marks?: MeterMark[];
}

const number = (n: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);

/**
 * A value against request/limit-style marks. The fill takes the tone of the
 * highest toned mark it has reached, else primary.
 *
 * `el.data = { value: 412, unit: 'Mi', marks: [{ label: 'request', value: 256 }, { label: 'limit', value: 512, tone: 'error' }] }`
 */
export class KdMeter extends KdElement {
  static override properties = { data: { attribute: 'data', converter: json } };
  static override styles = [
    base,
    tones,
    css`
      .track {
        position: relative;
        height: 8px;
        margin: 6px 0;
        border-radius: 4px;
        background: color-mix(in srgb, var(--kd-border-strong, currentColor) 35%, transparent);
      }
      .fill {
        height: 100%;
        border-radius: 4px;
        background: var(--tone);
      }
      .mark {
        position: absolute;
        top: -3px;
        bottom: -3px;
        width: 2px;
        background: var(--tone);
        box-shadow: 0 0 0 1px var(--kd-bg, transparent);
      }
      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 2px 20px;
        font-size: 12px;
      }
      .value {
        font-family: var(--kd-font-mono, monospace);
        font-size: 14px;
      }
      .legend .mark-label {
        color: var(--kd-text-2, inherit);
      }
      .legend .num {
        color: var(--tone-ink);
        font-family: var(--kd-font-mono, monospace);
      }
      .none {
        color: var(--kd-text-dim, inherit);
      }
    `,
  ];

  declare data: MeterData | undefined;

  override render() {
    const d = this.data;
    if (!d || typeof d !== 'object') return nothing;
    const value = typeof d.value === 'number' && Number.isFinite(d.value) ? d.value : undefined;
    const marks = (d.marks ?? []).filter((m) => m && Number.isFinite(m.value));
    const unit = d.unit ?? '';
    const largest = Math.max(value ?? 0, ...marks.map((m) => m.value));
    const scale = typeof d.max === 'number' && d.max > 0 ? d.max : largest > 0 ? largest : 1;
    // A mark's left edge moves from 0 to 100% - its width, so one at the maximum stays inside.
    const clamp = (f: number) => Math.min(1, Math.max(0, f));
    const at = (n: number) => `${Math.min(100, Math.max(0, (n / scale) * 100))}%`;
    const reached = value === undefined ? [] : marks.filter((m) => m.tone && value >= m.value);
    const fill = tone(reached.sort((a, b) => b.value - a.value)[0]?.tone, 'primary');
    return html`<div
      role="meter"
      aria-valuemin="0"
      aria-valuemax=${scale}
      aria-valuenow=${value ?? nothing}
    >
      <div class="track">
        ${value === undefined ? nothing : html`<div class="fill ${fill}" style=${styleMap({ width: at(value) })}></div>`}
        ${marks.map(
          (m) =>
            html`<div
              class="mark ${tone(m.tone)}"
              style=${styleMap({ left: `calc(${at(m.value)} - ${clamp(m.value / scale) * 2}px)` })}
              title="${m.label} ${number(m.value)}${unit}"
            ></div>`,
        )}
      </div>
      <div class="legend">
        <span class="value ${value === undefined ? 'none' : ''}">${value === undefined ? '–' : `${number(value)}${unit}`}</span>
        ${marks.map(
          (m) =>
            html`<span class=${tone(m.tone)}
              ><span class="mark-label">${m.label}</span> <span class="num">${number(m.value)}${unit}</span></span
            >`,
        )}
      </div>
    </div>`;
  }
}

define('kd-meter', KdMeter);
