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
| `packages/shared`             | `@shell-cli/shared`             | errors, types, constants, schemas          |
| `packages/template-engine`    | `@shell-cli/template-engine`    | Handlebars rendering, rollback-safe writes |
| `packages/plugin-next`        | `@shell-cli/plugin-next`        | Next.js framework plugin                   |
| `packages/plugin-better-auth` | `@shell-cli/plugin-better-auth` | Better Auth plugin                         |
| `packages/plugin-prisma`      | `@shell-cli/plugin-prisma`      | Prisma ORM plugin                          |
| `packages/plugin-drizzle`     | `@shell-cli/plugin-drizzle`     | Drizzle ORM plugin                         |
| `packages/plugin-postgres`    | `@shell-cli/plugin-postgres`    | PostgreSQL database plugin                 |

All 8 are publicly publishable (`publishConfig.access: "public"`). None are
published yet — see [Current status](#current-status-nothing-published-yet)
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

## Current status: nothing published yet

By deliberate decision, no `NPM_TOKEN` secret is configured on this repo —
so the publish half of `release.yml` has nothing to authenticate with.
Merging the Version Packages PR today would bump versions and update
changelogs but **not** actually publish anything to npm (the publish step
will just fail to authenticate). This is intentional, not a bug.

**To enable real publishing:**

1. Generate an npm
   [automation token](https://docs.npmjs.com/creating-and-viewing-access-tokens)
   under whichever npm account/org will own these packages.
2. Add it as a repository secret named `NPM_TOKEN`
   (Settings → Secrets and variables → Actions → New repository secret).
3. Push anything to `main` (or just merge the next Version Packages PR) —
   `release.yml`'s publish step will pick up the secret automatically via
   `actions/setup-node`'s `registry-url` + `NODE_AUTH_TOKEN` mechanism (see
   `release.yml`'s comments). No workflow changes needed.

Note `@hprabhash/shell-cli` needs the `@hprabhash` npm scope to exist and be
owned by whoever's token you use; the `@shell-cli/*` packages need the
`@shell-cli` scope similarly (create it as an npm org if you don't already
have packages published under it).

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
