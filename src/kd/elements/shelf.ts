import { css, html, nothing } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';

import { define } from '../define';
import { KdElement, base, json } from '../element';
import { safeHref } from '../parts';

/** One card: a picture over a title and a quieter line. */
export interface ShelfItem {
  title: string;
  /** An image URL; without one the card keeps its size with an empty frame. */
  image?: string;
  sub?: string;
  /** Makes the card a link: a Grafana path stays in the tab, anything else opens a new one. */
  href?: string;
  /** The hover text; the title when unset. */
  tip?: string;
}

const IMAGE = /^(https?:|data:image\/|\/|\.\.?\/)/i;

/**
 * A row of picture cards: posters, covers, faces. A `row` (the default) keeps
 * one line and scrolls sideways, so the panel stays one height however many
 * there are; a `grid` wraps. `width` is a card's width in px (140) and `ratio`
 * its picture's width/height (`2/3`, a poster).
 *
 * `<kd-shelf width="96" ratio="5/6" layout="grid"></kd-shelf>` then `el.items = rows`
 */
export class KdShelf extends KdElement {
  static override properties = {
    items: { attribute: 'items', converter: json },
    layout: {},
    width: { type: Number },
    ratio: {},
    empty: {},
  };
  static override styles = [
    base,
    css`
      .shelf {
        --gap: calc(var(--kd-space, 8px) * 1.5);
        gap: var(--gap);
      }
      .row {
        display: flex;
        overflow-x: auto;
        overflow-y: hidden;
        padding: 2px 2px 6px;
        scrollbar-width: thin;
      }
      .row .item {
        flex: 0 0 var(--card);
        width: var(--card);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(var(--card), 1fr));
      }
      .item {
        display: block;
        min-width: 0;
        color: inherit;
        text-decoration: none;
      }
      .art {
        display: block;
        width: 100%;
        aspect-ratio: var(--ratio);
        object-fit: cover;
        border: 1px solid var(--kd-border, transparent);
        border-radius: var(--kd-radius, 6px);
        background: var(--kd-bg-2, transparent);
        transition: transform 120ms ease;
      }
      a.item:hover .art,
      a.item:focus-visible .art {
        transform: scale(1.04);
        border-color: var(--kd-border-strong, currentColor);
      }
      a.item:focus-visible {
        outline: none;
      }
      .title {
        display: -webkit-box;
        overflow: hidden;
        margin-top: 6px;
        font-size: 12px;
        font-weight: 600;
        line-height: 1.25;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
      }
      .sub {
        display: block;
        overflow: hidden;
        color: var(--kd-text-2, inherit);
        font-size: 11px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .none {
        color: var(--kd-text-dim, inherit);
        font-style: italic;
      }
    `,
  ];

  declare items: ShelfItem[] | undefined;
  declare layout: string | undefined;
  declare width: number | undefined;
  declare ratio: string | undefined;
  declare empty: string | undefined;

  override render() {
    const list = Array.isArray(this.items) ? this.items.filter((i) => i && typeof i === 'object') : [];
    if (!list.length) return html`<div class="none">${this.empty ?? 'none'}</div>`;
    const layout = this.layout === 'grid' ? 'grid' : 'row';
    const width = Number(this.width) > 0 ? Number(this.width) : 140;
    const ratio = /^[\d.]+(\s*\/\s*[\d.]+)?$/.test(this.ratio ?? '') ? this.ratio : '2/3';
    return html`<div class="shelf ${layout}" style="--card: ${width}px; --ratio: ${ratio}">
      ${list.map((item) => this.#card(item))}
    </div>`;
  }

  #card(item: ShelfItem) {
    const title = String(item.title ?? '');
    const image = item.image && IMAGE.test(item.image) ? item.image : undefined;
    const body = html`${image
        ? html`<img class="art" src=${image} alt="" loading="lazy" />`
        : html`<span class="art blank"></span>`}<span class="title">${title}</span>${item.sub
        ? html`<span class="sub">${item.sub}</span>`
        : nothing}`;
    const tip = item.tip || title;
    const href = safeHref(item.href);
    if (!href) return html`<div class="item" title=${tip}>${body}</div>`;
    const external = !/^\/(?!\/)/.test(href);
    return html`<a
      class="item"
      href=${href}
      title=${tip}
      target=${ifDefined(external ? '_blank' : undefined)}
      rel=${ifDefined(external ? 'noopener' : undefined)}
      >${body}</a
    >`;
  }
}

define('kd-shelf', KdShelf);
