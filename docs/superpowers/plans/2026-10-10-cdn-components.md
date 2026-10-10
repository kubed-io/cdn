# cdn: round 4, components for every view (plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the generic components and styles the k8s views still hand-build: `kd-status`, `kd-card`,
`kd-reveal`, grid/mono sheets, row-header tables, `kd.css` utilities and time helpers in `kd`.

**Architecture:** Each addition is a Lit element or an option on one, in `src/kd/`, following the existing
element pattern. `k8s` only re-exports the time helpers and maps conditions onto `kd-status` checks.

**Tech Stack:** TypeScript, Lit 3 (no decorators), Vite 8 library build, Vitest + happy-dom.

**Spec:** `docs/superpowers/specs/2026-10-07-cdn-design.md`, section "Round 4: components for every view"
(C26-C32). Branch `components`. Deleted with the spec when the round ships.

## Global Constraints

- The bundle plan's rules still hold:
  - Lit with `static properties` + `declare`, never decorators;
  - `KdElement` + `base` + `define()`;
  - stateless renderers fed by `data` or properties;
  - 2-space TypeScript.
- Shadow styles take every colour from `--kd-*`, through `tones` for toned parts. `test/kd/no-colour.test.ts` fails on any
  hex colour, `rgb()` or named colour.
- `kd.css`:
  - every selector is scoped under `.kd`;
  - every colour value is `var(--kd-*)`, `transparent`, `inherit` or `currentcolor`, with no `color-mix()`
    (`test/styles.test.ts`).
- No per-kind mapping anywhere (C26).
- UI copy is terse: glyphs over words, no helper text.
- Each new tag joins `TAGS` in `test/kd/registered.test.ts` and is exported from `src/kd/index.ts`.
- Run everything with `npm test`, `npm run typecheck` and `npm run build`. CI uses `npm ci --ignore-scripts`.

## Review Focus

1. **Bad tones:** a `tone` or `ok` string that is not a tone (`"Running"`, `"ok"`) falls back to neutral, never throws
   and never drops the badge. (Task 1, Task 2)
2. **Masks in other shadow roots:** `kd-reveal` reaches masks inside another element's shadow root, and leaves masks
   outside its container alone. (Task 5)
3. **Re-renders:** Business Text recreates elements, and `kd-reveal` must not leave masks shown in a container it no
   longer holds. A mask that connects after a reveal starts hidden. (Task 5)
4. **Fully empty sheets:** a grid sheet whose rows are all empty renders nothing, the same as list layout. (Task 3)
5. **Empty row headers:** a row-header column with an empty cell still renders a `<th>`, holding `blank`, so the rows
   stay aligned. (Task 4)

---

### Task 1: `kd-status`

**Files:**
- Create: `src/kd/elements/status.ts`
- Modify: `src/kd/index.ts`, `test/kd/registered.test.ts` (add `status`)
- Test: `test/kd/status.test.ts`

**Interfaces:**
- Produces:
  - `interface Check { label: string; ok?: boolean | null | Tone; when?: string; detail?: string }`;
  - `interface StatusData { headline?: Cell[]; checks?: Check[] }`;
  - `checkTone(ok: Check['ok']): Tone`: `true` gives success, `false` error, `null`/`undefined` warning, and a tone
    passes through; any other string gives neutral;
  - `class KdStatus` with `data: StatusData`, from the `data` JSON attribute or the property.
  - Exports from `src/kd/index.ts`: `KdStatus`, `checkTone`, `type Check`, `type StatusData`.

