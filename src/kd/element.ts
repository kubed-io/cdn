import { LitElement, css, type CSSResultGroup } from 'lit';

import { followTheme } from './theme';

/**
 * What every element's shadow stylesheet starts from. Colours, fonts, radii and
 * spacing come only from the theme's `--kd-*` properties; a fallback is never a
 * colour literal, so an element on a page nobody themed inherits instead.
 */
export const base = css`
  :host {
    display: block;
    box-sizing: border-box;
    color: var(--kd-text, inherit);
    font-family: var(--kd-font, inherit);
    line-height: 1.5;
  }
  :host([hidden]) {
    display: none;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
`;

/** A JSON attribute, for markup produced by a query: `<kd-x data="{{kdjson rows}}">`. */
export const json = {
  fromAttribute(value: string | null): unknown {
    if (value === null || value === '') return undefined;
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  },
  toAttribute(value: unknown): string {
    return JSON.stringify(value);
  },
};

/** The nearest ancestor carrying `data-theme`, looking through shadow roots. */
export function themedAncestor(element: Element): Element | null {
  let node: Node | null = element.parentNode;
  while (node) {
    if (node instanceof Element && node.hasAttribute('data-theme')) return node;
    node = node instanceof ShadowRoot ? node.host : node.parentNode;
  }
  return null;
}

// Drops the properties followTheme set on an element, so it inherits again.
function unthemed(element: HTMLElement): void {
  for (const name of [...element.style].filter((n) => n.startsWith('--kd-'))) element.style.removeProperty(name);
  element.removeAttribute('data-theme');
}

/**
 * The base of every `kd-*` element. Elements are stateless renderers: they
 * draw from their properties, which the panel pushes in on every render, and
 * nothing lives only in an element (Business Text recreates them whenever the
 * panel's HTML changes).
 *
 * A top-level element with no themed ancestor themes itself from Grafana's
 * runtime and follows a live theme switch; under a panel root that `applyTheme`
 * already themed, or inside another element's shadow root, it simply inherits.
 */
export class KdElement extends LitElement {
  static override styles: CSSResultGroup = base;

  #following = 0;
  #stop: (() => void) | undefined;

  override connectedCallback(): void {
    super.connectedCallback();
    // Inside another kd element's shadow root, the outer one carries the theme.
    if (this.getRootNode() instanceof ShadowRoot) return;
    // Elements upgrade while their module is still evaluating, before the
    // panel's afterRender has called applyTheme on the root - so wait a frame,
    // and stand down if a themed ancestor turns up in the meantime.
    const ticket = ++this.#following;
    const live = () => ticket === this.#following && this.isConnected && !themedAncestor(this);
    const view = this.ownerDocument.defaultView;
    const later = view?.requestAnimationFrame?.bind(view) ?? ((f: () => void) => setTimeout(f, 0));
    later(() => {
      if (!live()) return;
      void followTheme(this).then((stop) => {
        if (live()) {
          this.#stop = stop;
          return;
        }
        stop();
        if (ticket === this.#following) unthemed(this);
      });
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#following++;
    this.#stop?.();
    this.#stop = undefined;
  }
}
