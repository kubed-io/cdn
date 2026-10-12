import { afterEach, describe, expect, it } from 'vitest';

import type { FeatureData, KdFeature, KdShelf } from '../../src/kd';
import { mount, shadow, update } from './mount';

const FILM: FeatureData = {
  title: 'Alien',
  sub: '1979',
  image: 'https://img.example/alien.jpg',
  facts: [{ text: 'IMDb 8.5', tone: 'warning' }, '1M votes', 'Movie', '1h 57m'],
  tags: ['Horror', 'Sci-Fi'],
  text: 'The crew of a commercial spacecraft encounters a deadly lifeform.',
  actions: [
    { id: 'find', label: '🔎 Find Now', tone: 'primary' },
    { label: 'IMDb ↗', href: 'https://www.imdb.com/title/tt0078748/' },
  ],
  people: [
    { title: 'Ridley Scott', sub: 'Director', image: 'https://img.example/scott.jpg' },
    { title: 'Sigourney Weaver', sub: 'Cast' },
  ],
};
const $ = (el: KdFeature, selector: string) => shadow(el).querySelector(selector);

describe('kd-feature', () => {
  afterEach(() => document.body.replaceChildren());

  it('shows the picture, title, sub, facts, tags and text', async () => {
    const el = await mount<KdFeature>(`<kd-feature></kd-feature>`);
    await update(el, { data: FILM });
    expect($(el, '.picture img')?.getAttribute('src')).toBe('https://img.example/alien.jpg');
    expect($(el, 'h2 .name')?.textContent).toBe('Alien');
    expect($(el, 'h2 .sub')?.textContent).toBe('1979');
    const facts = [...shadow(el).querySelectorAll('.facts > span')].map((f) => f.textContent?.trim());
    expect(facts).toEqual(['IMDb 8.5', '1M votes', 'Movie', '1h 57m']);
    expect($(el, '.facts kd-pill')?.getAttribute('tone')).toBe('warning');
    expect([...shadow(el).querySelectorAll('.tags kd-pill')].map((p) => p.textContent)).toEqual(['Horror', 'Sci-Fi']);
    expect($(el, '.text')?.textContent).toBe(FILM.text);
  });

  it('draws a button for an action and a link for one with an href', async () => {
    const el = await mount<KdFeature>(`<kd-feature></kd-feature>`);
    await update(el, { data: FILM });
    const [find, imdb] = shadow(el).querySelectorAll('.actions > *');
    expect(find.localName).toBe('button');
    expect(find.className).toBe('action primary');
    expect(find.textContent?.trim()).toBe('🔎 Find Now');
    expect(imdb.localName).toBe('a');
    expect(imdb.getAttribute('href')).toBe('https://www.imdb.com/title/tt0078748/');
    expect(imdb.getAttribute('target')).toBe('_blank');
    expect(imdb.className).toBe('action neutral');
  });

  it('says which button was pressed', async () => {
    const el = await mount<KdFeature>(`<kd-feature></kd-feature>`);
    await update(el, { data: FILM });
    const seen: unknown[] = [];
    el.addEventListener('action', (e) => seen.push((e as CustomEvent).detail));
    shadow(el).querySelector<HTMLButtonElement>('.actions button')!.click();
    expect(seen).toEqual([{ id: 'find', action: FILM.actions![0] }]);
  });

  it('keeps a place for actions the panel adds itself', async () => {
    const el = await mount<KdFeature>(`<kd-feature><a slot="actions" href="/d/x">In your library</a></kd-feature>`);
    await update(el, { data: FILM });
    expect($(el, '.actions slot[name="actions"]')).not.toBeNull();
  });

  it('lists the people as a grid shelf', async () => {
    const el = await mount<KdFeature>(`<kd-feature></kd-feature>`);
    await update(el, { data: FILM });
    const shelf = $(el, 'kd-shelf') as KdShelf;
    expect(shelf.getAttribute('layout')).toBe('grid');
    expect(shelf.items).toEqual(FILM.people);
  });

  it('leaves out what it was not given', async () => {
    const el = await mount<KdFeature>(`<kd-feature></kd-feature>`);
    await update(el, { data: { title: 'Brazil' } });
    for (const part of ['.picture', 'h2 .sub', '.facts', '.tags', '.text', 'kd-shelf']) expect($(el, part), part).toBeNull();
    // The actions row stays for the slot.
    expect($(el, '.actions slot')).not.toBeNull();
  });

  it('never links or loads a script URL from the data', async () => {
    const el = await mount<KdFeature>(`<kd-feature></kd-feature>`);
    await update(el, {
      data: { title: 'x', image: 'javascript:alert(1)', actions: [{ label: 'go', href: 'javascript:alert(2)' }] },
    });
    expect($(el, '.picture')).toBeNull();
    expect($(el, '.actions a')).toBeNull();
  });

  it('shows the empty text with no title', async () => {
    const el = await mount<KdFeature>(`<kd-feature empty="Pick a title."></kd-feature>`);
    expect($(el, '.none')?.textContent).toBe('Pick a title.');
    await update(el, { data: { title: '' } });
    expect($(el, '.none')?.textContent).toBe('Pick a title.');
  });

  it('takes its data as a JSON attribute too', async () => {
    const el = await mount<KdFeature>(`<kd-feature data='{"title":"Heat","sub":"1995"}'></kd-feature>`);
    expect($(el, 'h2 .sub')?.textContent).toBe('1995');
  });
});
