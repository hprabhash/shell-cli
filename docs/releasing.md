# Releasing

Versioning and publishing are managed with
[Changesets](https://github.com/changesets/changesets) across this pnpm
monorepo's 8 packages. This doc is the practical "how do I cut a release"
guide — see [architecture.md](architecture.md)'s Phase 9 section for why
it's built this way (including the real publishability bug that shaped it).

## The packages

| package                       | npm name                        | what it is                                 |
| ----------------------------- | ------------------------------- | ------------------------------------------ |
| `packages/cli-core`           | `@hprabhash/shell-cli`          | the CLI itself (bin: `shell`)              |
| `packages/shared`             | `@hprabhash/shared`             | errors, types, constants, schemas          |
| `packages/template-engine`    | `@hprabhash/template-engine`    | Handlebars rendering, rollback-safe writes |
| `packages/plugin-next`        | `@hprabhash/plugin-next`        | Next.js framework plugin                   |
| `packages/plugin-better-auth` | `@hprabhash/plugin-better-auth` | Better Auth plugin                         |
| `packages/plugin-prisma`      | `@hprabhash/plugin-prisma`      | Prisma ORM plugin                          |
| `packages/plugin-drizzle`     | `@hprabhash/plugin-drizzle`     | Drizzle ORM plugin                         |
| `packages/plugin-postgres`    | `@hprabhash/plugin-postgres`    | PostgreSQL database plugin                 |

All 8 are publicly publishable (`publishConfig.access: "public"`), all under
the single `@hprabhash` npm scope — see [Current status](#current-status)
below.

## Day to day: adding a changeset

Whenever you make a change worth a version bump (a new feature, a fix,
anything user-visible), describe it:

```bash
pnpm changeset
```

This asks interactively which packages changed and how (`patch`/`minor`/
`major`), then writes a markdown file under `.changeset/` describing it.
Commit that file alongside your change. You can add multiple changesets
before a release — they all get rolled up together.

If a change genuinely needs no release (docs, CI config, tests), you don't
need a changeset — but if you skip one for something that _does_ affect a
package, `pnpm changeset status` (and the CI-adjacent tooling) will flag it.

## What happens automatically

Two GitHub Actions workflows:

- **`.github/workflows/ci.yml`** — every push/PR to `main`: build, typecheck,
  lint, format check, unit/integration/e2e tests. Nothing release-related;
  this just gates merges.
- **`.github/workflows/release.yml`** — every push to `main`:
  - If there are pending changesets, it opens (or updates) a **"Version
    Packages" pull request** — this PR contains the version bumps and
    `CHANGELOG.md` updates that `pnpm version-packages` (`changeset version`)
    would produce, computed for you. You don't write this PR; the
    `changesets/action` bot does.
  - If that PR was just merged (i.e. the push _is_ the version-bump commit),
    it instead runs `pnpm release` (`pnpm build && changeset publish`),
    publishing every package whose version just changed.

**To actually release:** merge the Version Packages PR whenever you're ready.
That's the entire manual step — versions, changelogs, and publishing are all
automatic from there.

## Current status

`NPM_TOKEN` is configured, and all 8 packages publish under the `@hprabhash`
npm scope — an npm Organization (not a personal scope; the account's real
npm username is `prabhashkutti`, not `hprabhash`) that the publishing
account is a member of.

**Why everything is under one scope:** the packages were originally split
across `@hprabhash/shell-cli` (matching the org) and `@shell-cli/*` (for the
other 7). That second scope was never actually created as an npm org, so
`changeset publish` published `@hprabhash/shell-cli` successfully and then
hard-failed on the first `@shell-cli/*` package — leaving a published
`@hprabhash/shell-cli` version with dependencies on six packages that don't
exist on the registry (uninstallable). Rather than create and maintain a
second org, every package was renamed onto the single, already-working
`@hprabhash` scope, and `@hprabhash/shell-cli` got a patch release to fix
its now-correct dependency names.

**To add more packages later:** as long as they're scoped `@hprabhash/*`,
no further npm-side setup is needed — the org and the token already work.

## Manual commands (rarely needed)

You shouldn't normally need these — the GitHub Actions workflow does it for
you — but for local testing or emergencies:

```bash
pnpm changeset           # add a changeset (interactive)
pnpm version-packages     # changeset version -- bump versions + changelogs locally
pnpm release              # pnpm build && changeset publish -- needs npm auth configured locally
pnpm -r publish --dry-run # validate every package would pack/publish correctly, no network write
```

`pnpm pack` (run inside any package directory) produces a real local
`.tgz` you can inspect — useful for confirming `workspace:*` dependencies
were rewritten to real version ranges, or that a `files` field is including
everything it should (e.g. `plugin-next`'s `templates/` directory).
