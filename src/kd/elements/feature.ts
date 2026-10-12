import { css, html, nothing } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';

import { cellStyles, isEmpty, renderCell, type Cell } from '../cell';
import { define } from '../define';
import { KdElement, base, json } from '../element';
import { safeHref, tone, tones, type Tone } from '../parts';
import './shelf';
import type { ShelfItem } from './shelf';
import './pill';

/** A button, or a link when it has an `href`. */
export interface FeatureAction {
  /** Named in the `action` event a button dispatches. */
  id?: string;
  label: string;
  href?: string;
  /** primary and success read as the main thing to do; unset is a quiet link. */
  tone?: Tone;
  title?: string;
}

export interface FeatureData {
  title: string;
  /** After the title, quieter: a year, a version. */
  sub?: string;
  image?: string;
  /** One line of short facts: pills, counts, durations. */
  facts?: Cell[];
  /** Labels such as genres, as pills. */
  tags?: string[];
  /** A paragraph: a plot, a summary. */
  text?: string;
  actions?: FeatureAction[];
  /** Under it all, a grid of picture cards. */
  people?: ShelfItem[];
}

const IMAGE = /^(https?:|data:image\/|\/|\.\.?\/)/i;

/**
 * One thing at length: a large picture beside its title, facts, tags, text and
 * actions, with people (or any picture cards) underneath. Narrower than 520px,
 * the picture goes on top.
 *
 * A button dispatches `action` with `{ id, action }`; a panel adds its own
 * buttons or links in the `actions` slot.
 *
 * `<kd-feature empty="Pick a title."><a slot="actions" href="…">…</a></kd-feature>` then `el.data = {…}`
 */
export class KdFeature extends KdElement {
  static override properties = { data: { attribute: 'data', converter: json }, empty: {} };
  static override styles = [
    base,
    tones,
    cellStyles,
    css`
      :host {
        container-type: inline-size;
      }
      .feature {
        display: grid;
        grid-template-columns: 200px minmax(0, 1fr);
        gap: calc(var(--kd-space, 8px) * 3);
        padding: var(--kd-space, 8px);
      }
      .feature.bare {
        grid-template-columns: minmax(0, 1fr);
      }
      @container (max-width: 520px) {
        .feature {
          grid-template-columns: minmax(0, 1fr);
        }
        .picture {
          max-width: 200px;
        }
      }
      .picture img {
        display: block;
        width: 100%;
        border: 1px solid var(--kd-border, transparent);
        border-radius: var(--kd-radius, 6px);
        background: var(--kd-bg-2, transparent);
      }
      h2 {
        margin: 0 0 8px;
        font-size: 26px;
        font-weight: 600;
        line-height: 1.15;
      }
      h2 .sub {
        margin-left: 8px;
        color: var(--kd-text-2, inherit);
        font-size: 16px;
        font-weight: 400;
      }
      .facts,
      .tags,
      .actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
      }
      .facts {
        gap: 4px 12px;
        color: var(--kd-text-2, inherit);
        font-size: 13px;
      }
      .tags {
        gap: 6px;
        margin: 12px 0;
      }
      .text {
        margin: 0 0 16px;
        font-size: 14px;
        line-height: 1.55;
      }
      .actions {
        gap: 8px 12px;
        margin-bottom: 20px;
      }
      .action {
        padding: 6px 14px;
        border: 1px solid var(--tone-line);
        border-radius: var(--kd-radius, 4px);
        background: color-mix(in srgb, var(--tone) 18%, transparent);
        color: var(--tone-ink);
        cursor: pointer;
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        text-decoration: none;
        white-space: nowrap;
      }
      .action:hover {
        background: color-mix(in srgb, var(--tone) 30%, transparent);
      }
      .action.neutral {
        padding: 6px 2px;
        border-color: transparent;
        background: none;
        color: var(--kd-link, inherit);
      }
      .action.neutral:hover {
        text-decoration: underline;
      }
      .none {
        padding: var(--kd-space, 8px);
        color: var(--kd-text-dim, inherit);
        font-style: italic;
      }
    `,
  ];

  declare data: FeatureData | undefined;
  declare empty: string | undefined;

  override render() {
    const d = this.data;
    if (!d || typeof d !== 'object' || !d.title) return html`<div class="none">${this.empty ?? 'none'}</div>`;
    const image = d.image && IMAGE.test(d.image) ? d.image : undefined;
    const facts = (d.facts ?? []).filter((f) => !isEmpty(f));
    const tags = (d.tags ?? []).filter(Boolean);
    const people = (d.people ?? []).filter((p) => p && typeof p === 'object');
    return html`<div class="feature ${image ? '' : 'bare'}">
      ${image ? html`<div class="picture"><img src=${image} alt="" /></div>` : nothing}
      <div class="details">
        <h2><span class="name">${d.title}</span>${d.sub ? html`<span class="sub">${d.sub}</span>` : nothing}</h2>
        ${facts.length ? html`<div class="facts">${facts.map((f) => html`<span>${renderCell(f)}</span>`)}</div>` : nothing}
        ${tags.length ? html`<div class="tags">${tags.map((t) => html`<kd-pill>${t}</kd-pill>`)}</div>` : nothing}
        ${d.text ? html`<p class="text">${d.text}</p>` : nothing}
        <div class="actions">${(d.actions ?? []).map((a) => this.#action(a))}<slot name="actions"></slot></div>
        ${people.length ? html`<kd-shelf layout="grid" width="96" ratio="5/6" .items=${people}></kd-shelf>` : nothing}
      </div>
    </div>`;
  }

  #action(a: FeatureAction) {
    if (!a || typeof a !== 'object' || !a.label) return nothing;
    const cls = `action ${tone(a.tone)}`;
    if (a.href !== undefined) {
      const href = safeHref(a.href);
      if (!href) return nothing;
      const external = !/^\/(?!\/)/.test(href);
      return html`<a
        class=${cls}
        href=${href}
        title=${ifDefined(a.title)}
        target=${ifDefined(external ? '_blank' : undefined)}
        rel=${ifDefined(external ? 'noopener' : undefined)}
        >${a.label}</a
      >`;
    }
    return html`<button type="button" class=${cls} title=${ifDefined(a.title)} @click=${() => this.#press(a)}>
      ${a.label}
    </button>`;
  }

  #press(action: FeatureAction) {
    this.dispatchEvent(new CustomEvent('action', { detail: { id: action.id, action }, bubbles: true, composed: true }));
  }
}

define('kd-feature', KdFeature);
