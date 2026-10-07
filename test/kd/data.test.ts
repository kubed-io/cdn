import { afterEach, describe, expect, it } from 'vitest';

import type { KdData } from '../../src/kd';
import { mount, shadow, update } from './mount';

const pre = (el: KdData) => shadow(el).querySelector('pre')?.textContent;

describe('kd-data', () => {
  afterEach(() => document.body.replaceChildren());

  it('renders YAML from the data attribute and the property', async () => {
    const el = await mount<KdData>(`<kd-data data='{"name":"web","ports":[80]}'></kd-data>`);
    expect(pre(el)).toBe('name: web\nports:\n- 80');
    await update(el, { data: { replicas: 3 } });
    expect(pre(el)).toBe('replicas: 3');
  });

  it('highlights keys, strings, numbers and booleans', async () => {
    const el = await mount<KdData>(`<kd-data data='{"a":"x","b":1,"c":true,"d":null}'></kd-data>`);
    const spans = [...shadow(el).querySelectorAll('pre span')].map((s) => `${s.className}:${s.textContent}`);
    expect(spans).toEqual(['key:a', 'str:x', 'key:b', 'num:1', 'key:c', 'bool:true', 'key:d', 'null:null']);
  });

  it('escapes what it shows', async () => {
    const el = await mount<KdData>(`<kd-data></kd-data>`);
    await update(el, { data: { html: '<img src=x onerror=alert(1)>' } });
    expect(shadow(el).querySelector('img')).toBeNull();
    expect(pre(el)).toBe('html: <img src=x onerror=alert(1)>');
  });

  it('folds past `fold` lines under a summary of its size', async () => {
    const big = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`k${i}`, i]));
    const el = await mount<KdData>(`<kd-data></kd-data>`);
    await update(el, { data: big });
    const details = shadow(el).querySelector('details');
    expect(details?.open).toBe(false);
    expect(details?.querySelector('summary')?.textContent).toBe('{ } 11 keys');

    await update(el, { data: Array.from({ length: 4 }, (_, i) => i), fold: 3 });
    expect(shadow(el).querySelector('summary')?.textContent).toBe('[ ] 4 items');

    await update(el, { data: [{ a: 1, b: 2 }], fold: 1 });
    expect(shadow(el).querySelector('summary')?.textContent).toBe('[ ] 1 item');
  });

  it('does not fold short values, scalars or with fold="0"', async () => {
    const el = await mount<KdData>(`<kd-data fold="0"></kd-data>`);
    await update(el, { data: Array.from({ length: 50 }, (_, i) => i) });
    expect(shadow(el).querySelector('details')).toBeNull();
    await update(el, { data: 'a\nb\nc', fold: 1 });
    expect(shadow(el).querySelector('details')).toBeNull();
    expect(pre(el)).toBe('|-\n  a\n  b\n  c');
    await update(el, { data: { a: 1 }, fold: 10 });
    expect(shadow(el).querySelector('details')).toBeNull();
  });

  it('renders nothing until it has data', async () => {
    const el = await mount<KdData>(`<kd-data></kd-data>`);
    expect(shadow(el).querySelector('pre')).toBeNull();
    await update(el, { data: null });
    expect(pre(el)).toBe('null');
  });
});
