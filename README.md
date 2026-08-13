---
fe-managed: true
name: root-readme
description: >
  Repo README for activities-loader — HPE Altloader build pipeline features, governance,
  and dependencies.
governed_by: repo-standards/repo-readme
version: "1.1.0"
created: 2026-04-10
updated: 2026-08-13
---
# Activities Loader

Build and deploy pipeline for the HPE Altloader platform. Compiles activity source code, audience rules, site configurations, and location rules into the `fe_altloader.js` loader script and per-activity JavaScript bundles for buy.hpe.com.

## Features

### Build Pipeline

Rollup-based build system with Babel and TypeScript transpilation, CSS minification via clean-css, and terser for production minification. Produces both development (unminified) and production (minified + sourcemap) variants for each activity and the main loader script.

| Command | Description |
|---|---|
| `npm run build` | Build all activities |
| `npm run build:local` | Build using local hpe-altloader directory |
| `npm run setup:local` | Set up local hpe-altloader symlinks |

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

Managed by [fe-sys-hq](https://github.com/FunnelEnvy/fe-sys-hq). Governance rules deployed to `.claude/rules/` and plugin configuration in `.claude/settings.json`.

**Rules:**

- `10-repo-conventions` — file naming, git, credentials, .gitignore
- `11-skill-loading-requirements` — mandatory skill loading signals
- `12-claude-usage` — agent behavior conventions

**Plugins:** claude-code-management, fe-governance, fe-integrations, fe-knowledge-base

## Dependencies

- **Node.js** — runtime for build scripts
- **Rollup** — module bundler with plugins for Babel, TypeScript, JSON, CommonJS, node polyfills, terser
- **AWS S3** — deployment target (`fe-hpe-script.s3.us-east-2.amazonaws.com`)
- **hpe-altloader** — companion repo providing activity source code and configuration (consumed via local symlink for local builds)
