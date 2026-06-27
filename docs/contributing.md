# Contributing / Development Guide

Practical "how do I keep building this" reference. For the _why_ behind any
given decision, [architecture.md](architecture.md) has the full phase-by-phase
history — this doc is the condensed, task-oriented version.

## Setup

Requires Node `>=22.22.1` and pnpm (pinned via `packageManager` in the root
`package.json` — `corepack enable` will pick it up automatically).

```bash
pnpm install
pnpm build
```

## Monorepo layout

```
packages/
  shared/              @hprabhash/shared              — errors, types, constants, zod schemas
  template-engine/     @hprabhash/template-engine      — Handlebars rendering, rollback-safe file writes
  plugin-next/         @hprabhash/plugin-next          — Next.js 16 framework plugin
  plugin-better-auth/  @hprabhash/plugin-better-auth   — Better Auth, 19 selectable features
  plugin-prisma/       @hprabhash/plugin-prisma        — Prisma ORM plugin
  plugin-drizzle/      @hprabhash/plugin-drizzle       — Drizzle ORM plugin
  plugin-postgres/     @hprabhash/plugin-postgres      — PostgreSQL database plugin
  cli-core/            @hprabhash/shell-cli            — the CLI itself (bin: `shell`)
registry/                                              — remote template registry content (see adding-templates.md)
scripts/                                                — one-off maintainer tooling (e.g. publish-registry-template.mjs)
```

Dependency direction: `shared` and `template-engine` have no internal deps;
every plugin depends on `shared` (and `template-engine` if it renders
files); `cli-core` depends on every plugin + `shared`. Plugins never depend
on `cli-core` — that would be circular.

## Scripts

```bash
pnpm build              # builds all packages (tsup)
pnpm typecheck           # tsc --noEmit across all packages
pnpm lint                # eslint (flat config, strict + stylistic type-checked rules)
pnpm lint:fix
pnpm format              # prettier --write
pnpm format:check
pnpm test                # unit tests (vitest)
pnpm test:integration    # integration tests
pnpm test:e2e            # e2e tests (spawns the built dist/bin.js — run `pnpm build` first)
pnpm test:watch
```

Husky + lint-staged run `eslint --fix` and `prettier --write` on staged files
on every commit — don't bypass with `--no-verify`.

## Testing strategy

Three tiers, each with a distinct purpose — match the existing pattern for
whatever you're adding rather than inventing a new one:

- **Unit** (`packages/*/tests/unit/`): pure logic, no real I/O where
  avoidable. Functions that talk to the network or spawn processes take an
  injectable parameter (`CommandRunner` for processes, explicit URL params
  for `fetch`) defaulting to the real implementation — tests inject a fake.
  See `core/system-checks.ts`'s `checkGit(runner)` or
  `core/self-update.ts`'s `resolveInstallCommand(..., runner)` for the
  pattern. **Commands themselves (`commands/*.ts`) are not unit tested** —
  they're thin CLI-wiring layers tested via e2e instead. If a command's
  logic is complex enough to deserve direct tests, factor it into a
  `core/*.ts` module first (e.g. `template.ts` → `registry-client.ts`/
  `template-cache.ts`; `update.ts` → `self-update.ts`).
- **Integration** (`packages/*/tests/integration/`): real file I/O in temp
  directories, real local HTTP servers (`node:http`, see
  `tests/fixtures/test-registry-server.ts`) instead of mocking `fetch` —
  this project's house style is to avoid mocking the actual boundary being
  tested wherever a real (if local/fake) version is feasible.
- **e2e** (`packages/cli-core/tests/e2e/`): spawns the actual built
  `dist/bin.js` via `execa`, asserts on real stdout/exit codes. Run
  `pnpm build` first. Use `--no-install`/`--registry-url <local-server>`/etc.
  to keep these fast and offline — never let an e2e test perform a real
  global package install or a real npm publish.

**Manual verification matters more than the automated suite for anything
touching real external tooling** (a real `npm install`, a real `next build`,
a real registry over HTTPS, a real GitHub Actions run). Every phase in
architecture.md found at least one real bug this way that no amount of
mocked testing would have caught — budget time for it when adding anything
that shells out to or downloads from something real.

## Adding a new plugin

Every plugin implements the `Plugin` interface
(`packages/shared/src/plugin.ts`):

```ts
interface Plugin {
  register: () => PluginMetadata; // id, name, category, version, description — required
  questions: () => PluginQuestionDefinition[]; // required; [] if none
  validate: (answers) => { valid: boolean; problems: string[] }; // required
  doctor: () => Promise<CheckResult[]>; // required; [] if no checks
  install?: (ctx) => Promise<void>; // optional
  generate?: (ctx: PluginGenerateContext) => Promise<void>; // optional — most plugins implement this
  postInstall?: (ctx: PluginPostInstallContext) => Promise<void>; // optional
}
```