- [ ] **Step 1: Write the failing tests** in `test/kd/status.test.ts`, written like `steps.test.ts`:
  - `maps ok to tones and glyphs`. With checks `ok: true`, `false`, `null`, `'warning'`, `'info'` and `'Running'`:
    - each `.badge`'s class contains `success`, `error`, `warning`, `warning`, `info` and `neutral`, in that order;
    - each `.dot`'s text is `✓`, `✗`, `?`, `!`, `•` and `•`.
  - `shows detail under a failing check and as a tooltip on a passing one`:
    - a failing check's `.detail` text is its detail;
    - a passing check has no `.detail`, and its badge's `title` is the detail.
  - `renders the headline through renderCell`: `headline: [{ text: 'Running', tone: 'success' }, '2/3']` renders one
    `kd-pill` with `tone="success"`, and the text `2/3`.
  - `keeps the given order and the when`: the labels come out in input order, and `.when` holds `3m`.
  - `renders nothing without data`: for `undefined`, `{}` and `{ checks: [] }`, the shadow root has no `.headline` and
    no `.checks`.
  - `reads the data attribute`: `<kd-status data='{"checks":[{"label":"Ready","ok":true}]}'>` renders one `.badge`.

- [ ] **Step 2: Run** `npx vitest run test/kd/status.test.ts test/kd/registered.test.ts`. Expected: FAIL, the module
  and `kd-status` are missing.

- [ ] **Step 3: Implement**:
  - Markup: `.headline` (the cells, as `kd-sheet` renders them, with `cellStyles`), then `.checks`, a wrapping flex row
    of `.badge.<tone>`, each holding `.dot`, `.label`, an optional `.when` and an optional `.detail`.
  - Glyphs: `✓` for success, `✗` for error, `?` for `ok` null or undefined, `!` for an explicit `'warning'`, and `•`
    for anything else.
  - Look, the `.cbadge` design, using `tones`:
    - the dot is filled with `var(--tone)` and its glyph is `var(--kd-bg)`;
    - an error badge's border is `var(--tone-line)`;
    - `.when` and `.detail` are `var(--kd-text-2)`.

- [ ] **Step 4: Run** the same command. Expected: PASS, and `test/kd/no-colour.test.ts` passes.

- [ ] **Step 5: Commit**: `cdn: kd-status, a headline and toned check badges for the health of anything`.

### Task 2: `kd-card`

**Files:**
- Create: `src/kd/elements/card.ts`
- Modify: `src/kd/index.ts`, `test/kd/registered.test.ts` (add `card`)
- Test: `test/kd/card.test.ts`

**Interfaces:**
- Consumes: `tone()`, `tones` and `renderIcon()` from `src/kd/parts.ts`; `renderCell` and `cellStyles` from
  `src/kd/cell.ts`.
- Produces:
  - `interface CardData { name?: string; icon?: string; tone?: Tone; cells?: Cell[]; state?: string; message?: string }`;
  - `class KdCard` with `data: CardData` and a default `<slot>`.
  - Exports: `KdCard` and `type CardData`.

- [ ] **Step 1: Write the failing tests** in `test/kd/card.test.ts`:
  - `draws the accent and dot only with a tone`:
    - `{ name: 'app', tone: 'error' }` gives an `article.card.error` with a `.dot`;
    - `{ name: 'app' }` gives no `.dot`, and an `article` class of exactly `card`;
    - `{ tone: 'Running' }` gives no `.dot`.
  - `renders name, icon, cells, state and message`:
    - `.name` is `app`;
    - a `{ text: 'v1.2', tone: 'info' }` cell renders as a `kd-pill`;
    - `.state` is `Waiting` and `.message` is `ImagePullBackOff`.
  - `projects its body`: `<kd-card><p id="b">x</p></kd-card>` gives a `slot` whose `assignedElements()` contains `#b`.
    This holds even when there is no data.
  - `leaves out an empty header`: with neither a `name` nor `cells`, there is no `.head`.

