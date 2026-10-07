// Kind -> the k8s-* dashboard that shows it, as kd-link data.
import type { DashboardCell, HrefCell } from '../kd/cell';
import type { Vars } from '../kd/elements/link';
import { apiGroup, isBuiltInGroup, kindIcon } from './icons';

/** What names one Kubernetes object. */
export interface ObjectRef {
  kind: string;
  name: string;
  namespace?: string | null;
  apiVersion?: string | null;
  /** The resource name (`deployments`) when the kind's plural is irregular; guessed otherwise. */
  plural?: string | null;
}

/** A dashboard and its variables. */
export interface Route {
  dashboard: string;
  vars: Vars;
}

/** Options for a link cell. */
export interface LinkOptions {
  /** The label; defaults to the object's name. */
  text?: string;
  /** False leaves the icon out; a string replaces it. */
  icon?: boolean | string;
  /** Tooltip; defaults to the kind. */
  title?: string;
}

/** A dashboard link, or a plain label (an `href` cell with an empty href) where no view shows the kind. */
export type RefCell = DashboardCell | HrefCell;

/** Kinds the workload view opens, and the apiVersion each has when a reference omits it. */
export const WORKLOAD_KINDS: Readonly<Record<string, string>> = {
  Deployment: 'apps/v1',
  StatefulSet: 'apps/v1',
  DaemonSet: 'apps/v1',
  ReplicaSet: 'apps/v1',
  Job: 'batch/v1',
  CronJob: 'batch/v1',
};

/** The k8s-* dashboards, by kind, that the routes below can open. */
export const DASHBOARDS = {
  pod: 'k8s-pod',
  workload: 'k8s-workload',
  maps: 'k8s-maps',
  volume: 'k8s-volume',
  class: 'k8s-class',
  serviceaccount: 'k8s-serviceaccount',
  crd: 'k8s-crd',
  rd: 'k8s-rd',
  namespace: 'k8s-namespace',
  node: 'k8s-node',
  service: 'k8s-service',
  ingress: 'k8s-ingress',
  resource: 'k8s-resource',
} as const;

/** A kind's resource name, as the API guesses it: `Ingress` -> `ingresses`, `Policy` -> `policies`. */
export function plural(kind: string): string {
  const s = kind.toLowerCase();
  if (s === 'endpoints') return s;
  if (/(s|x|z|ch|sh)$/.test(s)) return `${s}es`;
  if (/[^aeiou]y$/.test(s)) return `${s.slice(0, -1)}ies`;
  return `${s}s`;
}

/** The API path of an object: `apis/apps/v1/namespaces/db/statefulsets/postgresql`, or `api/v1/nodes/n1`. */
export function apiPath(ref: ObjectRef): string | undefined {
  if (!ref.apiVersion) return undefined;
  const root = ref.apiVersion.includes('/') ? 'apis' : 'api';
  const ns = ref.namespace ? `/namespaces/${ref.namespace}` : '';
  return `${root}/${ref.apiVersion}${ns}/${ref.plural || plural(ref.kind)}/${ref.name}`;
}

/** The namespace view. */
export function namespaceRoute(namespace: string): Route {
  return { dashboard: DASHBOARDS.namespace, vars: { app_namespace: namespace } };
}

/**
 * The dashboard that shows an object: its own k8s-* view for the kinds that
 * have one, else the generic resource view (which needs the apiVersion to
 * build the API path). Undefined when there is neither.
 */
