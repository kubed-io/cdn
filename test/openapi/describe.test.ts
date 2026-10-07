import { describe, expect, it } from 'vitest';

import { behaviours, brief, constraints, find, normalize } from '../../src/openapi';
import { apps, core } from './fixtures';

const labels = (k: Parameters<typeof behaviours>[0]) => behaviours(k).map((b) => b.label);

describe('behaviours', () => {
  it('tags list, map and patch behaviour from the cluster OpenAPI', () => {
    const pod = normalize(core, 'io.k8s.api.core.v1.PodSpec');
    expect(labels(find(pod, 'containers')!.keywords)).toEqual(['keyed by name', 'patch merge by name']);
    expect(labels(find(pod, 'tolerations')!.keywords)).toEqual(['atomic list']);
    expect(labels(find(pod, 'nodeSelector')!.keywords)).toEqual(['atomic']);
    const deploy = normalize(apps, 'io.k8s.api.apps.v1.Deployment');
    expect(labels(find(deploy, 'spec.template.spec.containers.ports')!.keywords)).toEqual([
      'keyed by containerPort, protocol',
      'patch merge by containerPort',
    ]);
  });

  it('explains every x-kubernetes-* behaviour and a boolean additionalProperties', () => {
    const all = behaviours({
      'x-kubernetes-list-type': 'set',
      'x-kubernetes-map-type': 'granular',
      'x-kubernetes-patch-strategy': 'merge,retainKeys',
      'x-kubernetes-unions': [{ discriminator: 'type' }],
      'x-kubernetes-int-or-string': true,
      'x-kubernetes-preserve-unknown-fields': true,
      'x-kubernetes-embedded-resource': true,
      additionalProperties: false,
    });
    expect(all.map((b) => b.label)).toEqual([
      'set',
      'granular',
      'patch merge + retainKeys',
      'union',
      'int or string',
      'any fields',
      'embedded object',
      'no other keys',
    ]);
    for (const b of all) expect(b.why.length).toBeGreaterThan(10);
    expect(labels({ additionalProperties: true })).toEqual(['any keys']);
    expect(labels({ additionalProperties: { type: 'string' } })).toEqual([]);
  });
});

describe('constraints', () => {
  it('spells the limits beside the type', () => {
    expect(
      constraints({
        default: 3,
        enum: ['a', 'b'],
        format: 'int32',
        pattern: '^x$',
        minimum: 1,
        maximum: 5,
        exclusiveMaximum: true,
        multipleOf: 2,
        minLength: 1,
        maxItems: 4,
        uniqueItems: true,
        maxProperties: 9,
        nullable: true,
      }),
    ).toEqual([
      'default 3',
      'one of "a" | "b"',
      'format int32',
      'pattern ^x$',
      'range 1..5)',
      'multiple of 2',
      'length 1..',
      'items 0..4',
      'unique items',
      'keys 0..9',
      'nullable',
    ]);
  });

  it('leaves out the empty default every allOf wrapper carries', () => {
    expect(constraints({ default: {} })).toEqual([]);
    expect(constraints({ default: false })).toEqual(['default false']);
  });

  it('reads JSON Schema numeric exclusive bounds', () => {
    expect(constraints({ exclusiveMinimum: 0 })).toEqual(['range (0..']);
  });
});

describe('brief', () => {
  it('sums up a combinator branch', () => {
    expect(brief({ $ref: '#/components/schemas/io.k8s.api.core.v1.PodSpec' })).toBe('PodSpec');
    expect(brief({ type: 'integer', minimum: 0 })).toBe('integer (range 0..)');
    expect(brief({ required: ['a', 'b'] })).toBe('requires a, b');
    expect(brief({ properties: { a: {}, b: {} } })).toBe('fields a, b');
    expect(brief({ not: { type: 'string' } })).toBe('not string');
    expect(brief({ enum: [1, 2] })).toBe('one of 1 | 2');
  });
});
