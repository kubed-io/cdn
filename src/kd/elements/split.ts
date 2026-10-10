import { css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';

import { cellStyles, isEmpty, renderCell, type Cell } from '../cell';
import { define } from '../define';
import { KdElement, base } from '../element';

/** One entry in the list. `data` is anything the detail renderer needs. */
export interface SplitItem {
  id: string;
  label: string;
  /** A second, quieter line under the label. */
  sub?: string;
  /** Cells after the label: pills, counts. */
  cells?: Cell[];
  data?: unknown;
}

/** What the right pane shows for the selected item: a template, a node, nodes or text. */
export type SplitDetail = (item: SplitItem) => TemplateResult | Node | Node[] | string | null | undefined;

/**
 * A list on the left and the selected item on the right. The list is `items`;
 * the right pane is whatever `detail(item)` returns, rendered here, so the
 * panel never reaches into the page. The first item is selected until someone
 * picks another (by click or the arrow keys); with a `key` the choice is kept
 * in sessionStorage. A pick dispatches `change` with `{ id, item }`. Narrower
 * than 560px, the detail goes under the list.
 *
 * `el.items = mappers.map((m) => ({ id: m.name, label: m.name, cells: [m.type] })); el.detail = (item) => …`
 */
export class KdSplit extends KdElement {
  static override properties = {
    items: { attribute: false },
    detail: { attribute: false },
    selected: {},
    key: {},
    empty: {},
  };
  static override styles = [
    base,
    cellStyles,
    css`
      :host {
        container-type: inline-size;
      }
      .split {
        display: grid;
        grid-template-columns: minmax(180px, 280px) minmax(0, 1fr);
        gap: 0 20px;
      }
      @container (max-width: 560px) {
        .split {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      [role='listbox'] {
        display: flex;
        flex-direction: column;
        gap: 2px;
        outline: none;
      }
      [role='option'] {
        padding: 6px 10px;
        border-left: 2px solid transparent;
        border-radius: 0 var(--kd-radius, 4px) var(--kd-radius, 4px) 0;
        cursor: pointer;
        font-size: 13px;
      }
      [role='option']:hover {
        background: var(--kd-bg-2, transparent);
      }
      [role='option'][aria-selected='true'] {
        border-left-color: var(--kd-warning, currentColor);
        background: var(--kd-bg-2, transparent);
      }
      .row {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 2px 8px;
      }
      .label {
        overflow-wrap: anywhere;
      }
      .sub {
        color: var(--kd-text-2, inherit);
        font-size: 11px;
      }
      .detail {
        min-width: 0;
      }
      .none {
        padding: 8px 0;
        color: var(--kd-text-dim, inherit);
      }
    `,
  ];

  declare items: SplitItem[] | undefined;
  declare detail: SplitDetail | undefined;
  declare selected: string | undefined;
  declare key: string | undefined;
  declare empty: string | undefined;

  get #storage(): Storage | undefined {
    try {
      return this.ownerDocument?.defaultView?.sessionStorage ?? undefined;
    } catch {
      return undefined;
    }
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('key') || !this.key) return;
    try {
      const stored = this.#storage?.getItem(`kd-split:${this.key}`);
      if (stored !== null && stored !== undefined) this.selected = stored;
    } catch {
      // Storage can be blocked; the selection simply is not remembered.
    }
  }

  #list(): SplitItem[] {
    return (Array.isArray(this.items) ? this.items : []).filter((i) => i && typeof i.id === 'string');
  }

  /** The item shown on the right: the selected one, or the first when that is gone. */
  get current(): SplitItem | undefined {
    const list = this.#list();
    return list.find((i) => i.id === this.selected) ?? list[0];
  }

  #pick(item: SplitItem): void {
    if (this.key) {
      try {
        this.#storage?.setItem(`kd-split:${this.key}`, item.id);
      } catch {
        // as above
      }
    }
    if (item.id === this.current?.id && item.id === this.selected) return;
    this.selected = item.id;
    this.dispatchEvent(new CustomEvent('change', { detail: { id: item.id, item }, bubbles: true, composed: true }));
  }

  #key(e: KeyboardEvent): void {
    const list = this.#list();
    const at = list.findIndex((i) => i.id === this.current?.id);
    const next = e.key === 'ArrowDown' ? at + 1 : e.key === 'ArrowUp' ? at - 1 : -1;
    if (next < 0 || next >= list.length || next === at) return;
    e.preventDefault();
    this.#pick(list[next]);
  }

  override render() {
    const list = this.#list();
    if (!list.length) return html`<div class="none">${this.empty ?? 'none'}</div>`;
    const current = this.current;
    return html`<div class="split">
      <div role="listbox" tabindex="0" @keydown=${(e: KeyboardEvent) => this.#key(e)}>
        ${list.map((item) => {
          const cells = (item.cells ?? []).filter((c) => !isEmpty(c));
          return html`<div role="option" aria-selected=${item.id === current?.id ? 'true' : 'false'} @click=${() => this.#pick(item)}>
            <div class="row"><span class="label">${item.label}</span>${cells.length ? renderCell(cells) : nothing}</div>
            ${item.sub ? html`<div class="sub">${item.sub}</div>` : nothing}
          </div>`;
        })}
      </div>
      <div class="detail">${current && this.detail ? this.detail(current) ?? nothing : nothing}</div>
    </div>`;
  }
}

define('kd-split', KdSplit);
