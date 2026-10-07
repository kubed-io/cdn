import { describe, expect, it } from 'vitest';

import { KEYWORDS, find, normalize, shortName, type Schema, type SchemaNode } from '../../src/openapi';
import { apiextensions, apps, core, prometheus, walk } from './fixtures';

const DEPLOYMENT = 'io.k8s.api.apps.v1.Deployment';
const PROPS = 'io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps';

function at(node: SchemaNode, path: string): SchemaNode {
  const found = find(node, path);
  if (!found) throw new Error(`no field ${path}`);
  return found;
}

describe('normalize on Deployment', () => {
  const root = normalize(apps, DEPLOYMENT);

  it('resolves the root by name, by pointer and by a unique suffix', () => {
    expect(root.role).toBe('root');
    expect(root.ref).toBe(DEPLOYMENT);
    expect(root.type).toBe('Deployment');
    expect(normalize(apps, `#/components/schemas/${DEPLOYMENT}`).ref).toBe(DEPLOYMENT);
    expect(normalize(apps, 'apps.v1.Deployment').ref).toBe(DEPLOYMENT);
    expect(root.fields.map((f) => f.name)).toEqual(['apiVersion', 'kind', 'metadata', 'spec', 'status']);
  });

  it('names types the way kubectl explain does', () => {
    expect(at(root, 'metadata').type).toBe('ObjectMeta');
    expect(at(root, 'spec').type).toBe('DeploymentSpec');
    expect(at(root, 'spec.replicas').type).toBe('integer');
    expect(at(root, 'spec.template.spec.containers').type).toBe('[]Container');
    expect(at(root, 'spec.template.metadata.labels').type).toBe('map[string]string');
    expect(at(root, 'spec.template.spec.containers.args').type).toBe('[]string');
    expect(at(root, 'spec.strategy.rollingUpdate.maxSurge').type).toBe('IntOrString');
    expect(at(root, 'spec.template.spec.overhead').type).toBe('map[string]Quantity');
    expect(shortName('#/components/schemas/io.k8s.api.core.v1.PodSpec')).toBe('PodSpec');
  });

  it('marks required fields from the owning object', () => {
    expect(at(root, 'spec.selector').required).toBe(true);
    expect(at(root, 'spec.template').required).toBe(true);
    expect(at(root, 'spec.replicas').required).toBe(false);
    expect(at(root, 'spec.template.spec.containers').required).toBe(true);
    expect(at(root, 'spec.template.spec.containers.name').required).toBe(true);
    expect(at(root, 'spec.template.spec.containers.image').required).toBe(false);
  });

  it('resolves $ref through the allOf wrapper, the field keeping its own keywords', () => {
    const metadata = at(root, 'metadata');
    expect(metadata.ref).toBe('io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta');
    expect(metadata.typeName).toBe('ObjectMeta');
    expect(metadata.keywords.description).toMatch(/^Standard object's metadata/);
    expect(metadata.keywords.allOf).toEqual([{ $ref: '#/components/schemas/io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta' }]);
    expect(metadata.fields.map((f) => f.name)).toContain('labels');
  });

  it('walks lists and maps through their item and value schemas', () => {
    const containers = at(root, 'spec.template.spec.containers');
    expect(containers.items?.role).toBe('item');
    expect(containers.items?.ref).toBe('io.k8s.api.core.v1.Container');
    expect(containers.items?.path).toBe('spec.template.spec.containers');
    expect(containers.fields).toBe(containers.items?.fields);
    expect(at(root, 'spec.template.spec.containers.ports.containerPort').path).toBe(
      'spec.template.spec.containers.ports.containerPort',
    );
    const labels = at(root, 'spec.template.metadata.labels');
    expect(labels.values?.type).toBe('string');
    expect(labels.expandable).toBe(false);
  });

  it('keeps the parent link and serialises without looping', () => {
    const name = at(root, 'spec.template.spec.containers.name');
    expect(name.parent?.role).toBe('item');
    expect(name.parent?.parent?.name).toBe('containers');
    expect(() => JSON.stringify(root.fields)).not.toThrow();
  });
});

describe('recursion', () => {
  it('walks the whole PodSpec without hanging and finds no cycle in it', () => {
    const spec = normalize(core, 'io.k8s.api.core.v1.PodSpec');
    const nodes = [...walk(spec)];
    expect(nodes.length).toBeGreaterThan(1000);
    expect(nodes.filter((n) => n.cycle)).toEqual([]);
  });

  it('cuts JSONSchemaProps, which contains itself, with a reference to the ancestor', () => {
    const root = normalize(apiextensions, PROPS);
    const properties = at(root, 'properties');
    expect(properties.type).toBe('map[string]JSONSchemaProps');
    expect(properties.values?.cycle).toBe(root);
    expect(properties.fields).toEqual([]);
    const not = at(root, 'not');
    expect(not.cycle).toBe(root);
    expect(not.type).toBe('JSONSchemaProps');
    expect(at(root, 'allOf').type).toBe('[]JSONSchemaProps');
    expect([...walk(root)].length).toBeLessThan(200);
  });

  it('cuts at the nearest ancestor, deep in a CRD document', () => {
    const crd = normalize(apiextensions, 'io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinition');
    const schema = at(crd, 'spec.versions.schema.openAPIV3Schema');
    expect(schema.cycle).toBeUndefined();
    expect(at(schema, 'not').cycle).toBe(schema);
    expect([...walk(crd)].filter((n) => n.cycle).length).toBeGreaterThan(0);
  });

  it('survives a $ref to itself and a list of itself', () => {
    const doc = {
      components: {
        schemas: {
          Loop: { $ref: '#/components/schemas/Loop' },
          Tree: { type: 'object', properties: { children: { type: 'array', items: { $ref: '#/components/schemas/Tree' } } } },
          Nest: { type: 'array', items: { $ref: '#/components/schemas/Nest' } },
        },
      },
    };
    expect(normalize(doc, 'Loop').fields).toEqual([]);
    const tree = normalize(doc, 'Tree');
    expect(at(tree, 'children').type).toBe('[]Tree');
    expect(at(tree, 'children').items?.cycle).toBe(tree);
    expect(normalize(doc, 'Nest').type).toBe('[]Nest');
  });
});

describe('allOf', () => {
  it('merges every member under the node, properties and required together', () => {
    const doc = {
      components: {
        schemas: {
          A: { type: 'object', required: ['a'], properties: { a: { type: 'string' }, both: { type: 'object', properties: { x: { type: 'string' } } } } },
          B: { type: 'object', required: ['b'], properties: { b: { type: 'integer' }, both: { properties: { y: { type: 'string' } } } } },
        },
      },
    };
    const root = normalize(doc, {
      description: 'mine',
      allOf: [{ $ref: '#/components/schemas/A' }, { $ref: '#/components/schemas/B' }],
    });
    expect(root.keywords.description).toBe('mine');
    expect(root.fields.map((f) => [f.name, f.type, f.required])).toEqual([
      ['a', 'string', true],
      ['both', 'Object', false],
      ['b', 'integer', true],
    ]);
    expect(at(root, 'both').fields.map((f) => f.name)).toEqual(['x', 'y']);
  });
});

describe('the Prometheus CRD', () => {
  const version = prometheus.spec.versions[0];

  it('takes a CRD, a CRD version or its openAPIV3Schema as the root', () => {
    const fromCrd = normalize(prometheus);
    const fromVersion = normalize({}, version);
    const fromSchema = normalize({}, version.schema.openAPIV3Schema);
    for (const root of [fromCrd, fromVersion, fromSchema]) {
      expect(root.fields.map((f) => f.name)).toEqual(['apiVersion', 'kind', 'metadata', 'spec', 'status']);
    }
    expect(fromCrd.schema).toBe(version.schema.openAPIV3Schema);
  });

  it('has about 1,800 fields', () => {
    const fields = [...walk(normalize(prometheus))].filter((n) => n.role === 'field');
    expect(fields.length).toBeGreaterThan(1700);
  });

  it('names inline types', () => {
    const root = normalize(prometheus);
    expect(at(root, 'spec').type).toBe('Object');
    expect(at(root, 'spec.containers').type).toBe('[]Object');
    expect(at(root, 'spec.nodeSelector').type).toBe('map[string]string');
    expect(at(root, 'spec.containers.ports.containerPort').type).toBe('integer');
    expect(at(root, 'spec.containers.livenessProbe.httpGet.port').type).toBe('int-or-string');
  });

  it('carries CEL rules typed', () => {
    const rules = at(normalize(prometheus), 'spec.updateStrategy').keywords['x-kubernetes-validations'];
    expect(rules).toEqual([
      { message: 'rollingUpdate requires type to be RollingUpdate', rule: "!(self.type != 'RollingUpdate' && has(self.rollingUpdate))" },
    ]);
  });
});

// Every keyword present anywhere in the fixtures, read straight from the raw
// JSON, independently of the model.
function survey(schema: unknown, into: Set<string>): Set<string> {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) return into;
  const s = schema as Schema;
  for (const key of Object.keys(s)) into.add(key);
  for (const child of Object.values((s.properties as Record<string, unknown>) ?? {})) survey(child, into);
  for (const key of ['items', 'additionalProperties', 'not']) survey(s[key], into);
  for (const key of ['allOf', 'anyOf', 'oneOf']) for (const child of (s[key] as unknown[]) ?? []) survey(child, into);
  return into;
}

