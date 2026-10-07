# cdn: versioned static assets for Grafana panels

Date: 2026-10-07. Status: approved in chat with Dr K, awaiting review of this document.

## Problem

The homelab's Grafana dashboards are getting web-heavy: Business Text panels carry HTML,
CSS and JavaScript, and some import libraries (marked, dompurify, highlight.js) from
jsDelivr. Today the shared CSS and JS are inlined into every dashboard that uses them.
For example, a 12 KB `k8s-view.css` sits in each of the k8s-* dashboards, which is part
of why they reach 80–200 KB. The same CSS hard-codes dark-theme colours, so the views
look wrong in light mode, and each dashboard styles itself a little differently.

`kubed-io/cdn` is a public repo of static assets that panels load by URL, so dashboards
reference shared code instead of carrying copies. It is the companion of the
`grafana.krm.kubed.io` functions in krm-py (`docs/superpowers/specs/2026-10-07-grafana-krm-design.md`
there), which keep dashboard sources in git.

## Decisions

| # | Decision | By |
|---|---|---|
| C1 | Assets are served by jsDelivr's GitHub proxy from this public repo, not by GitHub Pages. | Dr K |
| C2 | Dashboards reference a version tag (`@vX.Y.Z`), never a branch. | recommended |
| C3 | Each dashboard holds the asset base URL in one hidden constant variable, `assets`, so a release is a one-line change per dashboard. | recommended |
| C4 | A theme layer maps Grafana's live theme onto CSS custom properties. Everything in this repo styles itself from those properties, never from hard-coded colours. | recommended |
| C5 | Stylesheets are scoped, because Business Text loads them into the whole page. | recommended |
| C6 | Plain CSS and ES modules first, with no build step. A framework (Svelte custom elements, Pico inside their shadow DOM) is a later, separate decision. | recommended |
| C7 | Releases follow the kubed-io pattern: `publish.yml` with `duplocloud/version-bump`, a dry run first, and the CHANGELOG rolled into the tag. | recommended |

## Facts this design rests on

Measured or read on 2026-10-07.

**Hosting.** Response headers, fetched with curl:

| URL form | Cache-Control | CORS |
|---|---|---|
| `cdn.jsdelivr.net/gh/<org>/<repo>@vX.Y.Z/<file>` or `@<sha>` | `max-age=31536000, immutable` | `Access-Control-Allow-Origin: *`, `Cross-Origin-Resource-Policy: cross-origin` |
| `cdn.jsdelivr.net/gh/<org>/<repo>@main/<file>` | `max-age=604800` (7 days in the browser), `s-maxage=43200` | `*` |
| GitHub Pages | `max-age=600`, and URLs carry no version | `*` |
| raw.githubusercontent | `max-age=300`, served as `text/plain` | `*` |

jsDelivr's other terms:
- It serves public repos only, up to 20 MB per file.
- A file at a tag or commit is cached permanently and cannot be replaced.
- A branch refreshes at the CDN every 12 hours. Purging is limited.

So a tag is the only URL form that is both cache-correct and immutable.

**Grafana.**
- Grafana 13.2.1 sends no Content-Security-Policy (`content_security_policy = false`), and the homelab sets `disable_sanitize_html = true`. Nothing blocks cross-origin scripts or styles.
- Turning CSP on later would break this design, because the default template allows only `'self'` styles.

**Business Text 6.3.0.** Grafana Labs' fork, current on the live instance.
- `externalStyles` takes URLs. They are run through `replaceVariables`, so `${assets}/…` works, and loaded as `<link>` tags in the document head, which makes them global to the page.
- External scripts were removed in 5.0. JavaScript loads modules with `import()` from `helpers` or `afterRender`.
- `afterRender` receives `context.element` and `context.grafana`, which includes `theme` (`GrafanaTheme2`) and `replaceVariables`. It runs again on every re-render.

**Grafana's theme.**
- Grafana exposes no theme CSS variables. `context.grafana.theme` is the reliable source.
- `window.grafanaBootData.user.lightTheme` holds only the saved preference.

**Pico CSS.** Even `pico.conditional.css` 2.1.1 styles `:root` and `*`, so it is safe only inside a shadow root.

**Repo state.** The repo is public and empty. It has no rulesets and no repo-level Actions variables.

## Layout

```
README.md            what is here, the URL convention, how to use it from a panel
CHANGELOG.md         Keep a Changelog; [Unreleased] rolls into each tag
grafana/
  theme.js           ES module: the theme layer
  theme.css          base styles built only on the theme's custom properties
.github/workflows/
  publish.yml        the release
```

New consumers get their own top-level directory beside `grafana/`. Nothing in a released
tag is ever renamed or deleted in place. A breaking change is a new path or a new major
version.

