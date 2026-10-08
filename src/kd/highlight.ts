// highlight.js on demand. This module is itself a lazy chunk (kd-code imports
// it when it first has text): the core loads once, then one chunk per language,
// so a page downloads only the languages it shows.
import type { HLJSApi, LanguageFn } from 'highlight.js';

// One loader per language file. Each `x.js.js` beside `x.js` is a deprecated
// re-export that logs a warning, so it is left out.
const FILES = import.meta.glob<LanguageFn>(['./*.js', '!./*.js.js'], {
  base: '/node_modules/highlight.js/es/languages/',
  import: 'default',
  exhaustive: true,
});

const LOADERS = new Map(Object.entries(FILES).map(([key, load]) => [key.slice(key.lastIndexOf('/') + 1, -3), load]));

// highlight.js's own aliases (read from 11.12.0's language definitions), which
// it only knows once a language is registered. `ls` and `ml` name two
// languages each; the first is taken.
const ALIASES: Record<string, string> = Object.fromEntries(
  (
    'ado:stata adoc:asciidoc ahk:autohotkey apacheconf:apache arm:armasm as:actionscript asc:angelscript atom:xml ' +
    'bat:dos batch:dos bf:brainfuck bind:dns c#:csharp c++:cpp capnp:capnproto cc:cpp cjs:javascript clj:clojure ' +
    'cls:cos cmake.in:cmake cmd:dos coffee:coffeescript console:shell cr:crystal craftcms:twig crm:crmsh cs:csharp ' +
    'cson:coffeescript cts:typescript cxx:cpp dcl:clean desktop:freedesktop dfm:delphi do:stata docker:dockerfile ' +
    'dpr:delphi dst:dust edn:clojure erl:erlang ex:elixir exs:elixir f#:fsharp f90:fortran f95:fortran ' +
    'feature:gherkin fs:fsharp gemspec:ruby gms:gams golang:go gql:graphql graph:roboconf gss:gauss gyp:python ' +
    'h++:cpp h:c hbs:handlebars hh:cpp hpp:cpp hs:haskell html:xml html.handlebars:handlebars html.hbs:handlebars ' +
    'htmlbars:handlebars https:http hx:haxe hxx:cpp hylang:hy i7:inform7 iced:coffeescript icl:clean ino:arduino ' +
    'instances:roboconf ipython:python irb:ruby jinja:django jldoctest:julia-repl js:javascript json5:json ' +
    'jsonc:json jsp:java jsx:javascript k:q kdb:q kt:kotlin ktm:kotlin kts:kotlin ktx:kotlin lassoscript:lasso ' +
    'ls:lasso m:mercury mak:makefile make:makefile md:markdown mikrotik:routeros mips:mipsasm mjs:javascript ' +
    'mk:makefile mkd:markdown mkdown:markdown ml:ocaml mm:objectivec mma:mathematica moo:mercury moon:moonscript ' +
    'mts:typescript nc:gcode nginxconf:nginx nixos:nix nt:nestedtext obj-c++:objectivec obj-c:objectivec ' +
    'objc:objectivec objective-c++:objectivec osascript:applescript p21:step21 pas:delphi pascal:delphi ' +
    'patch:diff pb:purebasic pbi:purebasic pcmk:crmsh pde:processing pf.conf:pf pl:perl plist:xml pluto:lua ' +
    'pm:perl podspec:ruby postgres:pgsql postgresql:pgsql pp:puppet proto:protobuf ps:powershell ps1:powershell ' +
    'pwsh:powershell py:python pycon:python-repl qt:qml rb:ruby re:reasonml rs:rust rss:xml scad:openscad ' +
    'sci:scilab scm:scheme sh:bash shellsession:shell st:smalltalk stanfuncs:stan step:step21 stp:step21 ' +
    'styl:stylus sv:verilog svg:xml svh:verilog systemd:freedesktop tao:xl tex:latex text:plaintext thor:ruby ' +
    'tk:tcl toml:ini ts:typescript tsx:typescript txt:plaintext v:verilog vb:vbnet vbs:vbscript ' +
    'wildfly-cli:jboss-cli wl:mathematica wsf:xml x++:axapta xhtml:xml xjb:xml xls:excel xlsx:excel ' +
    'xpath:xquery xq:xquery xqm:xquery xsd:xml xsl:xml yml:yaml zep:zephir zone:dns zsh:bash'
  )
    .split(' ')
    .map((pair) => pair.split(':')),
);

// File extensions an alias does not cover (or covers wrongly, as `.m`).
// highlight.js has no HCL or jq: Terraform reads acceptably as ini, jq as bash.
const EXTENSIONS: Record<string, string> = {
  bash_profile: 'bash',
  bashrc: 'bash',
  conf: 'ini',
  cfg: 'ini',
  csv: 'plaintext',
  dockerfile: 'dockerfile',
  env: 'ini',
  gitignore: 'plaintext',
  gradle: 'groovy',
  hcl: 'ini',
  htm: 'xml',
  ipynb: 'json',
  jq: 'bash',
  ksh: 'bash',
  log: 'plaintext',
  m: 'objectivec',
  markdown: 'markdown',
  mdx: 'markdown',
  profile: 'bash',
  properties: 'properties',
  pyi: 'python',
  rst: 'plaintext',
  service: 'ini',
  svelte: 'xml',
  tf: 'ini',
  tfvars: 'ini',
  timer: 'ini',
  vue: 'xml',
  zshrc: 'bash',
};

