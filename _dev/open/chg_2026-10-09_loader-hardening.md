---
fe-managed: true
name: loader-hardening
title: Loader Hardening
description: >
  Harden activities-loader before the hpe-web-dev cut-over. Publish a loader-owned reusable
  workflow_call build and deploy that callers pin by tag, validate the config files against a JSON
  Schema, fix the 11 defects found in discovery, prefix preview paths with the calling repo, and
  give setup-local.js a configurable source path that understands hpe-web-dev's activities/ layout.
  Member 5.1 of the altloader-cut-over initiative.
governed_by: change-management/change-document
managed_by: change-management
status: Backlog
resource_name: repo
resource_version: "TBD"
impact: 5
confidence: 4
ease: 2
initiative: altloader-cut-over
owner: Sam Baron
version: "0.1.0"
created: 2026-10-09
updated: 2026-10-09
---
# Loader Hardening

## Open Issues

**Source:** Approach authoring
**Generated:** 2026-10-09 11:45 PT

### Findings Detail

| # | Source | Finding | Description | Recommendation |
|---|---|---|---|---|
| 1 | Approach authoring | How and when to make activities-loader private | The owner is fine with a private repo (`Background`). Today every caller checks the loader out with no token, so flipping visibility before each caller authenticates breaks the production deploys (`Current State` > `Callers`). The open points are the credential (GitHub App or fine-grained token, and which repos hold it) and the moment of the flip. | Build the authenticated checkout into the reusable workflow in this change. Flip visibility as a separate owner action once a grep of every caller's workflows finds no unauthenticated checkout of the loader. Expect that moment at 5.6 unless hpe-altloader adopts the reusable workflow first (row 2). |
| 2 | Approach authoring | Whether hpe-altloader adopts the reusable workflow before 5.6 | Five of the defects live in hpe-altloader's own workflows, and hpe-altloader keeps deploying until 5.6. If only hpe-web-dev calls the new workflow, those five stay live in production until the flip. Moving hpe-altloader's callers means edits in another repo, which this change cannot make from activities-loader. | Move hpe-altloader's deploy and preview workflows onto the pinned reusable workflow, as an `Orchestrator-Owned` requirement set at Design. It fixes the five defects in production now and makes the private flip possible before 5.6. |

## Background

hpe-web-dev replaces hpe-altloader as the home of HPE Altloader activities ([hpe-web-dev:charter](hpe-web-dev:CHARTER.md)). This change is member 5.1 of the [hpe-web-dev:Platform Hardening and Cut-Over](hpe-web-dev:_initiatives/open/altloader-cut-over/overview.md) initiative. It hardens the loader before any activity moves.

The member is necessary for the initiative's `Goals` clause "Only one repo deploys to `s3://fe-hpe-script` at any time, and the switch happens in one step". The flip in 5.6 swaps which repo calls a single, pinned, loader-owned build. Without that build, each repo carries its own copy of the deploy logic, and the old copy keeps the defects below.

The charter row sets the scope ([hpe-web-dev:charter](hpe-web-dev:CHARTER.md) `Initiative 5`, member 5.1):

- a loader-owned reusable `workflow_call` build and deploy, pinned by tag;
- JSON Schema validation of the config files;
- fixes for the 11 defects found in discovery;
- repo-prefixed preview paths, so hpe-web-dev's new PR numbers cannot collide with hpe-altloader's;
- a configurable source path in `setup-local.js` that understands `activities/`.

The defects and the cut-over risks come from the [hpe-web-dev:pipeline and loader discovery](hpe-web-dev:_initiatives/open/altloader-cut-over/2026-10-01_pipeline-and-loader-discovery.md) report, sections 3.5 and 3.6. The `activities/` layout comes from member 1.1, [hpe-web-dev:Repo Architecture](hpe-web-dev:_dev/closed/chg_2026-10-01_repo-architecture.md) `Layout` item 1. Activity groups live under `activities/{Group}/{dir}/`, with the config files and shared `libs/` beside them.

**Owner input, 2026-10-09.** Sam asked whether activities-loader needs to be public, and is fine with making it private. A private repo needs every caller to check the loader out with a credential. That work belongs in the reusable workflow this change builds. The flip itself is open (`Open Issues` row 1).

Bundle hygiene is out of scope here. Stripping non-runtime fields from the public `activities.json` and `fe_altloader.js` is member 5.2.

## Current State

Measured at activities-loader `origin/main` `a17b6e1` (`git fetch origin main && git rev-parse --short origin/main`) and hpe-altloader `origin/master` `709e3b7` (`git fetch origin master && git rev-parse --short origin/master`).

### Repo

- **Visibility.** The repo is public (`gh api repos/FunnelEnvy/activities-loader --jq .visibility` prints `public`).
- **Workflows.** `.github/workflows/` holds only the governance workflows `fe-branch-sweep.yml` and `fe-release-tag.yml` (`ls .github/workflows`). The build and deploy CI lives in hpe-altloader.
- **Change tracking.** The repo has no `_dev/` and no `CHANGELOG.md` (`ls` at the repo root). A root `CHANGELOG.md` is being added separately, which makes the repo root the resource.
- **Source.** `src/` is gitignored (`.gitignore` line `/src/*`). At build time it holds a copy of the activity source.

### Callers

Every hpe-altloader workflow that builds with the loader checks it out at `main`, unpinned, with no token. It relies on the repo being public. There are nine checkouts across six workflows, and no `token:` key in any workflow file:

