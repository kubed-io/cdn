# cdn: the bundle round (plan)

Date: 2026-10-07. Implements rollout steps 2-4 of `docs/superpowers/specs/2026-10-07-cdn-design.md` in one PR
(branch `bundle`): the generic `kd` elements and scene helpers, the `openapi` entry, the `n8n` entry and the `k8s`
entry. Deleted with the spec when the round ships.

## What already exists (foundation, done first)

- `src/kd/element.ts`: `KdElement` (Lit, shadow DOM, self-theming when no ancestor has `data-theme`), `base` (the
  shared `:host` styles), `json` (the attribute converter), `themedAncestor`.
- `src/kd/define.ts`: `define(name, cls)`, the guarded registration; `VERSION`.
- `src/kd/helpers.ts`: `kdjson`, `registerHelpers(context.handlebars)`.
- Entries `src/{kd,openapi,k8s,n8n}/index.ts`, wired in `vite.config.ts`. Lit 3.3.3 is a bundled dependency.
- Reference material (gitignored, never commit): `stuff/ref/` - the chat tile split (`chat-tile/`, auth redacted),
  the k8s view CSS variants (`k8s-view/`), the events helpers (`events/`), `common.jq`, and raw v2 dashboards
  (`dash/`, e.g. `k8s-rd.json` panel-10 holds the schema jq).

## Rules every task follows

