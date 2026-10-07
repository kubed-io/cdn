import { afterEach, describe, expect, it, vi } from 'vitest';

import { KdSchema } from '../../src/openapi';
import { apps, prometheus } from './fixtures';

async function mount(setup: (el: KdSchema) => void = () => {}): Promise<KdSchema> {
  const el = document.createElement('kd-schema');
  setup(el);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const shadow = (el: KdSchema) => el.shadowRoot!;
const field = (el: KdSchema, path: string) =>
  shadow(el).querySelector<HTMLElement>(`.f[title="${path}"]`) ?? undefined;
// The lines of an opened field's body, whitespace collapsed.
const lines = (f: HTMLElement) =>
  [...f.querySelector(':scope > .fb')!.children].map((c) => c.textContent!.replace(/\s+/g, ' ').trim());
const names = (scope: ParentNode) =>
  [...scope.querySelectorAll(':scope > .f')].map((f) => f.querySelector('.k')?.textContent);

async function toggle(el: KdSchema, path: string): Promise<void> {
  field(el, path)!.querySelector('summary')!.click();
  // the toggle event is queued after the click
  await new Promise((resolve) => setTimeout(resolve));
  await el.updateComplete;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('kd-schema', () => {
  it('is registered and lists the root fields', async () => {
    expect(customElements.get('kd-schema')).toBe(KdSchema);
    const el = await mount((e) => {
      e.document = apps;
      e.root = 'io.k8s.api.apps.v1.Deployment';
    });
    expect(names(shadow(el).querySelector('.tree')!)).toEqual(['apiVersion', 'kind', 'metadata', 'spec', 'status']);
  });

  it('opens spec and status, renders closed fields without their subtree', async () => {
    const el = await mount((e) => (e.document = prometheus));
    const spec = field(el, 'spec')!;
    expect(spec.hasAttribute('open')).toBe(true);
    expect(field(el, 'status')!.hasAttribute('open')).toBe(true);
    expect(field(el, 'metadata')!.hasAttribute('open')).toBe(false);
    const affinity = field(el, 'spec.affinity')!;
    expect(affinity.hasAttribute('open')).toBe(false);
    expect(affinity.querySelector('.fc')).toBeNull();
    expect(field(el, 'spec.affinity.nodeAffinity')).toBeUndefined();
    // spec and status are open, the rest of 1,800 fields is not drawn
    expect(shadow(el).querySelectorAll('.f').length).toBeLessThan(250);
  });

  it('renders a subtree when opened and drops it when closed', async () => {
    const el = await mount((e) => (e.document = prometheus));
    await toggle(el, 'spec.affinity');
    expect(field(el, 'spec.affinity')!.hasAttribute('open')).toBe(true);
    expect(names(field(el, 'spec.affinity')!.querySelector('.fc')!)).toEqual([
      'nodeAffinity',
      'podAffinity',
      'podAntiAffinity',
    ]);
    expect(field(el, 'spec.affinity.nodeAffinity')!.querySelector('.fc')).toBeNull();
    await toggle(el, 'spec.affinity');
    expect(field(el, 'spec.affinity.nodeAffinity')).toBeUndefined();
  });

  it('shows the type, constraints, tags and the required marker', async () => {
    const el = await mount((e) => {
      e.document = apps;
      e.root = 'io.k8s.api.apps.v1.Deployment';
    });
    const selector = field(el, 'spec.selector')!;
    expect(selector.querySelector('.rq')?.getAttribute('title')).toBe('required');
    expect(selector.querySelector('.t')?.textContent).toBe('LabelSelector');
    expect(field(el, 'spec.replicas')!.querySelector('.rq')).toBeNull();
    expect(field(el, 'spec.replicas')!.querySelector('.c')?.textContent).toBe('format int32');
    await toggle(el, 'spec.template');
    await toggle(el, 'spec.template.spec');
    const containers = field(el, 'spec.template.spec.containers')!;
    expect(containers.querySelector('.t')?.textContent).toBe('[]Container');
    const tags = [...containers.querySelector('summary')!.querySelectorAll('.kt')];
    expect(tags.map((t) => t.textContent)).toEqual(['keyed by name', 'patch merge by name']);
    expect(tags[0].getAttribute('title')).toMatch(/apply merges items that share these keys/);
  });

  it('shows a CEL rule with its message when the field is opened', async () => {
    const el = await mount((e) => (e.document = prometheus));
    const strategy = field(el, 'spec.updateStrategy')!;
    expect(strategy.querySelector('.cel')).toBeNull();
    await toggle(el, 'spec.updateStrategy');
    const cel = field(el, 'spec.updateStrategy')!.querySelector('.fb .cel')!;
    expect(cel.textContent).toContain("!(self.type != 'RollingUpdate' && has(self.rollingUpdate))");
    expect(cel.textContent).toContain('rollingUpdate requires type to be RollingUpdate');
  });

  it('shows every keyword: combinators, docs, examples, rules, each item and value, and other', async () => {
    const el = await mount((e) => {
      e.expand = 'a';
      e.document = {
        type: 'object',
        properties: {
          a: {
            type: 'object',
            title: 'The A',
            description: 'First line\nsecond line',
            example: { x: 1 },
            examples: ['one'],
            externalDocs: { url: 'https://example.com/a', description: 'A docs' },
            anyOf: [{ required: ['x'] }, { required: ['y'] }],
            oneOf: [{ type: 'string' }, { type: 'integer', minimum: 0 }],
            allOf: [{ properties: { z: {} } }],
            not: { required: ['w'] },
            'x-kubernetes-preserve-unknown-fields': true,
            'x-kubernetes-embedded-resource': true,
            'x-kubernetes-validations': [
              { rule: 'self.x > 0', messageExpression: "'x is ' + self.x", reason: 'FieldValueInvalid', fieldPath: '.x', optionalOldSelf: true },
            ],
            'x-vendor': 'kept',
            properties: {
              list: { type: 'array', items: { type: 'string', enum: ['p', 'q'], 'x-kubernetes-int-or-string': true } },
              map: { type: 'object', additionalProperties: { type: 'integer', maximum: 9 } },
              bad: { type: 'string', externalDocs: { url: 'javascript:alert(1)' } },
            },
          },
        },
      };
    });
    const a = field(el, 'a')!;
    expect(a.querySelector('.fb > .desc')?.textContent).toBe('First line\nsecond line');
    expect(lines(a).slice(1)).toEqual([
      'any of: requires x | requires y',
      'exactly one of: string | integer (range 0..)',
      'all of: fields z',
      'must not be: requires w',
      'title The A',
      'example {"x":1}',
      'example "one"',
      'docs A docs',
      'validation',
      "self.x > 0 - message from 'x is ' + self.x (FieldValueInvalid) at .x (checked on create too)",
      'other',
      'x-vendor: "kept"',
    ]);
    expect(a.querySelector('.fb a')?.getAttribute('href')).toBe('https://example.com/a');
    const head = [...field(el, 'a')!.querySelectorAll(':scope > summary .kt')].map((t) => t.textContent);
    expect(head).toEqual(['any fields', 'embedded object']);

    await toggle(el, 'a.list');
    expect(lines(field(el, 'a.list')!)).toEqual(['each item', 'int or stringone of "p" | "q"']);
    await toggle(el, 'a.map');
    expect(field(el, 'a.map')!.querySelector('.t')?.textContent).toBe('map[string]integer');
    expect(lines(field(el, 'a.map')!)).toEqual(['each value', 'range ..9']);
    await toggle(el, 'a.bad');
    expect(field(el, 'a.bad')!.querySelector('a')).toBeNull();
    expect(lines(field(el, 'a.bad')!)).toEqual(['docs javascript:alert(1)']);
  });

  it('says where a recursive type is listed instead of repeating it', async () => {
    const el = await mount((e) => {
      e.document = {
        components: {
          schemas: {
            Tree: { type: 'object', properties: { name: { type: 'string' }, children: { type: 'array', items: { $ref: '#/components/schemas/Tree' } } } },
          },
        },
      };
      e.root = 'Tree';
    });
    await toggle(el, 'children');
    expect(field(el, 'children')!.querySelector('.fc')).toBeNull();
    expect(field(el, 'children')!.textContent).toContain('the same type as the root');
  });

  it('draws a field with nothing to open as a plain line', async () => {
    const el = await mount((e) => (e.document = { properties: { plain: { type: 'string' } } }));
    expect(field(el, 'plain')!.tagName).toBe('DIV');
    expect(field(el, 'plain')!.classList.contains('leaf')).toBe(true);
  });

  it('leaves out omitted top-level fields and opens the expanded ones', async () => {
    const el = await mount((e) => {
      e.setAttribute('omit', 'apiVersion kind metadata');
      e.setAttribute('expand', 'spec');
      e.document = prometheus;
    });
    expect(names(shadow(el).querySelector('.tree')!)).toEqual(['spec', 'status']);
    expect(field(el, 'status')!.hasAttribute('open')).toBe(false);
  });

  it('re-renders with a new document', async () => {
    const el = await mount((e) => (e.document = prometheus));
    await toggle(el, 'spec.affinity');
    el.document = apps;
    el.root = 'io.k8s.api.apps.v1.DeploymentSpec';
    await el.updateComplete;
    expect(names(shadow(el).querySelector('.tree')!)).toContain('replicas');
    el.document = { properties: {} };
    await el.updateComplete;
    expect(shadow(el).textContent).toContain('No schema');
  });

  it('fetches the document from src, with the root from its attribute', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(apps), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const el = await mount((e) => {
      e.setAttribute('root', 'apps.v1.Deployment');
      e.setAttribute('src', '/api/openapi/v3/apis/apps/v1');
    });
    await vi.waitFor(() => expect(field(el, 'spec')).toBeDefined());
    expect(fetch).toHaveBeenCalledWith('/api/openapi/v3/apis/apps/v1', expect.anything());
  });

  it('says so when src fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503, statusText: 'Unavailable' })));
    const el = await mount((e) => e.setAttribute('src', '/broken'));
    await vi.waitFor(() => expect(shadow(el).textContent).toContain('Could not load the schema: 503 Unavailable'));
  });
});