describe('keyword coverage', () => {
  const documents = { apps, core, apiextensions };
  const raw = new Set<string>();
  for (const doc of Object.values(documents)) for (const s of Object.values(doc.components!.schemas!)) survey(s, raw);
  survey(prometheus.spec.versions[0].schema.openAPIV3Schema, raw);

  // Every component as a root, plus the CRD; a type already walked is not walked again.
  const nodes: SchemaNode[] = [];
  const walked = new Set<string>();
  const visit = (node: SchemaNode): void => {
    nodes.push(node);
    if (node.ref) {
      if (walked.has(node.ref)) return;
      walked.add(node.ref);
    }
    for (const child of node.properties) visit(child);
    if (node.items) visit(node.items);
    if (node.values) visit(node.values);
  };
  for (const doc of Object.values(documents)) for (const name of Object.keys(doc.components!.schemas!)) visit(normalize(doc, name));
  visit(normalize(prometheus));
  const carried = new Set(nodes.flatMap((n) => [...Object.keys(n.keywords), ...Object.keys(n.other)]));

  it('finds the keywords the cluster uses', () => {
    expect(raw.size).toBe(26);
  });

  it.each([...raw].sort())('carries %s', (keyword) => {
    expect(carried.has(keyword)).toBe(true);
  });

  it('knows every keyword the cluster uses, x-kubernetes-* included', () => {
    expect([...raw].filter((k) => !KEYWORDS.includes(k as never))).toEqual([]);
    expect(nodes.filter((n) => Object.keys(n.other).length)).toEqual([]);
  });

  it('splits every keyword of every node between keywords and other', () => {
    for (const n of nodes) {
      expect([...Object.keys(n.keywords), ...Object.keys(n.other)].sort()).toEqual(Object.keys(n.schema).sort());
    }
  });

  it('puts an unknown keyword under other, raw', () => {
    const node = normalize({}, { type: 'string', 'x-vendor': { a: 1 }, $comment: 'hi', 'x-kubernetes-future': true });
    expect(node.other).toEqual({ 'x-vendor': { a: 1 }, $comment: 'hi', 'x-kubernetes-future': true });
    expect(node.keywords).toEqual({ type: 'string' });
  });
});

