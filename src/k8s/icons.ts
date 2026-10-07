// Kind -> icon. Every URL is pinned to a commit, so an upstream move or rename
// never breaks a published version.

const COMMUNITY = 'https://cdn.jsdelivr.net/gh/kubernetes/community@149066325ed521eab576a262ddff8f4da074d5de/icons/svg/';
const ARTWORK = 'https://cdn.jsdelivr.net/gh/cncf/artwork@002662490acb2303c7301acc0256c00790e03e9f/projects/';
const ESO = 'https://cdn.jsdelivr.net/gh/external-secrets/external-secrets@088f9e5ff057d35bd9f68779893b691abb948b33/assets/';
const DEVICON = 'https://cdn.jsdelivr.net/gh/devicons/devicon@7330accdbc47e2dc0c19789a48533c4a3c50fe58/icons/';

const resource = (name: string) => `${COMMUNITY}resources/unlabeled/${name}.svg`;

/** The Kubernetes wheel: a kind nobody drew an icon for. */
export const DEFAULT_ICON = `${ARTWORK}kubernetes/icon/color/kubernetes-icon-color.svg`;

/** A custom resource whose group has no icon of its own. */
export const CRD_ICON = resource('crd');

/** The kubernetes/community icon of each built-in kind that has one. */
export const KIND_ICONS: Readonly<Record<string, string>> = {
  Pod: resource('pod'),
  Deployment: resource('deploy'),
  StatefulSet: resource('sts'),
  DaemonSet: resource('ds'),
  ReplicaSet: resource('rs'),
  CronJob: resource('cronjob'),
  Job: resource('job'),
  Service: resource('svc'),
  Ingress: resource('ing'),
  IngressClass: resource('ing'),
  Endpoints: resource('ep'),
  EndpointSlice: resource('ep'),
  NetworkPolicy: resource('netpol'),
  ConfigMap: resource('cm'),
  Secret: resource('secret'),
  PersistentVolumeClaim: resource('pvc'),
  PersistentVolume: resource('pv'),
  StorageClass: resource('sc'),
  Volume: resource('vol'),
  ServiceAccount: resource('sa'),
  Role: resource('role'),
  RoleBinding: resource('rb'),
  ClusterRole: resource('c-role'),
  ClusterRoleBinding: resource('crb'),
  User: resource('user'),
  Group: resource('group'),
  Namespace: resource('ns'),
  ResourceQuota: resource('quota'),
  PriorityClass: resource('quota'),
  LimitRange: resource('limits'),
  HorizontalPodAutoscaler: resource('hpa'),
  PodSecurityPolicy: resource('psp'),
  CustomResourceDefinition: resource('crd'),
  Node: `${COMMUNITY}infrastructure_components/unlabeled/node.svg`,
};

/** The icon of each API group that has one; a group missing here falls back to `CRD_ICON`. */
export const GROUP_ICONS: Readonly<Record<string, string>> = {
  'cert-manager.io': `${ARTWORK}cert-manager/icon/color/cert-manager-icon-color.svg`,
  'external-secrets.io': `${ESO}eso-round-logo.svg`,
  'postgresql.kubed.io': `${DEVICON}postgresql/postgresql-original.svg`,
  'gcp.kubed.io': `${DEVICON}googlecloud/googlecloud-original.svg`,
  'keycloak.kubed.io': `${ARTWORK}keycloak/icon/color/keycloak-icon-color.svg`,
  'pkg.crossplane.io': `${ARTWORK}crossplane/icon/color/crossplane-icon-color.svg`,
};

// Groups whose kinds take their icon from the group, whatever the kind.
const GROUP_SUFFIXES: readonly [string, string][] = [
  ['crossplane.io', GROUP_ICONS['pkg.crossplane.io']],
  ['kubed.io', GROUP_ICONS['pkg.crossplane.io']],
];

const BUILT_IN = /^(|apps|batch|policy|autoscaling|[a-z0-9.-]*\.k8s\.io)$/;

/** The group of an apiVersion: `apps` for `apps/v1`, `''` for `v1`. */
export function apiGroup(apiVersion: string | null | undefined): string {
  const v = apiVersion ?? '';
  const cut = v.indexOf('/');
  return cut < 0 ? '' : v.slice(0, cut);
}

/** Whether a group is served by Kubernetes itself rather than a CRD or an aggregated API. */
export function isBuiltInGroup(group: string): boolean {
  return BUILT_IN.test(group);
}

/**
 * The icon of a kind. With an apiVersion, a custom resource takes its group's
 * icon (or the CRD icon), so a `ServiceAccount` of some operator's group is not
 * drawn as the core one. A kind with no icon at all gets `DEFAULT_ICON`.
 */
export function kindIcon(kind: string | null | undefined, apiVersion?: string | null): string {
  const k = kind ?? '';
  if (apiVersion != null && apiVersion !== '') {
    const group = apiGroup(apiVersion);
    if (!isBuiltInGroup(group)) {
      // ldap.kubed.io manages LDAP accounts: its kinds read as users.
      if (group === 'ldap.kubed.io') return KIND_ICONS[k === 'ServiceAccount' ? 'ServiceAccount' : 'User'];
      const exact = GROUP_ICONS[group];
      if (exact) return exact;
      const suffix = GROUP_SUFFIXES.find(([s]) => group === s || group.endsWith(`.${s}`));
      return suffix ? suffix[1] : CRD_ICON;
    }
  }
  return KIND_ICONS[k] ?? DEFAULT_ICON;
}
