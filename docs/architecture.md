# Architecture

This is a living document, extended at the end of each build phase. It records what
exists, why it's structured that way, and what's intentionally deferred.

For task-oriented docs instead of design history, see
[usage.md](usage.md) (using the CLI), [contributing.md](contributing.md)
(developing it), [adding-templates.md](adding-templates.md) (publishing
registry templates), and [releasing.md](releasing.md) (cutting a release).

## Roadmap

| #   | Phase                                                | Status  |
| --- | ---------------------------------------------------- | ------- |
| 1   | CLI Core (commands, prompts, logging, configuration) | ✅ Done |
| 2   | Plugin architecture                                  | ✅ Done |
| 3   | Template engine                                      | ✅ Done |
| 4   | Next.js plugin (real `shell create` generation)      | ✅ Done |
| 5   | Better Auth plugin                                   | ✅ Done |
| 6   | Prisma / Drizzle / PostgreSQL plugins                | ✅ Done |
| 7   | Template registry (remote, versioned, cached)        | ✅ Done |
| 8   | Update mechanism                                     | ✅ Done |
| 9   | Testing & CI/CD pipeline                             | ✅ Done |

## Phase 1 — CLI Core

### Packages

- **`packages/shared`** (`@hprabhash/shared`) — framework-agnostic primitives shared by
  every other package: the `ShellCliError` hierarchy, shared TypeScript types
  (`PackageManager`, `FrameworkId`, etc.), app-wide constants, and the zod schema for
  the persisted config file. Plugin packages (Phase 2+) will depend on this, not on
  `cli-core`, to avoid a circular dependency between the core and its plugins.

- **`packages/cli-core`** (published as `@hprabhash/shell-cli` as of Phase 9, bin
  name `shell`) — the CLI
  itself: argument parsing (`commander`), the command implementations, and the core
  runtime services (logger, config store, prompts, package-manager detection, system
  checks).

### Why no file generation in Phase 1

Building the plugin contract well (Phase 2) required at least one concrete
consumer in mind, so Phase 1 intentionally kept `shell create` as a
**prompt + validation + planning** flow only — it resolved and printed the user's
choices but wrote no files. Real generation needed the template engine (Phase 3)
and the Next.js plugin's `generate()` (Phase 4) before it could exist; as of Phase
4, `shell create` is fully real (see below).

### Error handling

