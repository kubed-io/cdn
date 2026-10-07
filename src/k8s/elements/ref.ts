import { css, html, nothing } from 'lit';

import '../../kd/elements/link';
import { define } from '../../kd/define';
import { KdElement, base, json } from '../../kd/element';
import { refLink, type ObjectRef } from '../links';

/**
 * A link to the k8s-* view of one object, with its kind's icon and a back
 * link to this page. Set `data` (an `ObjectRef`, or any object with `kind`,
 * `apiVersion` and `metadata`), or the attributes `kind`, `name`, `namespace`,
 * `api-version` and `plural`. A kind no view shows renders as a label.
 *
 * `<kd-k8s-ref kind="Pod" namespace="db" name="postgresql-0"></kd-k8s-ref>`
 */
export class KdK8sRef extends KdElement {
  static override properties = {
    data: { attribute: 'data', converter: json },
    kind: {},
    name: {},
    namespace: {},
    apiVersion: { attribute: 'api-version' },
    plural: {},
  };
  static override styles = [
    base,
    css`
      :host {
        display: inline;
      }
    `,
  ];

  declare data: Partial<ObjectRef> & { metadata?: { name?: string; namespace?: string } } | undefined;
  declare kind: string | undefined;
  declare name: string | undefined;
  declare namespace: string | undefined;
  declare apiVersion: string | undefined;
  declare plural: string | undefined;

  /** The reference, `data` taking precedence over the attributes field by field. */
  get ref(): ObjectRef | undefined {
    const d = this.data ?? {};
    const kind = d.kind ?? this.kind;
    const name = d.name ?? d.metadata?.name ?? this.name;
    if (!kind || !name) return undefined;
    return {
      kind,
      name,
      namespace: d.namespace ?? d.metadata?.namespace ?? this.namespace,
      apiVersion: d.apiVersion ?? this.apiVersion,
      plural: d.plural ?? this.plural,
    };
  }

  override render() {
    const ref = this.ref;
    return ref ? html`<kd-link .data=${refLink(ref)}></kd-link>` : nothing;
  }
}

define('kd-k8s-ref', KdK8sRef);
