import { css, html, nothing } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';

import { cellStyles, isEmpty, renderCell, type Cell } from '../cell';
import { define } from '../define';
import { KdElement, base, json } from '../element';
import { tone, tones, type Tone } from '../parts';

/** One health check: a badge with a toned dot. */
export interface Check {
  label: string;
  /** true passes, false fails, null (or unset) is unknown; or a tone outright. */
  ok?: boolean | null | Tone;
  /** Preformatted: `3m`, `+12s`. */
  when?: string;
  /** Shown under a check that is not passing, and as the tooltip of one that is. */
  detail?: string;
}

export interface StatusData {
  /** Cells before the checks: a phase pill, `2/3 ready`, a link. */
  headline?: Cell[];
  checks?: Check[];
}

/** The tone a check's `ok` stands for; a string that is not a tone is neutral. */
export function checkTone(ok: Check['ok']): Tone {
  if (ok === true) return 'success';
  if (ok === false) return 'error';
  if (ok === null || ok === undefined) return 'warning';
  return tone(ok);
}

function glyph(check: Check, t: Tone): string {
  if (t === 'success') return '✓';
  if (t === 'error') return '✗';
  if (check.ok === null || check.ok === undefined) return '?';
  return t === 'warning' ? '!' : '•';
}

/**
 * The health of anything: a headline of cells, then a strip of check badges,
 * in the order given. It knows nothing of where the checks come from.
 *
 * `el.data = { headline: [{ text: 'Running', tone: 'success' }], checks: [{ label: 'Ready', ok: false, detail: 'probe failed' }] }`
 */
export class KdStatus extends KdElement {
  static override properties = { data: { attribute: 'data', converter: json } };
  static override styles = [
    base,
    tones,
    cellStyles,
    css`
      .headline {
        margin-bottom: 8px;
        font-size: 13px;
      }
      .checks {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .badge {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 6px 14px 6px 8px;
        border: 1px solid var(--kd-border, transparent);
        border-radius: 8px;
        background: var(--kd-bg-2, transparent);
      }
      .badge.error {
        border-color: var(--tone-line);
      }
      .dot {
        flex: none;
        width: 22px;
        height: 22px;
        line-height: 22px;
        border-radius: 50%;
        text-align: center;
        font-size: 12px;
        font-weight: 700;
        color: var(--kd-bg, inherit);
        background: var(--tone);
      }
      .label {
        font-size: 12px;
      }
      .when,
      .detail {
        font-size: 11px;
        color: var(--kd-text-2, inherit);
      }
      .detail {
        max-width: 40ch;
        overflow-wrap: anywhere;
      }
    `,
  ];

  declare data: StatusData | undefined;

  override render() {
    const d = this.data;
    const headline = (Array.isArray(d?.headline) ? d.headline : []).filter((c) => !isEmpty(c));
    const checks = (Array.isArray(d?.checks) ? d.checks : []).filter((c) => c && typeof c === 'object');
    if (!headline.length && !checks.length) return nothing;
    return html`${headline.length ? html`<div class="headline">${renderCell(headline)}</div>` : nothing}
    ${checks.length
      ? html`<div class="checks">
          ${checks.map((c) => {
            const t = checkTone(c.ok);
            const passing = t === 'success';
            return html`<div class="badge ${t}" title=${ifDefined(passing ? c.detail : undefined)}>
              <span class="dot">${glyph(c, t)}</span>
              <span>
                <span class="label">${c.label}</span>
                ${c.when ? html`<span class="when">${c.when}</span>` : nothing}
                ${!passing && c.detail ? html`<div class="detail">${c.detail}</div>` : nothing}
              </span>
            </div>`;
          })}
        </div>`
      : nothing}`;
  }
}

define('kd-status', KdStatus);
