// The schema model: an OpenAPI v3 / JSON Schema document and a root, turned
// into a tree of plain-data nodes the viewers (and later a data viewer and an
// editor) draw from. No DOM here.

/** A raw schema object, as it appears in the document. */
export type Schema = Record<string, unknown>;

/** An OpenAPI v3 document, or any JSON document that holds schemas. */
export interface OpenApiDocument {
  components?: { schemas?: Record<string, Schema> };
  [key: string]: unknown;
}

/** One `x-kubernetes-validations` entry: a CEL rule. */
export interface Validation {
  rule: string;
  message?: string;
  messageExpression?: string;
  reason?: string;
  fieldPath?: string;
  optionalOldSelf?: boolean;
}

/** One `x-kubernetes-group-version-kind` entry. */
export interface GroupVersionKind {
  group: string;
  version: string;
  kind: string;
}

/** One `x-kubernetes-unions` entry. */
export interface Union {
  discriminator?: string;
  'fields-to-discriminateBy'?: Record<string, string>;
}

/**
 * Every keyword the model knows, typed. Values are the document's own, after
 * `$ref` resolution and the `allOf` merge; nothing is rewritten. Kubernetes'
 * `x-kubernetes-*` extensions are OpenAPI extensions, so they are known here
 * like any other keyword.
 */
export interface Keywords {
  $ref?: string;
  type?: string | string[];
  title?: string;
  description?: string;
  format?: string;
  pattern?: string;
  default?: unknown;
  enum?: unknown[];
  const?: unknown;
  example?: unknown;
  examples?: unknown[];
  minimum?: number;
  maximum?: number;
  /** A boolean in OpenAPI 3.0, a number in JSON Schema 2019+. */
  exclusiveMinimum?: boolean | number;
  exclusiveMaximum?: boolean | number;
  multipleOf?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minProperties?: number;
  maxProperties?: number;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;
  externalDocs?: { url?: string; description?: string };
  required?: string[];
  properties?: Record<string, Schema>;
  items?: Schema | Schema[];
  additionalProperties?: boolean | Schema;
  allOf?: Schema[];
  anyOf?: Schema[];
  oneOf?: Schema[];
  not?: Schema;
  'x-kubernetes-int-or-string'?: boolean;
  'x-kubernetes-preserve-unknown-fields'?: boolean;
  'x-kubernetes-embedded-resource'?: boolean;
  'x-kubernetes-list-type'?: 'atomic' | 'set' | 'map' | string;
  'x-kubernetes-list-map-keys'?: string[];
  'x-kubernetes-map-type'?: 'atomic' | 'granular' | string;
  'x-kubernetes-validations'?: Validation[];
  'x-kubernetes-patch-strategy'?: string;
  'x-kubernetes-patch-merge-key'?: string;
  'x-kubernetes-unions'?: Union[];
  'x-kubernetes-group-version-kind'?: GroupVersionKind[];
}

/** The names of every known keyword, in display order. */
export const KEYWORDS: readonly (keyof Keywords)[] = [
  '$ref', 'type', 'title', 'description', 'format', 'pattern', 'default', 'enum', 'const', 'example', 'examples',
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minLength', 'maxLength', 'minItems',
  'maxItems', 'uniqueItems', 'minProperties', 'maxProperties', 'nullable', 'readOnly', 'writeOnly', 'deprecated',
  'externalDocs', 'required', 'properties', 'items', 'additionalProperties', 'allOf', 'anyOf', 'oneOf', 'not',
  'x-kubernetes-int-or-string', 'x-kubernetes-preserve-unknown-fields', 'x-kubernetes-embedded-resource',
  'x-kubernetes-list-type', 'x-kubernetes-list-map-keys', 'x-kubernetes-map-type', 'x-kubernetes-validations',
  'x-kubernetes-patch-strategy', 'x-kubernetes-patch-merge-key', 'x-kubernetes-unions',
  'x-kubernetes-group-version-kind',
];
const KNOWN = new Set<string>(KEYWORDS);

