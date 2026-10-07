import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

import type { K8sObject } from '../../src/k8s';

// Real objects from a Kubernetes 1.36 cluster (`kubectl get -o json`), scrubbed:
// names, namespaces, nodes, uids and addresses replaced, managedFields and the
// last-applied copy dropped. pod -> rs -> deploy is one owner chain.
// events.json is Loki kube-event rows in the label shape the cluster's source writes.
const load = (name: string) => JSON.parse(readFileSync(join(cwd(), 'test/k8s/fixtures', name), 'utf8'));

export const pod: K8sObject = load('pod.json');
export const rs: K8sObject = load('rs.json');
export const deploy: K8sObject = load('deploy.json');
export const node: K8sObject = load('node.json');
export const events: { now: number; frames: unknown[][] } = load('events.json');

/** A deep copy, to change a fixture in one test only. */
export const copy = <T>(value: T): T => structuredClone(value);
