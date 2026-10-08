import { afterEach, describe, expect, it, vi } from 'vitest';

import { lineSet, type KdCode } from '../../src/kd';
import { mount, shadow, update } from './mount';

const lines = (el: KdCode) => [...shadow(el).querySelectorAll('.line')];
const texts = (el: KdCode) => lines(el).map((line) => line.textContent);

describe('lineSet', () => {
  it('reads ranges, lists and GitHub line anchors', () => {
    expect([...lineSet('3,7-9')]).toEqual([3, 7, 8, 9]);
    expect([...lineSet('L2-L3, 5')]).toEqual([2, 3, 5]);
    expect([...lineSet('9-7')]).toEqual([7, 8, 9]);
    expect([...lineSet([4, 2, 2.5])]).toEqual([4, 2]);
    expect([...lineSet(6)]).toEqual([6]);
    expect([...lineSet('x, 1-')]).toEqual([]);
    expect(lineSet(undefined).size).toBe(0);
  });
});

describe('kd-code', () => {
  afterEach(() => document.body.replaceChildren());

  it('renders plain text from the attribute and the property, one line each', async () => {
    const el = await mount<KdCode>(`<kd-code text="a\nb"></kd-code>`);
    expect(texts(el)).toEqual(['a', 'b']);
    await update(el, { text: 'one\r\ntwo\nthree\n' });
    expect(texts(el)).toEqual(['one', 'two', 'three']);
  });

  it('highlights by language and by filename', async () => {
    const el = await mount<KdCode>(`<kd-code language="yml" text="key: 1"></kd-code>`);
    expect(shadow(el).querySelector('.hljs-attr')?.textContent).toBe('key:');
    expect(shadow(el).querySelector('.lang')?.textContent).toBe('YAML');

    await update(el, { language: undefined, filename: 'src/app.ts', text: 'const x: number = 1;' });
    expect(shadow(el).querySelector('.hljs-keyword')?.textContent).toBe('const');
    expect(shadow(el).querySelector('.lang')?.textContent).toBe('TypeScript');
  });

  it('falls back to the filename when the language is unknown', async () => {
    const el = await mount<KdCode>(`<kd-code language="nope" filename="a.json" text='{"a": 1}'></kd-code>`);
    expect(shadow(el).querySelector('.hljs-number')?.textContent).toBe('1');
  });

  it('shows an unknown language as plain text', async () => {
    const el = await mount<KdCode>(`<kd-code language="nope" text="if x"></kd-code>`);
    expect(shadow(el).querySelector('[class^="hljs"]')).toBeNull();
    expect(shadow(el).querySelector('.lang')).toBeNull();
    expect(texts(el)).toEqual(['if x']);
  });

  it('escapes the source, highlighted or not', async () => {
    const evil = '<img src=x onerror=alert(1)><script>alert(2)</script>';
    const el = await mount<KdCode>(`<kd-code language="html"></kd-code>`);
    await update(el, { text: evil });
    expect(shadow(el).querySelector('img, script')).toBeNull();
    expect(lines(el)[0].textContent).toBe(evil);
    expect(shadow(el).querySelector('.hljs-tag')).not.toBeNull();

    await update(el, { language: 'nope' });
    expect(shadow(el).querySelector('img, script')).toBeNull();
    expect(lines(el)[0].textContent).toBe(evil);
  });

  it('keeps a multi-line token on each of its lines', async () => {
    const el = await mount<KdCode>(`<kd-code language="javascript"></kd-code>`);
    await update(el, { text: '/* a\nb */\nx();' });
    expect(texts(el)).toEqual(['/* a', 'b */', 'x();']);
    expect(lines(el)[1].querySelector('.hljs-comment')?.textContent).toBe('b */');
  });

  it('numbers lines from start, or not at all', async () => {
    const el = await mount<KdCode>(`<kd-code start="98" text="a\nb\nc"></kd-code>`);
    const pre = shadow(el).querySelector('pre')!;
    expect(pre.classList.contains('numbered')).toBe(true);
    expect(pre.getAttribute('style')).toContain('counter-reset: line 97');
    expect(pre.getAttribute('style')).toContain('--gutter: 3ch');

    await update(el, { lines: false });
    expect(shadow(el).querySelector('pre')!.classList.contains('numbered')).toBe(false);
    const off = await mount<KdCode>(`<kd-code lines="false" text="a"></kd-code>`);
    expect(off.lines).toBe(false);
  });

  it('marks highlighted lines, counted from start', async () => {
    const el = await mount<KdCode>(`<kd-code highlight="2,4-5" text="1\n2\n3\n4\n5\n6"></kd-code>`);
    expect(lines(el).map((l) => l.classList.contains('hl'))).toEqual([false, true, false, true, true, false]);
    await update(el, { highlight: [11], start: 10 });
    expect(lines(el).map((l) => l.classList.contains('hl'))).toEqual([false, true, false, false, false, false]);
  });

  it('marks highlighted lines in highlighted code too', async () => {
    const el = await mount<KdCode>(`<kd-code language="yaml" highlight="2" text="a: 1\nb: 2"></kd-code>`);
    expect(shadow(el).querySelector('.hljs-attr')).not.toBeNull();
    expect(lines(el).map((l) => l.classList.contains('hl'))).toEqual([false, true]);
  });

  it('wraps by attribute and by its toggle', async () => {
    const el = await mount<KdCode>(`<kd-code wrap text="a"></kd-code>`);
    const pre = () => shadow(el).querySelector('pre')!;
    expect(pre().classList.contains('wrap')).toBe(true);
    const toggle = shadow(el).querySelector<HTMLButtonElement>('button[aria-pressed]')!;
    toggle.click();
    await el.updateComplete;
    expect(el.wrap).toBe(false);
    expect(pre().classList.contains('wrap')).toBe(false);
  });

  it('copies the text as given', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });
    const el = await mount<KdCode>(`<kd-code></kd-code>`);
    await update(el, { text: 'a\r\nb\n' });
    const copy = [...shadow(el).querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Copy')!;
    copy.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('a\r\nb\n'));
    await el.updateComplete;
    expect(copy.textContent?.trim()).toBe('Copied');
  });

  it('shows a file past the size limit as plain text', async () => {
    const big = Array.from({ length: 10_001 }, (_, i) => `k${i}: ${i}`).join('\n');
    const el = await mount<KdCode>(`<kd-code language="yaml"></kd-code>`);
    await update(el, { text: big });
    expect(lines(el)).toHaveLength(10_001);
    expect(shadow(el).querySelector('.hljs-attr')).toBeNull();
  });

  it('renders the latest text when highlighting finishes out of order', async () => {
    const el = await mount<KdCode>(`<kd-code language="yaml"></kd-code>`);
    el.text = 'first: 1';
    await Promise.resolve();
    await Promise.resolve();
    el.text = 'second: 2';
    await el.updateComplete;
    expect(texts(el)).toEqual(['second: 2']);
    expect(shadow(el).querySelector('.hljs-attr')?.textContent).toBe('second:');
  });

  it('renders nothing without text', async () => {
    const el = await mount<KdCode>(`<kd-code language="yaml"></kd-code>`);
    expect(shadow(el).querySelector('pre')).toBeNull();
  });
});
