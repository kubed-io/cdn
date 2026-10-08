// The provider contract kd-files and kd-file read through. A static list ships
// now; anything that can list a folder (WebDAV, say) fits the same shape.
import type { Cell } from '../cell';

/** One file or folder. Paths are `/`-separated with no leading slash; the root is `''`. */
export interface Entry {
  path: string;
  /** Defaults to the last segment of `path`. */
  name?: string;
  type: 'file' | 'dir';
  /** Bytes. A folder's is the sum of what is below it. */
  size?: number;
  /** An ISO time or epoch milliseconds. A folder's is its newest. */
  modified?: string | number;
  /** Where the entry opens elsewhere (GitHub, say), shown beside its name. */
  href?: string;
  /** Numbers a column can show; a folder's are the sums of what is below it. */
  stats?: Record<string, number>;
  /** Anything else a column can show, as a kd cell. Not rolled up. */
  cells?: Record<string, Cell>;
  /** A folder the provider could not list (deeper than it loaded, say). */
  partial?: boolean;
}

/** What `read` resolves to: text, or a blob with its type. */
export interface FileContent {
  text?: string;
  blob?: Blob;
  /** A MIME type or a kind (`markdown`, `code`, `text`, `image`, `binary`). */
  type?: string;
  size?: number;
}

export interface Capabilities {
  read?: boolean;
  write?: boolean;
  rename?: boolean;
}

export interface Provider {
  /** The entries directly in a folder; rejects for a folder that does not exist. */
  list(path: string): Promise<Entry[]>;
  read?(path: string): Promise<FileContent>;
  capabilities?: Capabilities;
}

/** A path with no leading, trailing or doubled slashes. */
export function normalizePath(path: string | null | undefined): string {
  return String(path ?? '')
    .split('/')
    .filter((part) => part !== '' && part !== '.')
    .join('/');
}

/** The folder a path is in; the root's parent is the root. */
export function dirname(path: string): string {
  const p = normalizePath(path);
  const cut = p.lastIndexOf('/');
  return cut < 0 ? '' : p.slice(0, cut);
}

/** The last segment of a path. */
export function basename(path: string): string {
  const p = normalizePath(path);
  return p.slice(p.lastIndexOf('/') + 1);
}

/** An entry's display name. */
export function entryName(entry: Entry): string {
  return entry.name ?? basename(entry.path);
}

/** `1536` -> `1.5 KiB`. */
export function formatSize(bytes: number | null | undefined): string {
  const b = Number(bytes) || 0;
  if (b >= 1073741824) return `${(b / 1073741824).toFixed(1)} GiB`;
  if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MiB`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KiB`;
  return `${b} B`;
}

/** A `modified` value as epoch milliseconds; NaN when unreadable. */
export function modifiedTime(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return NaN;
  return typeof value === 'number' ? value : Date.parse(value);
}
