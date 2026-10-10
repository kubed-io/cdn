import { LitElement, css, html, nothing, type PropertyValues } from 'lit';

import { define } from '../define';
import { KdElement, base } from '../element';

const label = (section: Element, i: number) => section.getAttribute('label') || `Section ${i + 1}`;

/**
 * Collapsible sections over its child elements, all on one page: each child
 * is a section, headed by its `label` attribute with an optional `count`.
 * A section starts open, unless its count is 0 or it has `collapsed`; `open`
 * forces it open. With a `key`, what is open is kept in sessionStorage, so it
 * survives the panel recreating the element. A toggle dispatches `change`
 * with `{ label, index, open }`.
 *
 * `<kd-accordion key="client"><section label="Mappers" count="4">…</section>…</kd-accordion>`
 */
export class KdAccordion extends KdElement {
  static override properties = { key: {}, state: { state: true } };
  // Sections are assigned to slots by hand, so the light DOM is never touched.
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, slotAssignment: 'manual' };
  static override styles = [
    base,
    css`
      .section + .section {
        border-top: 1px solid var(--kd-border, transparent);
      }
      button {
        display: flex;
        align-items: baseline;
        gap: 8px;
        width: 100%;
        padding: 10px 2px;
        border: none;
        background: none;
        color: var(--kd-text, inherit);
        font: inherit;
        font-size: 13px;
        font-weight: 500;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        text-align: left;
        cursor: pointer;
      }
      button:hover .label {
        color: var(--kd-link, inherit);
      }
      .chevron {
        display: inline-block;
        width: 10px;
        color: var(--kd-text-2, inherit);
        transition: transform 0.12s;
      }
      [aria-expanded='true'] .chevron {
        transform: rotate(90deg);
      }
      .count {
        color: var(--kd-text-2, inherit);
        font-size: 11px;
        letter-spacing: normal;
      }
      .empty {
        color: var(--kd-text-dim, inherit);
      }
      .empty .count {
        color: var(--kd-text-dim, inherit);
      }
      [role='region'] {
        padding: 2px 0 14px 18px;
      }
    `,
  ];

  declare key: string | undefined;
  /** Open or closed by section label, once someone toggles it. */
  declare state: Record<string, boolean>;

  #observer: MutationObserver | undefined;

  constructor() {
    super();
    this.state = {};
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Sections may arrive, or change their label or count, after the element is created.
    this.#observer ??= new MutationObserver(() => this.requestUpdate());
    this.#observer.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['label', 'count', 'open', 'collapsed'],
    });
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
      const stored = this.#storage?.getItem(`kd-accordion:${this.key}`);
      if (stored) this.state = JSON.parse(stored);
    } catch {
      // Storage can be blocked or hold junk; the sections simply start as their markup says.
    }
  }

  #isOpen(section: Element, i: number): boolean {
    const remembered = this.state[label(section, i)];
    if (remembered !== undefined) return remembered;
    if (section.hasAttribute('open')) return true;
    return !section.hasAttribute('collapsed') && section.getAttribute('count') !== '0';
  }

  #toggle(section: Element, i: number): void {
    const name = label(section, i);
    const open = !this.#isOpen(section, i);
    this.state = { ...this.state, [name]: open };
    if (this.key) {
      try {
        this.#storage?.setItem(`kd-accordion:${this.key}`, JSON.stringify(this.state));
      } catch {
        // as above
      }
    }
    this.dispatchEvent(new CustomEvent('change', { detail: { label: name, index: i, open }, bubbles: true, composed: true }));
  }

  override render() {
    const sections = [...this.children];
    if (!sections.length) return nothing;
    return sections.map((section, i) => {
      const open = this.#isOpen(section, i);
      const count = section.getAttribute('count');
      return html`<div class="section">
        <button type="button" class=${count === '0' ? 'empty' : ''} aria-expanded=${open ? 'true' : 'false'} @click=${() => this.#toggle(section, i)}>
          <span class="chevron">▸</span><span class="label">${label(section, i)}</span>${count !== null ? html`<span class="count">${count}</span>` : nothing}
        </button>
        <div role="region" ?hidden=${!open}><slot></slot></div>
      </div>`;
    });
  }

  // One slot per section, assigned by hand; a closed section is only hidden.
  protected override updated(): void {
    const slots = this.renderRoot.querySelectorAll('slot');
    [...this.children].forEach((section, i) => slots[i]?.assign(section));
  }
}

define('kd-accordion', KdAccordion);
