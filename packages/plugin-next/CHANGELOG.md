# @shell-cli/plugin-next

## 0.1.1

### Patch Changes

- b5d05cd: `shell update` now actually applies an available update (with confirmation,
  or `--yes` to skip it) instead of only printing the install command, and
  gained `--rollback` to reinstall whichever version it last replaced.

  Every workspace package is now publishable (previously `private`, never
  published) and `cli-core` is renamed to `@hprabhash/shell-cli` — the
  unscoped `shell-cli` name is already taken on the public npm registry.

- Updated dependencies [b5d05cd]
  - @shell-cli/shared@0.2.0
  - @shell-cli/template-engine@0.1.1
