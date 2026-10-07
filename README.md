# 📦 cdn

**Versioned static assets for Grafana panels.** Shared CSS and ES modules that dashboards load by URL instead of carrying copies, served by [jsDelivr](https://www.jsdelivr.com/) straight from this repo's tags. 🎨

[![🧪 Test](https://github.com/kubed-io/cdn/actions/workflows/test.yml/badge.svg)](https://github.com/kubed-io/cdn/actions/workflows/test.yml)
[![🛡️ Quality](https://github.com/kubed-io/cdn/actions/workflows/quality.yml/badge.svg)](https://github.com/kubed-io/cdn/actions/workflows/quality.yml)

---

## 🗂️ What is here

| Path | What it is |
|---|---|
| `grafana/theme.js` | `applyTheme(element, theme)`: Grafana's live theme as `--kd-*` custom properties |
| `grafana/theme.css` | text, links, tables, badges, code and cards, styled only from those properties |

## 🔗 The URL

```
https://cdn.jsdelivr.net/gh/kubed-io/cdn@vX.Y.Z/<path>
```

A tag is cached for a year and can never change underneath a dashboard. **Never `@main` in a dashboard**: a branch is stale for up to a week and moves without notice.

Each dashboard holds the base URL once, in a hidden constant variable named `assets`:

```yaml
- kind: ConstantVariable
  spec:
    name: assets
    query: https://cdn.jsdelivr.net/gh/kubed-io/cdn@vX.Y.Z
    hide: hideVariable
```

A release is then a one-line change per dashboard.

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
externalStyles: ["${assets}/grafana/theme.css"]
content:        <div class="kd"> ... </div>
afterRender:    import(context.grafana.replaceVariables("${assets}") + "/grafana/theme.js")
                  .then(m => m.applyTheme(context.element, context.grafana.theme))
```

`afterRender` runs on every re-render and `applyTheme` is idempotent, so switching Grafana's theme restyles the panel.
