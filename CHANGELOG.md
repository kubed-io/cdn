# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!--
  These ARE the release notes. One SHORT line per entry, written for a user.
  ONLY EVER EDIT THE [Unreleased] SECTION: every versioned section shipped with
  a release and is immutable. publish.yml (duplocloud/version-bump) rolls
  [Unreleased] into a dated version section at release time.
-->

## [Unreleased]

## [0.0.6] - 2026-10-08

### Added

- `kd.js`: `<kd-markdown>` renders GitHub-flavoured markdown with marked, sanitised by DOMPurify, code fences highlighted.
- `kd.js`: `<kd-code>` highlights source with highlight.js, line numbers and copy, loading only the languages it shows.
- `kd.js`: `<kd-files>`, a file explorer over a provider, and `<kd-file>`, one file with the right renderer.
- `kd.js`: `feed(context, map)` themes a panel and hands its elements their data in one call.
- `github.js`: git tree entries, GitHub URLs, code-server activity and Claude edits per file, and code-server's path hash.

## [0.0.5] - 2026-10-08

### Changed

- `n8n.js` loads `@n8n/chat` 1.41.3 (was 1.39.2), npm's current `latest`.
- `@n8n/chat`'s version is `package.json`'s optional peer dependency instead of a constant, and a weekly workflow opens a PR when npm's `latest` moves.

## [0.0.4] - 2026-10-07

### Added

- `kd.js`: the generic elements `kd-pill`, `kd-bar`, `kd-sheet`, `kd-groups`, `kd-data`, `kd-tabs`, `kd-meter`, `kd-steps`, `kd-table`, `kd-mask`, `kd-link` and `kd-tile`.
- `kd.js`: Grafana page helpers for variables, the time range, the refresh picker, rows and tabs, focusing a panel and fitting a panel to its content.
- `kd.js`: `kdjson` and `registerHelpers` for passing data to an element from Handlebars.
- `openapi.js`: `<kd-schema>` renders any OpenAPI v3 or JSON Schema kubectl-explain style, lazily, with every keyword and Kubernetes extension.
- `openapi.js`: `normalize`, a schema model with `$ref` and `allOf` resolved, for building more schema tools.
- `k8s.js`: `<kd-k8s-object>`, `<kd-k8s-ref>` and `<kd-k8s-events>`, plus the mapping from Kubernetes objects onto the core elements.
- `n8n.js`: `mount(config)`, the n8n agent chat tile, so the library panel keeps only its settings.

## [0.0.3] - 2026-10-07

### Fixed

- The release publishes to npm; v0.0.2 was tagged but never reached npm, so 0.0.3 is the first CI release.

## [0.0.2] - 2026-10-07

### Added

- `@kubed.io/cdn` on npm, served by jsDelivr: TypeScript built into ES modules, one entry per domain.
- `kd.js`: `applyTheme(element, theme)` maps Grafana's live theme onto `--kd-*` custom properties and `data-theme`.
- `kd.js`: `followTheme(element)` themes an element from Grafana's runtime and follows a live theme switch.
- `kd.js`: `define(name, element)` registers a custom element once per page and warns when another version owns the tag.
- `kd.css`: text, links, tables, badges, code and cards for `.kd` panels, in both Grafana themes.
