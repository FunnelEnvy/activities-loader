---
fe-managed: true
name: loader-hardening
title: Loader Hardening
description: >
  Harden activities-loader before the hpe-web-dev cut-over. Publish a loader-owned reusable
  workflow_call build and deploy that callers pin by tag, move hpe-altloader's deploys onto it,
  validate the config files against a JSON Schema, fix the confirmed discovery defects, prefix
  preview paths with the calling repo, and give setup-local.js a configurable source path that
  understands hpe-web-dev's activities/ layout. Member 5.1 of the altloader-cut-over initiative.
governed_by: change-management/change-document
managed_by: change-management
status: Discovery
status_note: Halted on 1 owner decision (hpe-altloader adoption); then Approach approval
resource_name: repo
resource_version: "TBD"
impact: 5
confidence: 4
ease: 2
initiative: altloader-cut-over
owner: Sam Baron
version: "0.4.0"
created: 2026-10-09
updated: 2026-10-09
---
# Loader Hardening

## Contents

- [Background](#background)
- [Current State](#current-state)
- [Approach](#approach)
- [Requirements](#requirements)
- [Verification Design](#verification-design)
- [Verification Results](#verification-results)
- [Open Issues](#open-issues)

## Background

hpe-web-dev replaces hpe-altloader as the home of HPE Altloader activities ([hpe-web-dev:charter](hpe-web-dev:CHARTER.md)). This change is member 5.1 of the [hpe-web-dev:Platform Hardening and Cut-Over](hpe-web-dev:_initiatives/open/altloader-cut-over/overview.md) initiative. It hardens the loader before any activity moves.

The member serves the initiative's `Goals` clause "Only one repo deploys to `s3://fe-hpe-script` at any time, and the switch happens in one step". The flip in 5.6 swaps which repo calls a single, pinned, loader-owned build. Without that build, each repo carries its own copy of the deploy logic, and the old copy keeps the defects below.

The charter row sets the scope ([hpe-web-dev:charter](hpe-web-dev:CHARTER.md) `Initiative 5`, member 5.1):

- a loader-owned reusable `workflow_call` build and deploy, pinned by tag;
- JSON Schema validation of the config files;
- fixes for the 11 defects found in discovery;
- repo-prefixed preview paths, so hpe-web-dev's new PR numbers cannot collide with hpe-altloader's;
- a configurable source path in `setup-local.js` that understands `activities/`.

The defects and the cut-over risks come from the [hpe-web-dev:pipeline and loader discovery](hpe-web-dev:_initiatives/open/altloader-cut-over/2026-10-01_pipeline-and-loader-discovery.md) report, sections 3.5 and 3.6. Discovery of this change re-read all 11 and disproved one (`Current State` > `Defects`). The `activities/` layout comes from member 1.1, [hpe-web-dev:Repo Architecture](hpe-web-dev:_dev/closed/chg_2026-10-01_repo-architecture.md) `Layout` item 1. Activity groups live under `activities/{Group}/{dir}/`, with the config files and shared `libs/` beside them.

**Owner input, 2026-10-09.** Sam asked whether activities-loader needs to be public, and is fine with making it private. A private repo needs every caller to check the loader out with a credential. This change builds that checkout. The flip itself is an owner action outside the change (`Approach` > `Private Repo`).

**Initiative tag.** The doc keeps `initiative: altloader-cut-over`, although the overview lives in hpe-web-dev. The tag decides where `/advance` lands this doc's build in activities-loader: on the initiative-keyed integration branch, tag-first in either repo class (change-management [fe-sys-hq:git-strategy](fe-sys-hq:plugins/fe-governance/skills/change-management/references/git-strategy.md) `Branch Classes and Naming`, `Merge target` row). `drive_member.py` lands a build-onward step on that same branch. A later `closed:loader-hardening@activities-loader` gate reads that branch too ([fe-sys-hq:Cross-Repo Gate Grammar](fe-sys-hq:plugins/fe-governance/skills/change-management/references/initiative-management.md#cross-repo-gate-grammar)). Untagged, `/advance` would hold the build for the release cut instead, because the registry entry for activities-loader declares no `main_semantics` and so resolves to `released`. The gate would then stay blocked until that cut. The tag adds no second frontier record: `collect_cross_repo_frontier` in `portfolio_common.py` merges a tag-derived member into its declared row (`_add`). The slug resolves to no overview in this repo, which best-effort slug resolution tolerates.

## Current State

Measured at activities-loader `origin/main` `1212c23` (`git fetch origin main && git rev-parse --short origin/main`) and hpe-altloader `origin/master` `709e3b7` (`git fetch origin master && git rev-parse --short origin/master`). Since `a17b6e1`, the only commit on activities-loader `main` files this doc. The Discovery review re-read hpe-altloader at `fde7bf3`. Its one new commit changes only `activities.json` (`git diff --stat 709e3b7 fde7bf3 -- .github/ '*.json'`), and the counts below hold there.

### Repo

- **Visibility.** The repo is public (`gh api repos/FunnelEnvy/activities-loader --jq .visibility` prints `public`).
- **Workflows.** `.github/workflows/` holds only the governance workflows `fe-branch-sweep.yml` and `fe-release-tag.yml` (`ls .github/workflows`). The build and deploy CI lives in hpe-altloader.
- **Tags.** The only tag is `v1` (`git ls-remote --tags origin`). `fe-release-tag.yml` creates `v{version}` tags by `workflow_dispatch` at a release cut.
- **Change tracking.** This doc is the first in `_dev/`. The root `CHANGELOG.md`, which makes the repo root the resource, arrives with PR #129 on `sam_governance-compliance`. The PR is open and unmerged (`gh api repos/FunnelEnvy/activities-loader/pulls/129 --jq .merged` prints `false`). §7 Closed writes its `[Unreleased]` entry into that file, so #129 must merge first.
- **Source.** `src/` is gitignored (`.gitignore` line `/src/*`). At build time it holds a copy of the activity source.

### Callers

Every hpe-altloader workflow that builds with the loader checks it out at `main`, unpinned, with no token. It relies on the repo being public. There are nine checkouts across six workflows, and no `token:` key in any workflow file:

- `git grep -c "repository: FunnelEnvy/activities-loader" origin/master -- .github/workflows/` counts 1 each in `ci-deploy-fe-altloader.yml`, `ci-deploy-b2b-hybris-v2.yml`, `ci-deploy-b2c-v2.yml`, `ci-deploy-configurator-v2.yml` and `rebuild-all-activities.yml`, and 4 in `ci-pull-request.yml`.
- `git grep -n "token:" origin/master -- .github/workflows/` prints nothing.

The deploy workflows install the loader's dependencies with a composite action hpe-altloader supplies (`./src/.github/actions/setup-yarn`, from `git grep -n setup-yarn origin/master -- .github/workflows/`). A seventh workflow, `ci-close-pull-request.yml`, deletes preview paths and does not check the loader out.

### Local Setup

`scripts/setup-local.js` copies `activities.json`, `audiences.json`, `locations.json`, `sites.json`, `analytics_events.json` and `libs/` into `src/` from a fixed sibling path, `path.resolve(rootDir, '..', 'hpe-altloader')`. It reads them from that clone's root and takes no argument for another source or layout. The README on `main` still calls the copy a symlink. PR #129 corrects that wording (`git show FETCH_HEAD:README.md` after `git fetch origin sam_governance-compliance`).

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
| 9 | `package.json` | Placeholder npm packages `fs` and `child-process`, and two committed lockfiles. | Holds. Both packages are listed and nothing imports them: `build.js` and `setup-local.js` import Node's built-in `fs` and `child_process`. Both `package-lock.json` and `yarn.lock` are committed, and CI installs with yarn. The `.gitignore` half of the original defect lands with PR #129. |
| 10 | `init-activities.js`, `build.js` | Dead config: `environments` is inlined but never read, `VALID_ENVS` is hard-coded, and `detectTypeOfSite` duplicates `detectSites`. | Corrected. `build.js` inlines `process.env.ENVIRONMENTS`, and `init-activities.js` assigns it to a `const environments` no code reads. `detectTypeOfEnvironment` hard-codes `VALID_ENVS`. `detectTypeOfSite` repeats the filter in `detectSites`, is exported on `window.FeActivityLoader`, and has no caller in hpe-altloader (`git grep -n detectTypeOfSite origin/master` prints nothing). The misspelled `loggingSeviceUrl` is not inlined. It sits in hpe-altloader's `activities.json` and reaches the bucket only through the raw `activities.json` upload, which is 5.2's concern. |
| 11 | `init-activities.js` | `createEnvironmentIndicator` appends to `document.body` without waiting for it, so it throws when the loader runs in `<head>` under a non-PROD flag. | Holds. `runLoader` calls it first, with no readiness wait. Whether the bootstrap ever evaluates the loader in `<head>` was not observed. |

### Preview Paths

PR previews upload to `{group}-test/{PR number}/` and libs to `test/{PR number}/`, with no repo in the path (`git grep -n "s3://fe-hpe-script/.*test/" origin/master -- .github/workflows/ci-pull-request.yml`). hpe-web-dev's PR numbers restart at 1, so its previews would overwrite hpe-altloader's.

The cleanup in `ci-close-pull-request.yml` deletes `b2b-hybris-test/${{ github.event.ref }}` and `b2c-test/${{ github.event.ref }}` only (`git show origin/master:.github/workflows/ci-close-pull-request.yml`). It leaves configurator and libs previews in place. What it deletes was not confirmed against a run, because the run logs could not be fetched (`gh run view 37976002173 -R FunnelEnvy/hpe-altloader --log` fails on 2026-10-09). From training data, not a checked source: a `pull_request` event payload carries no top-level `ref`, so the expression may be empty and the step may delete each group's whole test prefix.

## Approach

### Change Profile

- **Script-affecting: no.** The deliverables are JavaScript, workflow YAML and JSON Schema files. No Python file changes, so Design covers the code through `Validation` rather than `_tests/`.
- **Performance-affecting: no.** No skill or agent-facing surface changes.
- **Test-eval-only: no.** Nothing lands under `_tests/` or `_evals/`.
- **Production deploy path: yes.** Item 7 moves hpe-altloader's live deploys onto the new workflow, so the release tag must exist before that switch.

### Plan

activities-loader takes ownership of its build and deploy, fixes the confirmed defects, and hpe-altloader moves onto the result. Both repos pin one released tag.

1. **Reusable workflow.** Publish an `on: workflow_call` workflow from this repo. It covers the per-group deploy, the `--lib` deploy, the full rebuild, the PR preview and the PR-close cleanup. Its inputs are the group, the activities to build, the source root inside the calling repo, the loader ref, the deploy environment's name and a dry-run switch.
   - *Checkouts.* It checks out the calling repo with the run's own token. It checks out the loader at the ref the caller pins, with an optional token secret that stays unused while the repo is public.
   - *Dependencies.* The `setup-yarn` composite action moves into this repo.
   - *Loader deploy side effects.* The `--lib` deploy keeps both side effects of today's `ci-deploy-fe-altloader.yml`: the raw `activities.json` upload to the bucket root and the POST to the Retool `github-action-finished` webhook (`git show origin/master:.github/workflows/ci-deploy-fe-altloader.yml`).
   - *Secrets.* The AWS and Slack secrets live in hpe-altloader's `production` environment, which each deploy job declares today. The reusable job declares the caller's environment itself, named by an input, so it reads those secrets directly. From training data, not a checked source: environment secrets cannot be passed through `workflow_call`. Design verifies that route before fixing the workflow's interface.
   - *Dry run.* A dry run builds and stops before any upload, which 5.5's byte-for-byte comparison needs.
   - *Trimmed inputs.* Discovery proposed `source_repo` and `s3_prefix` inputs. The source is always the calling repo. Both callers must write the same objects, which the group already fixes, so neither input stays.
2. **Source layout.** The workflow and `setup-local.js` read the source from a configurable root. For hpe-altloader that root is the repo root. For hpe-web-dev it is `activities/`, where the groups, config files and `libs/` sit together. `setup-local.js` takes the root as `--source <path>` or `ALTLOADER_SRC`. It defaults to a sibling hpe-web-dev clone's `activities/` and falls back to a sibling hpe-altloader clone. The [README](../../README.md)'s local-setup text follows.
3. **Schema validation.** Add JSON Schemas for `activities.json`, `sites.json`, `locations.json` and `audiences.json`. A loader script checks them before any build, in the deploy and in the PR preview, so a bad config fails in review. The checks cover what the loader reads: unique activity names, script and style paths that exist, known `env` values, and site and location names that exist.
   - *Variant weights.* Weights are non-negative, and each activity with variants has at least one positive weight. Weight 0 is how a concluded test is parked: eight enabled variants carry it at hpe-altloader `fde7bf3`, in 3058, 3071, 4063, 4066, 4067, 4074 (two) and 5004 (`git show fde7bf3:activities.json` piped through a Python `json` scan of `variants.*.weight`). A rule requiring every weight above zero would fail the next deploy.
   - *Paths.* The path check resolves a script or style path the way `build.js` joins it, by string. `4007-category-promotion-banner` lists `"/v2.js"` with a leading slash.
   - *ClickUp reference.* It waits for 3.2, which defines the full activity manifest. The loader never reads `clickupTaskId`, and one of hpe-altloader's 87 activities lacks it, so requiring it now would fail that repo's next deploy.
   - *Profile before Design.* The profile so far covers names, `env` values, `clickupTaskId`, weights and leading-slash paths. It found no duplicate names and only `QA`, `PROD` and `DEV` env values (`git show origin/master:activities.json` piped through a Python `json` count). Re-run it against every planned check before Design fixes the schema.
4. **Defect fixes.** Fix the ten defects that hold.
   - *Loader code (1, 2, 4, 9, 10, 11).* Remove `--all`, and make a run with neither `--lib` nor `--group` exit with a usage error. The full rebuild already builds each group on its own, because each group syncs to its own prefix. Clear `dist/` before the build actually runs. Make `does not contain any of` return `!value.some`. Remove the `fs` and `child-process` packages and `package-lock.json`. Derive `VALID_ENVS` from the inlined `environments` keys plus `PROD`, and delete `detectTypeOfSite`. Make `createEnvironmentIndicator` wait for `document.body`.
   - *Workflow defects (5, 6, 7, 8).* The reusable workflow fixes these, and callers pick the fixes up. It reads every page of the PR file listing. It falls back to a full group build when the push base is missing or not an ancestor. It rebuilds activities whose `activities.json` entry changed. It builds Slack labels from the group input.
   - *Defect 3.* No fix. The workflow's sparse checkout names the config files it needs, `analytics_events.json` included.
5. **Preview paths.** Previews go to `{group}-test/{repo}/{PR number}/`, and libs to `test/{repo}/{PR number}/`. The Resource Override comment and the PR-close cleanup use the same paths, and the cleanup covers every group and the libs.
6. **Release.** Callers pin a tag from the repo's release cut (`fe-release-tag.yml`), never `main`. The cut is change-management release work after this doc closes, not a Build step.
7. **hpe-altloader adoption.** hpe-altloader's six build workflows and its PR-close cleanup become thin callers of the pinned reusable workflow. The edit lands in hpe-altloader, which a step driven in activities-loader cannot write. Design therefore tags it `Orchestrator-Owned`, and the orchestrator lands it through hpe-altloader's own PR.
   - *Why now.* Otherwise the four workflow defects stay live in production until 5.6. hpe-web-dev has no activities before 5.5, so without adoption the workflow first deploys for real at cut-over. 5.5's dual run then compares two callers of one build. Once every checkout goes through the workflow, the private flip no longer waits for 5.6.
   - *Deploy order.* The release tag exists first, then hpe-altloader switches its workflows to it. hpe-altloader keeps deploying until 5.6, as the initiative decided; only its workflow files change.

### Private Repo

This change makes the loader checkout accept a token (item 1) and routes every caller through it (item 7). Making the repo private is an owner action outside the change, and the credential type is chosen then. The flip is ready when three things hold:

- each caller's `git grep -n "repository: FunnelEnvy/activities-loader"` over `.github/workflows/` finds no checkout outside the reusable workflow;
- each caller passes the token secret;
- the repo's Actions access setting lets organization repos call its workflows.

Two GitHub behaviors behind this list rest on training data, not a checked source. A reusable workflow's run token cannot read a private loader repo, so the checkout needs its own token. A private repo's workflows are callable only by repos the access setting admits. Both callers are private (`gh api repos/FunnelEnvy/hpe-altloader --jq .visibility`, and the same for hpe-web-dev).

### Out of Scope

- **Bundle hygiene.** Stripping non-runtime fields from the public `activities.json` and `fe_altloader.js` is member 5.2.
- **Further loader improvements from discovery.** jsdom unit tests for `init-activities.js`, versioned uploads with rollback, environment isolation, and one shared build for hpe-altloader's console-paste QA script.

## Requirements

To be authored at Design.

## Verification Design

### Validation

To be authored at Design.

## Verification Results

### Validation Outcomes

Not yet run.

## Open Issues

**Source:** Discovery review
**Generated:** 2026-10-09 12:00 PT

### Findings Detail

| # | Source | Finding | Description | Recommendation |
|---|---|---|---|---|
| 1 | Discovery review | Item 7 widens the charter scope and cannot meet its own deploy order | `Approach` > `Plan` item 7 adds hpe-altloader adoption, which the charter's member 5.1 row does not list ([hpe-web-dev:charter](hpe-web-dev:CHARTER.md) `Initiative 5`). Item 6 cuts the release tag only after this doc closes, yet item 7 needs that tag before hpe-altloader switches, and item 7 is a requirement this doc must meet before it closes. The `Simplicity Bias` asks for trimmed scope with standalone value to be spun out unless the user approves the wider scope. | (needs user judgment): a rule requires a person (folding in scope beyond the charter needs user approval). Leaning: spin item 7 out as its own change in hpe-altloader, `blocked_by` this doc's release, keeping `Why now` as its rationale. If kept, item 7 must pin a commit SHA on the integration branch instead of a tag, and the orchestrator must resolve hpe-altloader's `main_semantics` (undeclared, so `released`) before landing its PR. |
