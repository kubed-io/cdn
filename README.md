# 📦 cdn

**A theme layer and web components for Grafana panels.** Shared CSS and ES modules that dashboards load by URL instead of carrying copies: the npm package [`@kubed.io/cdn`](https://www.npmjs.com/package/@kubed.io/cdn), served by [jsDelivr](https://www.jsdelivr.com/). 🎨

[![🧪 Test](https://github.com/kubed-io/cdn/actions/workflows/test.yml/badge.svg)](https://github.com/kubed-io/cdn/actions/workflows/test.yml)
[![🛡️ Quality](https://github.com/kubed-io/cdn/actions/workflows/quality.yml/badge.svg)](https://github.com/kubed-io/cdn/actions/workflows/quality.yml)

---

## 🗂️ What is here

| Entry | What it brings |
|---|---|
| `dist/kd.js` | 🎨 the core: the theme layer, the Grafana page helpers, and every generic element |
| `dist/kd.css` | text, links, tables, badges, code and cards for plain `.kd` markup |
| `dist/openapi.js` | 📜 `<kd-schema>`: any OpenAPI v3 or JSON Schema, kubectl-explain style, rendered lazily |
| `dist/k8s.js` | ☸️ Kubernetes objects mapped onto the core elements: `<kd-k8s-object>`, `<kd-k8s-ref>`, `<kd-k8s-events>` |
| `dist/n8n.js` | 💬 `mount(config)`: the n8n agent chat tile for app dashboards |

The entries share chunks, so a page that loads several pays for Lit and the core once. The look lives in the core; a domain entry adds behaviour, never colours.

**Elements** (all `kd-*`, real custom elements with shadow DOM, themed from `--kd-*`):

| | |
|---|---|
| `kd-pill` `kd-tile` `kd-link` `kd-mask` | small things: a toned pill, a header tile, a dashboard link that keeps the time range and a back chain, a click-to-reveal value |
| `kd-bar` `kd-sheet` `kd-table` | a title bar with chips and a breadcrumb, a property sheet, a table; cells can be text, pills, links, code or data |
| `kd-groups` `kd-data` | labels as grouped pills, annotations as a tree; any JSON value as folded YAML |
| `kd-tabs` `kd-steps` `kd-meter` | tabs that remember their choice, a stepper, a value against request/limit marks |

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
externalStyles: [{ id: "kd", url: "${assets}/kd.css" }]   # objects: a bare string never loads
content:        <div class="kd"> ... </div>
afterRender:    import(context.grafana.replaceVariables("${assets}") + "/kd.js")
                  .then(m => m.applyTheme(context.element, context.grafana.theme))
```

`afterRender` runs on every re-render and `applyTheme` is idempotent, so switching Grafana's theme restyles the panel. Code with no `context.grafana.theme` calls `followTheme(element)` instead: it reads the live theme from Grafana's runtime and follows a theme switch.

Every panel imports what it needs itself. The browser loads a URL once per page however many panels import it, and an element defined by one panel works in all of them.

**Feeding an element.** Elements draw from their `data` and nothing else, because Business Text recreates them whenever the panel's HTML changes. Push data in from `afterRender` on every render:

```
content:        <div class="kd"><kd-table></kd-table></div>
afterRender:    import(base + "/kd.js").then(m => {
                  m.applyTheme(context.element, context.grafana.theme)
                  context.element.querySelector("kd-table").data = { rows: context.data }
                })
```

Markup from a query can carry the data as a JSON attribute instead, escaped: `data="{{kdjson rows}}"` with the `kdjson` helper (`registerHelpers(context.handlebars)`), or `@json | @html` in Infinity jq. Never `{{{ }}}` JSON into an attribute.

Ready-made panels are in [`examples/`](examples).

## 🛠️ Develop

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Unreleased code is tried in Grafana by publishing a pre-release (a `pre*` bump in the 🧬 Publish Version workflow), which goes to npm under the `next` tag.
