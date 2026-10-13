---
fe-managed: true
name: root-readme
title: Activities Loader
description: >
  Repo README for activities-loader — HPE Altloader build pipeline features, governance,
  and dependencies.
governed_by: repo-standards/repo-readme
managed_by: change-management
version: "1.3.0"
created: 2026-04-10
updated: 2026-10-13
---
# Activities Loader

Build and deploy pipeline for the HPE Altloader platform. Compiles activity source code, audience rules, site configurations, and location rules into the `fe_altloader.js` loader script and per-activity JavaScript bundles for buy.hpe.com.

## Features

### Build Pipeline

Rollup-based build system with Babel and TypeScript transpilation, CSS minification via clean-css, and terser for production minification. Produces both development (unminified) and production (minified + sourcemap) variants for each activity and the main loader script.

| Command | Description |
|---|---|
| `npm run build` | Build all activities: each group with `--group` (`B2C`, `B2B-Hybris`, `configurator`), then the loader with `--lib`. Expects `src/` staged the way CI stages it: config files and `libs/` at `src/`, and each group directory's contents copied into `src/activities/`. Then install with `yarn install --frozen-lockfile`, as the deploy workflows do. A plain `yarn install` rewrites `yarn.lock`, because the staged activities are workspaces |
| `npm run build:local` | Run `setup:local`, then build the loader with `--lib`. Set the source root with `ALTLOADER_SRC`, since `--source` here would reach `build.js` |
| `npm run setup:local` | Copy the config files and `libs/` into `src/` from a source root: `--source <path>`, else `ALTLOADER_SRC`, else a sibling hpe-web-dev clone's `activities/`, else a sibling hpe-altloader clone. Does not copy activity directories |

`build.js` builds one target per run, `--group <name>` (optionally narrowed by `--activities`) or `--lib`, and exits with a usage error given neither. It clears `dist/` first unless `--no-clean` is passed.

### Activity Management

Activities are defined in `src/activities.json` and organized by site group (`B2B-Hybris`, `B2C`, `configurator`). Each activity supports:

- Environment targeting (PROD, QA, DEV)
- Site assignment and URL-based location matching
- Audience targeting via account/org ID include/exclude rules (`src/audiences.json`)
- Optional A/B variant assignment with weighted random distribution

### Loader Runtime

`init-activities.js` is the entry point compiled into `fe_altloader.js`. At runtime on buy.hpe.com it:

- Detects the current environment, site, and page location
- Evaluates audience targeting rules against user context
- Assigns and persists A/B variant selections via cookie and localStorage
- Dynamically loads matching activity scripts from S3
- Tracks experiment variants via Microsoft Clarity and analytics events
- Passes environment and variant parameters to the B2B configurator iframe
- Blocks every activity load for HPE internal test accounts on the B2B production storefront

#### Runtime Query Parameters

Three URL parameters steer the loader at runtime. Each is read on every page load and can outlive the URL that set it, so the setting survives navigation.

| Parameter | Purpose | Persisted in |
|---|---|---|
| `FE_LOADER` | Choose the environment whose activities load, or disable the loader | `sessionStorage` — `fe-altloader-env` (opt-in) |
| `FE_VARIANT` | Force chosen activities to a specific variant | `fe_altloader` cookie and localStorage |
| `FE_OVERRIDE` | Bypass the B2B test-user kill switch | `sessionStorage` — `fe-altloader-test-user-override` |

##### `FE_LOADER`

| Value | Effect |
|---|---|
| `DEV`, `QA`, `PROD` | Load activities targeted at that environment, for the current page load only |
| `DEV-save`, `QA-save`, `PROD-save` | Same, persisted for the rest of the tab session |
| `disable` | Skip the loader entirely — no activities load |
| Any other value | Logs a warning and falls back to `PROD` |

A value without the `-save` suffix also clears any previously saved environment. Outside `PROD` the loader renders a red on-page environment indicator and loads unminified activity bundles; `PROD` loads the `.min` bundles.

##### `FE_VARIANT`

Forces specific activities to a variant instead of the usual weighted random assignment. The format is `activity:variant`, with multiple pairs separated by a period:

`?FE_VARIANT=hero_test:variant_b.nav_test:control`

An entry applies only when the named variant exists on that activity. The forced choice is written to the `fe_altloader` cookie and localStorage, so it sticks across pages exactly like a normally assigned variant.

##### `FE_OVERRIDE`

On `buy.hpe.com/b2b` the loader reads the `isTestUser` flag from the Hybris `#myAccountDetail` blob and blocks all activity loads when it is true. `FE_OVERRIDE` bypasses that check so an internal HPE account can still QA activities in production.

| Value | Effect |
|---|---|
| `TEST_USER` | Test-user check always reports false; bypass persisted for the tab session |
| Any other value | Clears the persisted bypass |

Set the bypass once on any B2B page, then browse normally — it stays in effect without the parameter:

`https://buy.hpe.com/b2b/<page>?FE_OVERRIDE=TEST_USER`

To end it before the tab closes, load any B2B page with a clearing value:

`https://buy.hpe.com/b2b/<page>?FE_OVERRIDE=off`

The value match is case-insensitive, and closing the tab ends the bypass. Outside the B2B production storefront the kill switch never runs, so the parameter has no effect there.

### Shared Libraries

`src/libs/` provides reusable utilities consumed by activities:

- `feReusable` — DOM utilities, condition waiting, CSS injection
- `FEi18n` — internationalization support
- `run_analytics_events` — analytics event tracking

## Governance

Governed by [fe-sys-hq](https://github.com/FunnelEnvy/fe-sys-hq). Its `fe-governance-deploy` skill deploys the governance sources here:

- **Rules.** `.claude/rules/`
- **Plugins.** Enabled and configured in `.claude/settings.json`
- **Workflows.** The `fe-`-prefixed files in `.github/workflows/`

## Dependencies

- **Node.js** — runtime for build scripts
- **Rollup** — module bundler with plugins for Babel, TypeScript, JSON, CommonJS, node polyfills, terser
- **AWS S3** — deployment target (`fe-hpe-script.s3.us-east-2.amazonaws.com`)
- **hpe-altloader** — current home of activity source code and configuration. hpe-web-dev's `activities/` replaces it at cut-over. `npm run setup:local` copies the config files and `libs/` from either into `src/` for local builds
