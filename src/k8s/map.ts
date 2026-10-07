// A Kubernetes API object, mapped onto the generic elements' data.
import type { Cell, CodeCell, PillCell } from '../kd/cell';
import type { BarData } from '../kd/elements/bar';
import type { GroupsData } from '../kd/elements/groups';
import type { MeterData, MeterMark } from '../kd/elements/meter';
import type { SheetRow } from '../kd/elements/sheet';
import type { Step, StepStatus } from '../kd/elements/steps';
import type { Tone } from '../kd/parts';
import { kindIcon } from './icons';
import { kindLink, namespaceLink, refLink, WORKLOAD_KINDS, type RefCell } from './links';

export interface OwnerReference {
  apiVersion?: string;
  kind: string;
  name: string;
  uid?: string;
  controller?: boolean;
}

export interface Condition {
  type: string;
  status: 'True' | 'False' | 'Unknown' | string;
  reason?: string;
  message?: string;
  lastTransitionTime?: string;
}

export interface ObjectMeta {
  name?: string;
  namespace?: string;
  uid?: string;
  creationTimestamp?: string;
  deletionTimestamp?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  ownerReferences?: OwnerReference[];
  finalizers?: string[];
  [key: string]: unknown;
}

/** Any Kubernetes API object; only the parts the mappings read are typed. */
export interface K8sObject {
  apiVersion?: string;
  kind?: string;
  metadata?: ObjectMeta;
  // The shapes differ by kind; each mapping reads what it knows defensively.
  spec?: any;
  status?: any;
  [key: string]: unknown;
}

export interface ResourceRequirements {
  requests?: Record<string, string | number>;
  limits?: Record<string, string | number>;
}

/** A container, or anything with `resources`. */
export interface ContainerLike {
  name?: string;
  resources?: ResourceRequirements;
}

/** Options shared by the mappings that show an age. */
export interface MapOptions {
  /** The time ages are measured to, in ms; defaults to now. */
  now?: number;
  /** Other objects the owner chain may walk through (the ReplicaSet a pod's Deployment owns, say). */
  related?: K8sObject[];
}

// --- quantities and times ------------------------------------------------------

const SUFFIXES: Record<string, number> = {
  n: 1e-9,
  u: 1e-6,
  m: 1e-3,
  '': 1,
  k: 1e3,
  M: 1e6,
  G: 1e9,
  T: 1e12,
  P: 1e15,
  E: 1e18,
  Ki: 2 ** 10,
  Mi: 2 ** 20,
  Gi: 2 ** 30,
  Ti: 2 ** 40,
  Pi: 2 ** 50,
  Ei: 2 ** 60,
};

const QUANTITY = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(?:([eE][+-]?\d+)|(Ki|Mi|Gi|Ti|Pi|Ei|[numkMGTPE]))?$/;

/**
 * A Kubernetes quantity as a plain number in base units: `100m` -> 0.1,
 * `128Mi` -> 134217728, `1e3` -> 1000, `2E` -> 2e18. NaN when it is not one.
 */
export function quantity(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  const m = QUANTITY.exec(value.trim());
  if (!m) return NaN;
  const n = Number(m[1]);
  if (m[2]) return n * 10 ** Number(m[2].slice(1));
  return n * SUFFIXES[m[3] ?? ''];
}

/** Seconds as kubectl-ish text: `42s`, `5m`, `3h 12m`, `2d 4h`. */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);

/** How long ago a timestamp was, or '' without one. */
export function age(iso: string | null | undefined, now = Date.now()): string {
  const t = ms(iso);
  return Number.isFinite(t) ? duration((now - t) / 1000) : '';
}

// --- resources -----------------------------------------------------------------

export interface ResourceMeter {
  /** `cpu`, `memory`, or any other resource name. */
  resource: string;
  data: MeterData;
}

const ORDER = (name: string) => (name === 'cpu' ? 0 : name === 'memory' ? 1 : 2);
const BYTES = /^(memory|ephemeral-storage|storage|hugepages-.*)$/;

// The display unit of a resource, chosen from the largest number shown.
function scale(resource: string, largest: number): { unit: string; factor: number } {
  if (resource === 'cpu') return { unit: 'm', factor: 1e3 };
  if (!BYTES.test(resource)) return { unit: '', factor: 1 };
  if (largest >= 2 ** 40) return { unit: 'Ti', factor: 2 ** -40 };
  if (largest >= 2 ** 30) return { unit: 'Gi', factor: 2 ** -30 };
  if (largest >= 2 ** 20) return { unit: 'Mi', factor: 2 ** -20 };
  return { unit: 'Ki', factor: 2 ** -10 };
}

