// URLs into GitHub and into a code-server checkout. Every host but GitHub's is
// a parameter: none is written into the package.

const encodePath = (path: string): string =>
  path
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');

const at = (path: string) => {
  const p = encodePath(path);
  return p ? `/${p}` : '';
};

/** A file on GitHub at a commit, branch or tag. */
export function blobUrl(repo: string, ref: string, path: string): string {
  return `https://github.com/${repo}/blob/${encodePath(ref)}${at(path)}`;
}

/** A folder on GitHub at a ref; the repository's root for an empty path. */
export function treeUrl(repo: string, ref: string, path = ''): string {
  return `https://github.com/${repo}/tree/${encodePath(ref)}${at(path)}`;
}

/** A file's raw bytes at a ref. */
export function rawUrl(repo: string, ref: string, path: string): string {
  return `https://raw.githubusercontent.com/${repo}/${encodePath(ref)}${at(path)}`;
}

/**
 * Bases for a markdown file's relative links (GitHub pages) and images (raw
 * bytes), at the ref the file was read at, in the folder it sits in: give the
 * commit a README came from, so a pull request's README links into the pull
 * request rather than into the default branch.
 */
export function readmeBase(repo: string, ref: string, dir = ''): { links: string; images: string } {
  const sub = encodePath(dir);
  const tail = sub ? `${sub}/` : '';
  return {
    links: `https://github.com/${repo}/blob/${encodePath(ref)}/${tail}`,
    images: `https://raw.githubusercontent.com/${repo}/${encodePath(ref)}/${tail}`,
  };
}

export interface CodeServerOptions {
  /** Where checkouts live on the code-server host; default `/projects`, so a repo is at `/projects/<owner>/<name>`. */
  root?: string;
  /** Open the path as the workspace folder rather than as a file in the repository's workspace. */
  folder?: boolean;
}

/**
 * A path of a repository's checkout in code-server: a folder opens as the
 * workspace, a file opens in the repository's workspace. `host` is the
 * code-server host (`code.example.com`, or a full origin); its payload names
 * the same host, which is what VS Code's remote needs.
 */
export function codeServerUrl(host: string, repo: string, path = '', options: CodeServerOptions = {}): string {
  const origin = /^https?:\/\//i.test(host) ? host.replace(/\/+$/, '') : `https://${host.replace(/\/+$/, '')}`;
  const authority = new URL(origin).host;
  const root = `/${String(options.root ?? '/projects').replace(/^\/+|\/+$/g, '')}`;
  const checkout = `${root}/${repo}`;
  const rel = path.split('/').filter(Boolean).join('/');
  const local = rel ? `${checkout}/${rel}` : checkout;
  if (options.folder || !rel) return `${origin}/?folder=${encodeURIComponent(local)}`;
  const payload = JSON.stringify([['openFile', `vscode-remote://${authority}${local}`]]);
  return `${origin}/?folder=${encodeURIComponent(checkout)}&payload=${encodeURIComponent(payload)}`;
}
