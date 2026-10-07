import { describe, expect, it } from 'vitest';

import {
  DASHBOARDS,
  apiPath,
  definitionRoute,
  kindIcon,
  kindLink,
  namespaceLink,
  plural,
  refLink,
  route,
  type ObjectRef,
} from '../../src/k8s';

describe('route', () => {
  // Each kind's view, and the variables that view declares (checked against the live dashboards).
  it.each<[ObjectRef, string, Record<string, string>]>([
    [{ kind: 'Pod', name: 'web-0', namespace: 'shop', apiVersion: 'v1' }, 'k8s-pod', { app_namespace: 'shop', pod: 'web-0' }],
    [
      { kind: 'Deployment', name: 'web', namespace: 'shop', apiVersion: 'apps/v1' },
      'k8s-workload',
      { kind: 'apps/v1/deployments', app_namespace: 'shop', workload: 'web' },
    ],
    [
      { kind: 'StatefulSet', name: 'db', namespace: 'shop' },
      'k8s-workload',
      { kind: 'apps/v1/statefulsets', app_namespace: 'shop', workload: 'db' },
    ],
    [
      { kind: 'DaemonSet', name: 'agent', namespace: 'shop' },
      'k8s-workload',
      { kind: 'apps/v1/daemonsets', app_namespace: 'shop', workload: 'agent' },
    ],
    [
      { kind: 'ReplicaSet', name: 'web-1', namespace: 'shop' },
      'k8s-workload',
      { kind: 'apps/v1/replicasets', app_namespace: 'shop', workload: 'web-1' },
    ],
    [{ kind: 'Job', name: 'once', namespace: 'shop' }, 'k8s-workload', { kind: 'batch/v1/jobs', app_namespace: 'shop', workload: 'once' }],
    [
      { kind: 'CronJob', name: 'nightly', namespace: 'shop', apiVersion: 'batch/v1' },
      'k8s-workload',
      { kind: 'batch/v1/cronjobs', app_namespace: 'shop', workload: 'nightly' },
    ],
    [
      { kind: 'ConfigMap', name: 'conf', namespace: 'shop' },
      'k8s-maps',
      { kind: 'configmaps', app_namespace: 'shop', mapname: 'conf' },
    ],
    [{ kind: 'Secret', name: 'keys', namespace: 'shop' }, 'k8s-maps', { kind: 'secrets', app_namespace: 'shop', mapname: 'keys' }],
    [
      { kind: 'PersistentVolumeClaim', name: 'data', namespace: 'shop' },
      'k8s-volume',
      { kind: 'persistentvolumeclaims', app_namespace: 'shop', volname: 'data' },
    ],
    [
      { kind: 'PersistentVolume', name: 'pv-1', namespace: 'ignored' },
      'k8s-volume',
      { kind: 'persistentvolumes', app_namespace: '', volname: 'pv-1' },
    ],
    [
      { kind: 'StorageClass', name: 'local-path' },
      'k8s-class',
      { kind: 'storage.k8s.io/v1/storageclasses', classname: 'local-path' },
    ],
    [
      { kind: 'IngressClass', name: 'traefik' },
      'k8s-class',
      { kind: 'networking.k8s.io/v1/ingressclasses', classname: 'traefik' },
    ],
    [
      { kind: 'ServiceAccount', name: 'web', namespace: 'shop', apiVersion: 'v1' },
      'k8s-serviceaccount',
      { app_namespace: 'shop', saname: 'web' },
    ],
    [
      { kind: 'CustomResourceDefinition', name: 'databases.example.com', apiVersion: 'apiextensions.k8s.io/v1' },
      'k8s-crd',
      { crdname: 'databases.example.com' },
    ],
    [{ kind: 'Namespace', name: 'shop' }, 'k8s-namespace', { app_namespace: 'shop' }],
    [{ kind: 'Node', name: 'node-1' }, 'k8s-node', { node: 'node-1' }],
    [{ kind: 'Service', name: 'web', namespace: 'shop' }, 'k8s-service', { app_namespace: 'shop', service: 'web' }],
    [
      { kind: 'Ingress', name: 'web', namespace: 'shop', apiVersion: 'networking.k8s.io/v1' },
      'k8s-ingress',
      { app_namespace: 'shop', ingress: 'web' },
    ],
  ])('%o opens %s', (ref, dashboard, vars) => {
    expect(route(ref)).toEqual({ dashboard, vars });
  });

  it('opens anything else with an apiVersion in the generic resource view', () => {
    expect(route({ kind: 'Certificate', name: 'web-tls', namespace: 'shop', apiVersion: 'cert-manager.io/v1' })).toEqual({
      dashboard: 'k8s-resource',
      vars: { path: 'apis/cert-manager.io/v1/namespaces/shop/certificates/web-tls' },
    });
    expect(route({ kind: 'PriorityClass', name: 'high', apiVersion: 'scheduling.k8s.io/v1' })).toEqual({
      dashboard: 'k8s-resource',
      vars: { path: 'apis/scheduling.k8s.io/v1/priorityclasses/high' },
    });
    expect(route({ kind: 'Endpoints', name: 'web', namespace: 'shop', apiVersion: 'v1' })?.vars.path).toBe(
      'api/v1/namespaces/shop/endpoints/web',
    );
    expect(route({ kind: 'Foo', name: 'x', apiVersion: 'example.com/v1', plural: 'foozles' })?.vars.path).toBe(
      'apis/example.com/v1/foozles/x',
    );
  });

  it('sends an operator kind of a built-in name to the resource view, not the built-in one', () => {
    expect(route({ kind: 'ServiceAccount', name: 'web', namespace: 'shop', apiVersion: 'gcp.kubed.io/v1alpha1' })).toEqual({
      dashboard: 'k8s-resource',
      vars: { path: 'apis/gcp.kubed.io/v1alpha1/namespaces/shop/serviceaccounts/web' },
    });
  });

  it('has no route for an unknown kind without an apiVersion', () => {
    expect(route({ kind: 'Mystery', name: 'x' })).toBeUndefined();
  });

  it('routes only to the k8s-* views', () => {
    expect(Object.values(DASHBOARDS).every((uid) => uid.startsWith('k8s-'))).toBe(true);
  });
});

