# @hprabhash/shell-cli

## 0.2.2

### Patch Changes

- Updated dependencies [9e9e5c2]
  - @hprabhash/plugin-next@0.1.2
  - @hprabhash/plugin-better-auth@0.1.2
  - @hprabhash/plugin-drizzle@0.1.2
  - @hprabhash/plugin-postgres@0.1.2
  - @hprabhash/plugin-prisma@0.1.2

## 0.2.1

### Patch Changes

- 8fca491: Fix broken dependencies on npm: the published 0.2.0 depended on
  `@shell-cli/shared`, `@shell-cli/plugin-better-auth`, and four other
  `@shell-cli/*` packages that were never actually published (that scope
  was never created as an npm organization), making `0.2.0` uninstallable.
  All packages have been renamed to the `@hprabhash` scope, which is a real
  org with publish access.

## 0.2.0

### Minor Changes

- b5d05cd: `shell update` now actually applies an available update (with confirmation,
  or `--yes` to skip it) instead of only printing the install command, and
  gained `--rollback` to reinstall whichever version it last replaced.

  Every workspace package is now publishable (previously `private`, never
  published) and `cli-core` is renamed to `@hprabhash/shell-cli` — the
  unscoped `shell-cli` name is already taken on the public npm registry.

### Patch Changes

- Updated dependencies [b5d05cd]
  - @hprabhash/shared@0.2.0
  - @hprabhash/plugin-next@0.1.1
  - @hprabhash/plugin-better-auth@0.1.1
  - @hprabhash/plugin-prisma@0.1.1
  - @hprabhash/plugin-drizzle@0.1.1
  - @hprabhash/plugin-postgres@0.1.1
