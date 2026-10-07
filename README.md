# 📦 cdn

**A theme layer and web components for Grafana panels.** Shared CSS and ES modules that dashboards load by URL instead of carrying copies: the npm package [`@kubed.io/cdn`](https://www.npmjs.com/package/@kubed.io/cdn), served by [jsDelivr](https://www.jsdelivr.com/). 🎨

[![🧪 Test](https://github.com/kubed-io/cdn/actions/workflows/test.yml/badge.svg)](https://github.com/kubed-io/cdn/actions/workflows/test.yml)
[![🛡️ Quality](https://github.com/kubed-io/cdn/actions/workflows/quality.yml/badge.svg)](https://github.com/kubed-io/cdn/actions/workflows/quality.yml)

---

## 🗂️ What is here

| File | What it is |
|---|---|
| `dist/kd.js` | the core: `applyTheme`, `followTheme` and `define` |
| `dist/kd.css` | text, links, tables, badges, code and cards for `.kd` markup, styled only from the theme |

The source is TypeScript under `src/`, one folder per entry. `dist/` is built by CI and exists only in the published package.

## 🔗 The URL

```
https://cdn.jsdelivr.net/npm/@kubed.io/cdn@X.Y.Z/dist/<file>
```

An exact version is cached for a year and can never change underneath a dashboard. **Never a range like `@0` in a dashboard**: it is stale for up to a week and moves without notice.

Each dashboard holds the base URL once, in a hidden constant variable named `assets`:

```yaml
- kind: ConstantVariable
  spec:
    name: assets
    query: https://cdn.jsdelivr.net/npm/@kubed.io/cdn@X.Y.Z/dist
    hide: hideVariable
```

A release is then a one-line change per dashboard. Move every dashboard together: panels share one page, and the first version of a custom element loaded owns its tag until a full reload.

## 🎨 The theme

`applyTheme` sets these on the panel root, plus `data-theme="dark"` or `"light"`. The names are the public API and follow semver.

| Property | From `GrafanaTheme2` |
|---|---|
| `--kd-bg`, `--kd-bg-2`, `--kd-canvas` | `colors.background.primary`, `.secondary`, `.canvas` |
| `--kd-text`, `--kd-text-2`, `--kd-text-dim` | `colors.text.primary`, `.secondary`, `.disabled` |
| `--kd-link` | `colors.text.link` |
| `--kd-border`, `--kd-border-strong` | `colors.border.weak`, `.medium` |
| `--kd-primary`, `--kd-success`, `--kd-warning`, `--kd-error`, `--kd-info` | `colors.<name>.main` |
| `--kd-font`, `--kd-font-mono` | `typography.fontFamily`, `.fontFamilyMonospace` |
| `--kd-radius` | `shape.radius.default` |
| `--kd-space` | `spacing(1)` |

**Everything is scoped under `.kd`.** Business Text loads stylesheets into the whole page, so no rule here touches an element, `*` or `:root` outside a `.kd` root.

## 🧩 In a Business Text panel

```
externalStyles: ["${assets}/kd.css"]
content:        <div class="kd"> ... </div>
afterRender:    import(context.grafana.replaceVariables("${assets}") + "/kd.js")
                  .then(m => m.applyTheme(context.element, context.grafana.theme))
```

`afterRender` runs on every re-render and `applyTheme` is idempotent, so switching Grafana's theme restyles the panel. Code with no `context.grafana.theme` calls `followTheme(element)` instead: it reads the live theme from Grafana's runtime and follows a theme switch.

Every panel imports what it needs itself. The browser loads a URL once per page however many panels import it.

## 🛠️ Develop

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Unreleased code is tried in Grafana by publishing a pre-release (a `pre*` bump in the 🧬 Publish Version workflow), which goes to npm under the `next` tag.
