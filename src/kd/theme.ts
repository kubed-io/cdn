// The theme layer: Grafana's live theme as `--kd-*` custom properties.
// The property names are this package's public API and follow semver.

/** The parts of a GrafanaTheme2 the theme layer reads. Any of them may be missing. */
export interface ThemeLike {
  isDark?: boolean;
  [key: string]: unknown;
}

type Read = (theme: any) => unknown;

const PROPERTIES: [string, Read][] = [
  ['--kd-bg', (t) => t.colors.background.primary],
  ['--kd-bg-2', (t) => t.colors.background.secondary],
  ['--kd-canvas', (t) => t.colors.background.canvas],
  ['--kd-text', (t) => t.colors.text.primary],
  ['--kd-text-2', (t) => t.colors.text.secondary],
  ['--kd-text-dim', (t) => t.colors.text.disabled],
  ['--kd-link', (t) => t.colors.text.link],
  ['--kd-border', (t) => t.colors.border.weak],
  ['--kd-border-strong', (t) => t.colors.border.medium],
  ['--kd-primary', (t) => t.colors.primary.main],
  ['--kd-success', (t) => t.colors.success.main],
  ['--kd-warning', (t) => t.colors.warning.main],
  ['--kd-error', (t) => t.colors.error.main],
  ['--kd-info', (t) => t.colors.info.main],
  ['--kd-font', (t) => t.typography.fontFamily],
  ['--kd-font-mono', (t) => t.typography.fontFamilyMonospace],
  ['--kd-radius', (t) => t.shape.radius.default],
  ['--kd-space', (t) => t.spacing(1)],
];

// A theme from an older or newer Grafana may lack a field; that property is
// skipped so the rest still apply, and CSS falls back to its own default.
function read(theme: ThemeLike, get: Read): string | undefined {
  try {
    const value = get(theme);
    return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Sets the `--kd-*` properties and `data-theme` ("dark" or "light") on
 * `element` from a GrafanaTheme2. Idempotent, so it is safe in Business Text's
 * `afterRender`, which runs on every re-render.
 *
 * @param element the panel's own root, never `:root`
 * @param theme a GrafanaTheme2, e.g. `context.grafana.theme`
 */
export function applyTheme(element: HTMLElement | null | undefined, theme: ThemeLike | null | undefined): void {
  if (!element || !theme) return;
  for (const [name, get] of PROPERTIES) {
    const value = read(theme, get);
    if (value !== undefined) element.style.setProperty(name, value);
  }
  if (typeof theme.isDark === 'boolean') {
    element.setAttribute('data-theme', theme.isDark ? 'dark' : 'light');
  }
}

/** The parts of `@grafana/runtime` that following the theme needs. */
interface Runtime {
  config: { theme2: ThemeLike };
  getAppEvents(): {
    subscribe(event: unknown, handler: (event: { payload?: ThemeLike }) => void): { unsubscribe(): void };
  };
  ThemeChangedEvent: unknown;
}

type GrafanaWindow = Window & { System?: { import?(id: string): Promise<unknown> } };

const runtimes = new WeakMap<Window, Promise<Runtime | null>>();

// Grafana loads plugins through SystemJS and shares its own packages there, so
// the page's live config and event bus are one import away. Outside Grafana
// there is no System and this resolves to null.
function runtime(win: GrafanaWindow): Promise<Runtime | null> {
  let found = runtimes.get(win);
  if (!found) {
    found = Promise.resolve()
      .then(() => win.System?.import?.('@grafana/runtime'))
      .then((r) => {
        const rt = r as Partial<Runtime> | undefined;
        return rt?.config?.theme2 && rt.getAppEvents && rt.ThemeChangedEvent ? (rt as Runtime) : null;
      })
      .catch(() => null);
    runtimes.set(win, found);
  }
  return found;
}

/**
 * Themes `element` from Grafana's live theme without being handed one, and
 * keeps it themed across a live theme switch. For code that has no
 * `context.grafana.theme`. The `<body>` theme class is never used: it goes
 * stale on a live switch.
 *
 * @returns a function that stops following; a no-op outside Grafana
 */
export async function followTheme(element: HTMLElement): Promise<() => void> {
  const win = element.ownerDocument?.defaultView as GrafanaWindow | null;
  const rt = win ? await runtime(win) : null;
  if (!rt) return () => {};
  applyTheme(element, rt.config.theme2);
  const subscription = rt
    .getAppEvents()
    .subscribe(rt.ThemeChangedEvent, (event) => applyTheme(element, event?.payload ?? rt.config.theme2));
  return () => subscription.unsubscribe();
}
