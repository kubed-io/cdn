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

### Added

- `grafana/theme.js`: `applyTheme(element, theme)` maps Grafana's live theme onto `--kd-*` custom properties and `data-theme`.
- `grafana/theme.css`: text, links, tables, badges, code and cards for `.kd` panels, in both Grafana themes.
