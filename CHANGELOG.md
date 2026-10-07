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
