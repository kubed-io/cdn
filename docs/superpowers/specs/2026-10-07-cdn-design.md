# cdn: a versioned web-component kit for Grafana panels

Date: 2026-10-07. Status: round 2. Step 1 shipped as 0.0.3; steps 2-4 (the package side) are built on branch
`bundle` per `docs/superpowers/plans/2026-10-07-cdn-bundle.md`; the dashboard switch-overs follow the release.

This spec is deleted by the PR that completes this work; anything lasting moves to the README.

Round 1 (a theme layer as plain files served from git tags) was built on the `spec` branch but never released.
Round 2 replaces its delivery: an npm package written in TypeScript, served by jsDelivr's npm mirror, carrying
custom elements as well as the theme. Round 1's theme contract survives unchanged.

## Problem

The homelab's Grafana dashboards are web applications in disguise. Business Text panels carry HTML, CSS and
JavaScript, and none of it is shared - it is copied. A survey of the live instance on 2026-10-07 (65 dashboards,
16 library panels) found:

| What | Copies | Bytes |
|---|---|---|
| The k8s view stylesheet, in every Business Text panel's `styles` | 78 in 14 dashboards | 897 KB, 40% of all k8s dashboard JSON |
| The events Handlebars helpers (evhead, evtabs, evsum, evtable) | 26 in 13 dashboards | 102 KB |
| `common.jq` pasted into Infinity queries, building HTML server-side | 27 in 15 dashboards | about 256 KB |
| The `n8n-chat-tile` library panel's script | 1, linked from 14 dashboards | 50 KB, with no tests and no version |

The stylesheet hard-codes dark-theme colours with `.theme-light &` overrides, and every view styles its pills,
tabs, sheets and trees a little differently. Changing one widget means regenerating and republishing every
dashboard that copied it.

`kubed-io/cdn` becomes the one place this code lives: a public npm package of ES modules and custom elements,
loaded by URL from jsDelivr, pinned to an exact version by each dashboard. It is the companion of the
`grafana.krm.kubed.io` functions in krm-py, which keep dashboard sources in git.

## Decisions

| # | Decision | By |
|---|---|---|
| C1 | ~~Served from git tags via jsDelivr's GitHub proxy.~~ Superseded by C8. | Dr K |
| C2 | Dashboards pin an exact version, never a range or a branch. | recommended |
| C3 | Each dashboard holds the asset base URL in one hidden constant variable, `assets`. | recommended |
| C4 | A theme layer maps Grafana's live theme onto `--kd-*` custom properties; everything styles itself from those. | recommended |
| C5 | Styles never leak: components style inside their shadow root; light-DOM CSS is scoped under `.kd`. | recommended |
| C6 | ~~Plain files, no build step.~~ Superseded by C9. Pico CSS is dropped: the look is Grafana's own, through C4. | recommended |
| C7 | Releases follow the kubed-io pattern: `publish.yml` with `duplocloud/version-bump`, a dry run first, the CHANGELOG rolled into the tag. | recommended |
| C8 | The package is published to **npmjs.com** and served by jsDelivr's npm mirror (`cdn.jsdelivr.net/npm/...`). | Dr K |
| C9 | Source is **TypeScript**, built by CI into ES modules. | Dr K |
| C10 | `dist/` is **never committed**. CI builds it and `npm publish` ships it inside the package tarball. | Dr K |
| C11 | **One package, one version, several entry points** (`kd`, `openapi`, `k8s`, `n8n`) that share chunks. No all-in-one bundle. | Dr K + recommended |
| C12 | **As much as possible lives in the core (`kd`).** A domain entry (`k8s`, `n8n`) adds behaviour and data mapping, not look: it defines no colours, no tokens and no general-purpose widgets. | Dr K |
| C13 | Components are **custom elements built with Lit**, with shadow DOM. | recommended |
| C14 | Components are **stateless renderers**: data is pushed in from the panel on every render; nothing lives only in an element. | recommended (from the probe) |
| C15 | **Each panel imports the entry it needs itself.** There is no "deps panel". | recommended (from the probe) |
| C16 | **Queries return data, not HTML.** Rendering moves from Infinity jq into the elements; jq only selects and reshapes. | recommended |
| C17 | **The OpenAPI schema viewer is a first-class, domain-free entry** (`openapi`), the start of a family of schema tools. | Dr K |
| C18 | **No secret ever enters this repo.** Credentials (the n8n Basic auth header) stay in Grafana and are passed in at mount time. | recommended |

