---
fe-managed: true
name: loader-hardening
title: Loader Hardening
description: >
  Harden activities-loader before the hpe-web-dev cut-over. Fix the six loader-code defects
  confirmed in discovery, in build.js, init-activities.js and package.json, and give setup-local.js
  a configurable source path that understands hpe-web-dev's activities/ layout. No build or deploy
  architecture change. Member 5.1 of the altloader-cut-over initiative.
governed_by: change-management/change-document
managed_by: change-management
status: Discovery
status_note: "Discovery complete: Approach approved 2026-10-12; ready for Design"
resource_name: repo
resource_version: "TBD"
impact: 3
confidence: 4
ease: 4
initiative: altloader-cut-over
owner: Sam Baron
version: "0.6.0"
created: 2026-10-09
updated: 2026-10-12
---
# Loader Hardening

## Contents

- [Background](#background)
- [Current State](#current-state)
- [Approach](#approach)
- [Requirements](#requirements)
- [Verification Design](#verification-design)
- [Verification Results](#verification-results)

## Background

hpe-web-dev replaces hpe-altloader as the home of HPE Altloader activities ([hpe-web-dev:charter](hpe-web-dev:CHARTER.md)). This change is member 5.1 of the [hpe-web-dev:Platform Hardening and Cut-Over](hpe-web-dev:_initiatives/open/altloader-cut-over/overview.md) initiative. It hardens the loader before any activity moves.

hpe-altloader builds with this loader today, and hpe-web-dev will once member 5.7 ports the deploy workflows.

The charter row sets the scope ([hpe-web-dev:charter](hpe-web-dev:CHARTER.md) `Initiative 5`, member 5.1), as the owner revised it on 2026-10-12 (`Approach` > `Plan`):

- fixes for the six loader-code defects found in discovery;
- a configurable source path in `setup-local.js` that understands `activities/`.

The defects and the cut-over risks come from the [hpe-web-dev:pipeline and loader discovery](hpe-web-dev:_initiatives/open/altloader-cut-over/2026-10-01_pipeline-and-loader-discovery.md) report, sections 3.5 and 3.6. Discovery of this change re-read all 11 and disproved one (`Current State` > `Defects`). The `activities/` layout comes from member 1.1, [hpe-web-dev:Repo Architecture](hpe-web-dev:_dev/closed/chg_2026-10-01_repo-architecture.md) `Layout` item 1. Activity groups live under `activities/{Group}/{dir}/`, with the config files and shared `libs/` beside them.

**Owner input, 2026-10-09.** Sam asked whether activities-loader needs to be public, and is fine with making it private. On 2026-10-12 the owner decided to keep it public (`Approach` > `Out of Scope`).

**Initiative tag.** The doc keeps `initiative: altloader-cut-over`, although the overview lives in hpe-web-dev. The tag decides where `/advance` lands this doc's build in activities-loader: on the initiative-keyed integration branch, tag-first in either repo class (change-management [fe-sys-hq:git-strategy](fe-sys-hq:plugins/fe-governance/skills/change-management/references/git-strategy.md) `Branch Classes and Naming`, `Merge target` row). `drive_member.py` lands a build-onward step on that same branch. A later `closed:loader-hardening@activities-loader` gate reads that branch too ([fe-sys-hq:Cross-Repo Gate Grammar](fe-sys-hq:plugins/fe-governance/skills/change-management/references/initiative-management.md#cross-repo-gate-grammar)). Untagged, `/advance` would hold the build for the release cut instead, because the registry entry for activities-loader declares no `main_semantics` and so resolves to `released`. The gate would then stay blocked until that cut.

## Current State

Measured at activities-loader `origin/main` `3e5f174` (`git fetch origin main && git rev-parse --short origin/main`, 2026-10-12). Since `1212c23` filed this doc, `main` has gained PR #129 (`2a4a53e`), a governance deploy (`f1c07a7`) and two commits to this doc (`git log --oneline 1212c23..origin/main`). hpe-altloader was first measured at `origin/master` `709e3b7` and re-read at `fde7bf3` and `53f7052` (`git fetch origin master && git rev-parse --short origin/master`, 2026-10-12). Between `709e3b7` and `53f7052`, the only changes under `.github/` or to a JSON file are to `activities.json` and `.claude/settings.json` (`git diff --stat 709e3b7 fde7bf3 -- .github/ '*.json'`, then `git diff --stat fde7bf3 53f7052 -- .github/ '*.json'`). The counts below hold at `53f7052`.

### Repo

- **Visibility.** The repo is public (`gh api repos/FunnelEnvy/activities-loader --jq .visibility` prints `public`).
- **Workflows.** `.github/workflows/` holds only the governance workflows `fe-branch-sweep.yml` and `fe-release-tag.yml` (`ls .github/workflows`). The build and deploy CI lives in hpe-altloader.
- **Tags.** The only tag is `v1` (`git ls-remote --tags origin`). `fe-release-tag.yml` creates `v{version}` tags by `workflow_dispatch` at a release cut.
- **Change tracking.** This doc is the first in `_dev/`. The root [CHANGELOG.md](../../CHANGELOG.md), which makes the repo root the resource, landed with PR #129 (`gh api repos/FunnelEnvy/activities-loader/pulls/129 --jq .merged,.merge_commit_sha` prints `true` and `2a4a53e…`, 2026-10-12). §7 Closed writes this doc's `[Unreleased]` entry there.
- **Source.** `src/` is gitignored (`.gitignore` line `/src/*`). At build time it holds a copy of the activity source.

### Callers

Every hpe-altloader workflow that builds with the loader checks it out at `main`, unpinned, with no token. It relies on the repo being public. There are nine checkouts across six workflows, and no `token:` key in any workflow file:

- `git grep -c "repository: FunnelEnvy/activities-loader" origin/master -- .github/workflows/` counts 1 each in `ci-deploy-fe-altloader.yml`, `ci-deploy-b2b-hybris-v2.yml`, `ci-deploy-b2c-v2.yml`, `ci-deploy-configurator-v2.yml` and `rebuild-all-activities.yml`, and 4 in `ci-pull-request.yml`.
- `git grep -n "token:" origin/master -- .github/workflows/` prints nothing.

The deploy workflows install the loader's dependencies with a composite action hpe-altloader supplies (`./src/.github/actions/setup-yarn`, from `git grep -n setup-yarn origin/master -- .github/workflows/`). A seventh workflow, `ci-close-pull-request.yml`, deletes preview paths and does not check the loader out.

### Local Setup

`scripts/setup-local.js` copies `activities.json`, `audiences.json`, `locations.json`, `sites.json`, `analytics_events.json` and `libs/` into `src/` from a fixed sibling path, `path.resolve(rootDir, '..', 'hpe-altloader')`. It reads them from that clone's root and takes no argument for another source or layout. The README's `npm run setup:local` row describes the copy from a sibling hpe-altloader clone, as corrected by PR #129 (`git show origin/main:README.md`).

### Defects

The 11 defects from discovery section 3.5, re-read at the measured shas. Ten hold, one of them in corrected form, and one is disproved. Six of the ten are in this repo and four in hpe-altloader's workflows.

| # | Where | Defect | Re-read |
|---|---|---|---|
| 1 | `build.js` | `--all` builds activities with no group, so the build throws. A run without `--lib` then also builds with no group. | Holds. The `argv.all` branch calls `buildActivities()` with no group, and the `else` branch runs it again without one. No workflow passes `--all` (`git grep -n -- "--all" origin/master -- .github/workflows/` prints nothing). |
| 2 | `build.js` | `cleandir('dist')` is called as a plain function, not registered as a rollup plugin, so stale local bundles survive. | Holds. `grep -n cleandir build.js` prints only the import and the bare call. |
| 3 | `rebuild-all-activities.yml` | The sparse checkout omits `analytics_events.json`, which the `--lib` build imports. | Disproved. At the last run's commit, `1f7674f`, the sparse list omitted the file and `libs/index.js` imported `run_analytics_events`. The 2026-07-01 run still passed `Build fe_altloader` (`gh run list -R FunnelEnvy/hpe-altloader --workflow rebuild-all-activities.yml`, then `gh api repos/FunnelEnvy/hpe-altloader/actions/runs/28537332160/jobs`). The likely reason, from training data rather than a checked source, is that cone-mode sparse checkout includes root-level files. |
| 4 | `init-activities.js` | The `does not contain any of` operator in `evaluateCondition` returns "not all of" (`!value.every`) instead of "none of". | Holds. No live config uses the operator (`git grep -c "does not contain any of" origin/master -- '*.json'` prints nothing), so the fix changes no live targeting. |
| 5 | `ci-pull-request.yml` | The PR file listing reads one page of the files API with no pagination, so large PRs miss activities in preview builds. | Holds. Each `curl` of `pulls/${PR_NUMBER}/files` passes no `per_page` and follows no pages. |
| 6 | deploy workflows | The push diff starts at `github.event.before`. A force push, or the first push of a new history, gives an empty or invalid base and skips activities silently. | Holds. All three group deploys run `git diff --name-only ${{ github.event.before }} ${{ github.sha }}` (`git grep -n "event.before" origin/master -- .github/workflows/`). |
| 7 | deploy workflows | A change to `activities.json` alone does not rebuild the affected activities. | Holds. Each group deploy keeps only paths matching `^{Group}/` (`git grep -n "grep '^" origin/master -- .github/workflows/ci-deploy-*.yml`). |
| 8 | `ci-deploy-b2c-v2.yml` | The B2C build-error Slack message is labelled B2B Hybris. | Holds. Its `Notify Slack on Build Errors` payload reads "B2B Hybris v2". |
| 9 | `package.json` | Placeholder npm packages `fs` and `child-process`, and two committed lockfiles. | Holds. Both packages are listed and nothing imports them: `build.js` and `setup-local.js` import Node's built-in `fs` and `child_process`. Both `package-lock.json` and `yarn.lock` are committed, and CI installs with yarn. The `.gitignore` half of the original defect, `tmp/` and `.env.*`, landed with PR #129 (`git show 2a4a53e -- .gitignore`). |
| 10 | `init-activities.js`, `build.js` | Dead config: `environments` is inlined but never read, `VALID_ENVS` is hard-coded, and `detectTypeOfSite` duplicates `detectSites`. | Corrected. `build.js` inlines `process.env.ENVIRONMENTS`, and `init-activities.js` assigns it to a `const environments` no code reads. `detectTypeOfEnvironment` hard-codes `VALID_ENVS`. `detectTypeOfSite` repeats the filter in `detectSites`, is exported on `window.FeActivityLoader`, and has no caller in hpe-altloader (`git grep -n detectTypeOfSite origin/master` prints nothing). The misspelled `loggingSeviceUrl` is not inlined. It sits in hpe-altloader's `activities.json` and reaches the bucket only through the raw `activities.json` upload, which is 5.2's concern. |
| 11 | `init-activities.js` | `createEnvironmentIndicator` appends to `document.body` without waiting for it, so it throws when the loader runs in `<head>` under a non-PROD flag. | Holds. `runLoader` calls it first, with no readiness wait. Whether the bootstrap ever evaluates the loader in `<head>` was not observed. |

### Preview Paths

PR previews upload to `{group}-test/{PR number}/` and libs to `test/{PR number}/`, with no repo in the path (`git grep -n "s3://fe-hpe-script/.*test/" origin/master -- .github/workflows/ci-pull-request.yml`). hpe-web-dev's PR numbers restart at 1, so its previews would overwrite hpe-altloader's.

The cleanup in `ci-close-pull-request.yml` deletes `b2b-hybris-test/${{ github.event.ref }}` and `b2c-test/${{ github.event.ref }}` only (`git show origin/master:.github/workflows/ci-close-pull-request.yml`). It leaves configurator and libs previews in place. What it deletes was not confirmed against a run, because the run logs could not be fetched (`gh run view 37976002173 -R FunnelEnvy/hpe-altloader --log` fails on 2026-10-09). From training data, not a checked source: a `pull_request` event payload carries no top-level `ref`, so the expression may be empty and the step may delete each group's whole test prefix.

## Approach

### Change Profile

- **Script-affecting: no.** The deliverables are JavaScript, `package.json` and README edits. No Python file changes, so Design covers the code through `Validation` rather than `_tests/`.
- **Performance-affecting: no.** No skill or agent-facing surface changes.
- **Test-eval-only: no.** Nothing lands under `_tests/` or `_evals/`.
- **Production deploy path: no.** No workflow, bucket path or release step changes. The `build.js` and `init-activities.js` fixes still reach production. hpe-altloader checks the loader out at `main`, unpinned (`Current State` > `Callers`), so its first rebuild after the fixes reach `main` ships them in `fe_altloader.js` and the group bundles.

### Plan

**Owner decisions, 2026-10-12.** The change makes no major build or deploy architecture change. It fixes the loader's own code and teaches `setup-local.js` hpe-web-dev's layout. hpe-altloader keeps its workflows until 5.6, and hpe-web-dev ports them in member 5.7 ([hpe-web-dev:charter](hpe-web-dev:CHARTER.md) `Decisions made at kickoff`, `Build and deploy` row). Work that left this change is listed under `Out of Scope`.

1. **Defect fixes.** Fix the six loader-code defects that hold (`Current State` > `Defects`).
   - *Build (1, 2).* Remove `--all`, and make a run with neither `--lib` nor `--group` exit with a usage error. The full rebuild already builds each group on its own, because each group syncs to its own prefix. Clear `dist/` before the build runs. The `build` script in `package.json` then runs the same sequence as hpe-altloader's `rebuild-all-activities.yml`: each of the three groups with `--group`, then `--lib`. That keeps the README's "Build all activities" description true (owner decision, 2026-10-12).
   - *Targeting operator (4).* Make `does not contain any of` return `!value.some`.
   - *Packages (9).* Remove the `fs` and `child-process` packages and `package-lock.json`.
   - *Dead config (10).* Derive `VALID_ENVS` from the inlined `environments` keys plus `PROD`, and delete `detectTypeOfSite`.
   - *Environment indicator (11).* Make `createEnvironmentIndicator` wait for `document.body`.
   - *Defect 3.* No fix. Discovery disproved it.
2. **Source path.** `setup-local.js` reads the config files and `libs/` from a configurable root instead of a fixed sibling hpe-altloader clone. It takes the root as `--source <path>` or `ALTLOADER_SRC`. The default is a sibling hpe-web-dev clone's `activities/`, where the groups, config files and `libs/` sit together. When that is absent, it falls back to a sibling hpe-altloader clone's root. The [README](../../README.md)'s local-setup text follows.

### Out of Scope

- **Workflow fixes and preview paths.** The four workflow defects (5 to 8), the repo-prefixed preview paths and the PR-close cleanup fix move to member 5.7, the deploy workflow port in hpe-web-dev. `Current State` > `Defects` and `Preview Paths` stay as its evidence.
- **Loader-owned build and deploy.** Rejected by the owner (`Alternatives Considered`).
- **Config schema validation.** JSON Schema validation of `activities.json`, `sites.json`, `locations.json` and `audiences.json` moves to member 3.2, the activity manifest, whose charter row includes JSON Schema in CI. This doc's Discovery profile is input for it:
  - Eight enabled variants carry weight 0, which is how a concluded test is parked, so a rule requiring every weight above zero would fail the next deploy. They sit in 3058, 3071, 4063, 4066, 4067, 4074 (two) and 5004 at hpe-altloader `fde7bf3` (`git show fde7bf3:activities.json` piped through a Python `json` scan of `variants.*.weight`).
  - `4007-category-promotion-banner` lists `"/v2.js"` with a leading slash, and `build.js` joins script paths by string.
  - One of hpe-altloader's 87 activities, `3073-test-new-cart-design`, lacks `clickupTaskId`, which the loader never reads.
  - There are no duplicate names, and the only `env` values are `QA`, `PROD` and `DEV`.

  The counts in the first, third and fourth sub-bullets re-measure the same at hpe-altloader `53f7052` (`git show origin/master:activities.json` piped through a Python `json` count, 2026-10-12).
- **Private repo.** The owner decided on 2026-10-12 to keep activities-loader public, so no caller needs a token checkout and no member owns one.
- **Which loader commit callers pin.** The deploy workflow port (5.7) pins a commit on activities-loader `main`, and during 5.5's dual run both repos build with that same commit (charter 5.7 row, owner decision 2026-10-12). These fixes reach that pin when they reach `main`.
- **Bundle hygiene.** Stripping non-runtime fields from the public `activities.json` and `fe_altloader.js` is member 5.2.
- **Further loader improvements from discovery.** jsdom unit tests for `init-activities.js`, versioned uploads with rollback, environment isolation, and one shared build for hpe-altloader's console-paste QA script.

### Alternatives Considered

- **Loader-owned build and deploy.** Discovery first planned a reusable `workflow_call` workflow in activities-loader, from the discovery report's `Structural improvements` (section 3.5). It brought a release tag for callers to pin, hpe-altloader's adoption of the workflow and a token-based loader checkout. The owner rejected it on 2026-10-12: no major build or deploy architecture change ([hpe-web-dev:charter](hpe-web-dev:CHARTER.md) `Decisions made at kickoff`, `Build and deploy` row). hpe-web-dev ports hpe-altloader's workflows with minor fixes in member 5.7 instead.

## Requirements

To be authored at Design.

## Verification Design

### Validation

To be authored at Design.

## Verification Results

### Validation Outcomes

Not yet run.
