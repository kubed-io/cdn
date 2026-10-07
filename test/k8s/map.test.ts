import { describe, expect, it } from 'vitest';

import type { Cell, SheetRow } from '../../src/kd';
import {
  annotations,
  bar,
  chips,
  conditions,
  kindIcon,
  labels,
  owners,
  resources,
  summary,
  trimmed,
  type K8sObject,
} from '../../src/k8s';
import { copy, deploy, node, pod, rs } from './fixtures';

const NOW = Date.parse('2026-10-07T12:00:00Z');
const row = (rows: SheetRow[], key: string): Cell => rows.find((r) => r.key === key)?.value;

describe('conditions', () => {
  it('orders a pod in the kubelet lifecycle, timed from creation', () => {
    expect(conditions(pod)).toEqual([
      { label: 'Scheduled', status: 'done', time: '+1s' },
      { label: 'Sandbox', status: 'done', time: '+2s' },
      { label: 'Initialized', status: 'done', time: '+1s' },
      { label: 'Containers', status: 'done', time: '+7d 8h' },
      { label: 'Ready', status: 'done', time: '+7d 8h' },
    ]);
  });

  it('reads a node pressure condition as good when False', () => {
    expect(conditions(node).map((s) => [s.label, s.status])).toEqual([
      ['Memory', 'done'],
      ['Disk', 'done'],
      ['PIDs', 'done'],
      ['Ready', 'done'],
    ]);
  });

  it('orders a deployment and has none for a replica set', () => {
    expect(conditions(deploy).map((s) => s.label)).toEqual(['Progressing', 'Available']);
    expect(conditions(rs)).toEqual([]);
    expect(conditions(undefined)).toEqual([]);
  });

  it('fails a bad condition and warns on an unknown one, with the why as detail', () => {
    const p = copy(pod);
    p.status.conditions.find((c: { type: string }) => c.type === 'Ready').status = 'False';
    Object.assign(p.status.conditions.find((c: { type: string }) => c.type === 'ContainersReady'), {
      status: 'Unknown',
      reason: 'ContainersNotReady',
      message: 'containers with unready status: [web]',
    });
    p.status.conditions.push({ type: 'DisruptionTarget', status: 'True', reason: 'EvictionByEvictionAPI' });
    const steps = conditions(p);
    expect(steps.find((s) => s.label === 'Ready')?.status).toBe('failed');
    expect(steps.find((s) => s.label === 'Containers')).toMatchObject({
      status: 'warning',
      detail: 'ContainersNotReady: containers with unready status: [web]',
    });
    expect(steps.at(-1)).toEqual({ label: 'DisruptionTarget', status: 'failed', detail: 'EvictionByEvictionAPI' });
  });
});

describe('resources', () => {
  it('maps requests and limits to meters, cpu in millicores and memory in Mi', () => {
    expect(resources(pod.spec.containers[0])).toEqual([
      {
        resource: 'cpu',
        data: { unit: 'm', marks: [{ label: 'request', value: 100 }, { label: 'limit', value: 1000, tone: 'error' }] },
      },
      {
        resource: 'memory',
        data: { unit: 'Mi', marks: [{ label: 'request', value: 128 }, { label: 'limit', value: 512, tone: 'error' }] },
      },
    ]);
  });

  it('fills the meter from usage and scales bytes to the largest number shown', () => {
    const [cpu, memory, gpu] = resources(
      { resources: { requests: { memory: '1Gi', 'example.com/gpu': '1' }, limits: { cpu: '2', memory: '4Gi' } } },
      { cpu: '250m', memory: 1.5 * 2 ** 30 },
    );
    expect(cpu).toEqual({ resource: 'cpu', data: { unit: 'm', value: 250, marks: [{ label: 'limit', value: 2000, tone: 'error' }] } });
    expect(memory.data).toEqual({
      unit: 'Gi',
      value: 1.5,
      marks: [{ label: 'request', value: 1 }, { label: 'limit', value: 4, tone: 'error' }],
    });
    expect(gpu).toEqual({ resource: 'example.com/gpu', data: { unit: '', marks: [{ label: 'request', value: 1 }] } });
  });

  it('has nothing for a container without resources', () => {
    expect(resources({ name: 'x' })).toEqual([]);
    expect(resources(undefined)).toEqual([]);
  });
});

