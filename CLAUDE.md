---
fe-managed: true
name: root-claude-md
description: >
  Repo-level agent context for activities-loader — intent routing and navigational pointers
  for the HPE Altloader build pipeline.
governed_by: repo-standards/claude-md
version: "1.0.0"
created: 2026-04-10
updated: 2026-04-10
---
# Activities Loader

HPE Altloader build pipeline — compiles activity code, audience rules, and configuration JSONs into the `fe_altloader.js` loader script and per-activity bundles deployed to buy.hpe.com.

## Intent Routing

| User intent | Load |
|---|---|
| Build activities or the loader script | `build.js`, `package.json` scripts |
| Add, edit, or configure an activity | `src/activities.json`, `src/activities/` |
| Edit audience targeting rules | `src/audiences.json` |
| Edit site detection rules | `src/sites.json` |
| Edit location detection rules | `src/locations.json` |
| Edit loader runtime behavior | `init-activities.js` |
| Edit shared libraries (reusable utils, i18n, analytics) | `src/libs/` |

## Repo-Specific

### Relationship to hpe-altloader

Companion to `hpe-altloader` — this repo is the build side, hpe-altloader contains activity source code and configuration.

### Build System

Rollup-based pipeline outputting to `dist/`. See README for commands and configuration.

### Activity Groups

Three site groups in `src/activities.json`: `B2B-Hybris`, `B2C`, `configurator`.
