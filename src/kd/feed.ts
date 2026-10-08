// The afterRender one-liner: theme the panel, hand each element its data.
import { applyTheme, type ThemeLike } from './theme';

/** The parts of Business Text's `context` that feed and variable read. */
export interface FeedContext {
  element?: HTMLElement | null;
  grafana?: {
    theme?: ThemeLike;
    replaceVariables?(text: string): string;
  } | null;
}

/** Properties to set, by CSS selector: `{ 'kd-files': { entries, selected } }`. */
export type FeedMap = Record<string, Record<string, unknown>>;

/**
 * Applies the theme to the panel root, then sets each selector's properties on
 * every element under the root that matches it. Idempotent, as afterRender
 * runs twice per refresh.
 *
 * It merges (`Object.assign`): a key left out keeps the value an earlier call
 * gave it. A panel should pass every key it manages each time, `undefined`
 * where one does not apply, or the last file's `type` or `src` sticks to the next.
 *
 * `afterRender: import(assets + '/kd.js').then((m) => m.feed(context, { 'kd-markdown': { markdown } }))`
 *
 * @returns the elements it set properties on
 */
export function feed(context: FeedContext | null | undefined, map: FeedMap = {}): Element[] {
  const root = context?.element;
  if (!root) return [];
  applyTheme(root, context.grafana?.theme);
  const fed: Element[] = [];
  for (const [selector, props] of Object.entries(map)) {
    let found: NodeListOf<Element>;
    try {
      found = root.querySelectorAll(selector);
    } catch {
      console.warn(`[kd] feed: not a selector: ${selector}`);
      continue;
    }
    for (const el of found) {
      Object.assign(el, props);
      fed.push(el);
    }
  }
  return fed;
}

/**
 * A dashboard variable's value as the panel sees it, through
 * `context.grafana.replaceVariables`: '' when the variable is not set or does
 * not exist.
 */
export function variable(context: FeedContext | null | undefined, name: string): string {
  const expression = '${' + name + '}';
  let value: unknown;
  try {
    value = context?.grafana?.replaceVariables?.(expression);
  } catch {
    return '';
  }
  return typeof value === 'string' && value !== expression ? value : '';
}