`ShellCliError` (in `shared`) carries a stable `code`, a process `exitCode`, and an
optional human `hint`. Subclasses: `ValidationError`, `ConfigError`,
`FileSystemError`, `NetworkError`, `UserCancelledError` (exit `130`, matching the
SIGINT convention, used when a user Ctrl+C's out of an interactive prompt).
`bin.ts` is the single place that catches these, formats them consistently, and sets
`process.exitCode` — command implementations just throw.

### Logging

A single `Logger` instance (`core/logger.ts`) with levels `silent | normal | verbose |
debug`, configured once from global flags (`--verbose`, `--debug`, `--silent`,
`--no-color`) before any command runs. Colors via `picocolors`; spinners/prompts via
`@clack/prompts`, wrapped in `core/prompts.ts` so every command handles prompt
cancellation (Ctrl+C) the same way — by throwing `UserCancelledError` rather than
each call site checking `isCancel()` individually.

### Configuration

Stored as JSON at `~/.shell-cli/config.json` (path resolution in `core/paths.ts`),
validated against a zod schema (`shared/src/schemas/config.schema.ts`) on every read.
Fields: `packageManager`, `preferredDatabase`, `telemetry` (defaults to `false` —
there is no telemetry collection implemented yet, so defaulting it "on" would
misrepresent what the tool does), `registryUrl` (the real template registry as
of Phase 7 — see below), `cacheDir`.

### Commands and what's real

| Command                                | Phase 1 behavior                                                                                         |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `shell create [name]`                  | Real as of Phase 4 — see below.                                                                          |
| `shell doctor`                         | Fully real: Node/git/package-manager detection, home-dir write check, best-effort registry reachability. |
| `shell version`                        | Fully real.                                                                                              |
| `shell update [--yes] [--rollback]`    | Real as of Phase 8 — see below. Self-executes (with confirmation) and can roll back.                     |
| `shell plugins`                        | Real as of Phase 2 — see below.                                                                          |
| `shell config get/set/list/path/reset` | Fully real, schema-validated.                                                                            |
| `shell template list/update/rollback`  | Real as of Phase 7 — see below.                                                                          |
| `shell cache clear`                    | Fully real — clears `~/.shell-cli/cache`.                                                                |
| `shell help`                           | Free via `commander`.                                                                                    |

Stubs always exit `0` and name the phase that will implement them — they are
forward-declarations of the command surface, not fake implementations.

## Phase 2 — Plugin Architecture

### The contract (`packages/shared/src/plugin.ts`)

```ts
interface Plugin {
  register(): PluginMetadata; // id, name, category, version, description
  questions(): PluginQuestionDefinition[];
  validate(answers): { valid: boolean; problems: string[] };
  doctor(): Promise<CheckResult[]>;
  install?(ctx): Promise<void>; // optional — no plugin can do real work here yet
  generate?(ctx): Promise<void>; // optional — needs the Phase 3 template engine
  postInstall?(ctx): Promise<void>; // optional
}
```

`register`/`questions`/`validate`/`doctor` are required because "no extra
questions" / "valid" / "no checks" are genuinely correct, complete answers today —
`install`/`generate`/`postInstall` are optional because nothing can honestly
implement them until later phases exist. `questions()` is declarative only: the
generic engine that turns a `PluginQuestionDefinition[]` into live `core/prompts.ts`
calls is deferred to Phase 5 (Better Auth), once a plugin with real multi-question
needs exists to design it against.

`CheckResult`/`CheckStatus` moved from `cli-core`'s `system-checks.ts` into `shared`,
since plugins need the same shape for `doctor()` and `plugin-next` can't depend on
`cli-core`. `PluginCategory` is a closed, core-owned enum (taxonomy of plugin
_kinds_); plugin _ids_ are not — `FrameworkId` is now `string`, not a literal union,
because frameworks are plugin-owned.

### Scope: built-in plugins only

Every plugin the spec requires (Next.js, Better Auth, Prisma, Drizzle, Postgres,
shadcn) is first-party, per the spec's own package list — none need dynamic
`npm install`. `shell install-plugin <name>` for third-party `shell-plugin-*`
packages is deferred until a real one exists to build the install/validate/rollback
machinery against; building it now would only be testable against synthetic
fixtures.

### Registry (`packages/cli-core/src/core/plugin-registry.ts`)

A static `BUILT_IN_PLUGINS` array (currently just `@hprabhash/plugin-next`'s default
export). `getAllPlugins()`, `getPluginsByCategory()`, `findPluginById()` all take an
optional `plugins` array (defaulting to the built-in list) purely so tests can inject
fixtures without any real module loading. `getPluginMetadata()` validates a plugin's
`register()` output against `pluginMetadataSchema` on every call and throws
`PluginError` if it's malformed — plugins are held to the same "validate before
execution" standard as user input. `collectPluginDoctorResults()` runs every
plugin's `doctor()` and prefixes each result's label with `[<plugin id>]` for
`shell doctor` to merge in alongside its own system checks.

### What changed in existing commands

- **`shell create`** — the framework prompt/`--framework` flag now reads from
  `getPluginsByCategory("framework")` instead of a hardcoded array; selecting an
  unregistered id fails with the same clear `ValidationError` as before, just
  sourced from the registry.
- **`shell plugins`** — lists every built-in plugin's id/name/category/version
  (replaces the Phase 1 stub).
- **`shell doctor`** — merges `collectPluginDoctorResults()` into the same
  pass/warn/fail table as the system checks.

### `packages/plugin-next`

The first concrete plugin: registers `{id: "next", category: "framework", ...}`,
returns `[]` for `questions()` (nothing more to ask), always validates, and reports
no doctor checks. Proves the contract with a real (if minimal) implementation rather
than a fixture-only test.

## Phase 3 — Template Engine

### `packages/template-engine` (`@hprabhash/template-engine`)

A new package, separate from `cli-core`, for the same reason `shared` is separate:
plugin packages (`plugin-next` now, `plugin-better-auth`/`plugin-prisma`/etc. later)
need to render templates without depending on `cli-core`. Nothing consumes it yet —
`plugin-next.generate()` still doesn't exist, that's Phase 4 — this phase only
builds and proves the engine in isolation.

- **`engine.ts`** — a dedicated Handlebars instance (`Handlebars.create()`, not the
  module-level default, so registering helpers/partials can't leak into other
  consumers in the same process). Compiles with `noEscape: true` always: these
  templates generate source code and config files, never HTML, and Handlebars'
  default escaping would corrupt output the moment a variable contained a quote.
  Ships four helpers Handlebars lacks natively — `eq`, `and`, `or`, `not` — so
  multi-value conditionals (`{{#if (eq orm "prisma")}}`) are possible; "conditional
  rendering" is an explicit requirement, not deferred. `registerPartialsDir(dir)`
  registers every `*.hbs` under `dir` as a partial, named by its path **relative to
  that directory** with the extension stripped (a file at `dir/sub/header.hbs`
  becomes partial `sub/header`).
- **`project-writer.ts`** — `ProjectWriter` is the rollback mechanism the spec asks
  for ("rollback partially generated projects"). It records whether `targetDir`
  existed before construction and tracks every file it writes/copies. `rollback()`
  deletes everything it tracked; if `targetDir` didn't pre-exist it removes the
  whole directory, otherwise it prunes back down to (but never removes) the
  pre-existing `targetDir`, leaving prior content untouched. `commit()` clears
  tracking so a stray later `rollback()` is inert.
- **`render-tree.ts`** — `renderTemplateTree(templateRootDir, targetDir, variables)`
  walks a template directory: `*.hbs` files are rendered and written without the
  suffix, everything else is copied byte-for-byte. Any path segment starting with
  `_` (convention: `_partials/`) is excluded from output and, if it's specifically
  `_partials`, auto-registered before the walk — same idea as Eleventy's
  `_includes`. On any failure mid-walk it calls `ProjectWriter.rollback()` before
  rethrowing as `FileSystemError`. The function returns a `Promise` (via
  `Promise.resolve().then(...)`, not `async`, since nothing here actually awaits
  anything yet) so future plugins can do real async I/O in `generate()` without a
  breaking signature change.

### Gotcha worth documenting: standalone partials and trailing newlines

Handlebars treats a partial reference that's alone on its own line as
"standalone" and strips the line break that follows it in the _parent_ template —
the partial's own content has to supply that newline itself, or output lines run
together. Hit this writing the integration test fixture; not a bug, just a sharp
edge worth remembering when writing real templates.

## Phase 4 — Next.js Plugin (Real Generation)

### Research before building

Rather than guess Next.js 16 conventions from training data that could be stale,
a real `npx create-next-app@latest` (TS + Tailwind + App Router, `--skip-install`)
was generated into scratch space and inspected directly, and the npm registry was
queried for actual current versions. Confirmed: `next@16.2.9`, `react`/
`react-dom@19.2.7`, `tailwindcss`/`@tailwindcss/postcss@4.3.1`; Turbopack is the
default bundler (no `--turbopack` flag needed in scripts); ESLint config uses the
`eslint/config` `defineConfig`/`globalIgnores` helpers with
`eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`; Tailwind v4
is CSS-first (`@import "tailwindcss"` + `@theme inline`, no `tailwind.config.js`).
The reference scaffold exact-pins `next`/`react`/`react-dom`/`eslint-config-next`
and ranges everything else (`eslint: "^9"`, `typescript: "^5"`, etc.) — mirrored
rather than reaching for absolute-latest on every dependency, since a generated
app's constraints are independent of this monorepo's own tooling versions.

### `packages/plugin-next/templates/next-app/`

Co-located with the plugin rather than a separate `packages/templates` package —
there's exactly one consumer; a shared package would be speculative until a second
plugin shows real duplication. Files needing a variable use the `.hbs` convention
from Phase 3 (`package.json.hbs`, `app/layout.tsx.hbs`, `app/page.tsx.hbs`,
`README.md.hbs`); everything else (`tsconfig.json`, `next.config.ts`,
`eslint.config.mjs`, `postcss.config.mjs`, `.gitignore`, `app/globals.css`) is a
plain static copy, since nothing in them needs templating yet — converting them to
`.hbs` happens if/when a future phase genuinely needs to inject something.

The homepage (`app/page.tsx.hbs`) is **not** a copy of create-next-app's demo —
no Vercel marketing links or bundled SVG assets, just a small page proving
Tailwind/dark-mode work, naming the project and the stack.

### `generate()`, finally implemented

`plugin-next`'s `generate()` validates its inputs via `requireStringVariable`
(new in `shared/src/plugin.ts` — the boundary check between a plugin's generic
`Record<string, unknown>` variables bag and what it specifically needs, throwing
`PluginError` on a miss) and calls `renderTemplateTree` from
`@hprabhash/template-engine`. `install`/`postInstall` stay unimplemented:
installing dependencies is generic across every framework, so `cli-core` handles
it once rather than each plugin reimplementing the same `<pm> install` call.

### `cli-core`: `core/git.ts` and `core/install-dependencies.ts`

Both **never throw** — a failed `git init`/commit or a failed dependency install
shouldn't roll back an otherwise-successfully-generated project (that's what Phase
3's `ProjectWriter` rollback is for, scoped to the generation step itself, not
optional follow-up steps). Each returns a result object instead
(`{initialized, committed}` / `{success, output}`) and `create.ts` decides how to
warn. `initGitRepo` mirrors create-next-app's own behavior of committing after
init, using whatever identity is already configured — if there isn't one, it
degrades to "initialized but not committed" rather than failing the whole command.

