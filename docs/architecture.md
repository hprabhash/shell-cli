# Architecture

This is a living document, extended at the end of each build phase. It records what
exists, why it's structured that way, and what's intentionally deferred.

## Roadmap

| #   | Phase                                                | Status     |
| --- | ---------------------------------------------------- | ---------- |
| 1   | CLI Core (commands, prompts, logging, configuration) | ✅ Done    |
| 2   | Plugin architecture                                  | ✅ Done    |
| 3   | Template engine                                      | ✅ Done    |
| 4   | Next.js plugin (real `shell create` generation)      | ✅ Done    |
| 5   | Better Auth plugin                                   | ⏳ Planned |
| 6   | Prisma / Drizzle / PostgreSQL plugins                | ⏳ Planned |
| 7   | Template registry (remote, versioned, cached)        | ⏳ Planned |
| 8   | Update mechanism                                     | ⏳ Planned |
| 9   | Testing & CI/CD pipeline                             | ⏳ Planned |

## Phase 1 — CLI Core

### Packages

- **`packages/shared`** (`@shell-cli/shared`) — framework-agnostic primitives shared by
  every other package: the `ShellCliError` hierarchy, shared TypeScript types
  (`PackageManager`, `FrameworkId`, etc.), app-wide constants, and the zod schema for
  the persisted config file. Plugin packages (Phase 2+) will depend on this, not on
  `cli-core`, to avoid a circular dependency between the core and its plugins.

- **`packages/cli-core`** (published as `shell-cli`, bin name `shell`) — the CLI
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
misrepresent what the tool does), `registryUrl` (placeholder URL for the Phase 7
template registry; not a working endpoint today), `cacheDir`.

### Commands and what's real

| Command                                | Phase 1 behavior                                                                                         |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `shell create [name]`                  | Real as of Phase 4 — see below.                                                                          |
| `shell doctor`                         | Fully real: Node/git/package-manager detection, home-dir write check, best-effort registry reachability. |
| `shell version`                        | Fully real.                                                                                              |
| `shell update`                         | Fully real check-and-advise (registry lookup + semver compare); does not self-execute a global install.  |
| `shell plugins`                        | Real as of Phase 2 — see below.                                                                          |
| `shell config get/set/list/path/reset` | Fully real, schema-validated.                                                                            |
| `shell template list/update`           | Stub — honest "lands in Phase 7" message, exit 0.                                                        |
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

A static `BUILT_IN_PLUGINS` array (currently just `@shell-cli/plugin-next`'s default
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

### `packages/template-engine` (`@shell-cli/template-engine`)

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
`@shell-cli/template-engine`. `install`/`postInstall` stay unimplemented:
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
