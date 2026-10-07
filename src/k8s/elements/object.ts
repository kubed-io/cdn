import { css, html, nothing } from 'lit';

import '../../kd/elements/bar';
import '../../kd/elements/data';
import '../../kd/elements/groups';
import '../../kd/elements/sheet';
import '../../kd/elements/steps';
import '../../kd/elements/tabs';
import './events';
import { define } from '../../kd/define';
import { KdElement, base, json } from '../../kd/element';
import { annotations, bar, conditions, labels, summary, trimmed, type K8sObject } from '../map';

/**
 * The generic page of one Kubernetes object, composed from the kd elements:
 * the title bar, the conditions as steps, then tabs for the summary sheet,
 * labels, annotations, events (when `events` is set: the panel's Loki frames)
 * and the YAML. `related` objects extend the owner chain; `key` keeps the
 * open tab per view; `now` (ms) pins the ages.
 *
 * `el.data = context.data[0][0]; el.events = context.data` → `<kd-k8s-object key="pod"></kd-k8s-object>`
 */
export class KdK8sObject extends KdElement {
  static override properties = {
    data: { attribute: 'data', converter: json },
    events: { attribute: false },
    related: { attribute: false },
    key: {},
    now: { type: Number },
  };
  static override styles = [
    base,
    css`
      .page {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    `,
  ];

  declare data: K8sObject | undefined;
  declare events: unknown;
  declare related: K8sObject[] | undefined;
  declare key: string | undefined;
  declare now: number | undefined;

  override render() {
    const o = this.data;
    if (!o || typeof o !== 'object') return nothing;
    const opt = { now: this.now, related: this.related };
    const steps = conditions(o);
    const l = labels(o);
    const a = annotations(o);
    const count = (map: object) => String(Object.keys(map).length);
    return html`<div class="page">
      <kd-bar .data=${bar(o, opt)}></kd-bar>
      ${steps.length ? html`<kd-steps .data=${steps}></kd-steps>` : nothing}
      <kd-tabs key=${this.key ?? nothing}>
        <section label="Summary"><kd-sheet .data=${summary(o, opt)}></kd-sheet></section>
        <section label="Labels" count=${count(l)}><kd-groups mode="pills" .data=${l}></kd-groups></section>
        <section label="Annotations" count=${count(a)}><kd-groups mode="tree" .data=${a}></kd-groups></section>
        ${this.events === undefined
          ? nothing
          : html`<section label="Events"><kd-k8s-events .data=${this.events} .now=${this.now}></kd-k8s-events></section>`}
        <section label="YAML"><kd-data fold="0" .data=${trimmed(o)}></kd-data></section>
      </kd-tabs>
    </div>`;
  }
}

define('kd-k8s-object', KdK8sObject);
