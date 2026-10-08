import { css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';

import { cellStyles, renderCell, type Cell } from '../cell';
import { define } from '../define';
import { KdElement, base, json } from '../element';
import { safeHref, tone, tones, type Tone } from '../parts';
import { setVariable } from '../scene';
import { staticProvider } from './static';
import { dirname, entryName, formatSize, modifiedTime, normalizePath, type Entry, type Provider } from './types';

export interface FileColumn {
  /** The stat or cell key; `size` and `modified` name the entry's own fields. */
  key: string;
  /** Defaults to the key. */
  label?: string;
  /** Defaults to `size` or `modified` for those keys, else `stat`. */
  kind?: 'size' | 'stat' | 'cell' | 'modified';
  /** Shown before a stat's number (`+`, an emoji). */
  icon?: string;
  /** The colour of a non-zero stat. */
  tone?: Tone;
  /** The header's tooltip. */
  title?: string;
}

/** What `navigate` and `select` carry. `entry` is undefined for the root. */
export interface FilesEventDetail {
  path: string;
  entry?: Entry;
}

type Kind = NonNullable<FileColumn['kind']>;
interface Sort {
  key: string;
  dir: 1 | -1;
}
interface Row {
  entry: Entry;
  /** The folder it is in, relative to the open one: set only for a filter match deeper down. */
  under?: string;
  up?: boolean;
}

const DEFAULT_COLUMNS: FileColumn[] = [{ key: 'size', kind: 'size' }];
// A filter walks the folders below the open one; this bounds a slow provider.
const SEARCH_LIMIT = 20000;

const kindOf = (col: FileColumn): Kind =>
  col.kind ?? (col.key === 'size' ? 'size' : col.key === 'modified' ? 'modified' : 'stat');

const byName = (a: Entry, b: Entry) =>
  entryName(a).localeCompare(entryName(b), undefined, { sensitivity: 'base', numeric: true });

function cellText(cell: Cell): string {
  if (cell === null || cell === undefined) return '';
  if (Array.isArray(cell)) return cell.map(cellText).join(' ');
  if (typeof cell !== 'object') return String(cell);
  if ('text' in cell) return String(cell.text);
  if ('code' in cell) return String(cell.code);
  return '';
}

function sortValue(entry: Entry, key: string, kind: Kind | 'name'): number | string {
  switch (kind) {
    case 'name':
      return entryName(entry);
    case 'size':
      return Number(entry.size) || 0;
    case 'modified': {
      const t = modifiedTime(entry.modified);
      return Number.isNaN(t) ? -Infinity : t;
    }
    case 'cell':
      return cellText(entry.cells?.[key]);
    default:
      return Number(entry.stats?.[key]) || 0;
  }
}

function formatModified(value: string | number | undefined): string {
  const t = modifiedTime(value);
  return Number.isNaN(t) ? '' : new Date(t).toISOString().slice(0, 10);
}

/**
 * A file explorer over a provider (`provider`, or `entries` for a static
 * list): breadcrumbs and `..`, folders first, columns sorted by a header
 * click, a filter box (`filter`), and the keyboard (arrows, Enter, Backspace).
 * Clicking a folder opens it (`navigate`); clicking a file selects it
 * (`select`, cancelable), and with `variable` writes `valuePrefix + path` to that
 * dashboard variable, replacing the URL entry as Grafana's own programmatic
 * writes do. `selected` (`valuePrefix + path`, as the variable holds it) is highlighted and
 * its folder opened. With a `key`, the open folder and the sort survive the
 * panel recreating the element.
 *
 * `<kd-files variable="file" key="repo-files" filter></kd-files>` + `el.entries = [...]`
 */
export class KdFiles extends KdElement {
  static override properties = {
    provider: { attribute: false },
    entries: { attribute: 'entries', converter: json },
    columns: { attribute: 'columns', converter: json },
    selected: {},
    variable: {},
    key: {},
    valuePrefix: { attribute: 'value-prefix' },
    label: {},
    filter: { type: Boolean },
    empty: {},
  };
  static override styles = [
    base,
    tones,
    cellStyles,
    css`
      :host {
        font-size: 13px;
      }
      .bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 10px;
        padding: 2px 0 8px;
      }
      .crumbs {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
        min-width: 0;
        font-size: 14px;
      }
      .sep,
      .dim,
      .tot {
        color: var(--kd-text-dim, inherit);
      }
      .tot {
        margin-left: auto;
        font-size: 12px;
      }
      button.crumb {
        padding: 0;
        border: none;
        background: none;
        color: var(--kd-link, inherit);
        font: inherit;
        font-weight: 500;
        cursor: pointer;
      }
      button.crumb:hover {
        text-decoration: underline;
      }
      button.crumb[aria-current='page'] {
        color: var(--kd-text, inherit);
        cursor: default;
        text-decoration: none;
      }
      input {
        flex: 1 1 160px;
        max-width: 280px;
        padding: 3px 8px;
        border: 1px solid var(--kd-border-strong, currentColor);
        border-radius: var(--kd-radius, 4px);
        background: transparent;
        color: inherit;
        font: inherit;
      }
      .rows {
        outline: none;
      }
      .rows:focus-visible {
        box-shadow: inset 0 0 0 1px var(--kd-primary, currentColor);
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th {
        padding: 6px 10px;
        color: var(--kd-text-2, inherit);
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 0.08em;
        text-align: left;
        text-transform: uppercase;
        white-space: nowrap;
        cursor: pointer;
        user-select: none;
      }
      th[aria-sort='ascending']::after {
        content: ' ▲';
      }
      th[aria-sort='descending']::after {
        content: ' ▼';
      }
      td {
        padding: 4px 10px;
        border-top: 1px solid var(--kd-border, transparent);
        vertical-align: middle;
      }
      .num {
        width: 1%;
        text-align: right;
        white-space: nowrap;
      }
      tbody tr {
        cursor: pointer;
      }
      tbody tr:hover td {
        background: color-mix(in srgb, var(--kd-text, currentColor) 5%, transparent);
      }
      tr.cursor td {
        background: color-mix(in srgb, var(--kd-text, currentColor) 8%, transparent);
      }
      tr[aria-selected='true'] td {
        background: color-mix(in srgb, var(--kd-primary, currentColor) 16%, transparent);
      }
      .name {
        display: flex;
        align-items: baseline;
        gap: 6px;
        min-width: 0;
      }
      .ico {
        flex: none;
      }
      .label {
        overflow-wrap: anywhere;
      }
      .dir .label {
        color: var(--kd-link, inherit);
        font-weight: 500;
      }
      .partial {
        font-size: 11px;
        font-style: italic;
      }
      a.ext {
        color: var(--kd-text-dim, inherit);
        text-decoration: none;
      }
      a.ext:hover {
        color: var(--kd-link, inherit);
      }
      .stat {
        font-weight: 600;
      }
      .stat.primary,
      .stat.success,
      .stat.warning,
      .stat.error,
      .stat.info {
        color: var(--tone-ink);
      }
      .none {
        padding: 8px 10px;
        color: var(--kd-text-dim, inherit);
      }
    `,
  ];

  declare provider: Provider | undefined;
  declare entries: Entry[] | undefined;
  declare columns: FileColumn[] | undefined;
  declare selected: string | undefined;
  declare variable: string | undefined;
  declare key: string | undefined;
  declare valuePrefix: string | undefined;
  declare label: string | undefined;
  declare filter: boolean | undefined;
  declare empty: string | undefined;

  #source: Provider | undefined;
  #folder: string | undefined;
  #fromStorage = false;
  #navigated = false;
  #seen: string | undefined;
  #picked: string | undefined;
  #listing: Entry[] = [];
  #listed: string | undefined;
  #error = '';
  #listTicket = 0;
  #query = '';
  #opened: Entry | undefined;
  #matches: Row[] | undefined;
  #searchTicket = 0;
  #sort: Sort = { key: 'name', dir: 1 };
  #cursor = -1;
  #scroll = false;

  /** The open folder. */
  get folder(): string {
    return this.#folder ?? '';
  }

  /** `selected` as a path, without `valuePrefix`; '' when it carries another prefix. */
  get selectedPath(): string {
    const s = String(this.selected ?? '');
    const p = this.valuePrefix ?? '';
    // A value carrying another prefix (an older commit's) selects nothing here.
    if (p) return s.startsWith(p) ? normalizePath(s.slice(p.length)) : '';
    return normalizePath(s);
  }

  get #storage(): Storage | undefined {
    try {
      return this.ownerDocument?.defaultView?.sessionStorage ?? undefined;
    } catch {
      return undefined;
    }
  }

  #load(suffix: string): string | null {
    if (!this.key) return null;
    try {
      return this.#storage?.getItem(`kd-files:${this.key}${suffix}`) ?? null;
    } catch {
      return null;
    }
  }

  #save(suffix: string, value: string): void {
    if (!this.key) return;
    try {
      this.#storage?.setItem(`kd-files:${this.key}${suffix}`, value);
    } catch {
      // Storage can be blocked; the state simply is not remembered.
    }
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    let relist = false;
    if (changed.has('provider') || changed.has('entries')) {
      const had = this.#source;
      this.#source = this.provider ?? (this.entries ? staticProvider(this.entries) : undefined);
      // A refresh keeps the rows on screen until the new ones arrive; a first source has none to keep.
      if (!had) this.#listed = undefined;
      relist = true;
    }
    if (changed.has('key')) {
      const m = /^(.*):(1|-1)$/.exec(this.#load(':sort') ?? '');
      if (m) this.#sort = { key: m[1], dir: Number(m[2]) as 1 | -1 };
    }
    const sel = this.selectedPath;
    if (this.#folder === undefined) {
      const stored = this.#load('');
      this.#fromStorage = stored !== null;
      this.#folder = stored !== null ? normalizePath(stored) : sel ? dirname(sel) : '';
      this.#seen = sel || undefined;
      relist = true;
    } else if (sel && sel !== this.#seen) {
      // The first selection a remembered folder meets does not move it; any
      // later one, from outside, opens its folder.
      const first = this.#seen === undefined;
      this.#seen = sel;
      if (sel !== this.#picked && !(first && this.#fromStorage) && dirname(sel) !== this.#folder) {
        this.#folder = dirname(sel);
        this.#navigated = false;
        this.#query = '';
        this.#matches = undefined;
        relist = true;
      }
    }
    if (relist) this.#list();
  }

  #list(): void {
    const source = this.#source;
    const folder = this.#folder ?? '';
    const ticket = ++this.#listTicket;
    if (!source) {
      this.#listing = [];
      this.#listed = folder;
      return;
    }
    let pending: Promise<Entry[]>;
    try {
      pending = Promise.resolve(source.list(folder));
    } catch (e) {
      pending = Promise.reject(e);
    }
    pending.then(
      (entries) => {
        if (ticket !== this.#listTicket) return;
        this.#listing = Array.isArray(entries) ? entries.filter((e) => e && typeof e.path === 'string') : [];
        const fresh = this.#listed !== folder;
        this.#listed = folder;
        this.#error = '';
        if (fresh) this.#cursor = -1;
        if (this.#query.trim()) this.#search();
        this.requestUpdate();
      },
      (error: unknown) => {
        if (ticket !== this.#listTicket) return;
        // A remembered folder that is gone: the selection's folder, else the root.
        // One opened by hand shows its error instead.
        if (folder !== '' && !this.#navigated) {
          const sel = dirname(this.selectedPath);
          this.#folder = sel && sel !== folder ? sel : '';
          this.#list();
          return;
        }
        this.#listing = [];
        this.#listed = folder;
        this.#error = error instanceof Error ? error.message : String(error);
        this.requestUpdate();
      },
    );
  }

  // Matches below the open folder: those directly in it first, then deeper ones.
  #search(): void {
    const source = this.#source;
    const query = this.#query.trim().toLowerCase();
    const ticket = ++this.#searchTicket;
    if (!source || !query) {
      this.#matches = undefined;
      return;
    }
    const start = this.#folder ?? '';
    const found: Row[] = [];
    void (async () => {
      let seen = 0;
      const queue: string[] = [start];
      while (queue.length && seen < SEARCH_LIMIT) {
        const folder = queue.shift() as string;
        let entries: Entry[];
        try {
          entries = folder === this.#listed ? this.#listing : await source.list(folder);
        } catch {
          continue;
        }
        if (ticket !== this.#searchTicket) return;
        for (const entry of entries) {
          seen += 1;
          if (entry.type === 'dir' && !entry.partial) queue.push(normalizePath(entry.path));
          if (!entryName(entry).toLowerCase().includes(query)) continue;
          const under = folder === start ? undefined : folder.slice(start ? start.length + 1 : 0);
          found.push({ entry, under });
        }
      }
      if (ticket !== this.#searchTicket) return;
      this.#matches = found;
      this.requestUpdate();
    })();
  }

  #go(path: string, entry?: Entry): void {
    const folder = normalizePath(path);
    this.#folder = folder;
    this.#navigated = true;
    this.#opened = entry;
    this.#query = '';
    this.#matches = undefined;
    this.#searchTicket++;
    this.#cursor = -1;
    this.#save('', folder);
    this.dispatchEvent(new CustomEvent<FilesEventDetail>('navigate', { detail: { path: folder, entry }, bubbles: true, composed: true }));
    this.#list();
    this.requestUpdate();
  }

  #pick(entry: Entry): void {
    const path = normalizePath(entry.path);
    const event = new CustomEvent<FilesEventDetail>('select', {
      detail: { path, entry },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    if (!this.dispatchEvent(event)) return;
    const value = `${this.valuePrefix ?? ''}${path}`;
    this.#picked = path;
    this.#seen = path;
    this.selected = value;
    if (this.variable) setVariable(this, this.variable, value);
  }

  #activate(row: Row): void {
    if (row.up) this.#go(dirname(this.#folder ?? ''));
    else if (row.entry.type === 'dir') this.#go(row.entry.path, row.entry);
    else this.#pick(row.entry);
  }

  #sortBy(key: string): void {
    const dir: 1 | -1 = this.#sort.key === key ? (this.#sort.dir === 1 ? -1 : 1) : key === 'name' ? 1 : -1;
    this.#sort = { key, dir };
    this.#save(':sort', `${key}:${dir}`);
    this.requestUpdate();
  }

  get #columns(): FileColumn[] {
    return Array.isArray(this.columns) ? this.columns.filter((c) => c && typeof c.key === 'string') : DEFAULT_COLUMNS;
  }

  #rows(): Row[] {
    const folder = this.#folder ?? '';
    if (this.#listed !== folder) return [];
    const query = this.#query.trim().toLowerCase();
    const rows: Row[] =
      this.#matches ??
      this.#listing.filter((e) => !query || entryName(e).toLowerCase().includes(query)).map((entry) => ({ entry }));
    const { key, dir } = this.#sort;
    const col = this.#columns.find((c) => c.key === key);
    const kind = key === 'name' || !col ? 'name' : kindOf(col);
    const sorted = [...rows].sort((a, b) => {
      const depth = (a.under === undefined ? 0 : 1) - (b.under === undefined ? 0 : 1);
      if (depth) return depth;
      const folders = (a.entry.type === 'dir' ? 0 : 1) - (b.entry.type === 'dir' ? 0 : 1);
      if (folders) return folders;
      const x = sortValue(a.entry, key, kind);
      const y = sortValue(b.entry, key, kind);
      const order =
        typeof x === 'string' || typeof y === 'string'
          ? String(x).localeCompare(String(y), undefined, { sensitivity: 'base', numeric: true })
          : x - y;
      return order * dir || (a.under ?? '').localeCompare(b.under ?? '') || byName(a.entry, b.entry);
    });
    return folder ? [{ entry: { path: dirname(folder), type: 'dir', name: '..' }, up: true }, ...sorted] : sorted;
  }

  #keydown(event: KeyboardEvent, rows: Row[]): void {
    const move = (to: number) => {
      event.preventDefault();
      this.#cursor = Math.max(0, Math.min(rows.length - 1, to));
      this.#scroll = true;
      this.requestUpdate();
    };
    const at = this.#cursor;
    switch (event.key) {
      case 'ArrowDown':
        return move(at + 1);
      case 'ArrowUp':
        return move(at - 1);
      case 'Home':
        return move(0);
      case 'End':
        return move(rows.length - 1);
      case 'Enter':
      case 'ArrowRight':
        if (rows[at] && (event.key === 'Enter' || rows[at].entry.type === 'dir')) {
          event.preventDefault();
          this.#activate(rows[at]);
        }
        return;
      case 'Backspace':
      case 'ArrowLeft':
        if (this.#folder) {
          event.preventDefault();
          this.#go(dirname(this.#folder));
        }
        return;
    }
  }

  #filterKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.#setQuery('');
    else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.#cursor = 0;
      (this.renderRoot.querySelector('.rows') as HTMLElement | null)?.focus();
      this.requestUpdate();
    }
  }

  #setQuery(query: string): void {
    this.#query = query;
    this.#matches = undefined;
    this.#cursor = -1;
    this.#search();
    this.requestUpdate();
  }

  protected override updated(): void {
    if (!this.#scroll) return;
    this.#scroll = false;
    (this.renderRoot.querySelector('tr.cursor') as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest' });
  }

  #crumbs(folder: string): TemplateResult {
    const parts = folder ? folder.split('/') : [];
    const crumb = (text: string, path: string, last: boolean) =>
      html`<button
        type="button"
        class="crumb"
        aria-current=${ifDefined(last ? 'page' : undefined)}
        @click=${() => !last && this.#go(path)}
      >
        ${text}
      </button>`;
    return html`<nav class="crumbs" aria-label="Folder">
      ${crumb(this.label || '/', '', !parts.length)}
      ${parts.map(
        (part, i) => html`<span class="sep">/</span>${crumb(part, parts.slice(0, i + 1).join('/'), i === parts.length - 1)}`,
      )}
    </nav>`;
  }

  #cell(entry: Entry, col: FileColumn): unknown {
    switch (kindOf(col)) {
      case 'size':
        return entry.size === undefined && entry.type === 'dir' ? '' : formatSize(entry.size);
      case 'modified':
        return html`<span title=${ifDefined(entry.modified === undefined ? undefined : String(entry.modified))}
          >${formatModified(entry.modified)}</span
        >`;
      case 'cell':
        return renderCell(entry.cells?.[col.key]);
      default: {
        const n = Number(entry.stats?.[col.key]) || 0;
        if (!n) return '';
        const cls = `stat ${col.tone ? tone(col.tone) : ''}`;
        return html`<span class=${cls} title=${`${col.label ?? col.key}: ${n}`}>${col.icon ?? ''}${n.toLocaleString('en')}</span>`;
      }
    }
  }

  #row(row: Row, i: number, selected: string, columns: FileColumn[]): TemplateResult {
    const { entry } = row;
    const dir = entry.type === 'dir';
    const href = row.up ? undefined : safeHref(entry.href);
    const isSelected = !dir && !!selected && normalizePath(entry.path) === selected;
    return html`<tr
      class=${[dir ? 'dir' : 'file', i === this.#cursor ? 'cursor' : ''].join(' ')}
      aria-selected=${isSelected ? 'true' : 'false'}
      @click=${() => {
        this.#cursor = i;
        this.#activate(row);
      }}
    >
      <td>
        <span class="name">
          <span class="ico" aria-hidden="true">${dir ? '📁' : '📄'}</span>
          ${row.under ? html`<span class="dim">${row.under}/</span>` : nothing}
          <span class="label">${entryName(entry)}</span>
          ${entry.partial
            ? html`<span class="partial dim" title="The provider could not list this folder">not listed</span>`
            : nothing}
          ${href
            ? html`<a class="ext" href=${href} target="_blank" rel="noopener" title="Open" @click=${(e: Event) => e.stopPropagation()}
                >↗</a
              >`
            : nothing}
        </span>
      </td>
      ${columns.map(
        (col) => html`<td class=${kindOf(col) === 'cell' ? '' : 'num'}>${row.up ? '' : this.#cell(entry, col)}</td>`,
      )}
    </tr>`;
  }

  override render() {
    const folder = this.#folder ?? '';
    const columns = this.#columns;
    const rows = this.#rows();
    const listed = this.#listed === folder;
    const items = rows.filter((r) => !r.up && r.under === undefined);
    const dirs = items.filter((r) => r.entry.type === 'dir').length;
    const total = this.#listing.reduce((sum, e) => sum + (Number(e.size) || 0), 0);
    const selected = this.selectedPath;
    const header = (key: string, text: string, num: boolean, title?: string) => {
      const sort = this.#sort.key === key ? (this.#sort.dir === 1 ? 'ascending' : 'descending') : undefined;
      return html`<th class=${num ? 'num' : ''} title=${ifDefined(title)} aria-sort=${ifDefined(sort)} @click=${() => this.#sortBy(key)}>
        ${text}
      </th>`;
    };
    let body: TemplateResult;
    if (!listed) body = html`<div class="none">Loading…</div>`;
    else if (this.#error) body = html`<div class="none">${this.#error}</div>`;
    else {
      const current = this.#listing.length ? undefined : this.#emptyNote(folder);
      const none = this.#query.trim() && rows.every((r) => r.up);
      body = html`<div class="rows" tabindex="0" @keydown=${(e: KeyboardEvent) => this.#keydown(e, rows)}>
        <table>
          <thead>
            <tr>
              ${header('name', 'Name', false)}
              ${columns.map((c) => header(c.key, c.label ?? c.key, kindOf(c) !== 'cell', c.title))}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, i) => this.#row(row, i, selected, columns))}
          </tbody>
        </table>
        ${current ?? (none ? html`<div class="none">No matches.</div>` : nothing)}
      </div>`;
    }
    return html`<div class="bar">
        ${this.#crumbs(folder)}
        ${this.filter
          ? html`<input
              type="search"
              placeholder="Filter"
              aria-label="Filter"
              .value=${this.#query}
              @input=${(e: Event) => this.#setQuery((e.target as HTMLInputElement).value)}
              @keydown=${(e: KeyboardEvent) => this.#filterKey(e)}
            />`
          : nothing}
        ${listed && !this.#error
          ? html`<span class="tot">${dirs} folders · ${items.length - dirs} files · ${formatSize(total)}</span>`
          : nothing}
      </div>
      ${body}`;
  }

  #emptyNote(folder: string): TemplateResult {
    const opened = this.#opened;
    if (opened?.partial && normalizePath(opened.path) === folder) {
      const href = safeHref(opened.href);
      return html`<div class="none">
        This folder was not listed.
        ${href ? html`<a class="ext" href=${href} target="_blank" rel="noopener">Open it ↗</a>` : nothing}
      </div>`;
    }
    return html`<div class="none">${this.empty ?? (folder ? 'This folder is empty.' : 'No files.')}</div>`;
  }
}

define('kd-files', KdFiles);
