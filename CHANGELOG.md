---
fe-managed: true
name: activities-loader-changelog
title: Changelog
description: Changelog for the activities-loader repo.
governed_by: change-management/changelog
managed_by: change-management
version: "0.1.0"
created: 2026-10-09
updated: 2026-10-09
---
# Changelog

## [Unreleased]

### Added
- Root CHANGELOG.md, making the repo root a managed resource under fe-sys-hq governance
- .gitignore coverage required by rule 10: credential file patterns, tmp/, OS artifacts and editor files

### Fixed
- README Governance section now lists all seven deployed rules and the managed fe- workflows
- README says setup:local copies files from hpe-altloader into src/, matching scripts/setup-local.js, instead of symlinking them
- Loader build and runtime fixes: --all removed with a usage error for a run with neither --group nor --lib, dist/ cleared per run unless --no-clean, npm run build builds every group then the loader, "does not contain any of" means none of, environments derived from the config, and the environment indicator waits for the body [loader-hardening]

### Changed
- setup:local reads from --source, ALTLOADER_SRC, a sibling hpe-web-dev activities/ or a sibling hpe-altloader, and no longer writes lockfiles; unused fs, child-process and rollup-plugin-cleandir packages and package-lock.json removed [loader-hardening]
