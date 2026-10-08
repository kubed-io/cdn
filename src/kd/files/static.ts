// A provider that answers from a flat list held in memory, such as a git tree.
import { basename, modifiedTime, normalizePath, type Entry, type FileContent, type Provider } from './types';

interface Folder {
  entry: Entry;
  /** Folders and files directly in it, by name. */
  children: Map<string, Folder | Entry>;
}

const isFolder = (node: Folder | Entry): node is Folder => 'children' in node;

export interface StaticOptions {
  /** Reads a file, when the caller has a way to (a fetch, say). */
  read?(path: string): Promise<FileContent>;
}

/**
 * A provider over a flat list. Folders that are only implied by a path are
 * made up; each folder's `size`, every numeric stat and the newest `modified`
 * are rolled up from everything below it (a folder with nothing listed below
 * it keeps whatever it was given). Later entries for a path win.
 */
export function staticProvider(entries: readonly Entry[] | null | undefined, options: StaticOptions = {}): Provider {
  const root: Folder = { entry: { path: '', type: 'dir' }, children: new Map() };
  const folders = new Map<string, Folder>([['', root]]);

  const folder = (path: string): Folder => {
    let node = folders.get(path);
    if (node) return node;
    const parent = folder(path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
    node = { entry: { path, type: 'dir' }, children: new Map() };
    folders.set(path, node);
    parent.children.set(basename(path), node);
    return node;
  };

  for (const given of entries ?? []) {
    if (!given || typeof given !== 'object') continue;
    const path = normalizePath(given.path);
    if (!path) continue;
    if (given.type === 'dir') {
      const node = folder(path);
      node.entry = { ...given, path };
    } else {
      const parent = folder(path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
      const name = basename(path);
      const existing = parent.children.get(name);
      if (existing && isFolder(existing)) continue;
      parent.children.set(name, { ...given, path, type: 'file' });
    }
  }

  // Bottom up: a folder's numbers are the sums of its children's.
  const rollUp = (node: Folder): Entry => {
    if (!node.children.size) return node.entry;
    let size = 0;
    let newest: string | number | undefined;
    let newestTime = -Infinity;
    const stats: Record<string, number> = {};
    for (const child of node.children.values()) {
      const e = isFolder(child) ? rollUp(child) : child;
      size += Number(e.size) || 0;
      const t = modifiedTime(e.modified);
      if (t > newestTime) {
        newest = e.modified;
        newestTime = t;
      }
      for (const [k, v] of Object.entries(e.stats ?? {})) {
        if (typeof v === 'number' && Number.isFinite(v)) stats[k] = (stats[k] ?? 0) + v;
      }
    }
    node.entry = { ...node.entry, size, stats, ...(newest === undefined ? {} : { modified: newest }) };
    return node.entry;
  };
  rollUp(root);

  return {
    list(path: string): Promise<Entry[]> {
      const node = folders.get(normalizePath(path));
      if (!node) return Promise.reject(new Error(`no folder ${normalizePath(path) || '/'}`));
      return Promise.resolve([...node.children.values()].map((child) => (isFolder(child) ? child.entry : child)));
    },
    ...(options.read ? { read: options.read } : {}),
    capabilities: { read: !!options.read, write: false, rename: false },
  };
}