- [ ] **Step 2: Run** `npx vitest run test/kd/card.test.ts test/kd/registered.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement**:
  - Tone: `tone(data.tone, …)` counts only a real tone; any other string means no tone.
  - Markup: `<article class="card {tone}">`, holding:
    - a `.head` (dot, icon, name, cells), present only when there is a `name` or `cells`;
    - a `.state` line in `var(--tone-ink)`, with `.message` under it;
    - then `<slot>`.
  - Look:
    - border `1px solid var(--kd-border)` and radius `var(--kd-radius)`;
    - a toned card gets `border-left: 4px solid var(--tone)`;
    - padding `calc(var(--kd-space, 8px) * 1.25) calc(var(--kd-space, 8px) * 1.75)`.

- [ ] **Step 4: Run** the same command. Expected: PASS.

- [ ] **Step 5: Commit**: `cdn: kd-card, a bordered block with a tone accent, a header, a state line and a body slot`.

### Task 3: `kd-sheet` grid layout and mono keys

**Files:**
- Modify: `src/kd/elements/sheet.ts`
- Test: `test/kd/sheet.test.ts` (append)

**Interfaces:**
- Produces:
  - `SheetRow` gains `wide?: boolean`;
  - `KdSheet` gains `layout` (attribute, `'list' | 'grid'`, default `'list'`) and `mono` (a boolean attribute, reflected).

- [ ] **Step 1: Append the failing tests**:
  - `lays rows out as label-over-value tiles`. With `layout="grid"` and the rows `A`, an empty `B`, and `C` with
    `wide: true`:
    - there are two `.grid > .cell` elements;
    - their `.label` texts are `['A', 'C']`;
    - the second has class `wide`.
  - `renders nothing when every row is empty`: a grid layout whose rows are all empty has no `.grid`.
  - `sets keys in monospace`: with `mono`, the `dl` has class `mono`.
  - The existing list tests stay unchanged.

- [ ] **Step 2: Run** `npx vitest run test/kd/sheet.test.ts`. Expected: the new tests FAIL.

- [ ] **Step 3: Implement**:
  - Grid: `.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px 24px }`;
    `.label` is 10px, uppercase, `letter-spacing: .08em`, in `var(--kd-text-2)`; `.wide { grid-column: 1 / -1 }`.
  - Mono: `.mono dt` takes `var(--kd-font-mono)` at 12px, in `var(--kd-text)`.

- [ ] **Step 4: Run** the same command. Expected: PASS.

- [ ] **Step 5: Commit**: `cdn: kd-sheet lays out as a tile grid and can set its keys in monospace`.

### Task 4: `kd-table` row headers and a blank placeholder

**Files:**
- Modify: `src/kd/elements/table.ts`
- Test: `test/kd/table.test.ts` (append)

**Interfaces:**
- Produces: `TableColumn` gains `header?: boolean`, and `KdTable` gains `blank` (attribute, default unset).

- [ ] **Step 1: Append the failing tests**:
  - `renders a header column as row headers`. With `columns: [{ key: 'name', header: true }, { key: 'cpu' }]`:
    - each `tbody tr`'s first cell is a `th[scope="row"]`;
    - the second cell is a `td`.
  - `fills empty cells with blank`. With `blank="·"` and rows holding `''`, `null`, missing keys and `[]`:
    - every one of those cells has the text `·`;
    - an empty header cell is still a `th` holding `·`.
  - `leaves empty cells empty without blank`: their text is `''`.

- [ ] **Step 2: Run** `npx vitest run test/kd/table.test.ts`. Expected: the new tests FAIL.

- [ ] **Step 3: Implement**:
  - Empty cells: use `isEmpty` from `cell.ts` to decide.
  - Header cells: `th[scope=row]` has a font weight of 600 and `white-space: nowrap`.
  - Blank text: `var(--kd-text-dim)`.

- [ ] **Step 4: Run** the same command. Expected: PASS.

- [ ] **Step 5: Commit**: `cdn: kd-table takes row-header columns and a placeholder for empty cells`.

### Task 5: `kd-reveal`

**Files:**
- Create: `src/kd/elements/reveal.ts`
- Modify: `src/kd/elements/mask.ts`, `src/kd/index.ts`, `test/kd/registered.test.ts` (add `reveal`)
- Test: `test/kd/reveal.test.ts`

**Interfaces:**
- Produces:
  - `revealAll(container: Node, shown: boolean): number`, exported from `mask.ts`. It sets `shown` on every connected
    `kd-mask` inside `container`, looking through shadow roots by walking `parentNode`, and `ShadowRoot.host` across
    them, as `themedAncestor` does. It returns how many masks it changed.
  - `class KdReveal` with state `shown`.
  - Exports: `KdReveal` and `revealAll`.

- [ ] **Step 1: Write the failing tests** in `test/kd/reveal.test.ts`:
  - `reveals every mask in its parent, through shadow roots`:
    - setup: a `div#box` holding a `kd-reveal`, a `kd-mask value="a"`, and a `div` whose open shadow root holds a
      `kd-mask value="b"`; a third `kd-mask value="c"` sits outside `#box`;
    - clicking the reveal's `button` shows both masks' `code` (`a` and `b`), and `c` stays dots.
  - `hides them again`: a second click returns all to dots, and the button's `aria-pressed` goes `true`, then `false`.
  - `does not stop single masks toggling`: after a reveal, clicking one mask's hide button hides only that mask.
  - `a mask connected later starts hidden`: after a reveal, a newly appended `kd-mask` in `#box` shows dots.
  - `never copies a value out`: after a reveal, no attribute on the reveal or the masks contains `a`, apart from the
    masks' own `value`.

