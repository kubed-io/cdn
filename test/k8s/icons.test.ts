// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { CRD_ICON, DEFAULT_ICON, GROUP_ICONS, KIND_ICONS, apiGroup, isBuiltInGroup, kindIcon } from '../../src/k8s/icons';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));
const sources = readdirSync(SRC, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.ts') || f.endsWith('.css'));
const urls = [...new Set([DEFAULT_ICON, CRD_ICON, ...Object.values(KIND_ICONS), ...Object.values(GROUP_ICONS)])];

describe('pinning', () => {
  it.each(sources)('%s references no moving branch or tag on a CDN', (file) => {
    expect(readFileSync(join(SRC, file), 'utf8')).not.toMatch(/@(main|master|latest)\b/);
  });

  it.each(urls)('%s is pinned to a commit', (url) => {
    expect(url).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/gh\/[\w.-]+\/[\w.-]+@[0-9a-f]{40}\/.+\.svg$/);
  });
});

describe('kindIcon', () => {
  const resource = (name: string) => expect.stringMatching(new RegExp(`/icons/svg/resources/unlabeled/${name}\\.svg$`));

  it.each([
    ['Pod', 'v1', 'pod'],
    ['Deployment', 'apps/v1', 'deploy'],
    ['StatefulSet', 'apps/v1', 'sts'],
    ['DaemonSet', 'apps/v1', 'ds'],
    ['ReplicaSet', 'apps/v1', 'rs'],
    ['Job', 'batch/v1', 'job'],
    ['CronJob', 'batch/v1', 'cronjob'],
    ['Service', 'v1', 'svc'],
    ['Ingress', 'networking.k8s.io/v1', 'ing'],
    ['ConfigMap', 'v1', 'cm'],
    ['Secret', 'v1', 'secret'],
    ['PersistentVolumeClaim', 'v1', 'pvc'],
    ['PersistentVolume', 'v1', 'pv'],
    ['StorageClass', 'storage.k8s.io/v1', 'sc'],
    ['ServiceAccount', 'v1', 'sa'],
    ['ClusterRole', 'rbac.authorization.k8s.io/v1', 'c-role'],
    ['HorizontalPodAutoscaler', 'autoscaling/v2', 'hpa'],
    ['Namespace', 'v1', 'ns'],
    ['CustomResourceDefinition', 'apiextensions.k8s.io/v1', 'crd'],
  ])('%s (%s) is the %s icon', (kind, apiVersion, name) => {
    expect(kindIcon(kind, apiVersion)).toEqual(resource(name));
    expect(kindIcon(kind)).toEqual(resource(name));
  });

  it('draws a node as the infrastructure node', () => {
    expect(kindIcon('Node', 'v1')).toMatch(/infrastructure_components\/unlabeled\/node\.svg$/);
  });

  it('gives a custom resource its group icon, or the CRD icon', () => {
    expect(kindIcon('Certificate', 'cert-manager.io/v1')).toBe(GROUP_ICONS['cert-manager.io']);
    expect(kindIcon('ExternalSecret', 'external-secrets.io/v1')).toBe(GROUP_ICONS['external-secrets.io']);
    expect(kindIcon('Database', 'postgresql.kubed.io/v1alpha1')).toBe(GROUP_ICONS['postgresql.kubed.io']);
    expect(kindIcon('Provider', 'pkg.crossplane.io/v1')).toBe(GROUP_ICONS['pkg.crossplane.io']);
    expect(kindIcon('Workspace', 'opentofu.m.upbound.io/v1beta1')).toBe(CRD_ICON);
    expect(kindIcon('Thing', 'other.kubed.io/v1')).toBe(GROUP_ICONS['pkg.crossplane.io']);
  });

  it('does not draw an operator kind of a built-in name as the built-in one', () => {
    expect(kindIcon('ServiceAccount', 'gcp.kubed.io/v1alpha1')).toBe(GROUP_ICONS['gcp.kubed.io']);
    expect(kindIcon('ServiceAccount', 'ldap.kubed.io/v1alpha1')).toBe(KIND_ICONS.ServiceAccount);
    expect(kindIcon('Client', 'ldap.kubed.io/v1alpha1')).toBe(KIND_ICONS.User);
    expect(kindIcon('Secret', 'example.com/v1')).toBe(CRD_ICON);
  });

  it('falls back to the Kubernetes wheel', () => {
    expect(kindIcon('Lease', 'coordination.k8s.io/v1')).toBe(DEFAULT_ICON);
    expect(kindIcon('Whatever')).toBe(DEFAULT_ICON);
    expect(kindIcon(undefined)).toBe(DEFAULT_ICON);
    expect(DEFAULT_ICON).toMatch(/cncf\/artwork@[0-9a-f]{40}\/projects\/kubernetes\//);
  });

  it('splits groups and knows the built-in ones', () => {
    expect(apiGroup('v1')).toBe('');
    expect(apiGroup('apps/v1')).toBe('apps');
    expect(apiGroup(undefined)).toBe('');
    expect(['', 'apps', 'batch', 'policy', 'autoscaling', 'storage.k8s.io', 'rbac.authorization.k8s.io'].every(isBuiltInGroup)).toBe(true);
    expect(['cert-manager.io', 'cluster.x-k8s.io', 'k8s.io.example.com'].some(isBuiltInGroup)).toBe(false);
  });
});