This needed `CommandRunner` (in `shared/src/types.ts`) to grow an optional
`{cwd}` parameter — it previously had no way to run a command anywhere but the
CLI's own working directory, fine for version checks but not for installing into
a freshly-created project directory. `realCommandRunner` was updated to honor it;
no existing caller needed to change.

### `commands/create.ts`: the real pipeline

Resolves the same `ProjectPlan` as before, then: `generate()` (spinner, falls
back to a "doesn't implement generation yet" notice if a future plugin lacks
one rather than crashing), git-init if requested (spinner, warns rather than
fails on a missing identity), dependency install if requested (spinner, warns
with the exact retry command on failure), then a real success message with the
project path and the package-manager-specific dev command — replacing the
Phase 1/2/3 "no files were written" placeholder entirely.

### Verification

Automated e2e tests use `--no-install` to stay fast and offline. The real,
slow path — actual `npm install` + `next build` + `next lint` against a freshly
generated project — was run manually once: scaffold succeeded, `npm run build`
compiled successfully, typechecked, generated static pages, and `npm run lint`
reported zero issues. Not part of the routine automated suite (too slow/network-
dependent to run on every `pnpm test:e2e`), but proves the generated output is
genuinely correct, not just file-existence-checked.

### Gotcha worth documenting: ESLint's nested-config discovery vs. template content

`templates/next-app/eslint.config.mjs` (template content, imports
`eslint-config-next` — a package that only exists in _generated_ projects, never
in this repo) is excluded from our own linting via `ignores` in the root
`eslint.config.js`, and `eslint .` respects that correctly. But `eslint <some
file path>` with an **explicit** path resolves that file's nearest config by
walking up its directory tree _before_ checking whether it's ignored — and for
`templates/next-app/next.config.ts`, the nearest config is the template's own
`eslint.config.mjs`, which ESLint then tries to load as real config and crashes
on the unresolvable import. `lint-staged` invokes ESLint with explicit staged
file paths, so this only surfaced at commit time, not on a plain `pnpm lint`.
Fixed by adding `--no-config-lookup --config eslint.config.js` (forces our one
root config, skips the crash-prone per-file nested lookup) to every ESLint
invocation (`lint`, `lint:fix`, and the `lint-staged` entry).

## Phase 5 — Better Auth Plugin

This is the largest phase so far — comparable to Phases 2+3+4 combined — because
Better Auth's real architecture means **composing** one `auth.ts` from an
arbitrary subset of 19 independently selectable features, not rendering one
fixed template like Next.js's plugin.

### Research before building

Better Auth is young and fast-moving, so live docs were fetched the same way
Next.js 16 was verified for Phase 4, rather than trusting training data that
could be stale. Confirmed via the npm registry (`better-auth@1.6.22`) and
`better-auth.com/docs`: `emailAndPassword`/`emailVerification`/
`account.accountLinking`/`rateLimit`/`session` are core config keys, not
plugins; `socialProviders.{google,github,discord,microsoft}` share one uniform
`{clientId, clientSecret}` shape (one generic implementation covers all four);
Apple is the exception (`clientSecret` is a JWT signed at request time from a
`.p8` key, via `jose`, plus a `trustedOrigins` entry); `passkey` and `apiKey`
have been extracted into separate npm packages (`@better-auth/passkey`,
`@better-auth/api-key` — confirmed these exist on the registry, not
hallucinated); "Teams" is a sub-option of `organization()`, not an independent
plugin; "WebAuthn" and "Passkeys" are the same feature in Better Auth (no
separate plugin) — collapsed into one, the one place the spec's 20-item list
becomes 19 selectable features, because of real library structure. The CLI
itself is published as the package `auth` (not `@better-auth/cli`), with
`generate --yes`/`migrate --yes` auto-detecting `lib/auth.ts`.

No Prisma/Drizzle/Postgres yet (Phase 6), so this phase uses Better Auth's
documented zero-ORM path (`better-sqlite3` directly) so a generated app works
immediately; Phase 6 will let users swap the adapter.

### The generic plugin-question engine, finally built

`core/run-plugin-questions.ts` turns a plugin's declarative `questions()` (added
in Phase 2, deliberately left unconsumed until "a plugin with real multi-question
needs exists to design it against") into a live flow by dispatching each
`PluginQuestionDefinition` to the matching `core/prompts.ts` wrapper, keyed by
`question.key`. Better Auth's feature picker — one `multiselect` listing all 19
features — is that plugin.

### The contribution model (`packages/plugin-better-auth/src/contribution.ts`)

Each feature is a small module implementing `BetterAuthFeature`:
`getContribution(selectedIds)` returns a `BetterAuthContribution` — pieces of
`auth.ts`/`auth-client.ts`/`package.json`/`.env` it wants to contribute (a
`config` object to deep-merge, `pluginCalls` to append to the `plugins: [...]`
array, import lines, dependencies, env vars, standalone helper code). A `raw()`
marker (`codegen/serialize-object.ts`) flags leaf values that must be emitted as
literal source (`process.env.X as string`, `new Database(...)`) rather than a
JSON-quoted string; `mergeContributions` folds every selected feature's
contribution into one structure — deep-merging `config` (so `email-password`'s
`emailAndPassword.enabled` and `password-reset`'s
`emailAndPassword.sendResetPassword` combine correctly), deduping
`trustedOrigins`/`envVars`, and merging import lines per module path
(`codegen/merge-imports.ts` — several plugins importing from
`better-auth/plugins` collapse into one `import { a, b, c } from "..."` line).
This is deliberately string-tree serialization, not an AST library like
ts-morph — sufficient for the job, smaller dependency footprint. "Teams" requires
"Organization" (and `password-reset` requires `email-password`) via a generic
`requires: string[]` field each feature can declare, checked once by
`validateFeatureSelection` — no per-pair special-casing needed except that
`organization.ts` itself reads whether `teams` is in the selected set to decide
whether to pass `{teams: {enabled: true}}` into its own `organization()` call.

