# Architecture

This is a living document, extended at the end of each build phase. It records what
exists, why it's structured that way, and what's intentionally deferred.

## Roadmap

| #   | Phase                                                | Status     |
| --- | ---------------------------------------------------- | ---------- |
| 1   | CLI Core (commands, prompts, logging, configuration) | ✅ Done    |
| 2   | Plugin architecture                                  | ✅ Done    |
| 3   | Template engine                                      | ✅ Done    |
| 4   | Next.js plugin (real `shell create` generation)      | ⏳ Planned |
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

### Why no file generation yet

Building the plugin contract well (Phase 2, below) required at least one concrete
consumer in mind (the Next.js + Better Auth + Prisma/Drizzle stack), so Phase 1
intentionally kept `shell create` as a **prompt + validation + planning** flow only:
it resolves and prints the user's choices but writes no files. Real generation still
waits on the template engine (Phase 3) and the Next.js plugin's `generate()` (Phase 4) — Phase 2 only replaced _where the framework choice comes from_, not whether
files get written.

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

| Command                                | Phase 1 behavior                                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `shell create [name]`                  | Full prompt flow + validation + non-interactive flags; prints a resolved plan; writes nothing to disk yet. |
| `shell doctor`                         | Fully real: Node/git/package-manager detection, home-dir write check, best-effort registry reachability.   |
| `shell version`                        | Fully real.                                                                                                |
| `shell update`                         | Fully real check-and-advise (registry lookup + semver compare); does not self-execute a global install.    |
| `shell plugins`                        | Real as of Phase 2 — see below.                                                                            |
| `shell config get/set/list/path/reset` | Fully real, schema-validated.                                                                              |
| `shell template list/update`           | Stub — honest "lands in Phase 7" message, exit 0.                                                          |
| `shell cache clear`                    | Fully real — clears `~/.shell-cli/cache`.                                                                  |
| `shell help`                           | Free via `commander`.                                                                                      |

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
edge worth remembering when writing real templates in Phase 4.