/**
 * One meter per resource a container requests or limits, cpu and memory
 * first: CPU in millicores, bytes in Ki/Mi/Gi/Ti. `usage` (quantities or base
 * numbers, by resource name) fills the meter; without it only the marks show.
 */
export function resources(container: ContainerLike | null | undefined, usage: Record<string, string | number> = {}): ResourceMeter[] {
  const requests = container?.resources?.requests ?? {};
  const limits = container?.resources?.limits ?? {};
  const names = [...new Set([...Object.keys(requests), ...Object.keys(limits)])].sort(
    (a, b) => ORDER(a) - ORDER(b) || (a < b ? -1 : a > b ? 1 : 0),
  );
  return names.map((resource) => {
    const request = quantity(requests[resource]);
    const limit = quantity(limits[resource]);
    const used = quantity(usage[resource]);
    const { unit, factor } = scale(resource, Math.max(...[request, limit, used].filter(Number.isFinite), 0));
    const marks: MeterMark[] = [];
    if (Number.isFinite(request)) marks.push({ label: 'request', value: request * factor });
    if (Number.isFinite(limit)) marks.push({ label: 'limit', value: limit * factor, tone: 'error' });
    const data: MeterData = { unit, marks };
    if (Number.isFinite(used)) data.value = used * factor;
    return { resource, data };
  });
}

// --- conditions ----------------------------------------------------------------

// The order each kind's conditions happen in; any other condition follows, by time.
const CONDITION_ORDER: Record<string, string[]> = {
  Pod: ['PodScheduled', 'PodReadyToStartContainers', 'Initialized', 'ContainersReady', 'Ready'],
  Node: ['MemoryPressure', 'DiskPressure', 'PIDPressure', 'NetworkUnavailable', 'Ready'],
  Deployment: ['Progressing', 'Available', 'ReplicaFailure'],
};

/** Condition types that are good when False. */
export const NEGATIVE_CONDITIONS: ReadonlySet<string> = new Set([
  'Failed',
  'Stalled',
  'Degraded',
  'FailureTarget',
  'Suspended',
  'Terminating',
  'DisruptionTarget',
  'ReplicaFailure',
  'MemoryPressure',
  'DiskPressure',
  'PIDPressure',
  'NetworkUnavailable',
]);

const CONDITION_LABELS: Record<string, string> = {
  PodScheduled: 'Scheduled',
  PodReadyToStartContainers: 'Sandbox',
  ContainersReady: 'Containers',
  MemoryPressure: 'Memory',
  DiskPressure: 'Disk',
  PIDPressure: 'PIDs',
  NetworkUnavailable: 'Network',
};

/** Whether a condition is in its good state (true), its bad one (false), or unknown (null). */
export function conditionOk(c: Condition): boolean | null {
  const negative = NEGATIVE_CONDITIONS.has(c.type);
  if (c.status === 'True') return !negative;
  if (c.status === 'False') return negative;
  return null;
}

const because = (c: Condition) => [c.reason, c.message].filter((s) => s != null && s !== '').join(': ');

/**
 * The object's conditions as steps, in the order they happen for the kinds
 * that have one: done when good, failed when bad, warning when unknown. The
 * time is how long after creation the condition last changed.
 */
export function conditions(obj: K8sObject | null | undefined): Step[] {
  const list: Condition[] = Array.isArray(obj?.status?.conditions) ? obj.status.conditions : [];
  const order = CONDITION_ORDER[obj?.kind ?? ''] ?? [];
  const rank = (c: Condition) => (order.includes(c.type) ? order.indexOf(c.type) : order.length);
  const created = ms(obj?.metadata?.creationTimestamp);
  return [...list]
    .sort((a, b) => rank(a) - rank(b) || (ms(a.lastTransitionTime) || 0) - (ms(b.lastTransitionTime) || 0))
    .map((c) => {
      const ok = conditionOk(c);
      const status: StepStatus = ok === true ? 'done' : ok === false ? 'failed' : 'warning';
      const step: Step = { label: CONDITION_LABELS[c.type] ?? c.type, status };
      const changed = ms(c.lastTransitionTime);
      if (Number.isFinite(changed) && Number.isFinite(created)) step.time = `+${duration((changed - created) / 1000)}`;
      const why = because(c);
      if (why && ok !== true) step.detail = why;
      return step;
    });
}

// --- owners --------------------------------------------------------------------

const sameRef = (o: K8sObject, ref: OwnerReference) =>
  (ref.uid && o.metadata?.uid === ref.uid) || (o.kind === ref.kind && o.metadata?.name === ref.name);

