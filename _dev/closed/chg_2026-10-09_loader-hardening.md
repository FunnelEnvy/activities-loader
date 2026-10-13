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
status: Closed
status_note: "Closed 2026-10-13 as completed; awaiting release"
resource_name: repo
resource_version: "TBD"
impact: 3
confidence: 4
ease: 4
initiative: altloader-cut-over
held_by:
  - sam_altloader-cut-over
owner: Sam Baron
version: "0.11.0"
created: 2026-10-09
updated: 2026-10-13
closed_as: completed
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
- **Production deploy path: no.** No workflow, bucket path or release step changes. The `build.js` and `init-activities.js` fixes still reach production. hpe-altloader checks the loader out at `main`, unpinned (`Current State` > `Callers`), so its first rebuild after the fixes reach `main` ships them in `fe_altloader.js` and the group bundles. Clearing `dist/` on every run does not change what those callers upload. Each hpe-altloader job runs `build.js` once before its upload, and `rebuild-all-activities.yml` already runs `rm -rf ./dist` between its builds (`git grep -n -E "build\.js|rm -rf ./dist|s3 (sync|cp)" origin/master -- .github/workflows/` at `53f7052`, 2026-10-13). The deploys install with `yarn install --frozen-lockfile` through the `setup-yarn` composite action (`git show origin/master:.github/actions/setup-yarn/action.yml`), so the lockfile edit also reaches production.

### Plan

**Owner decisions, 2026-10-12.** The change makes no major build or deploy architecture change. It fixes the loader's own code and teaches `setup-local.js` hpe-web-dev's layout. hpe-altloader keeps its workflows until 5.6, and hpe-web-dev ports them in member 5.7 ([hpe-web-dev:charter](hpe-web-dev:CHARTER.md) `Decisions made at kickoff`, `Build and deploy` row). Work that left this change is listed under `Out of Scope`.

1. **Defect fixes.** Fix the six loader-code defects that hold (`Current State` > `Defects`).
   - *Build (1, 2).* Remove `--all`, and make a run with neither `--lib` nor `--group` exit with a usage error. The full rebuild already builds each group on its own, because each group syncs to its own prefix. The `build` script in `package.json` then runs the same sequence as hpe-altloader's `rebuild-all-activities.yml`: each of the three groups with `--group`, then `--lib`. That keeps the README's "Build all activities" description true (owner decision, 2026-10-12).
   - *Clearing `dist/` (2).* `build.js` clears `dist/` on every run by default, and a `--no-clean` flag skips the clear. `npm run build` clears on its first invocation and passes `--no-clean` to the other three, so it ends with all four outputs in `dist/` (owner decision, 2026-10-13). Without the flag, each of the script's four runs would clear the one before it and leave only the loader output. The clear uses Node's `fs`. `rollup-plugin-cleandir` cannot do it as a registered plugin, because a run makes many rollup builds and the plugin would clear `dist/` before each one. The package is then unused and goes with the others under *Packages* (Design review, 2026-10-13).
   - *Targeting operator (4).* Make `does not contain any of` return `!value.some`.
   - *Packages (9).* Remove the `fs` and `child-process` packages and `package-lock.json`. `rollup-plugin-cleandir` goes too, once the clear no longer uses it.
   - *Dead config (10).* Derive `VALID_ENVS` from the inlined `environments` keys plus `PROD`, and delete `detectTypeOfSite`.
   - *Environment indicator (11).* Make `createEnvironmentIndicator` wait for `document.body`.
   - *Defect 3.* No fix. Discovery disproved it.
2. **Source path.** `setup-local.js` reads the config files and `libs/` from a configurable root instead of a fixed sibling hpe-altloader clone. It takes the root as `--source <path>` or `ALTLOADER_SRC`. The default is a sibling hpe-web-dev clone's `activities/`, where the groups, config files and `libs/` sit together. When that is absent, it falls back to a sibling hpe-altloader clone's root. The [README](../../README.md)'s local-setup text follows.

   `setup-local.js` copies the config files and `libs/`, not the activity directories, as it does today. The group builds read activity source from `src/activities/{dir}/`, which CI fills by copying each group directory's contents there (`rebuild-all-activities.yml`, `Copy files` step). A local `npm run build` needs the same staging. The README states it rather than `setup-local.js` taking it on (Design review, 2026-10-13).

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

