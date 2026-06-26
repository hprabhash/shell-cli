# Shell CLI

A production-grade, plugin-driven project scaffolding CLI — generate full-stack apps
(Next.js, Better Auth, Prisma/Drizzle, PostgreSQL, shadcn/ui, and more) with one command:

```bash
npm install -g shell-cli
shell create my-app
```

> **Status: Phase 1 — CLI Core.** Commands, prompts, logging, and configuration are
> implemented. Actual project file generation lands in Phase 4 once the plugin system
> (Phase 2) and template engine (Phase 3) exist. See [docs/architecture.md](docs/architecture.md)
> for the full roadmap and what's real vs. planned today.

## Monorepo layout

```
packages/
  shared/     @shell-cli/shared   — errors, types, constants, config schema
  cli-core/   shell-cli           — the CLI itself (bin: `shell`)
```

## Development

Requires Node >=20 and pnpm.

```bash
pnpm install
pnpm build        # builds all packages
pnpm typecheck     # tsc --noEmit across all packages
pnpm lint          # eslint
pnpm test          # unit tests (vitest)
pnpm test:e2e      # end-to-end CLI tests (spawns the built binary)
```

To run the CLI locally without a global link:

```bash
pnpm --filter shell-cli build
node packages/cli-core/dist/bin.js --help
```

To try it as a real global command:

```bash
pnpm --filter shell-cli build
pnpm --filter shell-cli exec npm link
shell --help
```

## License

MIT