describe('owners', () => {
  const deployment = {
    dashboard: 'k8s-workload',
    vars: { kind: 'apps/v1/deployments', app_namespace: 'shop', workload: 'web' },
    back: true,
    text: 'web',
    title: 'Deployment',
    icon: kindIcon('Deployment'),
  };
  const replicaSet = {
    dashboard: 'k8s-workload',
    vars: { kind: 'apps/v1/replicasets', app_namespace: 'shop', workload: 'web-5c57db9dff' },
    back: true,
    text: 'web-5c57db9dff',
    title: 'ReplicaSet',
    icon: kindIcon('ReplicaSet'),
  };

  it('chains a pod to its deployment through the pod-template-hash', () => {
    expect(owners(pod)).toEqual([deployment, replicaSet]);
  });

  it('walks the replica set when it is at hand', () => {
    const p = copy(pod);
    delete p.metadata!.labels!['pod-template-hash'];
    expect(owners(p)).toEqual([replicaSet]);
    expect(owners(p, [rs, deploy])).toEqual([deployment, replicaSet]);
  });

  it('chains a replica set to its deployment, and a deployment to nothing', () => {
    expect(owners(rs)).toEqual([deployment]);
    expect(owners(deploy)).toEqual([]);
    expect(owners(null)).toEqual([]);
  });

  it('never loops on a cycle', () => {
    const a: K8sObject = { kind: 'A', metadata: { name: 'a', uid: '1', ownerReferences: [{ kind: 'B', name: 'b', uid: '2' }] } };
    const b: K8sObject = { kind: 'B', metadata: { name: 'b', uid: '2', ownerReferences: [{ kind: 'A', name: 'a', uid: '1' }] } };
    expect(owners(a, [a, b]).map((c) => c.text)).toEqual(['a', 'b']);
  });
});

describe('labels and annotations', () => {
  it('copies the labels', () => {
    const l = labels(pod);
    expect(l['app.kubernetes.io/name']).toBe('web');
    expect(l).not.toBe(pod.metadata!.labels);
    expect(labels({})).toEqual({});
  });

  it('drops the last-applied copy from the annotations', () => {
    const d = copy(deploy);
    d.metadata!.annotations!['kubectl.kubernetes.io/last-applied-configuration'] = '{"kind":"Deployment"}';
    expect(annotations(d)).toEqual({ 'deployment.kubernetes.io/revision': '2' });
    expect(annotations(node)['k3s.io/hostname']).toBe('node-5');
  });

  it('trims managedFields and the last-applied copy for the YAML', () => {
    const d = copy(deploy);
    d.metadata!.managedFields = [{ manager: 'kubectl' }];
    d.metadata!.annotations = { 'kubectl.kubernetes.io/last-applied-configuration': '{}' };
    const t = trimmed(d);
    expect(t.metadata).not.toHaveProperty('managedFields');
    expect(t.metadata).not.toHaveProperty('annotations');
    expect(d.metadata!.managedFields).toBeDefined();
    expect(t.spec).toBe(d.spec);
  });
});