export function route(ref: ObjectRef): Route | undefined {
  const { kind, name } = ref;
  const ns = ref.namespace ?? '';
  // A kind of the same name in some operator's group is not the built-in one.
  const builtIn = !ref.apiVersion || isBuiltInGroup(apiGroup(ref.apiVersion));
  if (builtIn) {
    if (kind === 'Pod') return { dashboard: DASHBOARDS.pod, vars: { app_namespace: ns, pod: name } };
    if (kind in WORKLOAD_KINDS) {
      const apiVersion = ref.apiVersion || WORKLOAD_KINDS[kind];
      return {
        dashboard: DASHBOARDS.workload,
        vars: { kind: `${apiVersion}/${ref.plural || plural(kind)}`, app_namespace: ns, workload: name },
      };
    }
    if (kind === 'ConfigMap' || kind === 'Secret') {
      return {
        dashboard: DASHBOARDS.maps,
        vars: { kind: kind === 'Secret' ? 'secrets' : 'configmaps', app_namespace: ns, mapname: name },
      };
    }
    if (kind === 'PersistentVolumeClaim' || kind === 'PersistentVolume') {
      return {
        dashboard: DASHBOARDS.volume,
        vars: {
          kind: kind === 'PersistentVolume' ? 'persistentvolumes' : 'persistentvolumeclaims',
          app_namespace: kind === 'PersistentVolume' ? '' : ns,
          volname: name,
        },
      };
    }
    if (kind === 'StorageClass' || kind === 'IngressClass') {
      return {
        dashboard: DASHBOARDS.class,
        vars: {
          kind: kind === 'IngressClass' ? 'networking.k8s.io/v1/ingressclasses' : 'storage.k8s.io/v1/storageclasses',
          classname: name,
        },
      };
    }
    if (kind === 'ServiceAccount') return { dashboard: DASHBOARDS.serviceaccount, vars: { app_namespace: ns, saname: name } };
    if (kind === 'CustomResourceDefinition') return { dashboard: DASHBOARDS.crd, vars: { crdname: name } };
    if (kind === 'Namespace') return namespaceRoute(name);
    if (kind === 'Node') return { dashboard: DASHBOARDS.node, vars: { node: name } };
    if (kind === 'Service') return { dashboard: DASHBOARDS.service, vars: { app_namespace: ns, service: name } };
    if (kind === 'Ingress') return { dashboard: DASHBOARDS.ingress, vars: { app_namespace: ns, ingress: name } };
  }
  const path = apiPath(ref);
  return path ? { dashboard: DASHBOARDS.resource, vars: { path } } : undefined;
}

/**
 * The view of a kind's definition: the CRD view for a custom resource (its
 * CRD is named `<plural>.<group>`), the resource-definition view for a
 * built-in kind (which picks it as `<api path>#<Kind>`).
 */
export function definitionRoute(kind: string, apiVersion: string, resource?: string | null): Route {
  const group = apiGroup(apiVersion);
  if (!isBuiltInGroup(group)) {
    return { dashboard: DASHBOARDS.crd, vars: { crdname: `${resource || plural(kind)}.${group}` } };
  }
  const root = apiVersion.includes('/') ? 'apis' : 'api';
  return { dashboard: DASHBOARDS.rd, vars: { rd: `${root}/${apiVersion}#${kind}` } };
}

function icon(ref: ObjectRef, opt: LinkOptions): string | undefined {
  if (opt.icon === false) return undefined;
  return typeof opt.icon === 'string' ? opt.icon : kindIcon(ref.kind, ref.apiVersion);
}

/**
 * An object as a link cell (`kd-link` data) to its view, with its kind's icon
 * and a back link to this page. A kind no view shows is a plain label.
 */
export function refLink(ref: ObjectRef, opt: LinkOptions = {}): RefCell {
  const text = opt.text ?? ref.name;
  const title = opt.title ?? ref.kind;
  const to = route(ref);
  const img = icon(ref, opt);
  if (!to) return { href: '', text, title, ...(img ? { icon: img } : {}) };
  return { dashboard: to.dashboard, vars: to.vars, back: true, text, title, ...(img ? { icon: img } : {}) };
}

/** A namespace as a link cell to the namespace view. */
export function namespaceLink(namespace: string, opt: LinkOptions = {}): DashboardCell {
  return refLink({ kind: 'Namespace', name: namespace, apiVersion: 'v1' }, { title: 'Namespace', ...opt }) as DashboardCell;
}

/** A kind as a link cell to its definition. */
export function kindLink(kind: string, apiVersion: string, opt: LinkOptions = {}): DashboardCell {
  const to = definitionRoute(kind, apiVersion);
  const img = icon({ kind, name: kind, apiVersion }, opt);
  return {
    dashboard: to.dashboard,
    vars: to.vars,
    back: true,
    text: opt.text ?? kind,
    title: opt.title ?? apiVersion,
    ...(img ? { icon: img } : {}),
  };
}
