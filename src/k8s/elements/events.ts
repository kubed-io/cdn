import { html, nothing, type PropertyValues } from 'lit';

import '../../kd/elements/table';
import { define } from '../../kd/define';
import { KdElement, base, json } from '../../kd/element';
import { timeRange } from '../../kd/scene';
import { eventsTable, foldEvents, type EventGroup } from '../events';

/**
 * Kubernetes events from Loki (the panel's frames, or their rows) folded into
 * a table: one row per object, reason and message, with a reason pill
 * (warnings in the error tone, the reporting component on hover), the
 * message, how many times and when last seen. `object` adds the object each
 * event is about, `namespace` its namespace. "Last seen" is measured to `now`
 * (ms), else the dashboard's time range end, else the clock.
 *
 * `count` is the number of rows, `warnings` how many are warnings. Inside a
 * `kd-tabs` pane, the pane's `count` follows it, so the tab shows it.
 *
 * `el.data = context.data` → `<kd-k8s-events object></kd-k8s-events>`
 */
export class KdK8sEvents extends KdElement {
  static override properties = {
    data: { attribute: 'data', converter: json },
    object: { type: Boolean },
    namespace: { type: Boolean },
    now: { type: Number },
    empty: {},
  };
  static override styles = base;

  declare data: unknown;
  declare object: boolean | undefined;
  declare namespace: boolean | undefined;
  declare now: number | undefined;
  declare empty: string | undefined;

  #groups: EventGroup[] = [];

  /** The folded events. */
  get groups(): EventGroup[] {
    return this.#groups;
  }

  /** How many rows the table has. */
  get count(): number {
    return this.#groups.length;
  }

  /** How many of them are warnings. */
  get warnings(): number {
    return this.#groups.filter((g) => g.warning).length;
  }

  #end(): number {
    if (typeof this.now === 'number' && Number.isFinite(this.now)) return this.now;
    const to = timeRange(this)?.toIso;
    const t = to ? Date.parse(to) : NaN;
    return Number.isFinite(t) ? t : Date.now();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('data')) this.#groups = foldEvents(this.data);
  }

  protected override updated(): void {
    const pane = this.parentElement;
    if (pane?.parentElement?.localName === 'kd-tabs' && pane.getAttribute('count') !== String(this.count)) {
      pane.setAttribute('count', String(this.count));
    }
  }

  override render() {
    if (this.data === undefined || this.data === null) return nothing;
    const table = eventsTable(this.#groups, { object: this.object, namespace: this.namespace, now: this.#end() });
    return html`<kd-table .data=${table} empty=${this.empty ?? 'No events in this time range'}></kd-table>`;
  }
}

define('kd-k8s-events', KdK8sEvents);