## Facts this design rests on

Measured or read on 2026-10-07.

**Panels share one page.** A probe dashboard (uid `probe-wc-e016f4`, since deleted) driven in Chrome on Grafana
13.2.1 with Business Text 6.3.0 showed:

- Every panel shares one `window`, one `customElements` registry and one ES module map. N panels importing the
  same URL execute the module once. Markup rendered before its tag is defined upgrades the moment it is defined,
  in any panel, in either order.
- Custom tags survive Business Text's Handlebars and Markdown passes and the core `text` panel. The HTML
  sanitizer is off (`disable_sanitize_html = true`) and there is no Content-Security-Policy.
- Shadow DOM works. `--kd-*` properties set on the panel root inherit into shadow roots; a `>` selector in a
  shadow stylesheet works (a content `<style>` has its `>` escaped); Grafana's legacy global `.badge` does not reach in.
- `afterRender` has the real `window` and `document`; only the helpers editor hides them. Business Text content
  does not substitute `${var}`.
- A definition persists across SPA navigation. A second `customElements.define` of the same name throws; with a
  guard, **the first version loaded owns the tag until a full page reload**.
- Panels in a collapsed row or a closed tab are not in the DOM and their `afterRender` does not run.
- When a panel's rendered HTML changes (new data, a variable), every element in it is recreated and its state is
  lost. When the HTML is unchanged the elements are kept. `afterRender` runs twice per refresh.
- Data in: setting a property from `afterRender` (`el.rows = context.data`) is clean. A JSON attribute works when
  double-stashed through a helper (`data="{{kdjson data}}"`); triple-stashed, one `'` turns the tag into text.
- The theme is reachable without `afterRender`: `System.import('@grafana/runtime')` gives `config.theme2`, and
  `getAppEvents()` emits `ThemeChangedEvent` on a live switch. The `<body>` `theme-dark`/`theme-light` class goes
  **stale** on a live switch and must not be used.
- The core `text` panel executes inline `<script type="module">` on every mount.

**npm and jsDelivr.**

| URL form | Cache-Control |
|---|---|
| `cdn.jsdelivr.net/npm/<pkg>@<exact version>/<file>` | `max-age=31536000, immutable` |
| `cdn.jsdelivr.net/npm/<pkg>@<range>/<file>` | `max-age=604800`, `s-maxage=43200` |

Both send `access-control-allow-origin: *` and a JavaScript content type. jsDelivr mirrors the public npm
registry only, so GitHub Packages is not an option.

- Dr K created the npm organisation `kubed.io` on 2026-10-07, so the scope is `@kubed.io`. It has no packages yet.
- npm trusted publishing (OIDC from GitHub Actions, no token, provenance attached) can only be configured for a
  package that already exists, so **the first version is published by hand**.
- Current versions: lit 3.3.3, TypeScript 7.0.2, Vite 8.3.3, Vitest 5.0.3, happy-dom 20.14.5, `@n8n/chat`
  1.41.3 (the tile pins 1.39.2). Node 24 and npm 11 are in the pod.