### `@hprabhash/template-engine` extensions

Two small, well-motivated additions, both reusable by Phase 6:

- `ProjectWriter.patchFile()` — for a file a _previous_ plugin already wrote
  (here, `package.json`, which the Next.js plugin creates and Better Auth then
  adds dependencies to). Unlike `writeFile`, rollback restores the **original
  content** instead of deleting a file this run didn't create.
- `mergePackageJsonFragment()` — pure function merging
  `dependencies`/`devDependencies`/`scripts` into an existing `package.json`
  string without clobbering what's already there.

### `postInstall`, used for real for the first time

Better Auth's `postInstall()` runs `npx auth generate --yes` then
`npx auth migrate --yes` in the generated project — exactly what Phase 2
designed the hook for. `create.ts`'s pipeline now runs every selected plugin's
`generate()`, then git-init, then dependency install, then every selected
plugin's `postInstall()` (skipped with a log line if installation was skipped,
since the migration needs the `auth` CLI to actually be resolvable) — wrapped in
try/catch per plugin so one plugin's post-install failure warns rather than
aborting the whole command.

### `commands/create.ts`: one plugin to a list

Generalized from resolving a single `framework` plugin to a `SelectedPlugin[]`.
New `resolveAuth()` (prompts `Authentication:` with `None` + every registered
auth plugin; `--auth <id>` flag) and `resolveAuthFeatures()` (interactive →
`runPluginQuestions` + `plugin.validate()`; non-interactive → `--auth-features
a,b,c`, defaulting to `["email-password"]` under `--yes`). `ProjectPlan` gained
`auth: string | null` and `authFeatures: string[]`.

### Verification

Automated tests stay fast/offline (`--no-install`); the integration suite
parses generated `auth.ts`/`auth-client.ts` through the TypeScript compiler
(`ts.transpileModule`, zero diagnostics) for several feature combinations,
including all 19 at once. The real, slow path was run manually once: scaffolded
with installs on and a realistic feature set (email-password, google,
two-factor, organization+teams, admin) — `better-sqlite3`'s native binary
installed, `npx auth generate/migrate` created a real SQLite schema (the
`sqlite.db` file), and `next build`/`next lint` both passed cleanly, with
Better Auth itself emitting an honest runtime warning about the (intentionally)
blank Google OAuth credentials rather than crashing.

## Phase 6 — Prisma / Drizzle / PostgreSQL Plugins

Per the spec, database provider and ORM are independent prompts, not one
combined choice. This phase adds `plugin-postgres` (category `database`),
`plugin-prisma`/`plugin-drizzle` (category `orm`), and makes Better Auth
**ORM-aware** — Phase 5 always used `better-sqlite3` directly; with an ORM
selected, auth now goes through that ORM's database connection via the
matching Better Auth adapter package instead.

### Research before building

Verified live rather than assumed, since Prisma was at a much newer major
version than training data would suggest: `prisma@7.8.0`, `drizzle-orm@0.45.2`,
`drizzle-kit@0.31.10`. Prisma 7 requires the driver-adapter architecture
(`@prisma/adapter-pg` + `pg`) and a custom client output path
(`generated/prisma`, gitignored). Better Auth's Prisma and Drizzle adapters
both turned out to be **separate npm packages** lockstep-versioned with core
(`@better-auth/prisma-adapter`, `@better-auth/drizzle-adapter`, both
`1.6.22`) — `better-auth/adapters/prisma` is just a re-export wrapper around
the former, not a bundled implementation as initially assumed; see below for
why that distinction mattered.

### `packages/plugin-postgres` (category `database`)

`generate()` writes a real, working `docker-compose.yml` (`postgres:18`, fixed
dev credentials) and contributes
`DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app_dev` to
`.env`/`.env.example` via the new `mergeEnvFile` — a connection string that
genuinely works the moment `docker compose up -d` runs. `doctor()` warns if
`docker` isn't on `PATH`. No `postInstall` — nothing to run without a live
decision from the user about where Postgres actually runs.

### `packages/plugin-prisma` / `packages/plugin-drizzle` (category `orm`)

Each writes its own schema/client/config and patches `package.json` with its
dependencies; `postInstall()` runs schema-file-only codegen (`prisma generate`
/ `drizzle-kit generate`) — safe without a live database connection. Applying
the schema (`prisma migrate dev` / `drizzle-kit push`) needs a reachable
Postgres, which can't be assumed to exist, so that step is left to the user
with clear `printSuccessMessage` instructions rather than silently attempted
and likely failing.

### `@hprabhash/template-engine`: three more extensions

- `mergeEnvFile`/`appendGitignoreEntries` — append-if-missing, the same idea
  as `mergePackageJsonFragment`, needed once more than one plugin writes into
  the same `.env`/`.gitignore` (Postgres and Better Auth both want `.env`;
  Next.js and Prisma both want `.gitignore`).
- `mergeNextConfigServerExternalPackages` — append-if-missing into
  `next.config.ts`'s `serverExternalPackages` array; see below for why this
  exists.
- `mergePackageJsonFragment` grew an `onlyBuiltDependencies` field, merged
  into `pnpm.onlyBuiltDependencies`; see below for why this exists.

### Better Auth becomes ORM-aware

`packages/plugin-better-auth/src/database-adapter.ts`'s `resolveDatabaseAdapter(orm)`
returns the imports/config-value/dependencies for whichever of three cases
applies. `index.ts`'s `generate()` reads `context.variables.orm` (set by
`create.ts` from the resolved `--orm`/prompt value, passed alongside
`features`) and its `.env` writes use `patchFile` + `mergeEnvFile` so a
database plugin's `DATABASE_URL`, written first, survives. `postInstall()`
skips `auth migrate --yes` when an ORM is selected — only `generate --yes`;
applying the ORM's own schema is the user's own, live-database-dependent step.

### Real bugs only manual verification caught

