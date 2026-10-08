/**
 * What the library panel passes to `mount`: its `chat_*` constants (decoded),
 * the viewer, and the Authorization header. A field that arrives as a literal
 * `${...}` (a dashboard without that variable) reads as empty.
 */
export interface ChatConfig {
  /** An emoji, or an image URL. */
  icon?: string;
  label?: string;
  /** Where the tile goes; an http(s) link opens a new tab. */
  link?: string;
  /** The n8n Chat Trigger URL. Empty means tile only, and any leftover bubble is removed. */
  webhook?: string;
  title?: string;
  subtitle?: string;
  /** Greeting lines, split on `|`. */
  greeting?: string;
  /** Extra metadata as `key=variable` pairs, read live on every send: `pod=pod,database=datname`. */
  context?: string;
  /** The names the agent may set, in applied order. `time_from`, `time_to`, `refresh` and `focus` are reserved. */
  settable?: string;
  /** Each group's purpose, `Name=purpose` pairs joined by `|` (Grafana has no description on a tab or a row). */
  groups?: string;
  /** Stream the reply. Must match the Chat Trigger's responseMode, or nothing renders. */
  stream?: boolean | string;
  /** The viewer's login, sent as metadata. */
  user?: string;
  /** The Authorization header value. Kept in Grafana and passed in, never in this package. */
  auth?: string;
  /** The `@n8n/chat` version loaded from jsDelivr; by default the one package.json pins. */
  chatVersion?: string;
  /** The tile: an element, a selector, or by default `#n8n-chat-tile`. An `<a>` or a `<kd-tile>`. */
  tile?: Element | string | null;
  /** The page; by default the tile's, else the global window. */
  window?: Window;
}

/** The `@n8n/chat` build loaded by default: package.json's peer dependency, injected at build time. */
export const CHAT_VERSION: string = __N8N_CHAT_VERSION__;

export interface Settings {
  icon: string;
  label: string;
  link: string;
  webhook: string;
  title: string;
  subtitle: string;
  greeting: string[];
  context: [key: string, variable: string][];
  settable: string[];
  groups: Record<string, string>;
  stream: boolean;
  user: string;
  auth: string;
  chatVersion: string;
}

function text(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.startsWith('${') ? '' : value;
}

export function list(value: string): string[] {
  return value
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

/** `Name=purpose|Other=purpose` -> lower-cased name to purpose. */
export function groupNotes(value: string): Record<string, string> {
  const notes: Record<string, string> = {};
  for (const part of value.split('|')) {
    const eq = part.indexOf('=');
    if (eq > 0) notes[part.slice(0, eq).trim().toLowerCase()] = part.slice(eq + 1).trim();
  }
  return notes;
}

export function settings(config: ChatConfig): Settings {
  return {
    icon: text(config.icon),
    label: text(config.label),
    link: text(config.link),
    webhook: text(config.webhook).trim(),
    title: text(config.title),
    subtitle: text(config.subtitle),
    greeting: text(config.greeting)
      .split('|')
      .map((x) => x.trim())
      .filter(Boolean),
    context: list(text(config.context)).map((pair): [string, string] => {
      if (!pair.includes('=')) return [pair, pair];
      const [key, name] = pair.split('=').map((x) => x.trim());
      return [key, name];
    }),
    settable: list(text(config.settable)),
    groups: groupNotes(text(config.groups)),
    stream: config.stream === true || text(config.stream) === 'true',
    user: text(config.user),
    auth: text(config.auth),
    chatVersion: text(config.chatVersion).trim() || CHAT_VERSION,
  };
}