// Whole file names, lower-cased.
const NAMES: Record<string, string> = {
  brewfile: 'ruby',
  'cmakelists.txt': 'cmake',
  containerfile: 'dockerfile',
  dockerfile: 'dockerfile',
  gemfile: 'ruby',
  gnumakefile: 'makefile',
  jenkinsfile: 'groovy',
  makefile: 'makefile',
  podfile: 'ruby',
  rakefile: 'ruby',
  vagrantfile: 'ruby',
};

// Languages that are mostly another language. Other embedded languages
// (CSS in HTML, Ruby in YAML) are not loaded for them: that part stays plain.
const REQUIRES: Record<string, string[]> = {
  'clojure-repl': ['clojure'],
  django: ['xml'],
  dockerfile: ['bash'],
  dust: ['xml'],
  erb: ['xml', 'ruby'],
  haml: ['ruby'],
  handlebars: ['xml'],
  'julia-repl': ['julia'],
  mojolicious: ['xml', 'perl'],
  'node-repl': ['javascript'],
  'php-template': ['xml', 'php'],
  'python-repl': ['python'],
  shell: ['bash'],
  tap: ['yaml'],
  twig: ['xml'],
  'vbscript-html': ['xml', 'vbscript'],
};

/** Every language highlight.js has a chunk for, by file name (`yaml`, `javascript`, …). */
export function languages(): string[] {
  return [...LOADERS.keys()];
}

/**
 * The highlight.js language for a language name or alias (`js`, `yml`,
 * `language-sh`), or undefined when there is none. `plaintext` means a text
 * file: shown plain, nothing to load.
 */
export function languageOf(name: string | null | undefined): string | undefined {
  if (!name) return undefined;
  const key = name.trim().toLowerCase().replace(/^language-/, '');
  const found = ALIASES[key] ?? EXTENSIONS[key] ?? key;
  return LOADERS.has(found) ? found : undefined;
}

/** The highlight.js language for a file name or path (`Dockerfile`, `src/app.ts`, `.env`), or undefined. */
export function languageOfFile(filename: string | null | undefined): string | undefined {
  if (!filename) return undefined;
  const base = filename.slice(filename.lastIndexOf('/') + 1).toLowerCase();
  if (NAMES[base]) return NAMES[base];
  if (/^(docker|container)file[.-]/.test(base)) return 'dockerfile';
  const dot = base.lastIndexOf('.');
  if (dot < 0) return undefined;
  const ext = base.slice(dot + 1);
  return languageOf(EXTENSIONS[ext] ?? ext);
}

let core: Promise<HLJSApi> | undefined;
const loaded = new Map<string, Promise<boolean>>();

function hljs(): Promise<HLJSApi> {
  core ??= import('highlight.js/lib/core').then((m) => m.default);
  return core;
}

function load(language: string): Promise<boolean> {
  let done = loaded.get(language);
  if (!done) {
    const loader = LOADERS.get(language);
    done = loader
      ? Promise.all([hljs(), loader(), ...(REQUIRES[language] ?? []).map(load)]).then(([api, fn]) => {
          if (!api.getLanguage(language)) api.registerLanguage(language, fn);
          return true;
        })
      : Promise.resolve(false);
    // A chunk that failed to load (a network blip) may be asked for again.
    done = done.catch(() => {
      loaded.delete(language);
      return false;
    });
    loaded.set(language, done);
  }
  return done;
}

export interface Highlighted {
  /** The highlight.js language used. */
  language: string;
  /** Its display name, such as `YAML`. */
  name: string;
  /** highlight.js's HTML for each line: its own escaped text and `<span class="hljs-…">` only. */
  lines: string[];
}

// highlight.js's output is escaped text and <span class="…"> tags, nothing
// else. A span may cross lines (a block comment), so each line closes the
// spans still open at its end and reopens them on the next.
const TAG = /<span class="[\w .-]*">|<\/span>|\n/g;

/** Splits highlight.js HTML into lines; null when it holds any other markup. */
export function splitLines(markup: string): string[] | null {
  const lines: string[] = [];
  const open: string[] = [];
  let line = '';
  let last = 0;
  for (const match of markup.matchAll(TAG)) {
    const between = markup.slice(last, match.index);
    if (between.includes('<')) return null;
    line += between;
    last = match.index + match[0].length;
    const tag = match[0];
    if (tag === '\n') {
      lines.push(line + '</span>'.repeat(open.length));
      line = open.join('');
    } else if (tag === '</span>') {
      if (!open.pop()) return null;
      line += tag;
    } else {
      open.push(tag);
      line += tag;
    }
  }
  const rest = markup.slice(last);
  if (rest.includes('<') || open.length) return null;
  lines.push(line + rest);
  return lines;
}

/**
 * Highlights `text` (lines split on `\n`) as `language`, a name, alias or
 * highlight.js language. Null when the language is unknown, is plain text, or
 * its chunk cannot load.
 */
export async function highlight(text: string, language: string): Promise<Highlighted | null> {
  const lang = languageOf(language);
  if (!lang || lang === 'plaintext' || !(await load(lang))) return null;
  const api = await hljs();
  try {
    const result = api.highlight(text, { language: lang, ignoreIllegals: true });
    const lines = splitLines(result.value);
    return lines ? { language: lang, name: api.getLanguage(lang)?.name ?? lang, lines } : null;
  } catch {
    return null;
  }
}
