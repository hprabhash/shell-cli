# Architecture

This is a living document, extended at the end of each build phase. It records what
exists, why it's structured that way, and what's intentionally deferred.

## Roadmap

| #   | Phase                                                | Status     |
| --- | ---------------------------------------------------- | ---------- |
| 1   | CLI Core (commands, prompts, logging, configuration) | ✅ Done    |
| 2   | Plugin architecture                                  | ⏳ Planned |
| 3   | Template engine                                      | ⏳ Planned |
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

### Why no plugin system yet

The spec's end state is "the core CLI never needs modification to add a new
framework" — that requires a real plugin contract (`register/questions/validate/
install/generate/postInstall/doctor`) and a loader, which is Phase 2. Building that
contract well requires at least one concrete consumer in mind (the Next.js + Better
Auth + Prisma/Drizzle stack), so Phase 1 intentionally keeps `shell create` as a
**prompt + validation + planning** flow only: it resolves and prints the user's
choices but writes no files. This avoids hard-coding a one-off generator now that
would just be deleted in Phase 4.

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
| `shell plugins`                        | Stub — honest "lands in Phase 2" message, exit 0.                                                          |
| `shell config get/set/list/path/reset` | Fully real, schema-validated.                                                                              |
| `shell template list/update`           | Stub — honest "lands in Phase 7" message, exit 0.                                                          |
| `shell cache clear`                    | Fully real — clears `~/.shell-cli/cache`.                                                                  |
| `shell help`                           | Free via `commander`.                                                                                      |

Stubs always exit `0` and name the phase that will implement them — they are
forward-declarations of the command surface, not fake implementations.
