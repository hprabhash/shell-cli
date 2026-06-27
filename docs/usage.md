# Using Shell CLI

A command reference and walkthrough for `shell`, the CLI itself. For _why_ it's
built the way it is, see [architecture.md](architecture.md); for extending it,
see [contributing.md](contributing.md).

## Install

No install needed — run it directly with `npx` (it resolves the `shell` bin
even though it differs from the package name, since the package declares
only one `bin` entry):

```bash
npx @hprabhash/shell-cli create my-app
```

Add `-y` to skip the "ok to proceed" confirmation in scripts/CI:
`npx -y @hprabhash/shell-cli create my-app`.

Or install it globally to get the shorter `shell` command:

```bash
npm install -g @hprabhash/shell-cli
shell create my-app
```

(See [releasing.md](releasing.md) for current publish status. To run from a
local clone instead: `pnpm --filter @hprabhash/shell-cli build && node packages/cli-core/dist/bin.js --help`.)

## Quick start

```bash
shell create my-app
```

With no flags, this walks you through an interactive prompt flow:

1. **Project name** (skipped if given as an argument, e.g. `shell create my-app`)
2. **Framework** — currently only Next.js 16 (App Router)
3. **ORM** — `None` / `Prisma` / `Drizzle`
4. **Database** — only asked if you picked an ORM; currently only `PostgreSQL`
   (there's no database to provision without an ORM to use it)
5. **Authentication** — `None` / `Better Auth`, then (if Better Auth) a
   multiselect of features (see [Better Auth features](#better-auth-features) below)
6. **Package manager** — auto-detected, defaults to your configured preference
   (`shell config set packageManager <pm>`) or pnpm > npm > yarn > bun
7. **Initialize git?** (yes/no)
8. **Install dependencies?** (yes/no)

It then prints the resolved plan, scaffolds the project, runs `git init` and
the package manager install if requested, runs each plugin's post-install
step (e.g. `prisma generate`, `npx auth generate`), and prints next steps.

Non-interactively, pass everything as flags plus `--yes`:

```bash
shell create my-app --yes \
  --pm pnpm \
  --orm prisma --database postgresql \
  --auth better-auth --auth-features email-password,google \
  --git --install
```

## Global flags

These work on every command:

| Flag            | Effect                                            |
| --------------- | ------------------------------------------------- |
| `-V, --version` | Print the CLI version and exit.                   |
| `--verbose`     | Show additional progress detail.                  |
| `--debug`       | Show internal debug output (implies `--verbose`). |
| `--silent`      | Suppress all non-error output.                    |
| `--no-color`    | Disable colored output.                           |

## Commands

### `shell create [name]`

Scaffolds a new project. See the [quick start](#quick-start) above for the
interactive flow.

| Flag                         | Effect                                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `-y, --yes`                  | Skip prompts; use flags/defaults. Requires `name` as an argument.                                                                 |
| `--pm <packageManager>`      | `npm` \| `pnpm` \| `yarn` \| `bun`.                                                                                               |
| `--framework <id>`           | Framework plugin id. Run `shell plugins` for the list.                                                                            |
| `--orm <id>`                 | ORM plugin id, or `none`.                                                                                                         |
| `--database <id>`            | Database plugin id, or `none`. **Requires `--orm`** to also be set (to anything but `none`) — there's no database without an ORM. |
| `--auth <id>`                | Auth plugin id, or `none`.                                                                                                        |
| `--auth-features <ids>`      | Comma-separated feature ids for the auth plugin (skips the interactive picker).                                                   |
| `--git` / `--no-git`         | Initialize a git repository. Default: yes.                                                                                        |
| `--install` / `--no-install` | Install dependencies. Default: yes.                                                                                               |

**Outcome:** a real, working project at `./<name>` — not a skeleton. Under
`--yes` with no `--orm`/`--auth`, you get a bare Next.js 16 app. Add `--orm`
and `--database` for a working `docker-compose.yml` + ORM client wired to it;
add `--auth better-auth` to get a fully wired `lib/auth.ts` using whichever
ORM you picked (or `better-sqlite3` if none). Printed "next steps" tell you
exactly what's left to do manually (e.g. `docker compose up -d`, `prisma
migrate dev`) — nothing that needs a live database is ever silently skipped
_or_ silently attempted.

#### Better Auth features

Pass a comma-separated list to `--auth-features`, e.g.
`--auth-features email-password,google,two-factor`. Available ids:

| id                   | Label                     | Requires         |
| -------------------- | ------------------------- | ---------------- |
| `email-password`     | Email Password            |                  |
| `email-verification` | Email Verification        |                  |
| `password-reset`     | Password Reset            | `email-password` |
| `rate-limiting`      | Rate Limiting             |                  |
| `session-management` | Session Management        |                  |
| `account-linking`    | Account Linking           |                  |
| `google`             | Google (OAuth)            |                  |
| `github`             | GitHub (OAuth)            |                  |
| `discord`            | Discord (OAuth)           |                  |
| `microsoft`          | Microsoft (OAuth)         |                  |
| `apple`              | Apple (OAuth)             |                  |
| `magic-link`         | Magic Link                |                  |
| `two-factor`         | Two Factor Authentication |                  |
| `organization`       | Organization              |                  |
| `teams`              | Teams                     | `organization`   |
| `multi-session`      | Multi Session             |                  |
| `admin`              | Admin                     |                  |
| `passkeys`           | Passkeys (WebAuthn)       |                  |
| `api-keys`           | API Keys                  |                  |

Under `--yes` with no `--auth-features` given, defaults to `email-password`.
Selecting a feature without something it `Requires` is a validation error.

### `shell doctor`

Checks your environment for issues that would prevent `shell create` from
working: Node.js version, git, at least one package manager, that
`~/.shell-cli` is writable, and that the npm registry and template registry
are reachable. Always real checks, never placeholders.

**Outcome:** prints a pass/warn/fail line per check plus a summary count.
Exits `1` if anything failed, `0` otherwise (warnings don't fail the command —
e.g. no network just means cached data will be used instead).

### `shell version`

Prints the CLI's own version and the Node.js version it's running under.

### `shell update [--yes] [--rollback]`

Checks the npm registry for a newer published version of this CLI.

| Flag         | Effect                                                  |
| ------------ | ------------------------------------------------------- |
| `-y, --yes`  | Apply an available update without confirming.           |
| `--rollback` | Reinstall whichever version this command last replaced. |

**Outcome:** with no flags, checks and (if an update exists) asks to confirm
before running the actual global install command for your package manager.
Decline, and it just prints the command to run yourself. `--rollback` needs
at least one prior successful `update` to have something to roll back to —
otherwise it fails with a clear error rather than guessing.

### `shell plugins`

Lists every built-in plugin: id, name, category, version, description.
Useful for discovering valid `--framework`/`--orm`/`--database`/`--auth`
values for `shell create`.

Currently registered:

| id            | name                    | category    |
| ------------- | ----------------------- | ----------- |
| `next`        | Next.js 16 (App Router) | `framework` |
| `prisma`      | Prisma                  | `orm`       |
| `drizzle`     | Drizzle                 | `orm`       |
| `postgresql`  | PostgreSQL              | `database`  |
| `better-auth` | Better Auth             | `auth`      |

### `shell config get/set/list/path/reset`

Reads and writes `~/.shell-cli/config.json` (schema-validated on every read).

- `shell config list` — prints every key and its current value.
- `shell config get <key>` — prints one value.
- `shell config set <key> <value>` — sets one value (validated against the
  schema; `null`/`none` clears a nullable key, e.g.
  `shell config set packageManager null`).
- `shell config path` — prints the config file's path.
- `shell config reset [-y]` — resets everything to defaults (prompts to
  confirm unless `-y`).

Keys: `packageManager`, `preferredDatabase`, `telemetry`, `registryUrl`,
`cacheDir`, `lastKnownGoodVersion` (used internally by `shell update --rollback`).

### `shell template list/update/rollback`

Manages templates from the remote registry (see
[adding-templates.md](adding-templates.md) for the maintainer side). Every
subcommand accepts `--registry-url <url>` to override the configured registry
for that one invocation.

- `shell template list` — fetches the registry manifest and shows each
  template's id/name/description/latest version, plus your cached/active
  version and whether an update is pending. Falls back to the last
  successfully fetched manifest if offline.
- `shell template update [id]` — downloads (verifying sha256 checksums) and
  activates the latest version of one template, or every template if no id
  is given. A failed download never disturbs whatever was already active.
- `shell template rollback <id> [version]` — with a version, downloads
  (if needed) and activates exactly that version. Without one, activates the
  next-lower cached version — no network call, since it's already on disk.

**Outcome:** real files on disk under `~/.shell-cli/cache/templates/<id>/<version>/`.
Today there's one published template, `next-app` — the same content
`plugin-next` bundles, published independently so it can be updated without
a new CLI release (though `shell create` doesn't consume the registry copy
yet — see architecture.md's Phase 7 section for that scope boundary).

### `shell cache clear`

Deletes `~/.shell-cli/cache` entirely (registry manifest cache + every
cached template version). Safe to run any time; the next `template
list`/`update` just re-fetches.

### `shell help`

Free via `commander` — same as `--help` on any command/subcommand.
