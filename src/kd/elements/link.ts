import { css, html } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';

import { define } from '../define';
import { KdElement, base, json } from '../element';
import { renderIcon, safeHref } from '../parts';

/** Dashboard variables, without the `var-` prefix (one is added when missing). A list repeats the variable. */
export type Vars = Record<string, string | number | boolean | null | undefined | readonly (string | number | boolean)[]>;

export interface LinkData {
  /** A dashboard uid (optionally `uid/slug`, optionally followed by `?query`, as a `back` value is). */
  dashboard?: string;
  /** A plain URL, used when there is no `dashboard`. */
  href?: string;
  vars?: Vars;
  text?: string;
  /** An image URL or an emoji. */
  icon?: string;
  /** Tooltip. */
  title?: string;
  /** Pass this dashboard and its variables as `var-back`, so the target can link back. */
  back?: boolean;
}

interface Here {
  /** Grafana's sub-path, the part of the path before `/d/`. */
  prefix: string;
  uid?: string;
  params: URLSearchParams;
}

// The current dashboard, read from the page URL. Outside a dashboard (or
// outside Grafana) there is no uid and no time range to keep.
function here(win: Window | null | undefined): Here {
  try {
    const loc = win?.location;
    const m = /^(.*?)\/d\/([^/?#]+)/.exec(loc?.pathname ?? '');
    return {
      prefix: m?.[1] ?? '',
      uid: m ? decodeURIComponent(m[2]) : undefined,
      params: new URLSearchParams(loc?.search ?? ''),
    };
  } catch {
    return { prefix: '', params: new URLSearchParams() };
  }
}

/**
 * The URL a link goes to: `<sub-path>/d/<dashboard>?var-k=v…` keeping the
 * current `from`/`to`, plus `var-back=<this uid>?<this page's var-* query>`
 * when `back` is set; or the plain `href`. Undefined when there is neither.
 */
export function linkUrl(link: LinkData, win?: Window | null): string | undefined {
  if (!link.dashboard) return safeHref(link.href);
  const at = here(win);
  const cut = link.dashboard.indexOf('?');
  const path = cut < 0 ? link.dashboard : link.dashboard.slice(0, cut);
  const params = new URLSearchParams(cut < 0 ? '' : link.dashboard.slice(cut + 1));
  for (const [name, value] of Object.entries(link.vars ?? {})) {
    if (value === null || value === undefined) continue;
    const key = name.startsWith('var-') ? name : `var-${name}`;
    params.delete(key);
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, String(v));
  }
  for (const name of ['from', 'to']) {
    const value = at.params.get(name);
    if (value !== null && !params.has(name)) params.set(name, value);
  }
  if (link.back && at.uid) {
    const vars = new URLSearchParams([...at.params].filter(([k]) => k.startsWith('var-'))).toString();
    params.set('var-back', vars ? `${at.uid}?${vars}` : at.uid);
  }
  const query = params.toString();
  return `${at.prefix}/d/${path}${query ? `?${query}` : ''}`;
}

interface Runtime {
  locationService?: { push(to: string): void };
}
type GrafanaWindow = Window & { System?: { import?(id: string): Promise<unknown> } };

const runtimes = new WeakMap<Window, Runtime | null>();

// Grafana turns clicks on its own links into in-app navigation, but it finds
// the anchor from the event target, which a shadow root retargets to the host.
// So a kd-link does it itself, through the same location service; until the
// runtime has loaded (or outside Grafana) the browser simply follows the link.
function preload(win: GrafanaWindow | null | undefined): void {
  if (!win || runtimes.has(win) || !win.System?.import) return;
  runtimes.set(win, null);
  win.System.import('@grafana/runtime').then(
    (rt) => runtimes.set(win, rt as Runtime),
    () => {},
  );
}

function navigate(win: Window | null | undefined, url: string, event: MouseEvent): void {
  if (!win || event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const service = runtimes.get(win)?.locationService;
  if (!service) return;
  const to = new URL(url, win.location.href);
  if (to.origin !== win.location.origin) return;
  const { prefix } = here(win);
  const path = prefix && to.pathname.startsWith(prefix) ? to.pathname.slice(prefix.length) : to.pathname;
  event.preventDefault();
  service.push(path + to.search + to.hash);
}

/**
 * A link to a dashboard (or any URL) with an optional icon. Set `data`, or the
 * attributes of the same names (`vars` as JSON, `back` as a boolean). Without
 * `text`, the slot is the label.
 *
 * `<kd-link dashboard="k8s-pod" vars='{"pod":"web-0"}' back>web-0</kd-link>`
 */
export class KdLink extends KdElement {
  static override properties = {
    data: { attribute: 'data', converter: json },
    dashboard: {},
    href: {},
    vars: { converter: json },
    text: {},
    icon: {},
    back: { type: Boolean },
  };
  static override styles = [
    base,
    css`
      :host {
        display: inline;
      }
      /* One line: a long name ends in an ellipsis with the full text on hover.
         A table caps links with --kd-link-max, since 100% means nothing to an
         auto-layout column. */
      a,
      span.link {
        display: inline-flex;
        align-items: baseline;
        max-width: var(--kd-link-max, 100%);
        min-width: 0;
        vertical-align: bottom;
      }
      .text {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      a {
        color: var(--kd-link, inherit);
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
      .icon {
        width: 16px;
        height: 16px;
        margin-right: 4px;
        vertical-align: -3px;
      }
    `,
  ];

  declare data: LinkData | undefined;
  declare dashboard: string | undefined;
  declare href: string | undefined;
  declare vars: Vars | undefined;
  declare text: string | undefined;
  declare icon: string | undefined;
  declare back: boolean | undefined;

  /** The link, `data` taking precedence over the attributes field by field. */
  get link(): LinkData {
    const d = this.data ?? {};
    return {
      dashboard: d.dashboard ?? this.dashboard,
      href: d.href ?? this.href,
      vars: d.vars ?? this.vars,
      text: d.text ?? this.text,
      icon: d.icon ?? this.icon,
      title: d.title,
      back: d.back ?? this.back,
    };
  }

  override connectedCallback(): void {
    super.connectedCallback();
    preload(this.ownerDocument?.defaultView);
  }

  // Variables can change without the panel re-rendering this element, so the
  // URL is rebuilt when the pointer or focus arrives and again on the click.
  #refresh = () => this.requestUpdate();

  #click = (event: MouseEvent) => {
    const win = this.ownerDocument?.defaultView;
    const url = linkUrl(this.link, win);
    if (url === undefined) return;
    (event.currentTarget as HTMLAnchorElement).setAttribute('href', url);
    navigate(win, url, event);
  };

  override render() {
    const link = this.link;
    const url = linkUrl(link, this.ownerDocument?.defaultView);
    // The text carries its full self on hover (it may be cut short); the link's
    // own title (a kind, say) shows over the icon.
    const body = html`${renderIcon(link.icon)}<span class="text" title=${ifDefined(link.text)}
      ><slot>${link.text ?? ''}</slot></span
    >`;
    const title = link.title ?? link.text;
    if (url === undefined) return html`<span class="link" title=${ifDefined(title)}>${body}</span>`;
    return html`<a
      href=${url}
      title=${ifDefined(title)}
      @click=${this.#click}
      @mouseenter=${this.#refresh}
      @focus=${this.#refresh}
      >${body}</a
    >`;
  }
}

define('kd-link', KdLink);