- [ ] **Step 2: Run** `npx vitest run test/kd/reveal.test.ts test/kd/mask.test.ts test/kd/registered.test.ts`. Expected:
  FAIL.

- [ ] **Step 3: Implement**:
  - `mask.ts`: keep a module-level `Set<KdMask>`, added to in `connectedCallback` and removed in
    `disconnectedCallback`; `revealAll` walks that set.
  - `kd-reveal`: renders one `button` with `aria-label="show all"` and `aria-pressed`, holding an eye glyph (`◉` when
    shown, `○` when not). A click flips `shown` and calls `revealAll(this.parentNode, shown)`; when the parent is a
    `ShadowRoot`, it uses that root.

- [ ] **Step 4: Run** the same command. Expected: PASS, including the existing `mask.test.ts`.

- [ ] **Step 5: Commit**: `cdn: kd-reveal shows or hides every masked value in its container at once`.

### Task 6: `kd.css` layout and text utilities

**Files:**
- Modify: `src/kd/kd.css`
- Test: `test/styles.test.ts` (append)

**Interfaces:**
- Produces these classes for light-DOM markup under `.kd`:
  - `.cols`: grid, `repeat(auto-fill, minmax(420px, 1fr))`, gap `0 12px`;
  - `.tiles`: grid, `minmax(260px, 1fr)`, gap `12px`;
  - `.parts`: grid, `minmax(380px, 1fr)`, gap `0 28px`;
  - `.part`: `border-top: 1px dashed var(--kd-border)`, `margin-top: 12px`, `padding-top: 8px`;
  - `h3`: 13px, weight 500, uppercase, `letter-spacing: .08em`, `var(--kd-text-2)`;
  - `.label`: 10px, uppercase, `var(--kd-text-2)`;
  - `.mono`: `var(--kd-font-mono)`, 12px;
  - `.sub`: 11px, `margin-top: 2px`;
  - `.none`: `var(--kd-text-dim)`, `padding: 8px 0`.

- [ ] **Step 1: Append the failing test**:
  - `ships the layout and text utilities`: the parsed selectors include `.kd .cols`, `.kd .tiles`, `.kd .parts`,
    `.kd .part`, `.kd h3`, `.kd .label`, `.kd .mono`, `.kd .sub` and `.kd .none`.

- [ ] **Step 2: Run** `npx vitest run test/styles.test.ts`. Expected: the new test FAILs.

- [ ] **Step 3: Implement** the rules in `kd.css`, in a `/* Layout */` block and a `/* Text */` block.

- [ ] **Step 4: Run** the same command. Expected: PASS, including the scoping and colour tests.

- [ ] **Step 5: Commit**: `cdn: kd.css adds column, tile and part layouts and small text utilities`.

### Task 7: time helpers in `kd`; conditions as `kd-status`

**Files:**
- Create: `src/kd/time.ts`
- Modify: `src/kd/index.ts`, `src/k8s/map.ts` (`duration`, `age` and `conditions`), `src/k8s/index.ts`,
  `src/k8s/elements/object.ts`
- Test: `test/kd/time.test.ts`, `test/k8s/map.test.ts`, `test/k8s/elements.test.ts`

