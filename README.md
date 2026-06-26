# Shell CLI

A production-grade, plugin-driven project scaffolding CLI — generate full-stack apps
(Next.js, Better Auth, Prisma/Drizzle, PostgreSQL, and more) with one command:

```bash
npm install -g @hprabhash/shell-cli
shell create my-app
```

> **Status: Phases 1–9 complete.** `shell create` generates a real Next.js 16
> project with optional Better Auth, Prisma/Drizzle + PostgreSQL, wired together
> correctly. `shell template`/`shell update` talk to a real remote registry and
> npm respectively. See [docs/architecture.md](docs/architecture.md) for the
> full design history, phase by phase, including the real bugs manual
> end-to-end verification caught along the way.

## Monorepo layout

```
packages/
  shared/              @shell-cli/shared              — errors, types, constants, schemas
  template-engine/     @shell-cli/template-engine      — Handlebars rendering, rollback-safe file writes
  plugin-next/         @shell-cli/plugin-next          — Next.js 16 (App Router) framework plugin
  plugin-better-auth/  @shell-cli/plugin-better-auth   — Better Auth, 19 selectable features
  plugin-prisma/       @shell-cli/plugin-prisma        — Prisma 7 (driver-adapter) ORM plugin
  plugin-drizzle/      @shell-cli/plugin-drizzle       — Drizzle ORM plugin
  plugin-postgres/     @shell-cli/plugin-postgres      — PostgreSQL via docker-compose
  cli-core/            @hprabhash/shell-cli            — the CLI itself (bin: `shell`)
registry/                                              — remote template registry content
  templates.json                                       — manifest, served via raw.githubusercontent.com
```

## Development

Requires Node >=20 and pnpm.

```bash
pnpm install
pnpm build             # builds all packages
pnpm typecheck         # tsc --noEmit across all packages
pnpm lint              # eslint
pnpm format:check      # prettier --check
pnpm test              # unit tests (vitest)
pnpm test:integration  # integration tests (real local fixtures/servers, no mocking)
pnpm test:e2e          # end-to-end CLI tests (spawns the built binary)
```

To run the CLI locally without a global link:

```bash
pnpm --filter @hprabhash/shell-cli build
node packages/cli-core/dist/bin.js --help
```

To try it as a real global command:

```bash
pnpm --filter @hprabhash/shell-cli build
pnpm --filter @hprabhash/shell-cli exec npm link
shell --help
```

## Releasing

Versioning and changelogs are managed with [Changesets](https://github.com/changesets/changesets):

```bash
pnpm changeset          # describe a change and its semver impact
pnpm version-packages    # bump versions + update CHANGELOGs from pending changesets
pnpm release             # build, then publish every changed package to npm
```

CI (`.github/workflows/ci.yml`) runs the full gate sweep above on every push/PR.
`.github/workflows/release.yml` opens a "Version Packages" PR when changesets are
pending and publishes once it's merged — gated behind an `NPM_TOKEN` repository
secret that isn't configured yet, so nothing publishes automatically today.

## License

MIT