/**
 * The owner chain, outermost first, as link cells: each owner reference, with
 * the owners of any owner found in `related` before it. A pod's ReplicaSet
 * that carries its `pod-template-hash` is preceded by the Deployment it
 * implies even when the ReplicaSet itself is not at hand.
 */
export function owners(obj: K8sObject | null | undefined, related: K8sObject[] = []): RefCell[] {
  const chain: RefCell[] = [];
  const seen = new Set<string>();
  const walk = (o: K8sObject) => {
    const ns = o.metadata?.namespace;
    const hash = o.metadata?.labels?.['pod-template-hash'];
    for (const ref of o.metadata?.ownerReferences ?? []) {
      const key = ref.uid || `${ref.kind}/${ref.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const found = related.find((r) => sameRef(r, ref));
      if (found) walk(found);
      else if (ref.kind === 'ReplicaSet' && hash && ref.name.endsWith(`-${hash}`)) {
        const name = ref.name.slice(0, -hash.length - 1);
        chain.push(refLink({ kind: 'Deployment', name, namespace: ns, apiVersion: ref.apiVersion ?? 'apps/v1' }));
      }
      chain.push(refLink({ kind: ref.kind, name: ref.name, namespace: ns, apiVersion: ref.apiVersion }));
    }
  };
  if (obj) walk(obj);
  return chain;
}

// --- labels and annotations ---------------------------------------------------

/** The labels, for `<kd-groups mode="pills">`. */
export function labels(obj: K8sObject | null | undefined): GroupsData {
  return { ...(obj?.metadata?.labels ?? {}) };
}

/** Annotations too large and too stale to show: the copy of the object kubectl apply keeps. */
export const HIDDEN_ANNOTATIONS: readonly string[] = ['kubectl.kubernetes.io/last-applied-configuration'];

/** The annotations, for `<kd-groups mode="tree">`, without the last-applied copy. */
export function annotations(obj: K8sObject | null | undefined): GroupsData {
  const out: GroupsData = { ...(obj?.metadata?.annotations ?? {}) };
  for (const key of HIDDEN_ANNOTATIONS) delete out[key];
  return out;
}

// --- summary and bar ----------------------------------------------------------

const code = (value: unknown): CodeCell | undefined =>
  value === null || value === undefined || value === '' ? undefined : { code: String(value) };
const pill = (text: string, tone: Tone, title?: string): PillCell => (title ? { text, tone, title } : { text, tone });

function when(iso: string | undefined, now: number): Cell {
  const a = age(iso, now);
  return a ? [`${a} ago`, { code: iso as string }] : undefined;
}

function podRows(o: K8sObject, now: number): SheetRow[] {
  const spec = o.spec ?? {};
  const status = o.status ?? {};
  const ns = o.metadata?.namespace;
  const ips = (list: unknown) => (Array.isArray(list) ? list.map((x: { ip?: string }) => code(x?.ip)) : undefined);
  return [
    { key: 'Started', value: when(status.startTime, now) },
    {
      key: 'Node',
      value: spec.nodeName ? refLink({ kind: 'Node', name: spec.nodeName, apiVersion: 'v1' }) : pill('unscheduled', 'warning'),
    },
    { key: 'Pod IP', value: ips(status.podIPs) ?? code(status.podIP) },
    { key: 'Host IP', value: ips(status.hostIPs) ?? code(status.hostIP) },
    { key: 'QoS', value: status.qosClass },
    {
      key: 'Priority',
      value: [
        spec.priorityClassName
          ? refLink({ kind: 'PriorityClass', name: spec.priorityClassName, apiVersion: 'scheduling.k8s.io/v1' })
          : undefined,
        code(spec.priority ?? 0),
      ],
    },
    {
      key: 'Service account',
      value: spec.serviceAccountName
        ? refLink({ kind: 'ServiceAccount', name: spec.serviceAccountName, namespace: ns, apiVersion: 'v1' })
        : undefined,
    },
    { key: 'Restart policy', value: spec.restartPolicy },
  ];
}

function workloadRows(o: K8sObject): SheetRow[] {
  const spec = o.spec ?? {};
  const ns = o.metadata?.namespace;
  const selector = spec.selector?.matchLabels as Record<string, string> | undefined;
  const sa = spec.template?.spec?.serviceAccountName ?? spec.jobTemplate?.spec?.template?.spec?.serviceAccountName;
  return [
    { key: 'Replicas', value: replicas(o)?.text },
    { key: 'Strategy', value: spec.strategy?.type ?? spec.updateStrategy?.type },
    { key: 'Schedule', value: code(spec.schedule) },
    { key: 'Selector', value: selector ? Object.entries(selector).map(([k, v]) => code(`${k}=${v}`)) : undefined },
    { key: 'Service account', value: sa ? refLink({ kind: 'ServiceAccount', name: sa, namespace: ns, apiVersion: 'v1' }) : undefined },
  ];
}

const ROLE = 'node-role.kubernetes.io/';

function nodeRows(o: K8sObject): SheetRow[] {
  const status = o.status ?? {};
  const info = status.nodeInfo ?? {};
  const address = (type: string) =>
    (Array.isArray(status.addresses) ? status.addresses : []).filter((a: { type?: string }) => a?.type === type).map((a: { address?: string }) => code(a.address));
  const cap = status.capacity ?? {};
  const mem = quantity(cap.memory);
  return [
    { key: 'Roles', value: Object.keys(o.metadata?.labels ?? {}).filter((k) => k.startsWith(ROLE)).map((k) => k.slice(ROLE.length)).join(', ') },
    { key: 'Internal IP', value: address('InternalIP') },
    { key: 'External IP', value: address('ExternalIP') },
    { key: 'Kubelet', value: code(info.kubeletVersion) },
    { key: 'OS', value: [info.osImage, info.architecture].filter(Boolean).join(' · ') },
    { key: 'Kernel', value: code(info.kernelVersion) },
    { key: 'Runtime', value: code(info.containerRuntimeVersion) },
    { key: 'CPU', value: cap.cpu === undefined ? undefined : `${cap.cpu} cores` },
    { key: 'Memory', value: Number.isFinite(mem) ? `${(mem / 2 ** 30).toFixed(1)} Gi` : undefined },
    { key: 'Pods', value: cap.pods },
  ];
}

/**
 * A property sheet of the object, as the k8s views show it: kind (linked to
 * its definition), namespace, age, owners and uid, then what the kind adds
 * (a pod's node and IPs, a workload's replicas, a node's addresses and
 * capacity), then finalizers. Empty rows are left in; `kd-sheet` drops them.
 */
export function summary(obj: K8sObject | null | undefined, opt: MapOptions = {}): SheetRow[] {
  if (!obj) return [];
  const now = opt.now ?? Date.now();
  const m = obj.metadata ?? {};
  const kind = obj.kind ?? '';
  const rows: SheetRow[] = [
    { key: 'Kind', value: kind && obj.apiVersion ? kindLink(kind, obj.apiVersion) : kind },
    { key: 'Namespace', value: m.namespace ? namespaceLink(m.namespace) : undefined },
    { key: 'Created', value: when(m.creationTimestamp, now) },
    {
      key: 'Deleting',
      value: m.deletionTimestamp ? pill('terminating', 'warning', m.deletionTimestamp) : undefined,
    },
    { key: 'Controlled by', value: owners(obj, opt.related) },
  ];
  if (kind === 'Pod') rows.push(...podRows(obj, now));
  else if (kind in WORKLOAD_KINDS) rows.push(...workloadRows(obj));
  else if (kind === 'Node') rows.push(...nodeRows(obj));
  rows.push(
    { key: 'UID', value: code(m.uid) },
    { key: 'Finalizers', value: (m.finalizers ?? []).map((f) => code(f)) },
  );
  return rows;
}

const PHASE_TONES: [RegExp, Tone][] = [
  [/^(Running|Bound|Succeeded|Active|Available)$/, 'success'],
  [/^(Pending|Terminating|Released)$/, 'warning'],
  [/^(Failed|Lost)$/, 'error'],
];

const phaseTone = (phase: string): Tone => PHASE_TONES.find(([re]) => re.test(phase))?.[1] ?? 'neutral';

// Ready/desired for the kinds that run replicas.
function replicas(o: K8sObject): PillCell | undefined {
  const s = o.status ?? {};
  const kind = o.kind;
  let ready: number | undefined;
  let want: number | undefined;
  if (kind === 'DaemonSet') {
    ready = s.numberReady ?? 0;
    want = s.desiredNumberScheduled ?? 0;
  } else if (kind === 'Deployment' || kind === 'StatefulSet' || kind === 'ReplicaSet') {
    ready = s.readyReplicas ?? 0;
    want = o.spec?.replicas ?? 1;
  }
  if (ready === undefined || want === undefined) return undefined;
  return pill(`${ready}/${want} ready`, ready >= want ? 'success' : 'warning');
}

function podChips(o: K8sObject): Cell[] {
  const status = o.status ?? {};
  const sidecars = new Set(
    (o.spec?.initContainers ?? []).filter((c: { restartPolicy?: string }) => c.restartPolicy === 'Always').map((c: { name: string }) => c.name),
  );
  const main = [
    ...(status.containerStatuses ?? []),
    ...(status.initContainerStatuses ?? []).filter((c: { name: string }) => sidecars.has(c.name)),
  ];
  const all = [...(status.initContainerStatuses ?? []), ...(status.containerStatuses ?? []), ...(status.ephemeralContainerStatuses ?? [])];
  const ready = main.filter((c: { ready?: boolean }) => c.ready).length;
  const restarts = all.reduce((n: number, c: { restartCount?: number }) => n + (c.restartCount ?? 0), 0);
  const phase: string = o.metadata?.deletionTimestamp ? 'Terminating' : (status.phase ?? 'Unknown');
  const tone: Tone = phase === 'Succeeded' ? 'neutral' : phaseTone(phase);
  const total = main.length || (o.spec?.containers ?? []).length;
  return [
    pill(phase, tone, status.message ?? status.reason),
    pill(`${ready}/${total} ready`, ready === total ? 'success' : 'warning'),
    restarts > 0 ? pill(`↻ ${restarts}`, 'warning', 'restarts') : undefined,
  ];
}

function nodeChips(o: K8sObject): Cell[] {
  const ready = ((o.status?.conditions ?? []) as Condition[]).find((c) => c.type === 'Ready');
  const pressure = ((o.status?.conditions ?? []) as Condition[]).filter((c) => c.type !== 'Ready' && conditionOk(c) === false);
  return [
    ready ? pill(ready.status === 'True' ? 'Ready' : 'NotReady', ready.status === 'True' ? 'success' : 'error', because(ready)) : undefined,
    o.spec?.unschedulable ? pill('cordoned', 'warning', 'unschedulable') : undefined,
    ...pressure.map((c) => pill(`✗ ${c.type}`, 'error', because(c))),
  ];
}

// Phase, then the conditions folded into one good pill and one pill per bad one.
function genericChips(o: K8sObject): Cell[] {
  const s = o.status ?? {};
  const list = (Array.isArray(s.conditions) ? s.conditions : []) as Condition[];
  const good = list.filter((c) => conditionOk(c) === true);
  const lead = ['Ready', 'Available', 'Complete'].find((t) => good.some((c) => c.type === t)) ?? good[0]?.type;
  return [
    typeof s.phase === 'string' ? pill(s.phase, phaseTone(s.phase), 'phase') : undefined,
    kind(o) in WORKLOAD_KINDS ? replicas(o) : undefined,
    good.length ? pill(`✓ ${lead}${good.length > 1 ? ` +${good.length - 1}` : ''}`, 'success', good.map((c) => c.type).join(', ')) : undefined,
    ...list
      .filter((c) => conditionOk(c) !== true)
      .map((c) => (conditionOk(c) === null ? pill(`? ${c.type}`, 'warning', because(c)) : pill(`✗ ${c.type}`, 'error', because(c)))),
  ];
}

const kind = (o: K8sObject) => o.kind ?? '';

/** Status pills for the title bar: a pod's phase, readiness and restarts; a node's readiness; else phase, replicas and conditions. */
export function chips(obj: K8sObject | null | undefined): Cell[] {
  if (!obj) return [];
  const out = kind(obj) === 'Pod' ? podChips(obj) : kind(obj) === 'Node' ? nodeChips(obj) : genericChips(obj);
  return out.filter((c) => c !== undefined);
}

/** The title bar: the kind's icon, `Kind · namespace` above the name, status pills and the owner chain. */
export function bar(obj: K8sObject | null | undefined, opt: MapOptions = {}): BarData {
  if (!obj) return { title: '' };
  const ns = obj.metadata?.namespace;
  return {
    icon: kindIcon(obj.kind, obj.apiVersion),
    eyebrow: ns ? [`${kind(obj)} ·`, namespaceLink(ns, { icon: false })] : kind(obj),
    title: obj.metadata?.name ?? '',
    chips: chips(obj),
    chain: owners(obj, opt.related),
  };
}

/** The object without what nobody reads: managedFields and the last-applied copy. */
export function trimmed(obj: K8sObject): K8sObject {
  const { managedFields: _drop, ...metadata } = obj.metadata ?? {};
  const out: K8sObject = { ...obj, metadata };
  if (metadata.annotations) {
    const a = annotations(obj);
    if (Object.keys(a).length) metadata.annotations = a;
    else delete metadata.annotations;
  }
  return out;
}
