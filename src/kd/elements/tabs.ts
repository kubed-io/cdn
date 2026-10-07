import { LitElement, css, html, nothing, type PropertyValues } from 'lit';

import { define } from '../define';
import { KdElement, base } from '../element';

const label = (pane: Element, i: number) => pane.getAttribute('label') || `Tab ${i + 1}`;

/**
 * Tabs over its child elements, any number of them: each child is a pane,
 * labelled by its `label` attribute, with an optional `count` beside it.
 * `selected` names the open pane by label (or by index). With a `key`, the
 * choice is kept in sessionStorage, so it survives the panel recreating the
 * element. A change dispatches `change` with `{ label, index }`.
 *
 * `<kd-tabs key="pod-tabs"><section label="Events" count="3">…</section>…</kd-tabs>`
 */
export class KdTabs extends KdElement {
  static override properties = { selected: {}, key: {} };
  // Panes are assigned to slots by hand, so the light DOM is never touched.
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, slotAssignment: 'manual' };
  static override styles = [
    base,
    css`
      [role='tablist'] {
        display: flex;
        flex-wrap: wrap;
        gap: 0 22px;
        margin-bottom: 10px;
        border-bottom: 1px solid var(--kd-border, transparent);
      }
      button {
        margin: 0 0 -1px;
        padding: 6px 1px;
        border: none;
        border-bottom: 2px solid transparent;
        background: none;
        color: var(--kd-text-2, inherit);
        font: inherit;
        font-size: 13px;
        cursor: pointer;
      }
      button:hover {
        color: var(--kd-text, inherit);
      }
      /* Grafana's own active tab is underlined in this orange. */
      button[aria-selected='true'] {
        border-bottom-color: var(--kd-warning, currentColor);
        color: var(--kd-text, inherit);
      }
      .count {
        margin-left: 2px;
        color: var(--kd-text-dim, inherit);
        font-size: 11px;
      }
    `,
  ];

  declare selected: string | undefined;
  declare key: string | undefined;

  #observer: MutationObserver | undefined;

  override connectedCallback(): void {
    super.connectedCallback();
    // Panes may arrive or be relabelled after the element is created.
    this.#observer ??= new MutationObserver(() => this.requestUpdate());
    this.#observer.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ['label', 'count'] });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#observer?.disconnect();
  }

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
      const stored = this.#storage?.getItem(`kd-tabs:${this.key}`);
      if (stored !== null && stored !== undefined) this.selected = stored;
    } catch {
      // Storage can be blocked; the tab simply is not remembered.
    }
  }

  #panes(): Element[] {
    return [...this.children];
  }

  #index(panes: Element[]): number {
    const selected = this.selected;
    if (selected === undefined || selected === null || selected === '') return 0;
    const byLabel = panes.findIndex((pane, i) => label(pane, i) === selected);
    if (byLabel >= 0) return byLabel;
    const n = Number(selected);
    return Number.isInteger(n) && n >= 0 && n < panes.length ? n : 0;
  }

  #select(panes: Element[], index: number): void {
    const name = label(panes[index], index);
    if (this.key) {
      try {
        this.#storage?.setItem(`kd-tabs:${this.key}`, name);
      } catch {
        // as above
      }
    }
    if (name === this.selected) return;
    this.selected = name;
    this.dispatchEvent(new CustomEvent('change', { detail: { label: name, index }, bubbles: true, composed: true }));
  }

  override render() {
    const panes = this.#panes();
    if (!panes.length) return nothing;
    const open = this.#index(panes);
    return html`<div role="tablist">
        ${panes.map((pane, i) => {
          const count = pane.getAttribute('count');
          return html`<button
            type="button"
            role="tab"
            aria-selected=${i === open ? 'true' : 'false'}
            @click=${() => this.#select(panes, i)}
          >
            ${label(pane, i)}${count ? html`<span class="count">${count}</span>` : nothing}
          </button>`;
        })}
      </div>
      ${panes.map((_, i) => html`<div role="tabpanel" ?hidden=${i !== open}><slot></slot></div>`)}`;
  }

  // One slot per pane, assigned by hand; switching tabs only hides the others.
  protected override updated(): void {
    const slots = this.renderRoot.querySelectorAll('slot');
    this.#panes().forEach((pane, i) => slots[i]?.assign(pane));
  }
}

define('kd-tabs', KdTabs);
