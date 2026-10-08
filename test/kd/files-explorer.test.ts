import { afterEach, describe, expect, it } from 'vitest';

import '../../src/kd/files';
import { ACTIVITY_COLUMNS } from '../../src/github';
import type { Entry, FilesEventDetail, KdFiles, Provider } from '../../src/kd/files';
import { fakeScene, textbox } from './fake-scene';
import { mount, settle, shadow, update } from './mount';

const ENTRIES: Entry[] = [
  { path: 'README.md', type: 'file', size: 2048, stats: { opened: 1 }, modified: '2026-10-01T00:00:00Z' },
  { path: 'b.txt', type: 'file', size: 10, stats: { opened: 5 }, modified: '2026-10-07T00:00:00Z' },
  { path: 'src/kd/a.ts', type: 'file', size: 100, stats: { opened: 2, saved: 1 }, href: 'https://example.com/a.ts' },
  { path: 'src/kd/b.ts', type: 'file', size: 300, stats: { saved: 4 } },
  { path: 'src/index.ts', type: 'file', size: 7 },
  { path: 'src/deep', type: 'dir', partial: true, href: 'https://example.com/deep' },
  { path: 'docs/guide.md', type: 'file', size: 1, cells: { owner: { text: 'zed', tone: 'info' } } },
  { path: 'docs/index.md', type: 'file', size: 2, cells: { owner: 'amy' } },
];

// Lets the provider's promises settle, then the re-render.
async function tick(el: KdFiles): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    await new Promise((r) => setTimeout(r, 0));
    await settle(el);
  }
}

async function files(markup = '<kd-files></kd-files>', props: Partial<KdFiles> = { entries: ENTRIES }): Promise<KdFiles> {
  const el = await mount<KdFiles>(markup);
  await update(el, props);
  await tick(el);
  return el;
}

const rows = (el: KdFiles) => [...shadow(el).querySelectorAll('tbody tr')] as HTMLTableRowElement[];
const names = (el: KdFiles) => rows(el).map((r) => r.querySelector('.label')?.textContent?.trim());
const row = (el: KdFiles, name: string) => rows(el).find((r) => r.querySelector('.label')?.textContent?.trim() === name);
const crumbs = (el: KdFiles) => [...shadow(el).querySelectorAll('.crumb')].map((c) => c.textContent?.trim());
const column = (el: KdFiles, i: number) => rows(el).map((r) => r.cells[i]?.textContent?.replace(/\s+/g, ' ').trim());
const heads = (el: KdFiles) => [...shadow(el).querySelectorAll('th')] as HTMLElement[];
const sorter = (el: KdFiles, i: number) => heads(el)[i].querySelector('button') as HTMLButtonElement;
const trail = (el: KdFiles) => shadow(el).querySelector('.crumbs')?.textContent?.replace(/\s+/g, ' ').trim();
const key = (el: KdFiles, k: string) =>
  shadow(el).querySelector('.rows')?.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

afterEach(() => {
  document.body.replaceChildren();
  sessionStorage.clear();
  delete (window as { __grafanaSceneContext?: unknown }).__grafanaSceneContext;
});