- `duplocloud/version-bump` (Dr K's action) takes an explicit version and a `files` input, committed with the version
  commit. Without a tag it assumes the previous version is `0.0.1` and asks GitHub for notes since `v0.0.1`, hence
  the base tag.

**What the live code is made of** (the survey; raw dumps are scratch).

- The k8s view stylesheet has a 137-rule core identical to `kubed-io/grafana`'s `scripts/assets/k8s-view.css`,
  plus 0-2.1 KB of extras per view. k8s-workspace carries a third copy, scoped `.xw`.
- Recurring widgets across the k8s views: pill/badge, title bar, property sheet, label groups, annotation tree,
  YAML viewer, kind link with icon and back chain, CSS radio tabs (positional rules stop at 8 tabs), events table,
  resource meter, condition stepper, state stripe, secret mask. All are built as HTML inside Infinity jq.
- The schema viewer: k8s-crd and k8s-rd render OpenAPI v3 in jq (`schema.jq`, about 22 KB with `common.jq`):
  `$ref` and `allOf` resolution, kubectl-explain type names (`[]Container`, `map[string]string`), all 31 schema
  keywords found across the cluster's 155 CRDs, Kubernetes extensions as tags, CEL validations, a depth guard.
  Prometheus' CRD is about 890 KB of HTML and 1,800 fields.
- `n8n-chat-tile` is a core `text` panel: about 190 B of markup, 4 KB of CSS and 22 KB of JS once comments are
  removed. All of it is generic except one config block (the `chat_*` constants) and the auth header.

## The package

**Name:** `@kubed.io/cdn` (the org's scope, the repo's name). Dr K may rename it before the first publish; it cannot change after.

**Layout:**

```
package.json        name, version, exports per entry, files: ["dist"]
tsconfig.json
vite.config.ts      library mode, one entry per domain, ES output, shared chunks
src/
  kd/               core: theme, tokens, base CSS, scene helpers, generic elements
  openapi/          schema model + schema elements
  k8s/              Kubernetes mapping: kinds, icons, links, events, conditions
  n8n/              the chat tile
test/               Vitest + happy-dom, one folder per entry
dist/               build output, gitignored, shipped in the tarball
```

**Entry points** (high level; each is one ES module plus, where it has one, a light-DOM stylesheet):

| Entry | Gives | Imports |
|---|---|---|
| `dist/kd.js`, `dist/kd.css` | `applyTheme`, self-theming, the scene helpers, every generic element | lit |
| `dist/openapi.js` | the schema model and `kd-schema` | kd |
| `dist/k8s.js` | k8s data mapping and the few k8s-only elements | kd |
| `dist/n8n.js` | `mount(config)` for the chat tile; its page-global stylesheet is a string it injects once | kd; `@n8n/chat` at runtime |

Shared code (lit, the theme, the base element) lands in shared chunks under `dist/chunks/`, imported by relative
URL. A panel that loads `k8s.js` and another that loads `openapi.js` share one copy, because the module map is
keyed by URL (fact above). An all-in-one bundle is not offered: it would pull `@n8n/chat`'s loader into every
k8s panel and save nothing, since every entry is one import away.

**Dependencies:** lit is bundled into the shared chunk, so the version is ours. `@n8n/chat` is not bundled: the
`n8n` entry imports it at runtime from jsDelivr at a version pinned in the module (overridable in the config),
from its `dist/` build (the root build lacks the stream reader and the `.chat-inputs` rules).

## The core (`kd`)

C12 makes this the bulk of the package. A domain entry that needs a new look adds it here, generically.

**Theme.** Round 1's contract stands: `applyTheme(element, theme)` sets the `--kd-*` properties and `data-theme`
on the panel root; the property table is public API under semver. Round 2 adds self-theming: an element with no
themed ancestor reads `config.theme2` through `System.import('@grafana/runtime')` and follows
`ThemeChangedEvent`, so a component works even where nobody calls `applyTheme`. Every element's shadow
stylesheet reads only `--kd-*`, each with a fallback.

**`kd.css`.** Round 1's `theme.css`: base light-DOM styles for markup inside `<div class="kd">` (text, links,
tables, code, cards). Everything is scoped under `.kd`; there are no element-only, `*` or `:root` rules.