**Interfaces:**
- Consumes: `Check`, `KdStatus` and the `kd-status` tag from Task 1.
- Produces:
  - `duration(seconds: number): string` and `age(iso, now?)`, moved verbatim from `map.ts` into `src/kd/time.ts` and
    exported from `kd`. `k8s` re-exports the same functions, so `k8s.age === kd.age`.
  - `conditions(obj): Check[]`:
    - `ok` is `conditionOk(c)`;
    - `when` is the current `+duration` from creation;
    - `detail` is `because(c)` whenever it exists;
    - the order is as today.

- [ ] **Step 1: Write the failing tests**:
  - `test/kd/time.test.ts` moves the `duration`/`age` cases out of the k8s tests, importing from `src/kd`, plus one
    test that `k8s.age === kd.age` and `k8s.duration === kd.duration`.
  - In `map.test.ts`, the `conditions` expectations change to the `Check` shape:
    - `status: 'done'` becomes `ok: true`, `'failed'` becomes `ok: false`, and `'warning'` becomes `ok: null`;
    - `time` becomes `when`.
  - In `elements.test.ts`, the two `kd-steps` assertions on `kd-k8s-object` become `kd-status`. The data is
    `{ checks }`; with no conditions there is no `kd-status`.

- [ ] **Step 2: Run** `npx vitest run test/kd/time.test.ts test/k8s`. Expected: FAIL.

- [ ] **Step 3: Implement**:
  - Move the two helpers.
  - `map.ts` imports them from `../kd/time`.
  - `conditions()` builds `Check[]`.
  - `object.ts` imports `../../kd/elements/status` and renders `<kd-status .data=${{ checks }}>`.
  - `object.ts`'s doc comment says "the conditions as status badges".

- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit**: `cdn: age and duration live in kd; kd-k8s-object shows conditions with kd-status`.

### Task 8: integration and proof

**Files:**
- Create:
  - `examples/kd-status.yaml`: a Business Text panel, hand-built `StatusData`, no k8s import;
  - `examples/kd-card.yaml`: a card holding a grid `kd-sheet`, a row-header `kd-table` with `blank="·"`, and two
    `kd-mask`s under a `kd-reveal`, wrapped in `.kd .cols`;
  - `.npmrc`.
- Modify: `README.md` (the elements table and the `kd.css` paragraph), `CHANGELOG.md` (`[Unreleased]`, one short line
  per addition, and a **Changed** line for `conditions()`).

- [ ] **Step 1: Harden npm.** Write `.npmrc` with `ignore-scripts=true`, `allow-git=none` and `min-release-age=3` (the
  kb `check-npm` audit; the only install script in the lockfile is the macOS-only optional `fsevents`). Run
  `rm -rf node_modules && npm ci`. Expected: it succeeds with no warning about an unknown config key, and `npm test`
  passes.
- [ ] **Step 2: Write the examples.** Shape them on `examples/k8s-object.yaml`: v2 `Panel`, the `assets` constant, and an
  afterRender of a few lines.
- [ ] **Step 3: Update the README and CHANGELOG.**
- [ ] **Step 4: Run the full check**: `npm run typecheck && npm test && npm run build`. Expected: all green;
  `dist/kd.js` builds and `test/dist/tarball.test.ts` passes.
- [ ] **Step 5: Probe live.**
  - Run `npm run build:probe`.
  - Create a throwaway dashboard with a unique title, `cdn round 4 probe <date>`. Load `dist-probe/kd.js` and `k8s.js`
    through data: URLs into the two examples' panels, plus a `kd-k8s-object` on a live pod.
  - With selenium-flow, check:
    - both themes and a live theme switch;
    - status glyphs and tones;
    - the card accent, the grid sheet, the row headers and the blank placeholder;
    - reveal through the sheet's shadow root;
    - conditions as badges.
  - Delete the dashboard afterwards.
- [ ] **Step 6: Commit**: `cdn: round 4 examples, README, CHANGELOG and npm hardening`. Then ask Dr K before opening
  the PR (one PR per session).
