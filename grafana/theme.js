// The theme layer: Grafana's live theme as `--kd-*` custom properties.
// The property names are this repo's public API and follow semver.

const PROPERTIES = [
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
function read(theme, get) {
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
 * @param {HTMLElement} element the panel's own root, never `:root`
 * @param {object} theme a GrafanaTheme2, e.g. `context.grafana.theme`
 */
export function applyTheme(element, theme) {
  if (!element || !theme) return;
  for (const [name, get] of PROPERTIES) {
    const value = read(theme, get);
    if (value !== undefined) element.style.setProperty(name, value);
  }
  if (typeof theme.isDark === 'boolean') {
    element.setAttribute('data-theme', theme.isDark ? 'dark' : 'light');
  }
}