**Scene helpers.** The page-level code the chat tile, Torrent and k8s-explorer each carry today: the dashboard
scene, variables (read and set, respecting option lists), the time range (read raw and ISO, move in one call),
the refresh picker (offered intervals, snapping), the row/tab tree and focusing a panel, and fitting a panel's
grid height to its content.

**Generic elements** (names are illustrative; the implementer settles the attribute and property shapes):

| Element | Replaces | Data |
|---|---|---|
| `kd-pill` | pills and badges, condition badges | text, tone (`success`/`warning`/`error`/`info`/neutral), tooltip |
| `kd-bar` | the k8s title bar, the app masthead | icon, eyebrow, title, chips, a breadcrumb chain |
| `kd-sheet` | property sheets | key/value rows, values may be elements |
| `kd-groups` | label groups and the annotation tree | a string map, grouped by prefix; JSON values fold into `kd-data` |
| `kd-data` | the YAML viewer and JSON-in-annotations | any JSON value, shown as YAML, folded past a length |
| `kd-tabs` | CSS radio tabs (any number of tabs) | tab labels with counts, slotted panes |
| `kd-meter` | the resource meter | a value against one or more marks (request, limit) |
| `kd-steps` | the condition stepper, the state stripe | ordered steps with status and time |
| `kd-table` | the events table and other small HTML tables | rows and column definitions |
| `kd-mask` | the secret mask | a value revealed on demand |
| `kd-link` | kind links, dashboard links with a back chain | target dashboard, variables, label, icon |
| `kd-tile` | the chat tile's header link | icon, label, link |

**Element rules** (from the probe):

- **Stateless.** An element renders from its properties and nothing else. `afterRender` pushes data in every time
  (`el.rows = context.data`); it must be idempotent because it runs twice per refresh.
- **Two ways in.** Properties from `afterRender` are preferred. For markup produced by a query, an element also
  accepts its data as a JSON attribute; the package ships a `kdjson` Handlebars helper (double-stash safe) and
  documents the jq escaping (`@html`, and no blank lines, because Markdown runs over the content).
- **Guarded definitions.** Every element registers through one helper that skips a name already defined and logs
  a console warning naming both versions. Each element class exposes the package version.
- **Breaking changes get a new tag name.** Within a name, attributes and properties only grow. Because the first
  version loaded owns a tag for the whole page session, an older bundle must keep rendering newer markup sensibly.
- **No light-DOM side effects.** An element touches only its own shadow root, except the n8n mount, which owns
  its `#n8n-chat` node on `<body>` by design.

## The OpenAPI entry (`openapi`)

The schema viewer is generic (C17): it knows OpenAPI v3 and JSON Schema, and treats Kubernetes' `x-kubernetes-*`
extensions as known keywords because they are OpenAPI extensions, not because it knows Kubernetes.

**Schema model.** A normaliser turns a document plus a root (a component name, or a CRD version's
`openAPIV3Schema`) into a tree of nodes: `$ref` resolved within the document, `allOf` merged, recursion detected
and cut with a "see above" reference rather than a depth limit, and a display type for every node in kubectl
explain's spelling. Every keyword the jq renders today is carried; an unknown keyword lands under "other" with its
raw value. The model is plain data with no DOM, so later tools reuse it.

**`kd-schema`.** Renders the model as today's view does (field, type, constraints, required marker, description,
enum, defaults, CEL rules, extensions as tags), with lazy expansion: a subtree is rendered when it is opened.
That is what makes an 1,800-field CRD cheap. It takes the document and root as properties, or a URL to fetch
(an Infinity proxy URL, so the panel needs no query).

**Later tools** (out of scope for this round, designed for): a viewer that takes a schema and a data object and
displays the data guided by the schema (descriptions on hover, enums, formats, keyed lists as tables), and after
that an editor. Both stand on the same schema model, which is why the model is its own module.

## The Kubernetes entry (`k8s`)

Small by rule (C12). It holds what only Kubernetes knows:

