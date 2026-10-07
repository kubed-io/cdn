import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

import type { OpenApiDocument, Schema, SchemaNode } from '../../src/openapi';

// Real documents from a Kubernetes 1.36 cluster: `kubectl get --raw /openapi/v3/...`
// and `kubectl get crd prometheuses.monitoring.coreos.com -o json` (metadata and
// status trimmed to what is not cluster-specific).
// Under happy-dom import.meta.url is not a file URL; vitest runs from the repo root.
const load = (name: string) => JSON.parse(readFileSync(join(cwd(), 'test/openapi/fixtures', name), 'utf8'));

export const apps: OpenApiDocument = load('apps-v1.json');
export const core: OpenApiDocument = load('core-v1.json');
export const apiextensions: OpenApiDocument = load('apiextensions-v1.json');
export const prometheus: Schema & { spec: { versions: { schema: { openAPIV3Schema: Schema } }[] } } =
  load('prometheus-crd.json');

/** Every node below `node`, depth first, reading every child the model offers. */
export function* walk(node: SchemaNode): Generator<SchemaNode> {
  yield node;
  for (const child of node.properties) yield* walk(child);
  if (node.items) yield* walk(node.items);
  if (node.values) yield* walk(node.values);
}