R1 to R9 land in activities-loader. R10 is a hpe-web-dev KB edit. The root `CHANGELOG.md` gets its `[Unreleased]` entry at Closed, not in Build.

**R1. Build arguments.** `build.js` builds one group with `--group <B2B-Hybris|B2C|configurator>`, optionally narrowed by `--activities`, or the loader with `--lib`. Delete the `argv.all` branch. A run with neither `--group` nor `--lib` prints a usage message naming both flags and exits non-zero. It does this before it clears or writes anything, so `--all` alone now gets the usage error. A run with both flags keeps today's behavior: `--lib` wins.

**R2. Clearing `dist/`.** After the argument check and before any build, `build.js` deletes `dist/` with Node's `fs` (recursive, ignoring a missing directory). `--no-clean` skips the delete. Remove the bare `cleandir('dist')` call and its `rollup-plugin-cleandir` import.

**R3. `build` script.** The `package.json` `build` script runs four commands joined by `&&`:

1. `node build.js --group B2C`
2. `node build.js --no-clean --group B2B-Hybris`
3. `node build.js --no-clean --group configurator`
4. `node build.js --no-clean --lib`

The `setup:local` and `build:local` scripts keep their commands.

**R4. Targeting operator.** In `evaluateCondition`, `does not contain any of` returns `!value.some(val => url.includes(val))`. No other operator changes.

**R5. Packages and lockfiles.** Remove `fs` from `dependencies`, and `child-process` and `rollup-plugin-cleandir` from `devDependencies`. Delete `package-lock.json`. In `yarn.lock`, remove the entries for those three packages and for `@mstssk/cleandir`, which only `rollup-plugin-cleandir` requires (`grep -n '"@mstssk/cleandir"' yarn.lock` at `859e48d` prints one dependent line, inside the `rollup-plugin-cleandir` entry). Change nothing else in `yarn.lock`, because the deploys install it with `--frozen-lockfile`.

**R6. Environment config.** `detectTypeOfEnvironment` builds its valid list from `Object.keys(environments || {})` plus `PROD`, replacing the hard-coded `['DEV', 'QA', 'PROD']`. The guard keeps a config with no `environments` block loading with `PROD` alone rather than throwing (QA review, 2026-10-13). With hpe-altloader's current `environments` block, which has the keys `QA` and `DEV`, the valid set is unchanged. Delete `detectTypeOfSite` and its `window.FeActivityLoader.detectTypeOfSite` export. `detectSites` and the other exports stay.

**R7. Environment indicator.** `createEnvironmentIndicator` appends the indicator at once when `document.body` exists. Otherwise it appends on `DOMContentLoaded`. `runLoader` does not wait for it. The `PROD` early return and the indicator's text and style are unchanged.

**R8. Source resolution.** `setup-local.js` picks its source root by the first rule that applies:

1. `--source <path>`, resolved against the current directory;
2. the `ALTLOADER_SRC` environment variable;
3. a sibling `../hpe-web-dev/activities`, when it exists;
4. a sibling `../hpe-altloader`.

An explicit root from rule 1 or 2 that does not exist is an error, with no fallback. When no rule yields an existing root, the script exits non-zero and names every path it tried. As today, the root's existence is checked before `src/` is removed. The script logs the chosen root and the rule that chose it. It copies the same five config files and `libs/` from that root, and runs the `src/libs` install as today with `--no-package-lock` added. Without it, npm writes a root `package-lock.json` and rewrites `yarn.lock`, because the root is a yarn workspace that includes `src/libs` (QA review, 2026-10-13). It does not copy activity directories.

**R9. Local-setup text.** Every surface in this repo that says where `setup:local` reads from, or how to build after it, matches R3 and R8. The search `git grep -n -E "hpe-altloader|setup:local|setup-local|build:local|npm run build" -- README.md scripts package.json` at `859e48d` finds these sites:

- README `Build Pipeline` table, rows `npm run build`, `npm run build:local` and `npm run setup:local`;
- README `Dependencies`, the hpe-altloader bullet;
- `scripts/setup-local.js`, its header comment, the not-found error text and the closing hint, which today reads `npm run build -- --lib`.