Every other phase's manual-verification section reports a clean pass. This
one doesn't — running a real `shell create --orm prisma --auth better-auth
--install` followed by a real `next build` (exactly the spec's own "don't
generate placeholder code" discipline) surfaced five genuine bugs that no
amount of file-existence-checking in automated tests would have caught,
because nothing about the generated _files_ was wrong in isolation — only
their behavior under real tooling was:

1. **Prisma 7.8 rejects `url` in `schema.prisma`'s `datasource` block.**
   The original schema (written against the documented driver-adapter
   pattern) failed `prisma generate` with `P1012`: the connection string for
   Migrate now belongs in a separate `prisma.config.ts`
   (`defineConfig({ datasource: { url: env("DATABASE_URL") } })`), confirmed
   directly against the installed `@prisma/config` package's own `.d.ts`
   rather than trusting a single doc fetch. That config file is loaded as a
   plain module (not auto-`.env`-loaded the way `schema.prisma`'s old
   `env()` was), so it also needs its own `import "dotenv/config"` and a new
   `dotenv` devDependency.
2. **`better-auth/adapters/prisma`'s wildcard re-export doesn't resolve under
   Turbopack.** `export * from "@better-auth/prisma-adapter"` resolves fine
   under plain Node (verified directly) but Turbopack reports zero exports
   through pnpm's peer-hashed package layout. Fixed by importing directly
   from `@better-auth/prisma-adapter`, matching the shape already used for
   Drizzle's adapter.
3. \*_Two more Turbopack resolution failures, one Prisma-specific (dynamic
   `import()` of `@prisma/client/runtime/query_compiler_fast_bg._` WASM
files) and one universal to Better Auth itself (`@better-auth/telemetry`,
a direct dependency of `better-auth`core, fails to resolve regardless of
ORM — reproduced even with`better-sqlite3`and no ORM at all).`serverExternalPackages`alone fixed neither under Turbopack; an
isolated`next build --webpack`on the identical project succeeded
immediately. Fixed by having both`plugin-prisma`and`plugin-better-auth`patch the generated`dev`/`build`scripts to`--webpack`, and contributing
their respective native/WASM-backed packages
(`@prisma/client`/`pg`/`better-sqlite3`) to `serverExternalPackages` via
   the new shared helper — kept in both plugins independently since either
   can run without the other.
4. **`better-sqlite3`'s native binary silently never gets built.** pnpm
   blocks a dependency's install/build script by default since v9
   ("Ignored build scripts" warning) — `pnpm install` exits 0, but
   `new Database(...)` then fails at runtime with "Could not locate the
   bindings file." Fixed by having the sqlite branch of
   `resolveDatabaseAdapter` contribute `better-sqlite3` to a new
   `pnpm.onlyBuiltDependencies` field in the generated `package.json` —
   the same mechanism this monorepo's own root `package.json` already uses
   for `esbuild`.
5. **`plugin-drizzle`'s placeholder `schema.ts` wasn't a valid ES module.**
   A file containing only comments has no import/export statement, so
   TypeScript treats it as a global script, not a module — `import * as
schema from "./schema"` in `lib/db/index.ts` failed with "File is not a
   module" the moment a real `tsc`/`next build` ran, before `auth generate`
   ever gets a chance to add real exports. Fixed with a trailing `export {};`.

All five were caught and fixed in the same manual-verification pass that
Phase 4/5 reported clean; the corresponding unit/integration/e2e tests were
extended afterward to cover each one (e.g. asserting `prisma.config.ts`
content, `serverExternalPackages`/`onlyBuiltDependencies` patches, and the
`export {};` line) so they're now regression-checked automatically.

### `commands/create.ts`: `resolveOrm`/`resolveDatabase`

Prompt order follows the spec's literal sequence — `resolveOrm()` (`None` /
every registered `orm` plugin) first, then `resolveDatabase()` only if an ORM
was selected (there's no database to provision without an ORM to use it
yet). Plugin **execution** order is independent of prompt order: framework →
database → orm → auth, so an ORM's `postInstall` codegen (e.g. `prisma
generate`, which produces the client `lib/auth.ts` imports) always runs
before Better Auth's `auth generate --yes`. The auth plugin's `variables`
object is given `orm: <selected orm id or null>` alongside `features` so
`resolveDatabaseAdapter()` receives it regardless of how the other plugins
were ordered. `ProjectPlan` gained `orm: string | null` and
`database: string | null`; `printSuccessMessage` now suggests
`docker compose up -d` / `prisma migrate dev` / `drizzle-kit push` as
appropriate next steps instead of silently omitting them.

### Verification

Unit tests cover each new plugin's `generate()` output, the three new
template-engine merge helpers, and all branches of `resolveDatabaseAdapter`.
An integration suite (`packages/cli-core/tests/integration/orm-combo.test.ts`)
composes Next.js + Postgres + Prisma + Better Auth (and the Drizzle
equivalent) into one temp directory and checks the result through
`ts.transpileModule` for zero diagnostics. e2e tests cover `--orm`/`--database`
flag validation (rejecting `--database` without `--orm`, defaulting under
`--yes`) end to end. Manual verification (see above) ran all three real
combinations — Prisma+Postgres, Drizzle+Postgres, and the no-ORM SQLite
default — through a genuine `pnpm install` + `pnpm run build` + `pnpm run
lint`, all green, after the five fixes above.

## Phase 7 — Remote Template Registry

`shell template list`/`update` were Phase-1 stubs; `registryUrl`/`cacheDir`
existed in the config schema but `DEFAULT_REGISTRY_URL` was an explicitly
documented placeholder. This phase makes the registry real: versioned,
checksummed, cacheable, and rollback-capable.

### Hosting decision

This repo is now pushed to GitHub (`https://github.com/hprabhash/shell-cli`,
`main`). No `gh` CLI or GitHub token is available in this environment — only
plain git push access — so the registry avoids anything needing the GitHub
API or Releases. Registry content (a manifest + versioned template files)
lives directly in this repo under `registry/`, served read-only via
`raw.githubusercontent.com`. `DEFAULT_REGISTRY_URL` now points at
`https://raw.githubusercontent.com/hprabhash/shell-cli/main/registry/templates.json`.
No new runtime dependency was needed (no `tar`/zip library): each template
version is a manifest of relative file paths + sha256 checksums, and the
client downloads each file individually via a raw URL — the same way
`getLatestPublishedVersion` (Phase 1) already calls `fetch` directly with no
HTTP-library abstraction.

### Scope boundary (deliberate)

