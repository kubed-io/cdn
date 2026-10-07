// A small YAML dumper for JSON values: block style, kubectl's layout (a list
// sits at its key's indent), quotes only where a plain scalar would be misread.

/** What a token is, for highlighting. Punctuation and indentation are `plain`. */
export type YamlKind = 'key' | 'str' | 'num' | 'bool' | 'null' | 'plain';

export interface YamlToken {
  kind: YamlKind;
  text: string;
}

/** One output line: its indentation (with any `- ` markers), then its tokens. */
export interface YamlLine {
  prefix: string;
  tokens: YamlToken[];
}

const RESERVED = /^(~|null|true|false|yes|no|on|off|y|n)$/i;
const NUMBER =
  /^([-+]?(\.\d+|\d[\d_]*(\.\d*)?)([eE][-+]?\d+)?|0x[0-9a-f]+|0o[0-7]+|[-+]?\.(inf|nan)|[-+]?\d+(:[0-5]?\d)+(\.\d*)?)$/i;
const DATE = /^\d{4}-\d\d?-\d\d?([Tt ]|$)/;
const INDICATOR = /^([,[\]{}#&*!|>'"%@`]|[-?:](\s|$))/;
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/;

function needsQuotes(s: string): boolean {
  return (
    s === '' ||
    RESERVED.test(s) ||
    NUMBER.test(s) ||
    DATE.test(s) ||
    INDICATOR.test(s) ||
    /^\s|\s$/.test(s) ||
    s.includes(': ') ||
    s.includes(' #') ||
    s.endsWith(':') ||
    s.includes('\n') ||
    s.includes('\t') ||
    CONTROL.test(s)
  );
}

/** A string as a YAML scalar, double-quoted (JSON's escapes are YAML's) only when it must be. */
export function quote(s: string): string {
  return needsQuotes(s) ? JSON.stringify(s) : s;
}

const token = (kind: YamlKind, text: string): YamlToken => ({ kind, text });

function isBlock(value: unknown): value is object {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && typeof value === 'object' && Object.values(value).some((v) => v !== undefined);
}

function isLiteral(value: unknown): value is string {
  return typeof value === 'string' && value.includes('\n') && !CONTROL.test(value);
}

function scalar(value: unknown): YamlToken {
  if (value === null || value === undefined) return token('null', 'null');
  if (typeof value === 'boolean') return token('bool', String(value));
  if (typeof value === 'number' || typeof value === 'bigint') return token('num', String(value));
  if (Array.isArray(value)) return token('plain', '[]');
  if (typeof value === 'object') return token('plain', '{}');
  return token('str', quote(String(value)));
}

// A multi-line string as a literal block: `|` keeps one final newline, `|-`
// none and `|+` all; a leading space on the first line needs the indent stated.
function literal(s: string): { header: string; lines: string[] } {
  const chomp = s.endsWith('\n') ? (s.endsWith('\n\n') ? '+' : '') : '-';
  const body = chomp === '-' ? s : s.slice(0, -1);
  const lines = body.split('\n');
  const first = lines.find((l) => l !== '');
  return { header: `|${first?.startsWith(' ') ? '2' : ''}${chomp}`, lines };
}

// A scalar, an empty collection or a literal block after `head` (`key:` or nothing).
function inline(prefix: string, head: YamlToken[], value: unknown, inner: string): YamlLine[] {
  const gap = head.length ? [token('plain', ' ')] : [];
  if (isLiteral(value)) {
    const { header, lines } = literal(value);
    return [
      { prefix, tokens: [...head, ...gap, token('plain', header)] },
      ...lines.map((l) => ({ prefix: l ? inner : '', tokens: [token('str', l)] })),
    ];
  }
  return [{ prefix, tokens: [...head, ...gap, scalar(value)] }];
}

// A non-empty object or array at `indent`.
function block(value: object, indent: string, out: YamlLine[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isBlock(item)) {
        const sub: YamlLine[] = [];
        block(item, `${indent}  `, sub);
        sub[0].prefix = `${indent}- ${sub[0].prefix.slice(indent.length + 2)}`;
        out.push(...sub);
      } else {
        out.push(...inline(`${indent}- `, [], item, `${indent}  `));
      }
    }
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue;
    const head = [token('key', quote(key)), token('plain', ':')];
    if (isBlock(item)) {
      out.push({ prefix: indent, tokens: head });
      block(item, Array.isArray(item) ? indent : `${indent}  `, out);
    } else {
      out.push(...inline(indent, head, item, `${indent}  `));
    }
  }
}

/** A JSON value as YAML lines of tokens, for rendering with highlighting. */
export function yamlLines(value: unknown): YamlLine[] {
  const out: YamlLine[] = [];
  if (isBlock(value)) block(value, '', out);
  else out.push(...inline('', [], value, '  '));
  return out;
}

/** A JSON value as YAML text. */
export function toYaml(value: unknown): string {
  return yamlLines(value)
    .map((line) => line.prefix + line.tokens.map((t) => t.text).join(''))
    .join('\n');
}
