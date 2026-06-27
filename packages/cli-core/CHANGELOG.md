# @hprabhash/shell-cli

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
