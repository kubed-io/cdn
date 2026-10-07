import { afterEach, describe, expect, it } from 'vitest';

import { VERSION, type KdK8sEvents, type KdK8sObject, type KdK8sRef } from '../../src/k8s';
import type { KdLink, KdTable } from '../../src/kd';
import { mount, settle, shadow, text, update } from '../kd/mount';
import { copy, events, node, pod } from './fixtures';

const inner = <T extends Element>(el: Element, selector: string) => shadow(el).querySelector(selector) as T;

it.each(['kd-k8s-ref', 'kd-k8s-events', 'kd-k8s-object', 'kd-bar', 'kd-table'])('importing k8s registers %s', (tag) => {
  const element = customElements.get(tag) as (CustomElementConstructor & { kdVersion?: string }) | undefined;
  expect(element?.kdVersion).toBe(VERSION);
});

describe('kd-k8s-ref', () => {
  afterEach(() => document.body.replaceChildren());

  it('links a kind from attributes, with its icon', async () => {
    const el = await mount<KdK8sRef>(`<kd-k8s-ref kind="Pod" namespace="shop" name="web-0" api-version="v1"></kd-k8s-ref>`);
    const link = inner<KdLink>(el, 'kd-link');
    expect(link.link).toMatchObject({ dashboard: 'k8s-pod', vars: { app_namespace: 'shop', pod: 'web-0' }, back: true, text: 'web-0' });
    expect(shadow(link).querySelector('a')?.getAttribute('href')).toContain('/d/k8s-pod?var-app_namespace=shop&var-pod=web-0');
    expect(shadow(link).querySelector('img')?.getAttribute('src')).toMatch(/pod\.svg$/);
  });

  it('takes an object as data, and re-renders with new data', async () => {
    const el = await mount<KdK8sRef>(`<kd-k8s-ref data='{"kind":"Node","name":"node-1"}'></kd-k8s-ref>`);
    expect(inner<KdLink>(el, 'kd-link').link.vars).toEqual({ node: 'node-1' });
    await update(el, { data: pod });
    expect(inner<KdLink>(el, 'kd-link').link).toMatchObject({ dashboard: 'k8s-pod', text: 'web-5c57db9dff-6fkrm' });
  });

  it('renders nothing without a kind and a name', async () => {
    const el = await mount<KdK8sRef>(`<kd-k8s-ref kind="Pod"></kd-k8s-ref>`);
    expect(shadow(el).querySelector('kd-link')).toBeNull();
  });
});

describe('kd-k8s-events', () => {
  afterEach(() => document.body.replaceChildren());

  it('folds the frames into a table and counts the rows', async () => {
    const el = await mount<KdK8sEvents>(`<kd-k8s-events now="${events.now}"></kd-k8s-events>`);
    await update(el, { data: events.frames });
    expect(el.count).toBe(6);
    expect(el.warnings).toBe(1);
    const table = inner<KdTable>(el, 'kd-table');
    expect(shadow(table).querySelectorAll('tbody tr')).toHaveLength(6);
    expect(shadow(table).querySelectorAll('th')).toHaveLength(4);
    const pill = shadow(table).querySelector('tbody tr:nth-child(4) kd-pill');
    expect(pill?.getAttribute('tone')).toBe('error');
    expect(pill?.getAttribute('title')).toBe('Warning · from kubelet');
    expect(text(table)).toContain('×3');
  });

  it('adds the object column from the attribute, and renders from the data attribute', async () => {
    const json = JSON.stringify(events.frames).replace(/'/g, '&#39;');
    const el = await mount<KdK8sEvents>(`<kd-k8s-events object now="${events.now}" data='${json}'></kd-k8s-events>`);
    const table = inner<KdTable>(el, 'kd-table');
    expect([...shadow(table).querySelectorAll('th')].map((th) => th.textContent)).toEqual(['Reason', 'Object', 'Message', '', 'Last seen']);
    expect(shadow(table).querySelectorAll('tbody kd-link')).toHaveLength(6);
  });

  it('says so when there are none, and keeps its tab count', async () => {
    const tabs = await mount<HTMLElement>(`<kd-tabs><section label="Events"><kd-k8s-events></kd-k8s-events></section></kd-tabs>`);
    const el = tabs.querySelector('kd-k8s-events') as KdK8sEvents;
    await update(el, { data: [] });
    expect(el.count).toBe(0);
    expect(text(inner(el, 'kd-table'))).toBe('No events in this time range');
    expect(tabs.querySelector('section')?.getAttribute('count')).toBe('0');
    await update(el, { data: events.frames });
    expect(tabs.querySelector('section')?.getAttribute('count')).toBe('6');
  });
});

describe('kd-k8s-object', () => {
  afterEach(() => document.body.replaceChildren());

  it('composes the page of a pod from the kd elements', async () => {
    const el = await mount<KdK8sObject>(`<kd-k8s-object key="pod-test"></kd-k8s-object>`);
    await update(el, { data: pod, now: Date.parse('2026-10-07T12:00:00Z') });
    const root = shadow(el);
    expect(text(inner(el, 'kd-bar'))).toContain('web-5c57db9dff-6fkrm');
    expect(root.querySelector('kd-steps')).not.toBeNull();
    const labels = [...root.querySelectorAll('kd-tabs > section')].map((s) => [s.getAttribute('label'), s.getAttribute('count')]);
    expect(labels).toEqual([
      ['Summary', null],
      ['Labels', '10'],
      ['Annotations', '0'],
      ['YAML', null],
    ]);
    expect(text(inner(el, 'kd-sheet'))).toContain('Burstable');
    expect(root.querySelector('kd-data')?.getAttribute('fold')).toBe('0');
    expect(root.querySelector('kd-tabs')?.getAttribute('key')).toBe('pod-test');
  });

  it('adds an Events tab with its count when given events', async () => {
    const el = await mount<KdK8sObject>(`<kd-k8s-object></kd-k8s-object>`);
    await update(el, { data: pod, events: events.frames, now: events.now });
    const pane = shadow(el).querySelector('section[label="Events"]');
    expect(pane?.getAttribute('count')).toBe('6');
  });

  it('renders from the data attribute and re-renders a node without steps', async () => {
    const json = JSON.stringify(copy(node)).replace(/'/g, '&#39;');
    const el = await mount<KdK8sObject>(`<kd-k8s-object data='${json}'></kd-k8s-object>`);
    expect(text(inner(el, 'kd-bar'))).toContain('node-5');
    await update(el, { data: { kind: 'Thing', metadata: { name: 'x' } } });
    expect(shadow(el).querySelector('kd-steps')).toBeNull();
    expect(text(inner(el, 'kd-bar'))).toContain('x');
    await update(el, { data: undefined });
    await settle(el);
    expect(shadow(el).querySelector('kd-bar')).toBeNull();
  });
});