The `npm run build` row says the build expects `src/` staged the way CI stages it: config files and `libs/` at `src/`, and each group directory's contents copied into `src/activities/`. It then gives the install step, `yarn install --frozen-lockfile`, as the deploys run it (owner decision, 2026-10-13). The `build:local` row says it takes its source through `ALTLOADER_SRC`, since `npm run build:local -- --source` would pass the flag to `build.js`. The README's frontmatter `version` stays, because the version cascade is Release-only.

**R10 (Orchestrator-Owned).** In hpe-web-dev, `kb-altloader/reference/loader-runtime.md` § `Environments` says the valid values are hard-coded and that `init-activities.js` never reads the `environments` block. Once R6 reaches activities-loader `main`, update both statements to the derived list. Make the edit through that KB's own governance. The search `git -C hpe-web-dev grep -n -I -E "never reads|hardcoded in the function|detectTypeOfSite" -- kb-altloader` at `6962812` finds no other stale site. The same search over hpe-altloader `docs/` at `53f7052` finds none.

## Verification Design

### Validation

**Setup.** Put scratch files under `tmp/`, with the run's date prefix. In this environment hpe-altloader is cloned at `/home/user/HPE-altloader`, so the sibling default `../hpe-altloader` does not resolve, and hpe-web-dev has no `activities/` yet. Stage `src/` the way CI does:

1. `node scripts/setup-local.js --source /home/user/HPE-altloader`
2. `mkdir -p src/activities`, then copy the contents of each of hpe-altloader's `B2C/`, `B2B-Hybris/` and `configurator/` into it.
3. `yarn install --frozen-lockfile`, as the deploys run it. A plain `yarn install` here rewrites `yarn.lock`, because the staged activities become root workspaces.

Record the hpe-altloader sha used. The pre-change commit is `859e48d`.

1. **Group builds (R1, R2).** Run `node build.js --group B2C`, `--group B2B-Hybris` and `--group configurator` in turn. Each exits 0. After each run, `dist/` holds only that group's `fe_activity_*` bundles and their maps. Keep each run's file list for criterion 6. If a group exits 1, rerun it at `859e48d`. Matching `build-errors.json` content there marks the failure as pre-existing. Record it, and mark criterion 6 deferred for that cause.
2. **Loader build (R1, R2).** `node build.js --lib` exits 0, and `dist/` then holds only `fe_altloader.js` and `fe_altloader.js.map`.
3. **Usage error (R1).** With `dist/` populated, `node build.js` and `node build.js --all` each exit non-zero and print a usage message naming `--group` and `--lib`. The `dist/` listing is unchanged afterwards.
4. **`--activities` still narrows (R1).** `node build.js --group B2C --activities <one B2C dir>` builds only that activity's bundles. The group deploys depend on this flag.
5. **Clear and `--no-clean` (R2).** Create `dist/stale.js`, then run `node build.js --lib`. `stale.js` is gone. Then `node build.js --no-clean --group configurator` leaves both the loader files and the configurator bundles in `dist/`. `grep -n cleandir build.js` prints nothing.
6. **`npm run build` (R3).** It exits 0 and leaves `dist/` holding exactly the union of the file lists from criteria 1 and 2.
7. **Operator (R4).** A scratch Node script extracts `evaluateCondition` from `init-activities.js` and runs it in `vm` with a stubbed `window.location.href`, using `value: ["/a", "/b"]`. A URL with neither returns `true`. A URL with `/a` only returns `false`, and so does one with both. At `859e48d` the same script returns `true` for `/a` only, which shows the case fails before the fix.
8. **Packages and lockfiles (R5).** `package.json` lists none of `fs`, `child-process` or `rollup-plugin-cleandir`, and `package-lock.json` is gone. `grep -n -E '^"?(fs|child-process|rollup-plugin-cleandir|@mstssk/cleandir)@' yarn.lock` prints nothing. `git diff 859e48d -- yarn.lock` removes those four entries and nothing else. Run `yarn install --frozen-lockfile` in two layouts, `src/` empty and `src/` staged per `Setup`. In each layout the outcome after the change matches the outcome at `859e48d`. `Setup` step 1 leaves `yarn.lock` unchanged and writes no `package-lock.json` (`git status --short`).
9. **Environment config (R6).** In `init-activities.js`, `grep -n "\['DEV', 'QA', 'PROD'\]"` and `grep -n detectTypeOfSite` print nothing. Load the built `fe_altloader.js` in a local page served by `http-server` and opened in Playwright's Chromium (Playwright 1.56.1, browsers in `/opt/pw-browsers`). Then check:
   - `?FE_LOADER=DEV` shows the indicator reading `DEV`;
   - `?FE_LOADER=QA` shows it reading `QA`;
   - `?FE_LOADER=STAGING` logs `Invalid environment` and shows no indicator;
   - no parameter shows no indicator;
   - `window.FeActivityLoader.detectTypeOfSite` is `undefined` and `detectSites` is a function.
