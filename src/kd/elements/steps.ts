import { css, html, nothing } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';

import { define } from '../define';
import { KdElement, base, json } from '../element';
import { tone, tones, type Tone } from '../parts';

export type StepStatus = 'done' | 'active' | 'failed' | 'pending' | Tone;

export interface Step {
  label: string;
  status: StepStatus;
  time?: string;
  detail?: string;
}

const STATUS: Record<string, Tone> = { done: 'success', active: 'primary', failed: 'error', pending: 'neutral' };

function glyph(t: Tone, n: number): string {
  if (t === 'success') return '✓';
  if (t === 'error') return '✗';
  if (t === 'warning') return '!';
  return String(n);
}

/**
 * A stepper or state stripe: ordered steps, each with a status (a lifecycle
 * word or a tone), an optional time and a detail line.
 *
 * `el.data = [{ label: 'Scheduled', status: 'done', time: '2m' }, { label: 'Ready', status: 'failed', detail: 'probe failed' }]`
 */
export class KdSteps extends KdElement {
  static override properties = { data: { attribute: 'data', converter: json } };
  static override styles = [
    base,
    tones,
    css`
      ol {
        display: flex;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      li {
        position: relative;
        flex: 1;
        min-width: 0;
        text-align: center;
      }
      li + li::before {
        content: '';
        position: absolute;
        top: 12px;
        right: 50%;
        width: 100%;
        height: 2px;
        background: var(--kd-border-strong, currentColor);
        opacity: 0.6;
      }
      li.reached::before {
        background: var(--tone);
        opacity: 1;
      }
      .dot {
        position: relative;
        z-index: 1;
        width: 26px;
        height: 26px;
        margin: 0 auto;
        border-radius: 50%;
        background: var(--tone);
        color: var(--kd-bg, inherit);
        font-size: 13px;
        font-weight: 700;
        line-height: 26px;
      }
      .neutral .dot {
        border: 2px solid var(--tone-line);
        background: var(--kd-bg, transparent);
        color: var(--kd-text-2, inherit);
        line-height: 22px;
      }
      .active .dot {
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--tone) 30%, transparent);
      }
      .label {
        margin-top: 4px;
        font-size: 12px;
      }
      .time,
      .detail {
        color: var(--kd-text-2, inherit);
        font-size: 11px;
      }
      .detail {
        display: -webkit-box;
        overflow: hidden;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow-wrap: anywhere;
      }
    `,
  ];

  declare data: Step[] | undefined;

  override render() {
    const steps = Array.isArray(this.data) ? this.data : [];
    if (!steps.length) return nothing;
    return html`<ol>
      ${steps.map((step, i) => {
        const t = tone(STATUS[step.status] ?? step.status);
        const reached = step.status === 'done' || step.status === 'success';
        const cls = `${t}${reached ? ' reached' : ''}${step.status === 'active' ? ' active' : ''}`;
        return html`<li class=${cls} title=${ifDefined(step.detail)}>
          <div class="dot">${glyph(t, i + 1)}</div>
          <div class="label">${step.label}</div>
          ${step.time ? html`<div class="time">${step.time}</div>` : nothing}
          ${step.detail ? html`<div class="detail">${step.detail}</div>` : nothing}
        </li>`;
      })}
    </ol>`;
  }
}

define('kd-steps', KdSteps);