describe('kd-files', () => {
  it('lists the root, folders first, with sizes, totals and a root crumb', async () => {
    const el = await files('<kd-files label="cdn"></kd-files>');
    expect(names(el)).toEqual(['docs', 'src', 'b.txt', 'README.md']);
    expect(column(el, 1)).toEqual(['3 B', '407 B', '10 B', '2.0 KiB']);
    expect(crumbs(el)).toEqual(['cdn']);
    expect(shadow(el).querySelector('.tot')?.textContent).toBe('2 folders · 2 files · 2.4 KiB');
    row(el, 'src')?.click();
    await tick(el);
    expect(trail(el)).toBe('cdn / src');
  });

  it('counts one folder and one file in the singular', async () => {
    const el = await files('<kd-files></kd-files>', { entries: [{ path: 'a/b.txt', type: 'file', size: 1 }, { path: 'c.txt', type: 'file', size: 2 }] });
    expect(shadow(el).querySelector('.tot')?.textContent).toBe('1 folder · 1 file · 3 B');
  });

  it('leaves a zero count out of the totals', async () => {
    const el = await files('<kd-files></kd-files>', { entries: [{ path: 'a.txt', type: 'file', size: 1 }, { path: 'b.txt', type: 'file', size: 2 }] });
    expect(shadow(el).querySelector('.tot')?.textContent).toBe('2 files · 3 B');
    const only = await files('<kd-files></kd-files>', { entries: [{ path: 'a/b/c.txt', type: 'file', size: 1 }] });
    expect(shadow(only).querySelector('.tot')?.textContent).toBe('1 folder · 1 B');
  });

  it('takes its entries as a JSON attribute too', async () => {
    const json = JSON.stringify([{ path: 'x/y.txt', type: 'file', size: 3 }]).replace(/"/g, '&quot;');
    const el = await files(`<kd-files entries="${json}"></kd-files>`, {});
    expect(names(el)).toEqual(['x']);
  });

  it('opens folders and comes back by .., the crumbs and the keyboard', async () => {
    const el = await files();
    const went: FilesEventDetail[] = [];
    el.addEventListener('navigate', (e) => went.push((e as CustomEvent<FilesEventDetail>).detail));
    row(el, 'src')?.click();
    await tick(el);
    expect(el.folder).toBe('src');
    expect(names(el)).toEqual(['..', 'deep', 'kd', 'index.ts']);
    expect(went[0]).toMatchObject({ path: 'src', entry: { path: 'src', type: 'dir' } });

    row(el, 'kd')?.click();
    await tick(el);
    expect(crumbs(el)).toEqual(['/', 'src', 'kd']);
    // The bare root crumb is the first slash: no "/ / src".
    expect(trail(el)).toBe('/ src / kd');
    (shadow(el).querySelectorAll('.crumb')[1] as HTMLElement).click();
    await tick(el);
    expect(el.folder).toBe('src');
    row(el, '..')?.click();
    await tick(el);
    expect(el.folder).toBe('');
    expect(went.map((d) => d.path)).toEqual(['src', 'src/kd', 'src', '']);
  });

  it('marks a folder the provider could not list, and says so inside it', async () => {
    const el = await files();
    row(el, 'src')?.click();
    await tick(el);
    expect(row(el, 'deep')?.querySelector('.partial')?.textContent).toBe('not listed');
    row(el, 'deep')?.click();
    await tick(el);
    const note = shadow(el).querySelector('.none');
    expect(note?.textContent).toContain('This folder was not listed.');
    expect(note?.querySelector('a')?.getAttribute('href')).toBe('https://example.com/deep');
  });

  it('selects a file: highlight, a cancelable event, and the variable written', async () => {
    const calls: string[] = [];
    (window as { __grafanaSceneContext?: unknown }).__grafanaSceneContext = fakeScene({
      variables: [textbox('file', '', calls)],
    }).scene;
    const el = await files('<kd-files variable="file" value-prefix="abc123:"></kd-files>');
    const picked: FilesEventDetail[] = [];
    el.addEventListener('select', (e) => picked.push((e as CustomEvent<FilesEventDetail>).detail));
    row(el, 'b.txt')?.click();
    await tick(el);
    expect(picked).toEqual([{ path: 'b.txt', entry: ENTRIES[1] }]);
    expect(el.selected).toBe('abc123:b.txt');
    expect(calls).toEqual(['file=abc123:b.txt']);
    expect(row(el, 'b.txt')?.getAttribute('aria-selected')).toBe('true');
    expect(row(el, 'README.md')?.getAttribute('aria-selected')).toBe('false');

    el.addEventListener('select', (e) => e.preventDefault(), { once: true });
    row(el, 'README.md')?.click();
    await tick(el);
    expect(el.selected).toBe('abc123:b.txt');
    expect(calls).toEqual(['file=abc123:b.txt']);
  });

  it('highlights `selected` and opens its folder', async () => {
    const el = await files('<kd-files></kd-files>', { entries: ENTRIES, selected: 'src/kd/b.ts' });
    expect(el.folder).toBe('src/kd');
    expect(row(el, 'b.ts')?.getAttribute('aria-selected')).toBe('true');
    await update(el, { selected: 'docs/index.md' });
    await tick(el);
    expect(el.folder).toBe('docs');
    expect(row(el, 'index.md')?.getAttribute('aria-selected')).toBe('true');
  });

  it('reads `selected` through the prefix; another prefix selects nothing and stays put', async () => {
    const el = await files('<kd-files value-prefix="new:"></kd-files>', { entries: ENTRIES, selected: 'new:src/kd/b.ts' });
    expect(el.selectedPath).toBe('src/kd/b.ts');
    expect(el.folder).toBe('src/kd');
    await update(el, { selected: 'old:docs/index.md' });
    await tick(el);
    expect(el.selectedPath).toBe('');
    expect(el.folder).toBe('src/kd');
    expect(rows(el).some((r) => r.getAttribute('aria-selected') === 'true')).toBe(false);
  });

  it('keeps its folder per key across recreation, for the selection it was left with', async () => {
    const first = await files('<kd-files key="repo"></kd-files>');
    row(first, 'src')?.click();
    await tick(first);
    row(first, 'index.ts')?.click();
    await tick(first);
    row(first, '..')?.click();
    await tick(first);
    row(first, 'docs')?.click();
    await tick(first);
    expect(sessionStorage.getItem('kd-files:repo')).toBe('docs');
    expect(sessionStorage.getItem('kd-files:repo:selected')).toBe('src/index.ts');
    first.remove();

    const again = await files('<kd-files key="repo"></kd-files>', { entries: ENTRIES, selected: 'src/index.ts' });
    expect(again.folder).toBe('docs');
    // A later selection, from another panel, does open its folder.
    await update(again, { selected: 'src/kd/a.ts' });
    await tick(again);
    expect(again.folder).toBe('src/kd');

    const other = await files('<kd-files key="other"></kd-files>', { entries: ENTRIES, selected: 'src/index.ts' });
    expect(other.folder).toBe('src');
  });

  it('opens a deep link\'s folder over a remembered folder left with another selection', async () => {
    sessionStorage.setItem('kd-files:repo', 'docs');
    sessionStorage.setItem('kd-files:repo:selected', 'docs/guide.md');
    // Set together, as feed() does.
    const deep = await files('<kd-files key="repo"></kd-files>', { entries: ENTRIES, selected: 'src/kd/a.ts' });
    expect(deep.folder).toBe('src/kd');
    expect(row(deep, 'a.ts')?.getAttribute('aria-selected')).toBe('true');
    deep.remove();

    // Selected before the first render, too.
    sessionStorage.setItem('kd-files:repo', 'docs');
    const early = document.createElement('kd-files') as KdFiles;
    early.setAttribute('key', 'repo');
    early.entries = ENTRIES;
    early.selected = 'src/index.ts';
    document.body.append(early);
    await tick(early);
    expect(early.folder).toBe('src');

    // A folder remembered before selections were stored with it gives way too.
    sessionStorage.clear();
    sessionStorage.setItem('kd-files:old', 'docs');
    const old = await files('<kd-files key="old"></kd-files>', { entries: ENTRIES, selected: 'src/index.ts' });
    expect(old.folder).toBe('src');
  });

  it('remembers the open folder with each pick', async () => {
    const el = await files('<kd-files key="repo"></kd-files>', { entries: ENTRIES, selected: 'docs/index.md' });
    expect(el.folder).toBe('docs');
    // Another panel moves the selection; the user picks in the folder it opened.
    await update(el, { selected: 'src/kd/b.ts' });
    await tick(el);
    row(el, 'a.ts')?.click();
    await tick(el);
    expect(sessionStorage.getItem('kd-files:repo')).toBe('src/kd');
    expect(sessionStorage.getItem('kd-files:repo:selected')).toBe('src/kd/a.ts');
    el.remove();
    const again = await files('<kd-files key="repo"></kd-files>', { entries: ENTRIES, selected: 'src/kd/a.ts' });
    expect(again.folder).toBe('src/kd');
  });

  it('falls back to the root when a remembered folder is gone', async () => {
    sessionStorage.setItem('kd-files:repo', 'gone/away');
    const el = await files('<kd-files key="repo"></kd-files>');
    expect(el.folder).toBe('');
    expect(names(el)).toEqual(['docs', 'src', 'b.txt', 'README.md']);
  });

  it('survives storage that throws', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    try {
      const el = await files('<kd-files key="repo"></kd-files>');
      row(el, 'src')?.click();
      await tick(el);
      expect(el.folder).toBe('src');
    } finally {
      if (original) Object.defineProperty(window, 'sessionStorage', original);
    }
  });

  it('keeps the folder when new entries arrive', async () => {
    const el = await files();
    row(el, 'src')?.click();
    await tick(el);
    await update(el, { entries: [...ENTRIES, { path: 'src/new.ts', type: 'file', size: 1 }] });
    await tick(el);
    expect(el.folder).toBe('src');
    expect(names(el)).toContain('new.ts');
  });

  it('sorts by any column, folders always first, and remembers the sort', async () => {
    const columns = [
      { key: 'size' },
      { key: 'opened', label: 'Opened', icon: '📂 ', tone: 'info' as const },
      { key: 'modified' },
      { key: 'owner', kind: 'cell' as const },
    ];
    const el = await files('<kd-files key="s"></kd-files>', { entries: ENTRIES, columns });
    expect(heads(el).map((h) => h.textContent?.trim())).toEqual(['Name', 'size', '📂', 'modified', 'owner']);
    expect(sorter(el, 2).getAttribute('aria-label')).toBe('Opened');
    expect(sorter(el, 2).title).toBe('Opened');
    sorter(el, 1).click();
    await settle(el);
    expect(names(el)).toEqual(['src', 'docs', 'README.md', 'b.txt']);
    expect(heads(el)[1].getAttribute('aria-sort')).toBe('descending');
    sorter(el, 1).click();
    await settle(el);
    expect(names(el)).toEqual(['docs', 'src', 'b.txt', 'README.md']);
    sorter(el, 2).click();
    await settle(el);
    expect(names(el)).toEqual(['src', 'docs', 'b.txt', 'README.md']);
    expect(column(el, 2)).toEqual(['📂 2', '', '📂 5', '📂 1']);
    expect(rows(el)[0].querySelector('.stat')?.className).toBe('stat info');
    sorter(el, 3).click();
    await settle(el);
    expect(names(el)).toEqual(['docs', 'src', 'b.txt', 'README.md']);
    expect(column(el, 3)).toEqual(['', '', '2026-10-07', '2026-10-01']);
    expect(sessionStorage.getItem('kd-files:s:sort')).toBe('modified:-1');

    row(el, 'docs')?.click();
    await tick(el);
    sorter(el, 4).click();
    await settle(el);
    expect(column(el, 4)).toEqual(['', 'zed', 'amy']);
    expect(rows(el)[1].querySelector('kd-pill')).not.toBeNull();

    const again = await files('<kd-files key="s"></kd-files>', { entries: ENTRIES, columns });
    expect(heads(again)[4].getAttribute('aria-sort')).toBe('descending');
  });

  it('filters the open folder, then everything below it', async () => {
    const el = await files('<kd-files filter></kd-files>');
    const input = shadow(el).querySelector('input') as HTMLInputElement;
    input.value = 'B';
    input.dispatchEvent(new Event('input'));
    await tick(el);
    expect(rows(el).map((r) => r.querySelector('.name')?.textContent?.replace(/\s+/g, ''))).toEqual(['b.txt', 'src/kd/b.ts']);
    input.value = 'nothing-like-it';
    input.dispatchEvent(new Event('input'));
    await tick(el);
    expect(shadow(el).querySelector('.none')?.textContent).toBe('No matches.');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await tick(el);
    expect(names(el)).toEqual(['docs', 'src', 'b.txt', 'README.md']);
  });

  it('moves with the arrows, opens with Enter and goes up with Backspace', async () => {
    const calls: string[] = [];
    (window as { __grafanaSceneContext?: unknown }).__grafanaSceneContext = fakeScene({
      variables: [textbox('file', '', calls)],
    }).scene;
    const el = await files('<kd-files variable="file"></kd-files>');
    key(el, 'ArrowDown');
    key(el, 'ArrowDown');
    await settle(el);
    expect(rows(el)[1].classList.contains('cursor')).toBe(true);
    key(el, 'Enter');
    await tick(el);
    expect(el.folder).toBe('src');
    key(el, 'End');
    key(el, 'Enter');
    await tick(el);
    expect(calls).toEqual(['file=src/index.ts']);
    key(el, 'Backspace');
    await tick(el);
    expect(el.folder).toBe('');
  });

  it('lists through an asynchronous provider, ignoring answers that came too late', async () => {
    const waits: Record<string, number> = { '': 5, a: 30, b: 1 };
    const provider: Provider = {
      list: (path) =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve(
                path
                  ? [{ path: `${path}/f-${path}`, type: 'file', size: 1 }]
                  : [
                      { path: 'a', type: 'dir', size: 1 },
                      { path: 'b', type: 'dir', size: 1 },
                    ],
              ),
            waits[path] ?? 1,
          ),
        ),
    };
    const el = await mount<KdFiles>('<kd-files></kd-files>');
    await update(el, { provider });
    expect(shadow(el).querySelector('.none')?.textContent).toBe('Loading…');
    await new Promise((r) => setTimeout(r, 20));
    await settle(el);
    row(el, 'a')?.click();
    row(el, 'b')?.click();
    await new Promise((r) => setTimeout(r, 60));
    await settle(el);
    expect(el.folder).toBe('b');
    expect(names(el)).toEqual(['..', 'f-b']);
  });

  it('shows a root that cannot be listed', async () => {
    const el = await mount<KdFiles>('<kd-files></kd-files>');
    await update(el, { provider: { list: () => Promise.reject(new Error('403 Forbidden')) } });
    await tick(el);
    expect(shadow(el).querySelector('.none')?.textContent).toBe('403 Forbidden');
  });

  it('shows the error of a folder opened by hand, and gets back out', async () => {
    const provider: Provider = {
      list: async (path) => {
        if (path === 'locked') throw new Error('403 Forbidden');
        return [{ path: 'locked', type: 'dir' }];
      },
    };
    const el = await mount<KdFiles>('<kd-files></kd-files>');
    await update(el, { provider });
    await tick(el);
    row(el, 'locked')?.click();
    await tick(el);
    expect(el.folder).toBe('locked');
    expect(shadow(el).querySelector('.none')?.textContent).toBe('403 Forbidden');
    (shadow(el).querySelector('.crumb') as HTMLElement).click();
    await tick(el);
    expect(names(el)).toEqual(['locked']);
  });

  it('links an entry elsewhere without selecting it', async () => {
    const el = await files('<kd-files></kd-files>', { entries: ENTRIES, selected: 'src/kd/b.ts' });
    const link = row(el, 'a.ts')?.querySelector('a.ext') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://example.com/a.ts');
    expect(link.getAttribute('target')).toBe('_blank');
    link.addEventListener('click', (e) => e.preventDefault());
    link.click();
    await tick(el);
    expect(el.selected).toBe('src/kd/b.ts');
  });

  it('sorts from header buttons the keyboard reaches, without moving the rows', async () => {
    const el = await files();
    key(el, 'ArrowDown');
    await settle(el);
    const name = sorter(el, 0);
    expect(name.type).toBe('button');
    expect(name.hasAttribute('tabindex')).toBe(false);
    expect(heads(el).every((h) => !h.hasAttribute('tabindex'))).toBe(true);
    // Enter on a button is the button's: the rows' keyboard leaves it alone.
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    name.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(false);
    await tick(el);
    expect(el.folder).toBe('');
    name.click();
    await settle(el);
    expect(heads(el)[0].getAttribute('aria-sort')).toBe('descending');
    expect(names(el)).toEqual(['src', 'docs', 'README.md', 'b.txt']);
  });

  it('keeps a name on one line, whole in its tooltip, with its link at the end', async () => {
    const long = 'a-very-long-file-name-that-would-wrap-mid-word-in-a-narrow-panel.ts';
    const el = await files('<kd-files></kd-files>', {
      entries: [{ path: long, type: 'file', size: 1, href: 'https://example.com/x' }],
    });
    const name = rows(el)[0].querySelector('.name') as HTMLElement;
    expect(rows(el)[0].cells[0].classList.contains('cell-name')).toBe(true);
    expect(name.querySelector('.label')?.getAttribute('title')).toBe(long);
    expect(name.lastElementChild?.matches('a.ext')).toBe(true);
    const css = (el.constructor as typeof KdFiles).styles.flat().map((s) => (s as { cssText: string }).cssText).join('\n');
    expect(css).toMatch(/\.name\s*\{[^}]*white-space:\s*nowrap/);
    expect(css).toMatch(/\.label,\s*\.under\s*\{[^}]*text-overflow:\s*ellipsis/);
    expect(css).toMatch(/td\.cell-name\s*\{[^}]*max-width:\s*0/);
  });

  it('heads the activity columns with their icons, the label as the name', async () => {
    const el = await files('<kd-files></kd-files>', { entries: ENTRIES, columns: ACTIVITY_COLUMNS });
    const buttons = heads(el).map((_, i) => sorter(el, i));
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Name', '📂', '👁', '💾', '+', '−', 'Size']);
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([null, 'Opened', 'Viewed', 'Saved', 'Added', 'Removed', null]);
    expect(buttons[1].title).toBe('Opened: Opened in an editor tab (code-server)');
    expect(heads(el).slice(1).every((h) => h.classList.contains('num'))).toBe(true);
    expect([...rows(el)[0].cells].slice(1).every((c) => c.classList.contains('num'))).toBe(true);
  });

  it('draws its icons in the theme\'s text colour', async () => {
    const el = await files();
    const ico = rows(el)[0].querySelector('.ico') as SVGElement;
    expect(ico.localName).toBe('svg');
    expect(ico.getAttribute('stroke')).toBe('currentColor');
    const css = (el.constructor as typeof KdFiles).styles.flat().map((s) => (s as { cssText: string }).cssText).join('\n');
    expect(css).toMatch(/\.ico\s*\{[^}]*color:\s*var\(--kd-text-2/);
  });
});