10. **Indicator wait (R7).** In the same harness, with the loader in `<head>` and `?FE_LOADER=QA`, the page logs no uncaught `TypeError`, and the indicator is present after `DOMContentLoaded`. A loader built at `859e48d` on the same page logs the `appendChild` `TypeError`. With the loader at the end of `<body>`, the indicator is present as soon as the script runs.
11. **Source resolution (R8).** Build a fixture tree under `tmp/`. Copy `scripts/setup-local.js` into `<fixture>/activities-loader/scripts/`. Give `<fixture>/hpe-web-dev/activities/`, `<fixture>/hpe-altloader/` and two custom roots each the five config files, every one with marker content naming its root, plus a `libs/` with no `package.json`. Run the copied script from `<fixture>/activities-loader/` and read the marker in `src/activities.json`:
    - both sibling defaults present, no flag or variable: hpe-web-dev's `activities/`;
    - `hpe-web-dev/activities/` removed: hpe-altloader;
    - `ALTLOADER_SRC=<custom-1>`: custom-1;
    - `--source <custom-2>` with `ALTLOADER_SRC` also set: custom-2;
    - `--source` naming a missing path: non-zero exit, no fallback, and the existing `src/` is untouched;
    - no flag, no variable and neither sibling present: non-zero exit, a message listing every path tried, and `src/` untouched.

    In each successful case, the log names the chosen root and its rule. `Setup` step 1 covers a real `--source` run against hpe-altloader.
12. **Local-setup text (R9).** Each R9 site describes R8's resolution order and R3's build. The README `npm run build` row states the CI-style staging and the `yarn install --frozen-lockfile` step, and the `build:local` row names `ALTLOADER_SRC`. `grep -n "npm run build -- --lib" scripts/setup-local.js` prints nothing. The README frontmatter `version` equals its `859e48d` value.
13. **KB statement (R10).** The orchestrator confirms in hpe-web-dev that `kb-altloader/reference/loader-runtime.md` § `Environments` describes the derived list and no longer says the block is never read.
14. **Post-release rebuild (R1 to R6).** After the release cut lands these fixes on `main`, run hpe-altloader's `rebuild-all-activities.yml` by hand (owner decision, 2026-10-13). It builds each group and then `--lib` against activities-loader `main`, the sequence R3 mirrors. Every build and upload step passes, and the next push-triggered deploy, which installs with `--frozen-lockfile`, passes too. The rebuild deploys every group and the loader to production, so run it when a full redeploy is acceptable.

## Verification Results

### Validation Outcomes

12/14 confirmed; 2 deferred. Run at activities-loader `b9de38d` plus the QA fixes, against hpe-altloader `53f7052` (`git -C /home/user/HPE-altloader rev-parse --short HEAD`, 2026-10-13).

- **12 (R9), re-checked** at `a35b879` after the README install-step edit: confirmed.
- **13 (R10), deferred.** Orchestrator-owned in hpe-web-dev, and due only once R6 reaches activities-loader `main`. `kb-altloader/reference/loader-runtime.md` § `Environments` still says the values are hard-coded (read 2026-10-13).
- **14 (post-release rebuild), deferred.** It runs only after the release cut, and the release PR's `Post-Release Tasks` section carries it with R10.
