// Words for a schema node: the limits shown beside its type, and how
// Kubernetes treats it. Pure functions over the model, shared by every viewer.

import { shortName, type Keywords, type Schema } from './model';

/** A Kubernetes behaviour of a field: a short tag and the why behind it. */
export interface Behaviour {
  label: string;
  why: string;
}

const json = (value: unknown): string => JSON.stringify(value) ?? String(value);

const isEmptyObject = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0;

/**
 * The value limits, shown beside the type: `default`, `one of`, `format`,
 * `pattern`, `range`, `multiple of`, `length`, `items`, `unique items`, `keys`,
 * `nullable`. An empty-object default (Kubernetes puts `default: {}` on every
 * `allOf` wrapper) says nothing and is left out.
 */
export function constraints(k: Keywords): string[] {
  const out: string[] = [];
  if (k.default !== undefined && k.default !== null && !isEmptyObject(k.default)) out.push(`default ${json(k.default)}`);
  if (Array.isArray(k.enum)) out.push(`one of ${k.enum.map(json).join(' | ')}`);
  if (k.const !== undefined) out.push(`always ${json(k.const)}`);
  if (k.format) out.push(`format ${k.format}`);
  if (k.pattern) out.push(`pattern ${k.pattern}`);
  const exMin = typeof k.exclusiveMinimum === 'number' ? k.exclusiveMinimum : undefined;
  const exMax = typeof k.exclusiveMaximum === 'number' ? k.exclusiveMaximum : undefined;
  const min = exMin ?? k.minimum;
  const max = exMax ?? k.maximum;
  if (min != null || max != null) {
    const open = k.exclusiveMinimum === true || exMin !== undefined ? '(' : '';
    const close = k.exclusiveMaximum === true || exMax !== undefined ? ')' : '';
    out.push(`range ${open}${min ?? ''}..${max ?? ''}${close}`);
  }
  if (k.multipleOf != null) out.push(`multiple of ${k.multipleOf}`);
  if (k.minLength != null || k.maxLength != null) out.push(`length ${k.minLength ?? 0}..${k.maxLength ?? ''}`);
  if (k.minItems != null || k.maxItems != null) out.push(`items ${k.minItems ?? 0}..${k.maxItems ?? ''}`);
  if (k.uniqueItems) out.push('unique items');
  if (k.minProperties != null || k.maxProperties != null) out.push(`keys ${k.minProperties ?? 0}..${k.maxProperties ?? ''}`);
  if (k.nullable) out.push('nullable');
  if (k.readOnly) out.push('read-only');
  if (k.writeOnly) out.push('write-only');
  if (k.deprecated) out.push('deprecated');
  return out;
}

/**
 * How Kubernetes treats the field - server-side apply, strategic merge,
 * pruning, embedded objects - as tags with the why on hover.
 */
export function behaviours(k: Keywords): Behaviour[] {
  const out: Behaviour[] = [];
  const listType = k['x-kubernetes-list-type'];
  if (listType === 'map') {
    out.push({
      label: `keyed by ${(k['x-kubernetes-list-map-keys'] ?? []).join(', ')}`,
      why: 'list-type map: apply merges items that share these keys',
    });
  } else if (listType === 'set') {
    out.push({ label: 'set', why: 'list-type set: unique scalars, apply merges them' });
  } else if (listType) {
    out.push({ label: 'atomic list', why: 'list-type atomic: apply replaces the whole list' });
  }
  const mapType = k['x-kubernetes-map-type'];
  if (mapType === 'atomic') {
    out.push({ label: 'atomic', why: 'map-type atomic: apply replaces the whole object, never merges its fields' });
  } else if (mapType) {
    out.push({ label: 'granular', why: 'map-type granular: apply merges its fields one by one' });
  }
  const strategy = k['x-kubernetes-patch-strategy'];
  if (strategy) {
    const key = k['x-kubernetes-patch-merge-key'];
    out.push({
      label: `patch ${strategy.replace(/,/g, ' + ')}${key ? ` by ${key}` : ''}`,
      why: `strategic merge patch (kubectl apply without --server-side): ${strategy}${key ? `, items matched on ${key}` : ''}`,
    });
  }
  const unions = k['x-kubernetes-unions'];
  if (Array.isArray(unions) && unions.length) {
    const named = unions.map((u) => u.discriminator).filter(Boolean);
    out.push({ label: 'union', why: `set one of its fields${named.length ? `, named by ${named.join(', ')}` : ''}` });
  }
  if (k['x-kubernetes-int-or-string']) {
    out.push({ label: 'int or string', why: 'int-or-string: an integer or a string, e.g. 8080 or "http"' });
  }
  if (k['x-kubernetes-preserve-unknown-fields']) {
    out.push({ label: 'any fields', why: 'preserve-unknown-fields: fields the schema does not list are kept, not pruned' });
  }
  if (k['x-kubernetes-embedded-resource']) {
    out.push({
      label: 'embedded object',
      why: 'embedded-resource: a whole object - apiVersion, kind and metadata are validated',
    });
  }
  if (typeof k.additionalProperties === 'boolean') {
    out.push(
      k.additionalProperties
        ? { label: 'any keys', why: 'additionalProperties: keys beyond the listed ones are allowed' }
        : { label: 'no other keys', why: 'additionalProperties false: only the listed keys are allowed' },
    );
  }
  return out;
}

/** A combinator branch (`anyOf`, `oneOf`, `allOf`, `not`) in a few words. */
export function brief(schema: unknown): string {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) return json(schema);
  const s = schema as Schema & Keywords;
  if (typeof s.$ref === 'string') return shortName(s.$ref);
  if (s.type) {
    const c = constraints(s);
    return `${Array.isArray(s.type) ? s.type.join(' | ') : s.type}${c.length ? ` (${c.join(', ')})` : ''}`;
  }
  if (Array.isArray(s.required)) return `requires ${s.required.join(', ')}`;
  if (s.properties && typeof s.properties === 'object') return `fields ${Object.keys(s.properties).join(', ')}`;
  if (s.not !== undefined) return `not ${brief(s.not)}`;
  if (Array.isArray(s.enum)) return `one of ${s.enum.map(json).join(' | ')}`;
  return json(s).slice(0, 120);
}