- `git grep -c "repository: FunnelEnvy/activities-loader" origin/master -- .github/workflows/` counts 1 each in `ci-deploy-fe-altloader.yml`, `ci-deploy-b2b-hybris-v2.yml`, `ci-deploy-b2c-v2.yml`, `ci-deploy-configurator-v2.yml` and `rebuild-all-activities.yml`, and 4 in `ci-pull-request.yml`.
- `git grep -n "token:" origin/master -- .github/workflows/` prints nothing.

The deploy workflows install the loader's dependencies with a composite action hpe-altloader supplies (`./src/.github/actions/setup-yarn`, from `git grep -n setup-yarn origin/master -- .github/workflows/`).

### Local Setup

`scripts/setup-local.js` copies `activities.json`, `audiences.json`, `locations.json`, `sites.json`, `analytics_events.json` and `libs/` into `src/` from a fixed sibling path, `path.resolve(rootDir, '..', 'hpe-altloader')`. It reads them from that clone's root. It takes no argument for another source or layout, and the README still calls the copy a symlink.

### Defects

The 11 defects from discovery section 3.5, re-read at the measured shas. Six are in this repo, five in hpe-altloader's workflows.

| # | Where | Defect |
|---|---|---|
| 1 | `build.js` | `--all` builds activities with no group, so the build throws. A run without `--lib` then also builds with no group. |
| 2 | `build.js` | `cleandir('dist')` is called as a plain function, not registered as a rollup plugin, so stale local bundles survive. |
| 3 | `rebuild-all-activities.yml` | The sparse checkout omits `analytics_events.json`, which the `--lib` build imports. Not yet confirmed against a real run. |
| 4 | `init-activities.js` | The `does not contain any of` location operator returns "not all of" (`!value.every`) instead of "none of". |
| 5 | `ci-pull-request.yml` | The PR file listing reads one page of the files API with no pagination, so large PRs miss activities in preview builds. |
| 6 | deploy workflows | The push diff starts at `github.event.before`. A force push, or the first push of a new history, gives an empty or invalid base and skips activities silently. |
| 7 | deploy workflows | A change to `activities.json` alone does not rebuild the affected activities. |
| 8 | `ci-deploy-b2c-v2.yml` | The B2C build-error Slack message is labelled B2B Hybris. |
| 9 | `package.json`, `.gitignore` | Placeholder npm packages `fs` and `child-process`, two committed lockfiles, and no `tmp/` or `.env.*` ignore entries. |
| 10 | `init-activities.js`, `build.js` | Dead config: `environments` and the misspelled logging-service key are inlined but never read, `VALID_ENVS` is hard-coded, and `detectTypeOfSite` duplicates `detectSites`. |
| 11 | `init-activities.js` | `createEnvironmentIndicator` appends to `document.body` without waiting for it, so it throws when the loader runs in `<head>` under a non-PROD flag. |

### Preview Paths

PR previews upload to `{group}-test/{PR number}/` in the bucket, with no repo in the path (`git grep -n -- "-test/" origin/master -- .github/workflows/ci-pull-request.yml`). hpe-web-dev's PR numbers restart at 1, so its previews would overwrite hpe-altloader's.

## Approach

Make activities-loader own its build and deploy, then fix what discovery found. Release the result under a tag both repos can call.

1. **Reusable workflow.** Publish an `on: workflow_call` workflow from this repo. Its inputs are the group, the activities to build, the source repo, the source root inside it, the S3 prefix and a dry-run switch. It covers the per-group deploy, the `--lib` deploy, the full rebuild and the PR preview. It checks out the loader at the caller's pinned tag. It checks out the source with a credential, so the loader can go private later. The `setup-yarn` action moves into this repo. Callers keep their own secrets and pass them in. The dry-run switch serves 5.5's byte-for-byte dual run.
2. **Source layout.** The workflow and `setup-local.js` read the source from a configurable root. For hpe-altloader that root is the repo root. For hpe-web-dev it is `activities/`, where the groups, config files and `libs/` sit together. `setup-local.js` takes the source path as an argument or environment variable. It defaults to a sibling hpe-web-dev clone's `activities/` and falls back to a sibling hpe-altloader clone.
3. **Schema validation.** Add JSON Schemas for `activities.json`, `sites.json`, `locations.json` and `audiences.json`, checked in the reusable workflow before any build. The checks cover unique activity names, existing script and style paths, variant weights above zero, known environments, sites and locations, and a ClickUp task reference on each activity. 3.2 later defines the full activity manifest. This schema covers what the loader reads today.
4. **Defect fixes.** Fix all 11. The five workflow defects (3, 5, 6, 7, 8) are fixed inside the reusable workflow, where callers pick them up. Confirm defect 3 against a real run before fixing it.
5. **Preview paths.** Previews go to a repo-prefixed path, `{group}-test/{repo}/{PR number}/`. The Resource Override comment the preview job posts follows the new path.
6. **Release.** Tag a release with the repo's existing `fe-release-tag.yml`. Callers pin that tag, never `main`.

**Private repo, in scope as candidate work.** Make activities-loader private once every caller checks it out with a credential. Item 1 builds that checkout. The credential and the timing of the flip are open (`Open Issues` row 1). The flip is an owner action, not part of this change's build.

Not in scope: jsdom unit tests for `init-activities.js`, versioned uploads with rollback, environment isolation, and one shared build for hpe-altloader's console-paste QA script. Discovery lists them as later loader improvements, not as part of member 5.1.

## Requirements

To be authored at Design.

## Verification Design

### Validation

To be authored at Design.

## Verification Results

### Validation Outcomes

Not yet run.
