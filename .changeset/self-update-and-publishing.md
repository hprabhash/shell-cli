---
"@hprabhash/shell-cli": minor
"@shell-cli/shared": minor
"@shell-cli/template-engine": patch
"@shell-cli/plugin-next": patch
"@shell-cli/plugin-better-auth": patch
"@shell-cli/plugin-prisma": patch
"@shell-cli/plugin-drizzle": patch
"@shell-cli/plugin-postgres": patch
---

`shell update` now actually applies an available update (with confirmation,
or `--yes` to skip it) instead of only printing the install command, and
gained `--rollback` to reinstall whichever version it last replaced.

Every workspace package is now publishable (previously `private`, never
published) and `cli-core` is renamed to `@hprabhash/shell-cli` — the
unscoped `shell-cli` name is already taken on the public npm registry.