This phase does not wire the registry into `plugin-next`'s `generate()` —
that plugin keeps using its bundled `templates/next-app/`. The registry is a
separate, independently-real subsystem (fetch/cache/version/rollback),
proven against real content (a copy of the same `next-app` template,
published as the registry's first entry) but not yet consumed by the
generation pipeline. Wiring a plugin to _prefer_ a registry-cached template
over its bundled copy is natural future work, not required for "the
registry is real."

### Registry content layout

```
registry/
  templates.json                          # top-level manifest
  templates/
    next-app/
      1.0.0/
        manifest.json                     # { "files": { "<relPath>": "<sha256 hex>" } }
        files/                            # mirrors plugin-next/templates/next-app/ exactly
```

Every resource besides the manifest itself is resolved as a **relative URL
against `registryUrl`** via Node's native `URL` class (e.g.
`new URL("templates/next-app/1.0.0/manifest.json", registryUrl)`) — no
separate "registry base URL" config field needed.
`scripts/publish-registry-template.mjs` is a small one-off publishing
script (not part of the shipped CLI package) that walks a source directory,
computes sha256 per file, and writes/updates the manifest + version
directory — real, reusable tooling for adding future templates. Both
`registry/**` and `scripts/**` are excluded from ESLint/Prettier (the
former is checksummed, externally-served content; reformatting it would
silently invalidate every checksum — the latter is a plain-JS script outside
any package's tsconfig project).

### `packages/shared` additions

`src/schemas/registry.schema.ts`: zod schemas for the top-level manifest
(`registryManifestSchema`/`registryTemplateEntrySchema`) and a template
version's file-checksum map (`templateVersionManifestSchema`, keys are
relative paths, values are validated as 64-char lowercase sha256 hex).
`src/constants.ts` gained `TEMPLATES_CACHE_SUBDIR_NAME` and
`REGISTRY_MANIFEST_CACHE_FILE_NAME` alongside the updated
`DEFAULT_REGISTRY_URL`.

### `packages/cli-core/src/core/registry-client.ts`

Mirrors the existing `utils/version.ts` fetch pattern (`AbortController` +
5s timeout, `response.ok` check, zod-validated JSON parse, failures wrapped
in `NetworkError`) — no new HTTP dependency. `downloadTemplateVersionToDir`
fetches a version's manifest, then for each `{relPath, sha256}` entry:
rejects any path containing `..` segments or resolving outside the
destination directory (defensive — the manifest is network-sourced input),
downloads the raw file, and verifies its sha256 (`crypto.createHash`)
_before_ writing it to disk. Throws on the first failure; the caller is
responsible for using a disposable temp directory so a partial failure
never touches already-active content.

### `packages/cli-core/src/core/template-cache.ts`

Owns the on-disk cache layout under `<cacheDir>/templates/<id>/`: a
`state.json` (`{active, cached}`) plus one directory per cached version.
`installVersion` downloads into a sibling temp directory and only
`fs.renameSync`s it into place — and updates `state.json` — once the
download fully succeeds; any failure cleans up the temp directory and
leaves the previous state completely untouched (proven in the integration
test via a deliberately-corrupted fixture version). `activateVersion` just
flips `state.json`'s `active` pointer to an already-cached version — no
network call, which is what makes rollback instant.
`findPreviousCachedVersion` (via `semver`) picks the highest cached version
strictly below the current active one, for the no-argument rollback case.
A separate small cache (`registry-manifest.json`) holds the last
successfully fetched top-level manifest, for the offline-fallback path
below.

### `commands/template.ts` (rewritten) and `shell doctor`

Each subcommand takes its own `--registry-url <url>` override (mirroring
`create.ts`'s per-flag override style rather than fighting Commander's
parent-option inheritance for three commands).

- **`list`**: fetches the manifest live; on failure, falls back to the
  cached copy with an "offline — showing cached data" notice — the same
  philosophy as `checkNetwork()`'s "offline, cached data still works" from
  Phase 1. Shows each template's cached/active version and whether an
  update is available.