## The theme layer

**`grafana/theme.js`** exports one function, `applyTheme(element, theme)`.
- It sets custom properties on `element`, the panel's own root, never `:root`, from a `GrafanaTheme2`.
- It sets `data-theme="dark"` or `"light"` from `theme.isDark`.
- It is idempotent, because `afterRender` runs on every re-render.

The property contract below is this repo's public API and follows semver:

| Property | `GrafanaTheme2` source |
|---|---|
| `--kd-bg` | `colors.background.primary` |
| `--kd-bg-2` | `colors.background.secondary` |
| `--kd-canvas` | `colors.background.canvas` |
| `--kd-text` | `colors.text.primary` |
| `--kd-text-2` | `colors.text.secondary` |
| `--kd-text-dim` | `colors.text.disabled` |
| `--kd-link` | `colors.text.link` |
| `--kd-border` | `colors.border.weak` |
| `--kd-border-strong` | `colors.border.medium` |
| `--kd-primary`, `--kd-success`, `--kd-warning`, `--kd-error`, `--kd-info` | `colors.<name>.main` |
| `--kd-font`, `--kd-font-mono` | `typography.fontFamily`, `typography.fontFamilyMonospace` |
| `--kd-radius` | `shape.radius.default` |
| `--kd-space` | `spacing(1)` |

Each source path is checked against the live `GrafanaTheme2` during implementation. Any
path that differs is corrected in this table first.

**`grafana/theme.css`:**
- Every selector is scoped under the class `kd`, which the panel's root markup carries. There are no element-only, `*` or `:root` rules.
- Colours, fonts, radii and spacing come only from the `--kd-*` properties.
- It covers what more than one dashboard needs today: text, links, tables, badges, code and cards.

**How a panel uses it** (high-level):

```
externalStyles: ["${assets}/grafana/theme.css"]
content:        <div class="kd"> ... </div>
afterRender:    import(context.grafana.replaceVariables("${assets}") + "/grafana/theme.js")
                  .then(m => m.applyTheme(context.element, context.grafana.theme))
```

The dashboard defines `assets` as a hidden `ConstantVariable` whose value is
`https://cdn.jsdelivr.net/gh/kubed-io/cdn@vX.Y.Z`. With the krm-py functions this is a
plain v2 variable in `dashboard.yaml`, with no templating.

## Release

- **`publish.yml`** is dispatched by hand. Its inputs are `action` (patch, minor, major or a pre-release) and `push` (default false).
  - It mints the kubed.io GitHub App token through GCP workload identity, the same way `kubed-io/mopidy`'s `publish.yml` does.
  - `duplocloud/version-bump` rolls `CHANGELOG.md`, commits and tags on `main`, then creates the GitHub Release.
  - With `push=false` it is a dry run that changes nothing. Always run that first.
- **Before the first release, three settings are needed:**
  - **A base tag `v0.0.1` on the initial commit,** with no GitHub Release. `version-bump`'s first run 404s without it.
  - **Repo-level variables `GCP_WIF_PROVIDER` and `GCP_PROJECT`,** copied from a working kubed-io repo. The org variables read as empty in new repos.
  - **A ruleset bypass for the kubed.io App on `main`,** but only if a ruleset requiring pull requests is added. There is none today.
- **No build step.** The tag's tree is what jsDelivr serves. If a build step is ever added (C6), its output must be committed in the version commit, before the tag.

## Acceptance

1. **The tagged files are served correctly.** After the first real release, both `grafana/theme.js` and `grafana/theme.css` at `cdn.jsdelivr.net/gh/kubed-io/cdn@<tag>/` return 200, `cache-control: max-age=31536000, immutable`, `access-control-allow-origin: *`, and a JavaScript or CSS content type.
2. **The theme layer works in a real dashboard.** A probe dashboard in Grafana, with a unique title and deleted afterwards, holds one Business Text panel wired as above. In a real browser (selenium-flow):
   - the panel root has every `--kd-*` property set and `data-theme` matching Grafana's theme, in both the dark and the light theme;
   - a `.kd` table picks up the theme's colours;
   - no style leaks outside the panel. Compare Grafana's own chrome before and after the stylesheet loads.
3. **The README documents the convention:** the URL form, the `assets` variable, the property contract and the scoping rule.

## Out of scope

- **Moving existing dashboard CSS and JS here,** such as `k8s-view.css` and the `repo-*.js` helpers. Each comes over when its dashboard is rebuilt with the krm-py functions.
- **Svelte custom elements and Pico CSS,** and the build step they would need.
- **A custom domain or GitHub Pages.**
- **Images and icons.** Today's icons come from `cncf/artwork` and `simple-icons` on jsDelivr and can stay there.
