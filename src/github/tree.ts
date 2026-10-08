// The Repo dashboard's git tree (file-tree.A.jq: {oid, path, type, size} per
// object, nested to a fixed depth) as kd-files entries.
import type { Cell } from '../kd/cell';
import type { Entry } from '../kd/files/types';
import { blobUrl, codeServerUrl, treeUrl } from './urls';

/** One row of the tree query. `type` is git's: `blob`, `tree`, or `commit` for a submodule. */
export interface TreeRow {
  oid?: string;
  path: string;
  type: string;
  size?: number | string | null;
}

export interface TreeOptions {
  /** `owner/name`: each entry links to itself on GitHub at the tree's commit. */
  repo?: string;
  /** A code-server host: each entry gets an `open` cell linking to it in the checkout there (needs `repo`). */
  codeServer?: string;
  /** Where checkouts live on the code-server host (default `/projects`). */
  root?: string;
}

/** Rows from a panel's data: a list of rows, or Business Text's list of frames (each a list of rows). */
export function treeRows(data: unknown): TreeRow[] {
  const all = Array.isArray(data) ? data.flatMap((x) => (Array.isArray(x) ? x : [x])) : [];
  return all.filter(
    (r): r is TreeRow => !!r && typeof r === 'object' && typeof (r as TreeRow).path === 'string' && typeof (r as TreeRow).type === 'string',
  );
}

/** The commit the tree was read at: the first row's `oid`, or ''. */
export function treeOid(data: unknown): string {
  return treeRows(data).find((r) => r.oid)?.oid ?? '';
}

/**
 * kd-files entries for the tree: a `tree` is a folder, anything else a file. A
 * git tree is never empty, so a folder with nothing below it in the rows is one
 * the query's depth did not reach, and is marked `partial`.
 */
export function treeEntries(data: unknown, options: TreeOptions = {}): Entry[] {
  const rows = treeRows(data);
  const oid = treeOid(rows);
  const parents = new Set<string>();
  for (const r of rows) {
    const cut = r.path.lastIndexOf('/');
    if (cut > 0) parents.add(r.path.slice(0, cut));
  }
  const seen = new Set<string>();
  const out: Entry[] = [];
  for (const r of rows) {
    if (!r.path || seen.has(r.path)) continue;
    seen.add(r.path);
    const dir = r.type === 'tree';
    const entry: Entry = { path: r.path, type: dir ? 'dir' : 'file' };
    if (!dir) entry.size = Number(r.size) || 0;
    if (dir && !parents.has(r.path)) entry.partial = true;
    if (options.repo && oid) entry.href = dir ? treeUrl(options.repo, oid, r.path) : blobUrl(options.repo, oid, r.path);
    if (options.repo && options.codeServer) {
      const open: Cell = {
        href: codeServerUrl(options.codeServer, options.repo, r.path, { folder: dir, root: options.root }),
        text: '',
        icon: '⌨',
        title: 'Open in code-server',
      };
      entry.cells = { open };
    }
    out.push(entry);
  }
  return out;
}