describe('laziness', () => {
  // A document that records every object read through it.
  function tracked<T extends object>(target: T): { doc: T; touched: Set<object> } {
    const touched = new Set<object>();
    const proxies = new WeakMap<object, object>();
    const wrap = (value: unknown): unknown => {
      if (typeof value !== 'object' || value === null) return value;
      let proxy = proxies.get(value);
      if (!proxy) {
        proxy = new Proxy(value, {
          get(obj, key, receiver) {
            touched.add(obj);
            return wrap(Reflect.get(obj, key, receiver));
          },
          ownKeys(obj) {
            touched.add(obj);
            return Reflect.ownKeys(obj);
          },
        });
        proxies.set(value, proxy);
      }
      return proxy;
    };
    return { doc: wrap(target) as T, touched };
  }

  it('reads only the root of the Prometheus CRD until asked for more', () => {
    const { doc, touched } = tracked(structuredClone(prometheus));
    const root = normalize(doc);
    const atRoot = touched.size;
    expect(atRoot).toBeLessThan(15);

    const spec = root.fields.find((f) => f.name === 'spec')!;
    const afterRoot = touched.size;
    expect(afterRoot).toBeLessThan(40);

    void spec.fields;
    expect(touched.size).toBeLessThan(600);

    for (const node of walk(root)) void node.fields;
    expect(touched.size).toBeGreaterThan(1800);
  });

  it('builds a child once and keeps it', () => {
    const root = normalize(apps, DEPLOYMENT);
    expect(root.fields).toBe(root.fields);
    expect(at(root, 'spec')).toBe(at(root, 'spec'));
  });
});
