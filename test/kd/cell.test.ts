import { render } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';

import { isEmpty, renderCell, type Cell, type KdData, type KdLink } from '../../src/kd';
import { settle } from './mount';

function cell(value: Cell): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  render(renderCell(value), host);
  return host;
}

describe('renderCell', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('renders scalars as text and nothing for null', () => {
    expect(cell('web-0').textContent).toBe('web-0');
    expect(cell(3).textContent).toBe('3');
    expect(cell(false).textContent).toBe('false');
    expect(cell(null).textContent).toBe('');
    expect(cell(undefined).textContent).toBe('');
  });

  it('renders text with a tone as a kd-pill, text escaped', () => {
    const pill = cell({ text: '<b>Running</b>', tone: 'success', title: 'all ready' }).querySelector('kd-pill');
    expect(pill?.getAttribute('tone')).toBe('success');
    expect(pill?.getAttribute('title')).toBe('all ready');
    expect(pill?.textContent).toBe('<b>Running</b>');
    expect(pill?.querySelector('b')).toBeNull();
  });

  it('leaves out a pill tone and title that are not given', () => {
    const pill = cell({ text: 'x' }).querySelector('kd-pill');
    expect(pill?.hasAttribute('tone')).toBe(false);
    expect(pill?.hasAttribute('title')).toBe(false);
  });

  it('renders an href as a kd-link', async () => {
    const link = cell({ href: 'https://example.com/', text: 'site', icon: '🔗' }).querySelector('kd-link') as KdLink;
    await settle(link);
    const a = link.shadowRoot?.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://example.com/');
    expect(link.shadowRoot?.textContent).toContain('site');
    expect(link.shadowRoot?.querySelector('.icon')?.textContent).toBe('🔗');
  });

  it('renders a dashboard as a kd-link', async () => {
    const link = cell({ dashboard: 'k8s-pod', vars: { pod: 'web-0' }, text: 'web-0' }).querySelector('kd-link') as KdLink;
    await settle(link);
    expect(link.shadowRoot?.querySelector('a')?.getAttribute('href')).toBe('/d/k8s-pod?var-pod=web-0');
  });

  it('renders data as a kd-data', async () => {
    const data = cell({ data: { a: [1] } }).querySelector('kd-data') as KdData;
    await settle(data);
    expect(data.data).toEqual({ a: [1] });
    expect(data.shadowRoot?.querySelector('pre')?.textContent).toBe('a:\n- 1');
  });

  it('renders code as monospace text', () => {
    expect(cell({ code: 'kubectl get po' }).querySelector('code')?.textContent).toBe('kubectl get po');
  });

  it('renders an object of no known shape as data', () => {
    const data = cell({ replicas: 2 } as unknown as Cell).querySelector('kd-data') as KdData;
    expect(data.data).toEqual({ replicas: 2 });
  });

  it('renders a list inline, without its empty cells', () => {
    const host = cell(['a', null, '', { text: 'b' }, [], { code: 'c' }]);
    const items = host.querySelectorAll('.cells > span');
    expect(items.length).toBe(3);
    expect(items[0].textContent).toBe('a');
    expect(items[1].querySelector('kd-pill')?.textContent).toBe('b');
    expect(items[2].querySelector('code')?.textContent).toBe('c');
  });
});

describe('isEmpty', () => {
  it('is true for nothing, an empty string and a list of empties', () => {
    expect([null, undefined, '', [], [null, ''], [[]]].every((c) => isEmpty(c as Cell))).toBe(true);
    expect([0, false, 'x', [null, 'x'], { text: '' }].some((c) => isEmpty(c as Cell))).toBe(false);
  });
});