describe('definitionRoute', () => {
  it('opens a built-in kind in the resource-definition view', () => {
    expect(definitionRoute('Deployment', 'apps/v1')).toEqual({ dashboard: 'k8s-rd', vars: { rd: 'apis/apps/v1#Deployment' } });
    expect(definitionRoute('Pod', 'v1')).toEqual({ dashboard: 'k8s-rd', vars: { rd: 'api/v1#Pod' } });
  });

  it('opens a custom kind in the CRD view, by the CRD name', () => {
    expect(definitionRoute('Certificate', 'cert-manager.io/v1')).toEqual({
      dashboard: 'k8s-crd',
      vars: { crdname: 'certificates.cert-manager.io' },
    });
    expect(definitionRoute('Policy', 'example.com/v1')).toEqual({ dashboard: 'k8s-crd', vars: { crdname: 'policies.example.com' } });
  });
});

describe('link cells', () => {
  it('is kd-link data with the kind icon and a back link', () => {
    expect(refLink({ kind: 'Pod', name: 'web-0', namespace: 'shop', apiVersion: 'v1' })).toEqual({
      dashboard: 'k8s-pod',
      vars: { app_namespace: 'shop', pod: 'web-0' },
      back: true,
      text: 'web-0',
      title: 'Pod',
      icon: kindIcon('Pod'),
    });
  });

  it('takes a text, a title and an icon, or no icon', () => {
    const cell = refLink({ kind: 'Node', name: 'node-1' }, { text: 'the node', title: 'where it runs', icon: false });
    expect(cell).toEqual({ dashboard: 'k8s-node', vars: { node: 'node-1' }, back: true, text: 'the node', title: 'where it runs' });
    expect(refLink({ kind: 'Node', name: 'node-1' }, { icon: '🖥' }).icon).toBe('🖥');
  });

  it('is a plain label where no view shows the kind', () => {
    expect(refLink({ kind: 'Mystery', name: 'x' })).toEqual({ href: '', text: 'x', title: 'Mystery', icon: kindIcon('Mystery') });
  });

  it('links a namespace and a kind', () => {
    expect(namespaceLink('shop')).toMatchObject({ dashboard: 'k8s-namespace', vars: { app_namespace: 'shop' }, title: 'Namespace' });
    expect(kindLink('StatefulSet', 'apps/v1')).toMatchObject({
      dashboard: 'k8s-rd',
      vars: { rd: 'apis/apps/v1#StatefulSet' },
      text: 'StatefulSet',
      title: 'apps/v1',
      back: true,
    });
  });
});

describe('plural and apiPath', () => {
  it.each([
    ['Pod', 'pods'],
    ['Ingress', 'ingresses'],
    ['Policy', 'policies'],
    ['Gateway', 'gateways'],
    ['Endpoints', 'endpoints'],
    ['Mesh', 'meshes'],
    ['Box', 'boxes'],
  ])('%s -> %s', (kind, resource) => {
    expect(plural(kind)).toBe(resource);
  });

  it('needs an apiVersion', () => {
    expect(apiPath({ kind: 'Pod', name: 'x' })).toBeUndefined();
    expect(apiPath({ kind: 'Node', name: 'n', apiVersion: 'v1' })).toBe('api/v1/nodes/n');
  });
});