describe('summary', () => {
  it('describes a pod like the pod view', () => {
    const rows = summary(pod, { now: NOW });
    expect(rows.map((r) => r.key).slice(0, 5)).toEqual(['Kind', 'Namespace', 'Created', 'Deleting', 'Controlled by']);
    expect(row(rows, 'Kind')).toMatchObject({ dashboard: 'k8s-rd', vars: { rd: 'api/v1#Pod' }, text: 'Pod' });
    expect(row(rows, 'Namespace')).toMatchObject({ dashboard: 'k8s-namespace', vars: { app_namespace: 'shop' } });
    expect(row(rows, 'Created')).toEqual(['7d 10h ago', { code: '2026-09-30T01:26:26Z' }]);
    expect(row(rows, 'Deleting')).toBeUndefined();
    expect((row(rows, 'Controlled by') as Cell[]).length).toBe(2);
    expect(row(rows, 'Node')).toMatchObject({ dashboard: 'k8s-node', vars: { node: 'node-8' } });
    expect(row(rows, 'Pod IP')).toEqual([{ code: '10.42.4.98' }]);
    expect(row(rows, 'QoS')).toBe('Burstable');
    expect(row(rows, 'Service account')).toMatchObject({ dashboard: 'k8s-serviceaccount', vars: { app_namespace: 'shop', saname: 'web' } });
    expect(row(rows, 'UID')).toEqual({ code: pod.metadata!.uid });
  });

  it('describes a deployment and a node', () => {
    const d = summary(deploy, { now: NOW });
    expect(row(d, 'Replicas')).toBe('1/1 ready');
    expect(row(d, 'Strategy')).toBe('RollingUpdate');
    expect(row(d, 'Controlled by')).toEqual([]);
    const n = summary(node, { now: NOW });
    expect(row(n, 'Namespace')).toBeUndefined();
    expect(row(n, 'Kind')).toMatchObject({ vars: { rd: 'api/v1#Node' } });
    expect(row(n, 'Roles')).toBe('apps');
    expect(row(n, 'Internal IP')).toEqual([{ code: '10.0.0.44' }]);
    expect(row(n, 'CPU')).toBe('8 cores');
    expect(row(n, 'Memory')).toBe('15.1 Gi');
    expect(row(n, 'Finalizers')).toEqual([{ code: 'wrangler.cattle.io/node' }, { code: 'wrangler.cattle.io/managed-etcd-controller' }]);
  });

  it('marks an object being deleted', () => {
    const p = copy(pod);
    p.metadata!.deletionTimestamp = '2026-10-07T11:59:00Z';
    expect(row(summary(p, { now: NOW }), 'Deleting')).toEqual({ text: 'terminating', tone: 'warning', title: '2026-10-07T11:59:00Z' });
    expect(chips(p)[0]).toMatchObject({ text: 'Terminating', tone: 'warning' });
  });
});

describe('bar', () => {
  it('heads a pod with its phase, readiness, restarts and owner chain', () => {
    const b = bar(pod);
    expect(b.icon).toBe(kindIcon('Pod'));
    expect(b.title).toBe('web-5c57db9dff-6fkrm');
    expect(b.eyebrow).toEqual(['Pod ·', expect.objectContaining({ dashboard: 'k8s-namespace', text: 'shop' })]);
    expect((b.eyebrow as Cell[])[1]).not.toHaveProperty('icon');
    expect(b.chips).toEqual([
      { text: 'Running', tone: 'success' },
      { text: '1/1 ready', tone: 'success' },
      { text: '↻ 20', tone: 'warning', title: 'restarts' },
    ]);
    expect(b.chain?.map((c) => (c as { text: string }).text)).toEqual(['web', 'web-5c57db9dff']);
  });

  it('heads a deployment with replicas and folded conditions', () => {
    expect(bar(deploy).chips).toEqual([
      { text: '1/1 ready', tone: 'success' },
      { text: '✓ Available +1', tone: 'success', title: 'Progressing, Available' },
    ]);
  });

  it('heads a node with readiness, cordon and pressure', () => {
    const b = bar(node);
    expect(b.eyebrow).toBe('Node');
    expect(b.chips).toEqual([{ text: 'Ready', tone: 'success', title: 'KubeletReady: kubelet is posting ready status' }]);
    const n = copy(node);
    n.spec.unschedulable = true;
    n.status.conditions[1].status = 'True';
    expect(chips(n).map((c) => (c as { text: string }).text)).toEqual(['Ready', 'cordoned', '✗ DiskPressure']);
  });

  it('heads a custom resource with its phase and conditions', () => {
    const cr: K8sObject = {
      apiVersion: 'example.com/v1',
      kind: 'Database',
      metadata: { name: 'db', namespace: 'shop' },
      status: {
        phase: 'Pending',
        conditions: [
          { type: 'Ready', status: 'False', reason: 'Waiting', message: 'no server' },
          { type: 'Synced', status: 'True' },
          { type: 'Healthy', status: 'Unknown' },
        ],
      },
    };
    expect(bar(cr).chips).toEqual([
      { text: 'Pending', tone: 'warning', title: 'phase' },
      { text: '✓ Synced', tone: 'success', title: 'Synced' },
      { text: '✗ Ready', tone: 'error', title: 'Waiting: no server' },
      { text: '? Healthy', tone: 'warning' },
    ]);
    expect(bar(null)).toEqual({ title: '' });
  });
});