`register`/`questions`/`validate`/`doctor` are required because "nothing
extra to ask" / "always valid" / "no checks" are genuinely correct answers
even for a minimal plugin — there's no good reason to make them optional.
`generate`/`install`/`postInstall` are optional because a plugin might
legitimately have nothing to do for one of them (e.g. `plugin-postgres` has
no `postInstall` — nothing to run without a live decision about where
Postgres actually runs).

Steps:

1. Scaffold `packages/plugin-<name>/` matching an existing plugin's
   `package.json`/`tsconfig.json`/`tsup.config.ts` (copy `plugin-postgres`'s
   for the simplest example, or `plugin-next`'s if you need an on-disk
   `templates/` directory + Handlebars rendering via
   `@hprabhash/template-engine`'s `renderTemplateTree`).
2. Implement `index.ts` exporting a `Plugin` as the default export.
3. **If your plugin writes into a file another plugin might also touch**
   (`package.json`, `.env`, `.gitignore`, `next.config.ts`) — use
   `ProjectWriter.patchFile()` + the matching merge helper
   (`mergePackageJsonFragment`, `mergeEnvFile`, `appendGitignoreEntries`,
   `mergeNextConfigServerExternalPackages`) instead of `writeFile()`, so you
   don't clobber what another plugin already wrote. All four live in
   `@hprabhash/template-engine`.
4. Register it in `packages/cli-core/src/core/plugin-registry.ts`'s
   `BUILT_IN_PLUGINS` array.
5. If it needs cross-plugin coordination (e.g. "what ORM did the user pick"),
   thread it through `PluginGenerateContext.variables` — see how
   `commands/create.ts` passes `orm: ormPluginId` into the auth plugin's
   variables, and how `plugin-better-auth/src/database-adapter.ts` reads it.
6. Write unit tests for `generate()`'s output (file contents, merged
   `package.json` deps) and, if it has real external interactions, an
   integration test. Add e2e coverage in `cli.e2e.test.ts` if it's
   reachable via a new `shell create` flag combination.

## Key gotchas (read before you hit them)

These are condensed from `architecture.md`'s "Errors and Fixes" /
"real bug" sections across all 9 phases — full context is there if you need
it, but the short version:

- **`.npmrc` has `engine-strict=true`.** Any dependency (direct or
  transitive) whose `engines.node` doesn't include the Node version running
  the install is a hard `pnpm install` failure, not a warning. Check a
  package's actual `engines` field on the npm registry before assuming a
  lower Node floor is fine — `MIN_NODE_MAJOR_VERSION` was wrong for a long
  time before CI caught it for real.
- **Never guess npm package versions.** This project tracks several
  fast-moving packages (Next.js 16, Prisma 7, Better Auth, TypeScript 6,
  ESLint 10, Zod 4, commander 15...) that are all newer majors than training
  data tends to assume. Check `https://registry.npmjs.org/<pkg>/latest`
  before hardcoding a version anywhere.
- **The `registry` and `packages/*/templates` directories are excluded from
  ESLint/Prettier** (see `eslint.config.js`/`.prettierignore`) — they're
  either generated-project source (different conventions than ours) or
  checksummed published content (reformatting changes bytes and breaks
  checksums — this happened for real, see adding-templates.md). If you add
  a new templates-style directory, exclude it the same way before anything
  touches it.
- **`core.autocrlf` can silently rewrite committed bytes.** If you ever add
  another checksum-sensitive directory, give it the same `-text`
  `.gitattributes` treatment `registry/**` already has, proactively.
- **`exactOptionalPropertyTypes`/`noUncheckedIndexedAccess` are both on.**
  Pass optional fields to third-party APIs via conditional spread
  (`...(x !== undefined && { key: x })`), not `{ key: x ?? undefined }`.
  Array/Record index access is always `T | undefined` — destructure and
  null-check rather than relying on a prior `.length` check to narrow.
- **`eslint <explicit-path>` resolves config by walking up that file's own
  directory before checking ignores.** This is why every lint invocation
  (including `lint-staged`'s) passes
  `--no-config-lookup --config eslint.config.js --no-warn-ignored` —
  without it, linting a staged file under a plugin's `templates` directory
  crashes trying to load that template's fake `eslint.config.mjs`.
- **Windows + dynamic `import()` needs `pathToFileURL`.** A plain relative
  or absolute Windows path fails with `ERR_UNSUPPORTED_ESM_URL_SCHEME`;
  wrap it: `import(pathToFileURL(path.resolve(...)).href)`.
- **Rebuild a dependency before its dependents after changing its types.**
  `tsup`/`tsc` read a workspace dependency's _built_ `dist/index.d.ts`, not
  its live source — editing `shared/src/plugin.ts` and immediately
  typechecking a plugin that depends on it will show a stale error until
  you rebuild `shared` first.
- **Commands are e2e-only; logic worth testing lives in `core/*.ts`.** See
  [Testing strategy](#testing-strategy) above — don't add a unit test file
  for a `commands/*.ts` file; factor the logic out first.