- the kind → icon map (today duplicated between jq `kicon` and the `k8s-resources` library panel), with icon
  URLs pinned to commits, not `@main` or `@latest`;
- links to the k8s-* dashboards (`kd-link` targets) and the back chain;
- mapping an object to generic elements: conditions to `kd-steps`, requests and limits to `kd-meter`,
  labels and annotations to `kd-groups`, owner references to a breadcrumb chain;
- the events rendering (Loki kube events folded into `kd-table` and a tab count), replacing the Handlebars helpers;
- `k8s.css` holding layout specific to the k8s views, if any remains. It holds **no colour literals and no
  `--kd-*` definitions**, enforced by a test.

The k8s views then stop building HTML in jq (C16). A query returns the API object (or a reshaped slice of it);
the panel's content is a few elements, and `afterRender` hands them the data.

## The n8n entry (`n8n`)

`mount(config)` does what the chat tile's 22 KB script does today: the head stylesheet, the `#n8n-chat` bubble,
the navigation watcher that removes it when you leave the dashboard, fitting it to the controls row, live metadata
getters, the stream filter that turns the agent's dashboard-state chunks into variable changes, applying only the
`chat_settable` names in order, the state card, and cleaning the loaded history. `mount` is idempotent, because
the core text panel re-runs its script on every mount.

The library panel keeps only: the tile markup (or a `kd-tile`), a short module script that reads the `chat_*`
constants and calls `mount`, and the Basic auth header (C18). Its size drops from 50 KB to under 1 KB.

## How a panel uses it

The dashboard's hidden constant `assets` is `https://cdn.jsdelivr.net/npm/@kubed.io/cdn@X.Y.Z/dist`. All
dashboards should move to a new version together (one shared variable file embedded by each krm-py dashboard
source), because the first version loaded owns each tag for the page session.

Business Text, high level:

```
externalStyles: [{ id: "kd", url: "${assets}/kd.css" }]   # objects: a bare string never loads
content:        <div class="kd"><kd-schema></kd-schema></div>
afterRender:    const base = context.grafana.replaceVariables("${assets}")
                import(base + "/openapi.js").then(m => {
                  m.applyTheme(context.element, context.grafana.theme)
                  context.element.querySelector("kd-schema").document = context.data[0]
                })
```

## Build, test and release

**Build.** Vite in library mode compiles TypeScript into `dist/`: one ES module per entry, shared chunks, the
CSS files, and type declarations. `dist/` is gitignored and listed in `package.json` `files`, so it exists only in
the tarball.

