---
fe-managed: true
name: root-readme
description: >
  Repo README for activities-loader — HPE Altloader build pipeline features, governance,
  and dependencies.
governed_by: repo-standards/repo-readme
version: "1.0.0"
created: 2026-04-10
updated: 2026-04-10
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