/**
 * A node of the schema tree: a field, the root, or the item/value schema of a
 * list/map.
 *
 * Children (`properties`, `items`, `values`, `fields`) are computed when first
 * read and then kept, so normalizing a root costs one node and a viewer pays
 * only for what it opens. `parent` and `cycle` are getters, so a node
 * serialises as plain data without looping.
 *
 * Recursion is cut, never depth-limited: a node whose type is already open
 * above it has `cycle` set to that ancestor and no children.
 */
export interface SchemaNode {
  /** `root` (what normalize returns), `field` (a property), `item` (an array's items), `value` (a map's values). */
  readonly role: 'root' | 'field' | 'item' | 'value';
  /** The property name; `''` for the root, an item or a value. */
  readonly name: string;
  /** The path as kubectl explain spells it (`spec.template.spec.containers.name`); items and values share their owner's. */
  readonly path: string;
  /** Listed in the owning object's `required`. */
  readonly required: boolean;
  /** The display type in kubectl explain's spelling: `string`, `Object`, `[]Container`, `map[string]string`, `int-or-string`, `any`. */
  readonly type: string;
  /** The short name of the type it was referenced as (`PodSpec` for `io.k8s.api.core.v1.PodSpec`). */
  readonly typeName?: string;
  /** The full name of the schema `$ref`/`allOf` brought in (`io.k8s.api.core.v1.PodSpec`). */
  readonly ref?: string;
  /** The schema after `$ref` resolution and the `allOf` merge; the node's own keywords win. */
  readonly schema: Schema;
  /** The known keywords of `schema`. */
  readonly keywords: Keywords;
  /** Every keyword of `schema` the model does not know, raw. */
  readonly other: Record<string, unknown>;
  /** The node it belongs to; the root has none. */
  readonly parent: SchemaNode | undefined;
  /** When this node's type is open in an ancestor, that ancestor. Its children are listed there, not here. */
  readonly cycle: SchemaNode | undefined;
  /** The object's own properties, in document order. */
  readonly properties: readonly SchemaNode[];
  /** An array's item schema. */
  readonly items: SchemaNode | undefined;
  /** A map's value schema (an `additionalProperties` schema). */
  readonly values: SchemaNode | undefined;
  /** The children kubectl explain lists: the properties, else the items' fields, else the values' fields. */
  readonly fields: readonly SchemaNode[];
  /** Whether `fields` is non-empty. */
  readonly expandable: boolean;
}

/** A root: a component name (`X` or `#/components/schemas/X`, or a unique `.X` suffix), any `#/` pointer, a schema, a CRD version, or a CRD. */
export type Root = string | Schema;

const isObject = (value: unknown): value is Schema =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const COMPONENTS = '#/components/schemas/';

/** The short name of a component, as kubectl explain shows it: `io.k8s.api.core.v1.PodSpec` -> `PodSpec`. */
export function shortName(ref: string): string {
  const name = ref.startsWith(COMPONENTS) ? ref.slice(COMPONENTS.length) : ref.slice(ref.lastIndexOf('/') + 1);
  return name.slice(name.lastIndexOf('.') + 1);
}

function pointer(document: unknown, ref: string): unknown {
  if (!ref.startsWith('#')) return undefined;
  let at: unknown = document;
  for (const part of ref.slice(1).split('/').slice(1)) {
    const key = decodeURIComponent(part).replace(/~1/g, '/').replace(/~0/g, '~');
    if (!isObject(at) && !Array.isArray(at)) return undefined;
    at = (at as Record<string, unknown>)[key];
  }
  return at;
}