**Test.** `test.yml` runs `npm ci`, a type check, and Vitest with happy-dom (elements render from properties and
from JSON attributes, re-render idempotently and survive a second definition; the schema model against fixtures
from real CRDs and the cluster's OpenAPI v3), plus the scoping and no-colour checks on every stylesheet.

**Package.** `package.yml`, like krm-py's, builds and `npm pack`s the tarball, checks that every entry is in it and
loads with the right version, uploads it as an artifact, and reports sizes per file. It runs on pull requests, on
`main`, and from `publish.yml` with the release tag.

**Release.** `publish.yml` is the same manual flow as krm-py and selenium-flow: `workflow_dispatch` with `action`
(patch, minor, major or a pre-release) and `push` (false first, for a dry run). Nothing publishes on a push to `main`.

1. **test**: `test.yml`.
2. **version**: `package.json` is the source of truth, as in `duplocloud/version-bump`'s own `publish.yml`.
   `npm version <action> --no-git-tag-version` computes the next version and rewrites `package.json` and the
   lockfile; `version-bump` is handed that exact version and commits both (its `files` input) with the rolled
   CHANGELOG, then tags. The App token comes from the org's `GH_CLIENT_ID` and `GH_APP_KEY`.
3. **package**: `package.yml` at the new tag.
4. **npm**: publishes that tarball with `--provenance`, tokenless through npm trusted publishing (`id-token: write`,
   the `npm` environment). Pre-release versions go under the `next` dist-tag, never `latest`.
5. **release**: the GitHub Release on the tag, with the tarball attached and the jsDelivr URL of every entry.

The tag exists before the package does. If the npm job fails, it is re-run; it publishes the artifact already
built from the tag and never re-tags.

**Pre-releases are the dev loop.** Nothing in git is servable any more (no committed `dist/`), so trying
unreleased code in a real Grafana means publishing a pre-release (`0.2.0-rc.0` under `next`) and pointing a probe
dashboard's `assets` at it. Pre-release versions are as immutable as any other.

**Before the first release:**

- Dr K publishes the first version (`0.0.1`, an empty placeholder or
  the first build) by hand with `npm publish --access public`.
- On npmjs.com, the package gets a trusted publisher: repo `kubed-io/cdn`, workflow `publish.yml`, environment `npm`.
- The repo gets the base tag `v0.0.1` on its initial commit, an `npm` environment, and the labels `dependencies`,
  `javascript`, `github-actions` and `no changelog`. The version job mints the kubed.io App token from the org's
  `GH_CLIENT_ID` variable and `GH_APP_KEY` secret, which reach public repos, so no repo-level GCP variables.
- Dependabot gains the `npm` ecosystem.

## Rollout

Each step is shippable on its own and is checked live before the next.

1. **The package.** TypeScript, Vite, Vitest, the CI, the npm prerequisites. Round 1's theme layer ported to
   `kd` unchanged in behaviour, plus self-theming. First pre-release.
2. **The chat tile** (`n8n`). One library panel edit moves 14 dashboards, which is the largest reach for the
   smallest change, and the code is already isolated.
3. **The schema viewer** (`openapi`), first on k8s-rd, then k8s-crd. Both views' schema panels switch from jq
   HTML to `kd-schema`.
4. **The generic elements and `k8s`**, one k8s view at a time, starting with the stylesheet: each view drops its
   copied `styles` for `kd.css` (and `k8s.css` if needed), then its jq HTML for elements.

## Acceptance

1. **Served correctly.** Every entry and chunk of a release at `cdn.jsdelivr.net/npm/@kubed.io/cdn@<version>/dist/`
   returns 200, `max-age=31536000, immutable`, `access-control-allow-origin: *` and a JavaScript or CSS content
   type. The package page shows provenance from `kubed-io/cdn`'s `publish.yml`.
2. **Theme in a real dashboard.** A probe dashboard (unique title, deleted afterwards) checked in a real browser
   with selenium-flow: every `--kd-*` property and `data-theme` set in both themes; an element with no
   `applyTheme` ancestor follows a live theme switch; no style leaks into Grafana's chrome.
3. **Sharing.** On the probe, three panels importing two entries execute the shared chunk once, in any render order.
4. **Chat tile.** On one app dashboard, the tile and chat behave as before: the bubble leaves with the dashboard,
   variables the agent sets apply, the time range moves. The library panel is under 1 KB plus the auth header,
   and no credential exists anywhere in the repo or the package.
5. **Schema viewer.** k8s-rd and k8s-crd show every field and keyword they show today for a sample of kinds
   (Pod, Deployment, the Prometheus CRD), and the Prometheus CRD opens without a visible stall.
6. **Size.** Each migrated k8s view's dashboard JSON shrinks by at least the bytes of its copied stylesheet.
7. **The README documents** the URL form, the `assets` variable, each entry, the element rules, the theme
   contract and the release.

## Out of scope

- The schema-plus-data viewer and the editor (designed for; the next round).
- Moving the k8s and app dashboards themselves into krm-py sources.
- The repo dashboard's helpers, `marked`/DOMPurify and highlight.js (a later `kd` addition).
- A custom domain, GitHub Pages, or a Content-Security-Policy.
- Images and icons themselves; icons stay on `cncf/artwork` and `simple-icons`, pinned.