- **`update [id]`**: no `id` updates every manifest entry to `latest`; one
  failure warns and continues rather than aborting the rest (same
  try/catch-per-item shape as `create.ts`'s `runPostInstallAll`).
- **`rollback <id> [version]`**: with an explicit version, installs it
  (no-op if already cached) and activates it — this is also how you
  "upgrade" to a specific non-latest version. Without one, activates the
  next-lower cached version; errors clearly if there isn't one.

`checkRegistry()` (new, in `system-checks.ts`, same shape as `checkNetwork()`
— `warn` not `fail` on unreachability) is now part of `runAllChecks()`, so
`shell doctor` reports template-registry reachability alongside everything
else.

The Phase-1 `notImplementedYet()` stub helper (`commands/_shared.ts`) had no
remaining callers once `template.ts` became real — deleted rather than left
as dead code.

### Verification

**Unit**: registry schemas (valid/invalid manifests and checksums),
`template-cache.ts`'s state read/write/activate/rollback-candidate-selection
logic against a temp cache dir (no network), `checkRegistry()` with a
stubbed global `fetch` (same pattern as the existing `checkNetwork()` test).

**Integration**: a real `node:http` server (`tests/fixtures/test-registry-server.ts`,
shared with the e2e suite) serves a fixture registry — one template
("widget", versions 1.0.0/1.1.0) plus a version whose served files
deliberately don't match their declared checksum. Against this real server
(not a mocked `fetch`): fetch+validate the manifest, install+activate a
version and verify the exact file content landed on disk, install a second
version without disturbing which one is active, roll back with the server
_closed_ (proving no network call), and confirm a checksum-mismatched
version is fully rejected — no version directory, no leftover temp
directory, and the previously-active version's files are byte-for-byte
unchanged.

**e2e**: the built CLI's `template list/update/rollback` driven against the
same fixture server via `--registry-url`, covering the full realistic
sequence (list with nothing cached → explicit-version rollback → update to
latest → list shows no pending update → no-op update → no-argument rollback
→ rejecting an unknown id → rejecting a bad checksum → `cache clear` wiping
the template cache too).

**Manual**: after pushing `registry/`'s real content, `shell template
list`/`update`/`rollback`/`doctor`/`cache clear` were run against the live
`raw.githubusercontent.com` URL — the same "don't trust file-existence
checks alone" discipline every prior phase used. This is the one phase where
that discipline caught something file-existence checks structurally
_couldn't_: see below.

### Real bug only manual verification caught: git silently rewrote the published bytes

`shell template update next-app` against the live registry failed every
file's checksum. The cause: this machine's git is configured with
`core.autocrlf=true`, which normalizes CRLF→LF on commit. The publishing
script computed every file's sha256 against the original CRLF bytes on
disk; git then silently stored LF versions when the files were committed —
so the manifest's checksums and the actual served content diverged the
moment the commit happened, invisible until something actually re-verified
the round trip end to end. Confirmed via the GitHub Contents API (reads the
git blob directly, bypassing any CDN) that the _committed_ content was the
mismatched LF version, then fixed with a new root `.gitattributes`
(`registry/** -text`, telling git never to touch these bytes again) and
`git add --renormalize registry/` to restore the original checksummed
content. Re-verified against the live URL after the CDN's `max-age=300`
cache expired (confirmed via `Cache-Control`/`Source-Age` response headers)
— `update` then succeeded for real, downloading and verifying all ten files.

## Phase 8 — Self-Update Mechanism

`shell update` (Phase 1) only ever printed the install command — this phase
makes it actually run it, with a rollback path.

### `packages/cli-core/src/core/self-update.ts` (new)

The testable core, split out of the command file the same way `template.ts`
delegates to `registry-client.ts`/`template-cache.ts` (Phase 7) — commands
stay thin CLI-wiring layers; this is where the logic that's worth unit
testing lives. `buildGlobalInstallCommand(pm, packageName, version)` returns
a structured `{command, args}` (replacing the old plain string the
function returned, which would have needed re-parsing to actually execute
rather than just print) for each of the four package managers.
`resolveInstallCommand` detects available package managers
(`detectAllPackageManagers`, already existing) and picks one
(`pickPreferredPackageManager`, already existing) — both now take an
injectable `CommandRunner` for testing, mirroring `checkGit`'s pattern.
`applyVersion(install, fromVersion, runner)` records `fromVersion` to
config as `lastKnownGoodVersion` **before** running the install (so a
later `--rollback` always swaps back to whichever version was active
immediately before the most recent `update`/`rollback` — not just the
first version ever replaced), then runs it via `realCommandRunner` and
returns a plain result object — never throws, matching `runInstall`'s
"a failed install shouldn't crash the command" philosophy.

### `packages/shared`: `lastKnownGoodVersion` config field

Added to `configSchema` (nullable string, default `null`). No new
`config-store.ts` function needed — `loadConfig`/`saveConfig` already
handle arbitrary schema fields.

### `commands/update.ts`: confirm, apply, or roll back

Default behavior is unchanged through the "is an update available" check.
New: `-y/--yes` skips the confirmation prompt (`promptConfirm`, the same
`core/prompts.ts` wrapper every other command uses) and applies
immediately; declining the prompt falls back to printing the command, as
before. `--rollback` reads `lastKnownGoodVersion` — a clear `ConfigError`
if nothing's been applied yet ("roll back is only available after `shell
update` has applied an update at least once"), otherwise resolves and
(after the same confirm-or-`--yes` gate) applies that exact version.

### A real bug this phase's own research surfaced

Renaming the package (Phase 9, but discovered while planning _this_ phase)
turned out not to be just a publishing nicety: the unscoped name `shell-cli`
is already published on the real npm registry by someone unrelated. Before
the rename, `shell update`'s e2e test hung for the full 30s timeout —
`getLatestPublishedVersion("shell-cli")` was successfully resolving _their_
package's version, `isUpdateAvailable` correctly saw it as newer than our
local `0.1.0`, and the command proceeded to show an interactive confirm
prompt with no TTY behind it to answer. Renaming to the confirmed-available
`@hprabhash/shell-cli` fixed this for real (verified: the same command now
gets a clean, fast 404 and degrades gracefully) — a second, independent
reason the Phase 9 naming decision had to happen before this phase's tests
could be trusted.

### Verification

Unit tests (`tests/unit/self-update.test.ts`) cover `buildGlobalInstallCommand`
for all four package managers, `resolveInstallCommand` with an injected
fake runner, `applyVersion`'s success/failure result shapes and its
rollback-target bookkeeping (including that a _second_ applied update
correctly swaps the rollback target rather than keeping the original).
e2e: `shell update` against the real (unpublished) package name — exercises
the genuine `NetworkError` degradation path, not a placeholder — and
`shell update --rollback` with nothing ever applied, asserting the clear
error rather than a crash.

## Phase 9 — Testing & CI/CD Pipeline

Most of "testing" was already real by this point — 7 phases' worth of
unit/integration/e2e tests, strict TypeScript, ESLint/Prettier/Husky/
lint-staged, all in place since Phase 1. What was missing: the package
wasn't actually publishable, and there was no CI. Both needed the GitHub
repo Phase 7 just connected.

### A real bug found before any code ran: the package can't be installed as published

`cli-core`'s `tsup.config.ts` has no `noExternal` — `dist/bin.js` imports
`@hprabhash/plugin-better-auth` etc. as genuine external packages, not
bundled. Every other `@hprabhash/*` package was `"private": true` and had
never been published. Publishing `cli-core` exactly as it stood would have
produced a broken install: npm would try to resolve six packages that
don't exist on the registry.

**Why bundling (the obvious fix) is wrong:** `plugin-next` resolves its
`templates/next-app/` directory via `path.dirname(fileURLToPath(import.meta.url))`
relative to its own compiled file's location. Bundling that code into
`cli-core/dist/bin.js` would make `import.meta.url` resolve to _cli-core's_
dist location instead, breaking template lookup — the other four plugins
have no such dependency (inline string templates), but fixing some of six
packages and not others is its own inconsistency.

**Fix:** make every `@hprabhash/*` package a real, independently-published
package instead — removed `"private": true`, added
`"publishConfig": {"access": "public"}`, and (`plugin-next` only) a
`"files"` field including `templates` alongside `dist` so its template
tree actually ships. This is exactly the scenario Changesets exists for:
multi-package monorepo releases where `workspace:*` needs rewriting to
real version ranges at publish time — verified for real via `pnpm pack`
on `cli-core` and inspecting the resulting tarball's `package.json`:
every `@hprabhash/*` dependency had been rewritten from `workspace:*` to
the literal current version (`0.1.0`), confirming an install would
actually resolve correctly. `pnpm -r publish --dry-run` across every
package (no network write, just packing/validation) also confirmed
`plugin-next`'s tarball genuinely contains all 9 template files plus
`dist/`, not just code.

### Renaming `cli-core` to `@hprabhash/shell-cli`

The unscoped name `shell-cli` is already taken on the public npm registry
by an unrelated package (confirmed via the registry API) — `@hprabhash/shell-cli`
is confirmed available. The `bin` field (`{"shell": "./dist/bin.js"}`) is
unaffected — the command users type was never tied to the package name.
The root workspace package's own name (`shell-cli-monorepo`) is untouched —
it's `private`, never published, a purely internal label.

### Changesets

`.changeset/config.json` (`access: "public"`, matching every package's own
`publishConfig`). Root scripts: `pnpm changeset` (describe a pending
change's semver impact), `pnpm version-packages` (`changeset version` —
bumps versions and CHANGELOGs from pending changesets), `pnpm release`
(`pnpm build && changeset publish`). A changeset describing this phase's
own changes (`self-update-and-publishing.md`) is committed alongside it —
real usage of the tool being introduced, not just scaffolding.

### `.github/workflows/`

`ci.yml`: every push/PR to `main`, one `ubuntu-latest` job runs the full
gate sequence (`build` → `typecheck` → `lint` → `format:check` → `test` →
`test:integration` → `test:e2e`). No OS matrix — nothing in the suite
asserts platform-specific behavior despite being developed on Windows;
easy to add later if that changes. The e2e suite's `doctor`/registry
checks hit real public endpoints exactly like they do locally —
GitHub-hosted runners have outbound internet access by default.

`release.yml`: on push to `main`, `changesets/action` either opens/updates
a "Version Packages" PR (pending changesets) or runs `pnpm release`
(a version-bump commit was just merged) — using `actions/setup-node`'s
built-in `registry-url` + `NODE_AUTH_TOKEN` for npm auth (the standard
mechanism, rather than committing a `_authToken` line to the repo's own
`.npmrc`, which would print a "failed to replace env" warning on every
local `pnpm install` since `NPM_TOKEN` is never set outside CI). No
`NPM_TOKEN` secret is configured — by design, per the resolved decision to
build the full pipeline without actually publishing yet. The publish half
of this workflow has nothing to authenticate with until that secret is
added; the version-PR half works today with no further setup.

### Verification

Full local gate sweep (build/typecheck/lint/format/unit/integration/e2e)
green. `pnpm -r publish --dry-run` and a real `pnpm pack` + tarball
inspection (above) in place of an actual publish, per the resolved
decision not to publish today. Workflow YAML correctness is verified the
same way every other phase verifies real infrastructure: pushed, then
checked against GitHub's actual Actions API
(`api.github.com/repos/hprabhash/shell-cli/actions/runs`) to confirm `ci.yml`
genuinely ran and passed on GitHub's own runners — not just "the YAML
looks right."

### A real bug that verification caught: the stated Node minimum was wrong

The first real push: both workflows failed at `pnpm install --frozen-lockfile`,
on GitHub's runner (pinned to Node 20) but not locally (Node 25 — every
constraint is satisfied by something that new). `engine-strict=true` (set
in `.npmrc` since Phase 1) makes a mismatched `engines.node` on _any_
installed package — direct or transitive — a hard install failure, not a
warning. Checking each dependency's own `engines` field directly against
the npm registry found the real floor: `commander@15` (a genuine runtime
dependency of the CLI, not a dev tool) requires Node `>=22.12.0`;
`lint-staged@17` (dev-only) requires `>=22.22.1`. `MIN_NODE_MAJOR_VERSION`
had been `20` since Phase 1 and was never actually correct once `commander`
reached v15 — nothing had exercised an install on exactly-Node-20 to
surface it until CI did. Fixed: `MIN_NODE_MAJOR_VERSION` → `22` (shared,
drives `shell doctor`'s own check), `cli-core`'s published `engines.node`
→ `>=22.12.0` (what an end user actually needs to run the CLI), the root
workspace's → `>=22.22.1` (what contributing to this repo needs), both
workflows' `node-version` → `22`. Re-verified the same way: pushed again,
polled the Actions API, confirmed `ci.yml` actually went green this time.

### Known remaining gap: `release.yml` can't open its PR yet

After the Node fix, `ci.yml` passed for real. `release.yml` still fails —
but differently now: `pnpm install`/build succeed, and `changesets/action`
gets far enough to create a `changeset-release/main` branch with the
version-bump commit, but fails to open the actual pull request from it.
This is the textbook symptom of a GitHub repository setting that defaults
to _off_ on newly created repos: **Settings → Actions → General → Workflow
permissions → "Allow GitHub Actions to create and approve pull
requests."** Without it, the default `GITHUB_TOKEN` can push a branch
(`contents: write` covers that) but not open a PR from it, regardless of
the `pull-requests: write` permission already granted in the workflow
file. This needs the repository owner to flip that one setting — not
something a workflow or `GITHUB_TOKEN` can grant itself. Once it's on,
the next push to `main` (or re-running this same workflow) should open
the Version Packages PR successfully with no other changes needed.

### Turning on real publishing: an npm scope mismatch, twice

Once the Version Packages PR flow worked and `NPM_TOKEN` was added, the
publish step still failed. Diagnosing it without GitHub admin access to
the run's raw logs (the Actions API rejects `actions/jobs/{id}/logs` with
403 for a non-admin token even on a public repo; the public job-results
page's "annotations" only surface a generic `Publish command exited with
code 1`, never the underlying npm error) meant reasoning from the npm
registry's own public, unauthenticated read API instead.

The actual mismatch: `cli-core` was planned to publish as
`@hprabhash/shell-cli`, on the assumption that `hprabhash` was the user's
npm username (it matches their GitHub username — never independently
verified). It isn't; their real npm username is `prabhashkutti`, and npm
usernames can't be renamed. A scope only auto-resolves to an account when
the scope name matches that account's username exactly — so `@hprabhash`
needed to exist as a separate npm **Organization** (Account → Add an
Organization), which the user then created.

That fixed `cli-core`'s publish, but the other 7 packages were scoped
`@shell-cli/*` — a second scope that was never created as an org. Result:
`changeset publish` published `@hprabhash/shell-cli@0.2.0` successfully
(confirmed live via `registry.npmjs.org/@hprabhash/shell-cli`, publisher
`prabhashkutti`), then hard-failed publishing the first `@shell-cli/*`
package, exiting 1 — and left a real, broken package on the registry:
`@hprabhash/shell-cli@0.2.0`'s own `dependencies` pin six packages
(`@shell-cli/shared`, `@shell-cli/plugin-better-auth`, etc.) that don't
exist, confirmed via the registry API returning 404 for every one of them.
Anyone running `npm install -g @hprabhash/shell-cli` at that version would
hit an unresolvable dependency.

Rather than create and maintain a second npm org for no real benefit, all
8 packages were renamed onto the single, already-working `@hprabhash`
scope (`@shell-cli/shared` → `@hprabhash/shared`, etc., across every
`package.json`, source import, test, and doc) and `cli-core` got a patch
changeset to publish a corrected `0.2.1` with the right dependency names,
superseding the broken `0.2.0`. See [releasing.md](releasing.md#current-status)
for the live status.

A second, unrelated bug surfaced by the same push: an e2e test
(`update degrades gracefully when no version of this package is published
yet`) hard-assumed the package would _never_ be found on the registry —
exactly backwards once publishing started working. Rewritten to assert
only the durable invariant (`shell update` exits 0 and never reaches the
interactive confirm prompt with no TTY behind it), since which specific
non-interactive outcome that hits (`NetworkError`, "already on the latest
version", or a declined update) legitimately depends on real registry
state at test time.
