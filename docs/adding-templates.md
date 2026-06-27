# Adding Templates to the Registry

The remote template registry (built in Phase 7 — see
[architecture.md](architecture.md) for the full design rationale) lives
directly in this repo under `registry/` and is served read-only via
`raw.githubusercontent.com`. This doc is the practical "how do I publish a
new template or a new version" guide.

## How it's structured

```
registry/
  templates.json                  # top-level manifest
  templates/
    <id>/
      <version>/
        manifest.json              # { "files": { "<relPath>": "<sha256 hex>" } }
        files/                     # the actual template tree, mirrored exactly
```

`registry/templates.json` lists every template with its `latest` version and
the full `versions` history. Old versions are never deleted — that's what
makes `shell template rollback` work without re-downloading anything that's
already been published once.

`DEFAULT_REGISTRY_URL` (in `packages/shared/src/constants.ts`) points at
`registry/templates.json`'s raw URL. Every other resource — a version's
`manifest.json`, its `files/*` — is resolved as a **relative URL** against
that one (see `packages/cli-core/src/core/registry-client.ts`). If you ever
move the registry to a different host, you only need to update that one
constant.

## Publishing a template (the script)

Don't hand-edit `registry/templates.json` or compute checksums yourself —
use `scripts/publish-registry-template.mjs`:

```bash
node scripts/publish-registry-template.mjs <id> <version> <sourceDir> \
  --name "Human-readable name" \
  --description "One-line description"
```

What it does:

1. Walks `<sourceDir>` recursively, computing a sha256 of every file.
2. Writes `registry/templates/<id>/<version>/manifest.json` (the checksum
   map) and copies every file into `registry/templates/<id>/<version>/files/`.
3. Updates (or creates) `registry/templates.json`: adds `<version>` to that
   template's `versions` array and bumps `latest` to it. `--name`/
   `--description` are optional on subsequent versions (they update the
   existing entry's metadata if given, otherwise it's left alone).

Example — publishing a new version of the existing `next-app` template after
editing `packages/plugin-next/templates/next-app/`:

```bash
node scripts/publish-registry-template.mjs next-app 1.1.0 packages/plugin-next/templates/next-app
```

Example — publishing a brand new template:

```bash
node scripts/publish-registry-template.mjs my-template 1.0.0 path/to/source \
  --name "My Template" --description "What it's for."
```

## Before you commit: the CRLF gotcha

**Read this before publishing on Windows.** `registry/**` is covered by a
root `.gitattributes` rule (`registry/** -text`) specifically because git's
line-ending normalization (`core.autocrlf`) will silently change a text
file's bytes on commit — which invalidates its checksum without any error,
since the corruption happens _after_ the publishing script already computed
and wrote the checksum. This actually happened once (see architecture.md's
Phase 7 bug writeup) and broke every download from the live registry until
caught by manual end-to-end verification.

The `.gitattributes` rule should make this a non-issue going forward — git
won't touch bytes under `registry/**` at all, on commit or checkout — but if
you ever see a registry checksum mismatch that makes no sense, this is the
first thing to suspect. To verify your local files match what's committed:

```bash
node -e "
const fs = require('fs');
const crypto = require('crypto');
const manifest = JSON.parse(fs.readFileSync('registry/templates/<id>/<version>/manifest.json', 'utf-8'));
for (const [relPath, expected] of Object.entries(manifest.files)) {
  const actual = crypto.createHash('sha256').update(fs.readFileSync('registry/templates/<id>/<version>/files/' + relPath)).digest('hex');
  if (actual !== expected) console.log('MISMATCH:', relPath);
}
console.log('done');
"
```

## Testing before you push

Don't test against the live `raw.githubusercontent.com` URL while iterating
— GitHub's CDN caches responses for ~5 minutes (`Cache-Control: max-age=300`),
so you won't see your changes immediately even after pushing. Two better
options:

**Point the CLI at your local working tree directly**, via a `file://` URL
or a quick static server:

```bash
npx serve registry -p 4873
node packages/cli-core/dist/bin.js template list --registry-url http://localhost:4873/templates.json
node packages/cli-core/dist/bin.js template update <id> --registry-url http://localhost:4873/templates.json
```

**Or write a real test** using the existing fixture pattern — see
`packages/cli-core/tests/fixtures/test-registry-server.ts` (a real
`node:http` server with a fixture manifest) and
`packages/cli-core/tests/integration/template-registry.test.ts` for how to
exercise the full fetch → verify → cache → activate flow against it.

## After pushing: verifying the live registry

```bash
curl -s https://raw.githubusercontent.com/hprabhash/shell-cli/main/registry/templates.json
node packages/cli-core/dist/bin.js template update <id>
```

If the manifest looks stale, you're hitting the CDN cache — wait a few
minutes, or check response headers (`Cache-Control`/`Source-Age`) to see how
old the cached copy is.

## Scope note

`shell create`'s actual generation pipeline (`plugin-next`'s `generate()`,
etc.) does **not** read from this registry — each plugin still bundles its
own template content and generates from that directly. The registry is a
separate, independently-real subsystem today. Wiring a plugin to prefer a
registry-cached template over its bundled copy is a reasonable next step,
not yet done — see architecture.md's Phase 7 "Scope boundary" note.
