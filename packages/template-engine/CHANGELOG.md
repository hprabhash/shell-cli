# @hprabhash/template-engine

## 0.1.2

### Patch Changes

- 9e9e5c2: Fix `shell create` failing with `ENOENT ... .gitignore` for every ORM plugin
  (Prisma, Drizzle) that patches the generated project's `.gitignore`. The
  Next.js template's `.gitignore` file never made it into the published npm
  tarball — `npm publish` treats a `.gitignore` file as packing-control input
  and silently strips it, even nested deep inside template content meant to be
  copied verbatim. The template now ships the dotless `gitignore`, and
  `renderTemplateTree` restores the leading dot when writing it into the
  generated project.

## 0.1.1

### Patch Changes

- b5d05cd: `shell update` now actually applies an available update (with confirmation,
  or `--yes` to skip it) instead of only printing the install command, and
  gained `--rollback` to reinstall whichever version it last replaced.

  Every workspace package is now publishable (previously `private`, never
  published) and `cli-core` is renamed to `@hprabhash/shell-cli` — the
  unscoped `shell-cli` name is already taken on the public npm registry.

- Updated dependencies [b5d05cd]
  - @hprabhash/shared@0.2.0
