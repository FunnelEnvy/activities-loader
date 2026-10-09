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
