import { afterEach, describe, expect, it, vi } from 'vitest';

import { linkUrl, type KdLink } from '../../src/kd';
import { mount, shadow, update } from './mount';

const POD = '/d/k8s-pod/kubernetes-pod?orgId=1&from=now-6h&to=now&var-app_namespace=default&var-pod=web-0';

function at(path: string): void {
  history.replaceState(null, '', path);
}

const href = (el: KdLink) => shadow(el).querySelector('a')?.getAttribute('href');

describe('linkUrl', () => {
  afterEach(() => at('/'));

  it('builds a dashboard URL from vars, prefixing var- where missing', () => {
    expect(linkUrl({ dashboard: 'k8s-ns', vars: { app_namespace: 'a b', 'var-x': 1, skip: null, list: ['p', 'q'] } }, window)).toBe(
      '/d/k8s-ns?var-app_namespace=a+b&var-x=1&var-list=p&var-list=q',
    );
  });

  it('keeps the time range of the current page', () => {
    at(POD);
    expect(linkUrl({ dashboard: 'k8s-node', vars: { node: 'puffer' } }, window)).toBe(
      '/d/k8s-node?var-node=puffer&from=now-6h&to=now',
    );
  });

  it('adds this dashboard and its variables as var-back', () => {
    at(POD);
    const url = new URL(linkUrl({ dashboard: 'k8s-ns', vars: { app_namespace: 'default' }, back: true }, window)!, location.href);
    expect(url.pathname).toBe('/d/k8s-ns');
    expect(url.searchParams.get('var-back')).toBe('k8s-pod?var-app_namespace=default&var-pod=web-0');
    expect(url.searchParams.get('from')).toBe('now-6h');
  });

  it('chains back through a page that was itself opened with a back', () => {
    at(POD);
    const first = linkUrl({ dashboard: 'k8s-ns', back: true }, window)!;
    at(first);
    const second = new URL(linkUrl({ dashboard: 'k8s-node', back: true }, window)!, location.href);
    const back = second.searchParams.get('var-back')!;
    expect(back.startsWith('k8s-ns?')).toBe(true);
    // Following the back value returns to the namespace page, whose own back is the pod.
    const returned = new URL(linkUrl({ dashboard: back }, window)!, location.href);
    expect(returned.pathname).toBe('/d/k8s-ns');
    expect(returned.searchParams.get('var-back')).toBe('k8s-pod?var-app_namespace=default&var-pod=web-0');
  });

  it('keeps Grafana sub-paths', () => {
    at('/grafana/d/k8s-pod/x?var-pod=a');
    expect(linkUrl({ dashboard: 'k8s-ns', back: true }, window)).toBe('/grafana/d/k8s-ns?var-back=k8s-pod%3Fvar-pod%3Da');
  });

  it('works outside a dashboard and outside Grafana', () => {
    at('/explore');
    expect(linkUrl({ dashboard: 'k8s-ns', back: true }, window)).toBe('/d/k8s-ns');
    expect(linkUrl({ dashboard: 'k8s-ns' }, null)).toBe('/d/k8s-ns');
  });

  it('uses a plain href, but never a script URL', () => {
    expect(linkUrl({ href: 'https://example.com/' })).toBe('https://example.com/');
    expect(linkUrl({ href: 'javascript:alert(1)' })).toBeUndefined();
    expect(linkUrl({})).toBeUndefined();
  });
});

describe('kd-link', () => {
  afterEach(() => {
    at('/');
    document.body.replaceChildren();
    delete (window as { System?: unknown }).System;
  });

  it('renders from attributes, the slot being the label', async () => {
    const el = await mount<KdLink>(`<kd-link dashboard="k8s-pod" vars='{"pod":"web-0"}' icon="/img/pod.svg">web-0</kd-link>`);
    expect(href(el)).toBe('/d/k8s-pod?var-pod=web-0');
    expect(shadow(el).querySelector('img')?.getAttribute('src')).toBe('/img/pod.svg');
    expect(el.textContent).toBe('web-0');
  });

  it('renders from the data attribute and the property, data winning field by field', async () => {
    const el = await mount<KdLink>(`<kd-link dashboard="ignored" data='{"dashboard":"k8s-ns","text":"default"}'></kd-link>`);
    expect(href(el)).toBe('/d/k8s-ns');
    expect(shadow(el).textContent).toContain('default');
    await update(el, { data: { dashboard: 'k8s-node', text: 'puffer', title: 'Node' } });
    expect(href(el)).toBe('/d/k8s-node');
    expect(shadow(el).querySelector('a')?.getAttribute('title')).toBe('Node');
    expect(shadow(el).textContent).toContain('puffer');
  });

  it('is plain text without a target', async () => {
    const el = await mount<KdLink>(`<kd-link text="nowhere"></kd-link>`);
    expect(shadow(el).querySelector('a')).toBeNull();
    expect(shadow(el).textContent).toContain('nowhere');
  });

  it('rebuilds the URL at click time, so it follows variables changed since render', async () => {
    at(POD);
    const el = await mount<KdLink>(`<kd-link dashboard="k8s-ns" back>ns</kd-link>`);
    at(POD.replace('web-0', 'web-1'));
    const a = shadow(el).querySelector('a')!;
    a.addEventListener('click', (e) => e.preventDefault());
    a.click();
    expect(new URL(a.getAttribute('href')!, location.href).searchParams.get('var-back')).toContain('var-pod=web-1');
  });

  it('navigates inside Grafana through its location service', async () => {
    at('/grafana/d/k8s-pod/x?var-pod=a');
    const push = vi.fn();
    Object.assign(window, { System: { import: vi.fn(async () => ({ locationService: { push } })) } });
    const el = await mount<KdLink>(`<kd-link dashboard="k8s-ns" data='{"vars":{"app_namespace":"default"}}'>ns</kd-link>`);
    await new Promise((r) => setTimeout(r));
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, button: 0 });
    shadow(el).querySelector('a')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(push).toHaveBeenCalledWith('/d/k8s-ns?var-app_namespace=default');
  });
});
