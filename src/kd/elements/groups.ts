import { css, html, nothing } from 'lit';

import './data';
import './pill';
import { define } from '../define';
import { KdElement, base, json } from '../element';

/** A string map, such as labels or annotations. */
export type GroupsData = Record<string, string>;

interface Group {
  prefix: string;
  entries: { key: string; name: string; value: string }[];
}

// Grouped by the prefix before "/"; unprefixed keys first, then by prefix.
function group(data: GroupsData): Group[] {
  const groups = new Map<string, Group>();
  for (const [key, raw] of Object.entries(data)) {
    const cut = key.indexOf('/');
    const prefix = cut < 0 ? '' : key.slice(0, cut);
    const value = raw === null || raw === undefined ? '' : typeof raw === 'string' ? raw : JSON.stringify(raw);
    let g = groups.get(prefix);
    if (!g) groups.set(prefix, (g = { prefix, entries: [] }));
    g.entries.push({ key, name: key.slice(cut + 1), value });
  }
  return [...groups.values()].sort((a, b) => (a.prefix < b.prefix ? -1 : a.prefix > b.prefix ? 1 : 0));
}

/** A value that is a JSON object or array, parsed; undefined for anything else. */
export function jsonValue(value: string): object | undefined {
  if (!/^\s*[[{]/.test(value)) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed !== null && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

const CLIP = 600;

/**
 * A string map grouped by key prefix: as pills (`mode="pills"`, the default,
 * for labels) or as a key/value tree (`mode="tree"`, for annotations, where a
 * value holding a JSON object or array is shown as folded YAML).
 *
 * `<kd-groups mode="tree" data="{{kdjson metadata.annotations}}">`
 */
export class KdGroups extends KdElement {
  static override properties = {
    data: { attribute: 'data', converter: json },
    mode: {},
  };
  static override styles = [
    base,
    css`
      .group + .group {
        margin-top: 12px;
      }
      div.head,
      tr.head td {
        padding-bottom: 3px;
        border-bottom: 1px solid var(--kd-border, transparent);
        color: var(--kd-text-2, inherit);
        font-family: var(--kd-font-mono, monospace);
        font-size: 11px;
      }
      div.head {
        margin-bottom: 6px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      td {
        padding: 2px 12px 2px 0;
        vertical-align: top;
      }
      tr.head td {
        padding-top: 12px;
      }
      tr.head:first-child td {
        padding-top: 0;
      }
      tr.head + tr td {
        padding-top: 6px;
      }
      .k {
        white-space: nowrap;
      }
      code {
        font-family: var(--kd-font-mono, monospace);
        font-size: 12px;
      }
      .twig {
        margin: 0 8px 0 4px;
        color: var(--kd-text-dim, inherit);
        font-family: var(--kd-font-mono, monospace);
      }
      .v {
        width: 100%;
        color: color-mix(in srgb, var(--kd-success, currentColor) 70%, var(--kd-text, currentColor));
        font-family: var(--kd-font-mono, monospace);
        font-size: 12px;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .none {
        padding: 8px 0;
        color: var(--kd-text-dim, inherit);
      }
    `,
  ];

  declare data: GroupsData | undefined;
  declare mode: 'pills' | 'tree' | undefined;

  override render() {
    const d = this.data;
    if (!d || typeof d !== 'object') return nothing;
    const groups = group(d);
    if (!groups.length) return html`<div class="none">none</div>`;
    return this.mode === 'tree' ? this.#tree(groups) : this.#pills(groups);
  }

  #pills(groups: Group[]) {
    return groups.map(
      (g) => html`<div class="group">
        ${g.prefix ? html`<div class="head">${g.prefix}</div>` : nothing}
        <div>
          ${g.entries.map(
            (e) => html`<kd-pill tone="info" title=${e.key}>${e.value === '' ? e.name : `${e.name}=${e.value}`}</kd-pill>`,
          )}
        </div>
      </div>`,
    );
  }

  #tree(groups: Group[]) {
    return html`<table>
      <tbody>
        ${groups.map(
          (g) => html`${g.prefix ? html`<tr class="head"><td colspan="2">${g.prefix}</td></tr>` : nothing}
          ${g.entries.map((e, i) => {
            const parsed = jsonValue(e.value);
            return html`<tr>
              <td class="k">
                ${g.prefix ? html`<span class="twig">${i === g.entries.length - 1 ? '└' : '├'}</span>` : nothing}<code
                  >${e.name}</code
                >
              </td>
              <td class="v">
                ${parsed
                  ? html`<kd-data .data=${parsed}></kd-data>`
                  : e.value.length > CLIP
                    ? `${e.value.slice(0, CLIP)} …`
                    : e.value}
              </td>
            </tr>`;
          })}`,
        )}
      </tbody>
    </table>`;
  }
}

define('kd-groups', KdGroups);