- **Lit without decorators.** `static override properties = { data: { attribute: 'data', converter: json } }` plus a
  `declare data: T;` field (a plain class field would shadow Lit's accessor, because `useDefineForClassFields`).
- **Every element extends `KdElement`**, puts `base` first in `static styles`, and registers itself at import with
  `define('kd-…', Class)` from its own module. Its entry's `index.ts` imports the module (side effect) and re-exports
  the class and its data types.
- **Main input is `data`** (property, or the JSON `data` attribute). Small scalar settings are attributes.
- **Stateless.** Render only from properties. UI state that must survive Business Text recreating the element (the
  selected tab) is kept in `sessionStorage` under a caller-given `key`, wrapped in try/catch.
- **Styles in the shadow root only**, from `--kd-*` with no colour literal anywhere (fallbacks are `inherit`,
  `currentColor` or `transparent`). Tones: `primary | success | warning | error | info | neutral` map to
  `--kd-<tone>`; neutral uses `--kd-text-2` and `--kd-border-strong`.
- **No `innerHTML` with data.** Text goes through Lit templates; never `unsafeHTML` on input.
- **Tests:** Vitest + happy-dom under `test/<entry>/`. Render from a property and from the attribute; re-render with
  new data; no colour literal in the element's styles (`test/kd/no-colour.test.ts` scans every `css\`` block in `src`).
- **2-space TypeScript, single quotes, semicolons**, comments only where they earn their lines.
- Run `npm run typecheck && npm test && npm run build` before calling a task done.

## The shared cell

`src/kd/cell.ts` (task 1) defines what a sheet row value or a table cell may be, and one `renderCell(cell)`:

```
Cell = string | number | boolean | null
     | { text: string, tone?: Tone, title?: string }          -> kd-pill
     | { href: string, text: string, icon?: string }          -> a link (kd-link when `dashboard` is given)
     | { dashboard: string, vars?: {..}, text, icon?, back? } -> kd-link
     | { data: unknown }                                      -> kd-data
     | { code: string }                                       -> monospace text
     | Cell[]                                                 -> inline, wrapped
```

## Task 1 - the generic elements (`src/kd/elements/`, owner: agent A)

| Element | `data` | Attributes | Notes |
|---|---|---|---|
| `kd-pill` | - (slot is the text) | `tone`, `title` | |
| `kd-bar` | `{icon?, eyebrow?, title, chips?: Cell[], chain?: Cell[]}` | | title bar / masthead; `icon` is a URL or an emoji; chain renders as a breadcrumb |
| `kd-sheet` | `{key, value: Cell}[]` or a plain object | | two-column property sheet |
| `kd-groups` | `Record<string,string>` | `mode`: `pills` (labels) or `tree` (annotations) | grouped by the prefix before `/`, unprefixed first without a header; a value that parses as a JSON object/array folds into `kd-data` |
| `kd-data` | any JSON value | `fold` (lines, default 10) | YAML view (own small dumper, block style, quotes only when needed); longer than `fold` collapses under a `<details>` "{ } n keys / [ ] n items" line |
| `kd-tabs` | - (children are panes: `<section label="…" count="…">`) | `selected`, `key` | any number of tabs; selection remembered per `key` |
| `kd-meter` | `{value, max?, unit?, marks?: {label, value, tone?}[]}` | | a value against request/limit-style marks |
| `kd-steps` | `{label, status: 'done'|'active'|'failed'|'pending'|Tone, time?, detail?}[]` | | stepper / state stripe |
| `kd-table` | `{columns: {key, label, align?}[], rows: Record<string, Cell>[]}` | `empty` | |
| `kd-mask` | - | `value` | hidden until clicked; never logged |
| `kd-link` | `{dashboard?, href?, vars?, text?, icon?, back?}` or attributes of the same names (`vars` as JSON) | | `/d/<dashboard>?var-k=v…`; `back` adds `var-back=<this dashboard uid + its vars>`; keeps the time range |
| `kd-tile` | - | `icon`, `label`, `href` | the chat tile's header link |

Also `src/kd/yaml.ts` (the dumper `kd-data` uses, exported) and `kd.css` stays as is.

## Task 2 - the scene helpers (`src/kd/scene.ts`, owner: agent C, with task 4)

Ported from the chat tile (`stuff/ref/chat-tile/chat-tile.js`) and k8s-explorer's fit-to-content afterRender
(`stuff/ref/dash/k8s-explorer.json`). Every function takes the page `Window` (from `element.ownerDocument.defaultView`)
or finds it from an element; none touches `window` at import.

- `scene(win)`: `__grafanaSceneContext` or null.
- `variable(win, name)`, `setVariables(win, values, allowed)`: dropdowns via `changeValueTo` with an option match,
  text boxes via `setValue`; `allowed` order is applied order.
- `timeRange(win)` (raw and ISO), `setTimeRange(win, from, to)` via `onTimeRangeChange({raw})` in one call.
- `refreshIntervals(win)`, `setRefresh(win, value)` snapping to the nearest offered interval on a log scale.
- `groups(win)` (rows and tabs with their `panel-N` keys), `focusPanel(win, id)` (open the group, scroll, retry over
  animation frames).
- `fitPanel(element, context)`: the grid-height fit (see `grafana-panel-fits-its-content` notes in the chat tile
  reference and the explorer's afterRender).

## Task 3 - `openapi` (`src/openapi/`, owner: agent B)

- `model.ts`: `normalize(document, root) -> SchemaNode`. `root` is a component name (`#/components/schemas/X` or
  `X`), a CRD version's `openAPIV3Schema`, or a schema object. `$ref` resolved within the document, `allOf` merged,
  recursion cut with a reference to the ancestor (no depth limit), kubectl-explain type names (`[]Container`,
  `map[string]string`, `Object`), every keyword kept: known ones typed, unknown ones under `other`. Kubernetes
  extensions (`x-kubernetes-*`) are known keywords. Pure data, no DOM, lazily expandable (children computed on
  demand) so an 1,800-field CRD is cheap.
- `kd-schema`: properties `document`, `root`, or attribute `src` (fetch a URL returning the document). Renders field,
  type, constraints beside the type, required marker, description, enum, default, CEL rules, extensions as tags with
  the why on hover; `spec`/`status` open, the rest closed; a subtree is rendered when opened. Matches the current
  k8s-rd/k8s-crd view (`stuff/ref/dash/k8s-rd.json` panel-10 jq is the reference for what is shown).
- Fixtures: the cluster's OpenAPI v3 for `apps/v1` and `v1` (`kubectl get --raw /openapi/v3/...`), and the
  Prometheus CRD (`kubectl get crd prometheuses.monitoring.coreos.com -o json`), trimmed only if huge, in
  `test/openapi/fixtures/`.

## Task 4 - `n8n` (`src/n8n/`, owner: agent C)

- `mount(config)`: everything `stuff/ref/chat-tile/chat-tile.js` does, in TypeScript, using the scene helpers from
  task 2. Idempotent (the core text panel re-runs its script on every mount). Config: the `chat_*` values (icon,
  label, link, webhook, title, subtitle, greeting, context, settable, groups), `auth` (the Authorization header value,
  passed in, never stored in the package), `chatVersion` (default `1.39.2`, the `@n8n/chat` build loaded at runtime
  from jsDelivr `dist/`).
- Styles in `src/n8n/styles.ts` as a string the mount injects once (page-global by design: the bubble lives on
  `<body>`), so there is no light-DOM `n8n.css`.
- `examples/n8n-chat-tile.html`: the new library panel content (a `kd-tile` + one module script reading the `chat_*`
  constants and calling `mount`), with the auth header as a placeholder.

## Task 5 - `k8s` (`src/k8s/`, owner: agent D, after task 1)

- `icons.ts`: kind -> icon URL, from `common.jq` `kicon` and the `k8s-resources` library panel, pinned to commits.
- `links.ts`: kind -> k8s-* dashboard and its variables (from `common.jq` nslink, wlref, mapref, volref, classref,
  saref, crdhref, rdhref), returning `kd-link` data.
- `map.ts`: `conditions(obj) -> kd-steps data`, `resources(container) -> kd-meter data`, `owners(obj) -> chain`,
  `labels(obj)`/`annotations(obj) -> kd-groups data`, `summary(obj) -> kd-sheet data`.
- `kd-k8s-ref` (a kind link with its icon) and `kd-k8s-events` (Loki kube-event frames -> a `kd-table` and a count,
  replacing the evhead/evtabs/evsum helpers in `stuff/ref/events/`).
- No colours and no `--kd-*` definitions; `k8s.css` only if layout remains that the elements do not cover.

## Task 6 - integration (owner: me)

- `vite.config.ts` entries, `package.json` `exports` for every entry, `package.yml`'s verify list, `publish.yml`'s
  `ASSETS`.
- `examples/`: one Business Text snippet per entry (schema viewer for k8s-rd, a k8s object page, the chat tile).
- README (entries, elements, rules, examples), CHANGELOG, the spec's "status".
- A live probe in Grafana 13.2.1 with selenium-flow: a throwaway dashboard (unique title, deleted afterwards)
  loading self-contained probe builds through `data:` URLs (`npm run build:probe`), checking theme in both modes,
  shared registration, each element rendering, `kd-schema` on a real CRD, and no style leak.

## Acceptance for the PR

Spec acceptance 2, 3, 5 (on the probe) and 7; typecheck, tests and build green; zizmor clean; the tarball holds every
entry. Acceptance 1, 4 and 6 follow the release, when the library panel and the k8s dashboards switch over.
