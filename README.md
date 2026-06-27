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
> npm respectively.

## Documentation

| Doc                                                  | What's in it                                                                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [docs/usage.md](docs/usage.md)                       | Using the CLI: every command, every flag, what it actually does.                                                                                      |
| [docs/contributing.md](docs/contributing.md)         | Dev setup, monorepo layout, testing strategy, adding a new plugin, gotchas.                                                                           |
| [docs/adding-templates.md](docs/adding-templates.md) | Publishing a new template (or version) to the remote registry.                                                                                        |
| [docs/releasing.md](docs/releasing.md)               | Changesets workflow, what's automated, how to actually cut a release.                                                                                 |
| [docs/architecture.md](docs/architecture.md)         | Full design history, phase by phase — the _why_ behind everything above, including the real bugs manual end-to-end verification caught along the way. |

## Monorepo layout

```
packages/
  shared/              @hprabhash/shared              — errors, types, constants, schemas
  template-engine/     @hprabhash/template-engine      — Handlebars rendering, rollback-safe file writes
  plugin-next/         @hprabhash/plugin-next          — Next.js 16 (App Router) framework plugin
  plugin-better-auth/  @hprabhash/plugin-better-auth   — Better Auth, 19 selectable features
  plugin-prisma/       @hprabhash/plugin-prisma        — Prisma 7 (driver-adapter) ORM plugin
  plugin-drizzle/      @hprabhash/plugin-drizzle       — Drizzle ORM plugin
  plugin-postgres/     @hprabhash/plugin-postgres      — PostgreSQL via docker-compose
  cli-core/            @hprabhash/shell-cli            — the CLI itself (bin: `shell`)
registry/                                              — remote template registry content
  templates.json                                       — manifest, served via raw.githubusercontent.com
```

## Quick start for development

Requires Node >=22.22.1 and pnpm. Full detail in
[docs/contributing.md](docs/contributing.md).

```bash
pnpm install
pnpm build
node packages/cli-core/dist/bin.js --help
```

## License

MIT