function refName(ref: string): string {
  return ref.startsWith(COMPONENTS) ? ref.slice(COMPONENTS.length) : ref.replace(/^#\/?/, '');
}

interface Resolved {
  schema: Schema;
  /** Every schema name merged in, outermost first. */
  refs: string[];
}

// A {$ref} node becomes the schema it points at, its own keywords on top; every
// allOf member is resolved and merged under the node's own keywords. Properties
// that two members both define are merged lazily, as an allOf of the two.
function resolve(document: unknown, schema: Schema, seen: string[] = []): Resolved {
  let base: Schema = {};
  const refs: string[] = [];
  const parts: Schema[] = [];
  const ref = schema.$ref;
  if (typeof ref === 'string') {
    const name = refName(ref);
    if (!seen.includes(name)) {
      refs.push(name);
      const target = pointer(document, ref);
      if (isObject(target)) parts.push(target);
    }
  }
  if (Array.isArray(schema.allOf)) for (const member of schema.allOf) if (isObject(member)) parts.push(member);
  if (!parts.length) return { schema, refs };
  for (const part of parts) {
    const inner = resolve(document, part, [...seen, ...refs]);
    refs.push(...inner.refs.filter((r) => !refs.includes(r)));
    base = merge(base, inner.schema);
  }
  return { schema: merge(base, schema), refs };
}

function merge(under: Schema, over: Schema): Schema {
  const out: Schema = { ...under, ...over };
  if (isObject(under.properties) && isObject(over.properties)) {
    const props: Record<string, unknown> = { ...under.properties };
    for (const [key, value] of Object.entries(over.properties)) {
      props[key] = key in props && isObject(value) && isObject(props[key]) ? { allOf: [props[key], value] } : value;
    }
    out.properties = props;
  }
  if (Array.isArray(under.required) && Array.isArray(over.required)) {
    out.required = [...new Set([...under.required, ...over.required])];
  }
  return out;
}

// A type that contains itself only through arrays and maps stops at its name.
function displayType(document: unknown, schema: Schema, refs: string[], seen: string[] = []): string {
  if (refs.some((r) => seen.includes(r))) return shortName(refs[0]);
  const t = schema.type;
  if (t === 'array') {
    const inner = resolve(document, isObject(schema.items) ? schema.items : {});
    return '[]' + displayType(document, inner.schema, inner.refs, [...seen, ...refs]);
  }
  const ap = schema.additionalProperties;
  if ((t === 'object' || t === undefined) && isObject(ap) && !isObject(schema.properties)) {
    const inner = resolve(document, ap);
    return 'map[string]' + displayType(document, inner.schema, inner.refs, [...seen, ...refs]);
  }
  if (refs.length) return shortName(refs[0]);
  if (schema['x-kubernetes-int-or-string']) return 'int-or-string';
  if (t === 'object') return 'Object';
  if (typeof t === 'string') return t;
  if (Array.isArray(t)) return t.join(' | ');
  if (isObject(schema.properties)) return 'Object';
  return 'any';
}

class Node implements SchemaNode {
  readonly role: SchemaNode['role'];
  readonly name: string;
  readonly path: string;
  readonly required: boolean;
  readonly type: string;
  readonly typeName?: string;
  readonly ref?: string;
  readonly schema: Schema;
  readonly keywords: Keywords;
  readonly other: Record<string, unknown>;

  readonly #document: unknown;
  readonly #parent: Node | undefined;
  readonly #refs: string[];
  readonly #cycle: Node | undefined;
  #properties?: Node[];
  #items?: Node | null;
  #values?: Node | null;

  constructor(document: unknown, raw: Schema, role: SchemaNode['role'], name: string, parent: Node | undefined, required: boolean) {
    this.#document = document;
    this.#parent = parent;
    const { schema, refs } = resolve(document, raw);
    this.#refs = refs;
    this.role = role;
    this.name = name;
    this.path = role === 'field' && parent?.path ? `${parent.path}.${name}` : role === 'field' ? name : (parent?.path ?? '');
    this.required = required;
    this.schema = schema;
    if (refs.length) {
      this.ref = refs[0];
      this.typeName = shortName(refs[0]);
    }
    this.type = displayType(document, schema, refs);
    const keywords: Record<string, unknown> = {};
    const other: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema)) (KNOWN.has(key) ? keywords : other)[key] = value;
    this.keywords = keywords as Keywords;
    this.other = other;
    for (let up = parent; up && !this.#cycle; up = up.#parent) {
      if (up.#refs.some((r) => refs.includes(r))) this.#cycle = up;
    }
  }

  get parent(): SchemaNode | undefined {
    return this.#parent;
  }

  get cycle(): SchemaNode | undefined {
    return this.#cycle;
  }

  get properties(): readonly SchemaNode[] {
    if (!this.#properties) {
      const props = this.schema.properties;
      const required = Array.isArray(this.schema.required) ? this.schema.required : [];
      this.#properties =
        this.#cycle || !isObject(props)
          ? []
          : Object.entries(props).map(
              ([key, value]) => new Node(this.#document, isObject(value) ? value : {}, 'field', key, this, required.includes(key)),
            );
    }
    return this.#properties;
  }

  get items(): SchemaNode | undefined {
    if (this.#items === undefined) {
      const items = this.schema.items;
      this.#items = !this.#cycle && this.schema.type === 'array' && isObject(items)
        ? new Node(this.#document, items, 'item', '', this, false)
        : null;
    }
    return this.#items ?? undefined;
  }

  get values(): SchemaNode | undefined {
    if (this.#values === undefined) {
      const ap = this.schema.additionalProperties;
      this.#values = !this.#cycle && isObject(ap) ? new Node(this.#document, ap, 'value', '', this, false) : null;
    }
    return this.#values ?? undefined;
  }

  get fields(): readonly SchemaNode[] {
    if (this.properties.length) return this.properties;
    return this.items?.fields ?? this.values?.fields ?? [];
  }

  get expandable(): boolean {
    return this.fields.length > 0;
  }

  toJSON(): Record<string, unknown> {
    const { role, name, path, required, type, typeName, ref, keywords, other } = this;
    return { role, name, path, required, type, typeName, ref, keywords, other, cycle: this.#cycle?.path };
  }
}

function rootSchema(document: unknown, root: Root | undefined): Schema {
  if (root === undefined) {
    if (isObject(document) && document.kind === 'CustomResourceDefinition') return crdSchema(document);
    return isObject(document) ? document : {};
  }
  if (typeof root === 'string') {
    if (root.startsWith('#')) return { $ref: root };
    const schemas = isObject(document) && isObject(document.components) ? document.components.schemas : undefined;
    if (isObject(schemas)) {
      if (root in schemas) return { $ref: COMPONENTS + root.replace(/~/g, '~0').replace(/\//g, '~1') };
      const matches = Object.keys(schemas).filter((k) => k.endsWith('.' + root));
      if (matches.length === 1) return { $ref: COMPONENTS + matches[0] };
    }
    return {};
  }
  if (root.kind === 'CustomResourceDefinition') return crdSchema(root);
  if (isObject(root.schema) && isObject(root.schema.openAPIV3Schema)) return root.schema.openAPIV3Schema;
  if (isObject(root.openAPIV3Schema)) return root.openAPIV3Schema;
  return root;
}

// A CRD's storage version, or its first.
function crdSchema(crd: Schema): Schema {
  const spec = isObject(crd.spec) ? crd.spec : {};
  const versions = Array.isArray(spec.versions) ? spec.versions.filter(isObject) : [];
  const version = versions.find((v) => v.storage) ?? versions[0];
  const schema = version && isObject(version.schema) ? version.schema.openAPIV3Schema : undefined;
  return isObject(schema) ? schema : {};
}

/**
 * The schema tree of `root` in `document`. Only the root is built; every other
 * node is built when its parent's children are first read.
 *
 * @param document an OpenAPI v3 document (its `components.schemas` resolve `$ref`), a CRD, or a bare schema
 * @param root a component name (`io.k8s.api.apps.v1.Deployment`, `#/components/schemas/...`, or a unique suffix
 *   such as `apps.v1.Deployment`), a `#/` pointer, a schema object, a CRD version (`{schema: {openAPIV3Schema}}`)
 *   or its `openAPIV3Schema`; omitted, the document itself (a CRD: its storage version)
 */
export function normalize(document: unknown, root?: Root): SchemaNode {
  const schema = rootSchema(document, root);
  return new Node(document, schema, 'root', '', undefined, false);
}

/** The node at a dotted field path below `node` (`spec.template.spec.containers.name`), or undefined. */
export function find(node: SchemaNode, path: string): SchemaNode | undefined {
  let at: SchemaNode | undefined = node;
  for (const name of path.split('.').filter(Boolean)) {
    at = at?.fields.find((f) => f.name === name);
  }
  return at;
}
