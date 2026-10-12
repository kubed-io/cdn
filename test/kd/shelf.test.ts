import { afterEach, describe, expect, it } from 'vitest';

import type { KdShelf, ShelfItem } from '../../src/kd';
import { mount, shadow, update } from './mount';

const ITEMS: ShelfItem[] = [
  { title: 'Alien', image: 'https://img.example/alien.jpg', sub: '1979 · ★8.5', href: '/d/abc/films?var-imdb=tt0078748' },
  { title: 'Arrival', sub: '2016', href: 'https://www.imdb.com/title/tt2543164/', tip: 'Arrival (2016)' },
  { title: 'Brazil' },
];
const items = (el: KdShelf) => [...shadow(el).querySelectorAll('.item')];

describe('kd-shelf', () => {
  afterEach(() => document.body.replaceChildren());

  it('draws one card per item: art, title and sub', async () => {
    const el = await mount<KdShelf>(`<kd-shelf></kd-shelf>`);
    await update(el, { items: ITEMS });
    const [alien, arrival, brazil] = items(el);
    expect(alien.querySelector('img')?.getAttribute('src')).toBe('https://img.example/alien.jpg');
    expect(alien.querySelector('img')?.getAttribute('loading')).toBe('lazy');
    expect(alien.querySelector('.title')?.textContent).toBe('Alien');
    expect(alien.querySelector('.sub')?.textContent).toBe('1979 · ★8.5');
    // No image: a placeholder of the same size, so the row stays even.
    expect(arrival.querySelector('img')).toBeNull();
    expect(arrival.querySelector('.art.blank')).not.toBeNull();
    expect(brazil.querySelector('.sub')).toBeNull();
  });

  it('links a card with an href, in the same tab inside Grafana and a new one outside', async () => {
    const el = await mount<KdShelf>(`<kd-shelf></kd-shelf>`);
    await update(el, { items: ITEMS });
    const [alien, arrival, brazil] = items(el);
    expect(alien.localName).toBe('a');
    expect(alien.getAttribute('href')).toBe('/d/abc/films?var-imdb=tt0078748');
    expect(alien.getAttribute('target')).toBeNull();
    expect(arrival.getAttribute('target')).toBe('_blank');
    expect(arrival.getAttribute('rel')).toBe('noopener');
    expect(brazil.localName).toBe('div');
  });

  it('titles a card with its tip, or its title', async () => {
    const el = await mount<KdShelf>(`<kd-shelf></kd-shelf>`);
    await update(el, { items: ITEMS });
    expect(items(el).map((i) => i.getAttribute('title'))).toEqual(['Alien', 'Arrival (2016)', 'Brazil']);
  });

  it('never links or loads a script URL from the data', async () => {
    const el = await mount<KdShelf>(`<kd-shelf></kd-shelf>`);
    await update(el, { items: [{ title: 'x', href: 'javascript:alert(1)', image: 'javascript:alert(2)' }] });
    const [x] = items(el);
    expect(x.localName).toBe('div');
    expect(x.querySelector('img')).toBeNull();
  });

  it('is a row by default and wraps as a grid on request', async () => {
    const el = await mount<KdShelf>(`<kd-shelf></kd-shelf>`);
    await update(el, { items: ITEMS });
    expect(shadow(el).querySelector('.shelf')?.className).toBe('shelf row');
    el.setAttribute('layout', 'grid');
    await el.updateComplete;
    expect(shadow(el).querySelector('.shelf')?.className).toBe('shelf grid');
  });

  it('sizes the cards from width and ratio', async () => {
    const el = await mount<KdShelf>(`<kd-shelf width="96" ratio="1"></kd-shelf>`);
    await update(el, { items: ITEMS });
    const style = shadow(el).querySelector<HTMLElement>('.shelf')!.getAttribute('style') ?? '';
    expect(style).toContain('--card: 96px');
    expect(style).toContain('--ratio: 1');
  });

  it('takes its items as a JSON attribute too', async () => {
    const el = await mount<KdShelf>(`<kd-shelf items='[{"title":"Heat"}]'></kd-shelf>`);
    expect(items(el).map((i) => i.querySelector('.title')?.textContent)).toEqual(['Heat']);
  });

  it('says so when there is nothing', async () => {
    const el = await mount<KdShelf>(`<kd-shelf></kd-shelf>`);
    expect(shadow(el).querySelector('.none')?.textContent).toBe('none');
    el.setAttribute('empty', 'No titles');
    await update(el, { items: [] });
    expect(shadow(el).querySelector('.none')?.textContent).toBe('No titles');
  });
});
