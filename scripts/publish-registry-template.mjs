#!/usr/bin/env node
// Publishes a template directory into registry/templates/<id>/<version>/ —
// computes a sha256 per file (manifest.json) and updates the top-level
// registry/templates.json. Not part of the shipped CLI package; this is
// one-off content-publishing tooling, run manually when adding/updating a
// registry template.
//
// Usage: node scripts/publish-registry-template.mjs <id> <version> <sourceDir> [--name "..."] [--description "..."]

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      flags[key] = argv[i + 1];
      i++;
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function walkFiles(dir, baseDir = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      files.push(path.relative(baseDir, fullPath));
    }
  }
  return files.map((p) => p.split(path.sep).join("/"));
}

function sha256OfFile(filePath) {
  const content = fs.readFileSync(filePath);
  return createHash("sha256").update(content).digest("hex");
}

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [id, version, sourceDirArg] = positional;
  if (!id || !version || !sourceDirArg) {
    console.error(
      "Usage: node scripts/publish-registry-template.mjs <id> <version> <sourceDir> [--name name] [--description desc]",
    );
    process.exit(1);
  }

  const sourceDir = path.resolve(sourceDirArg);
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    console.error(`Source directory does not exist: ${sourceDir}`);
    process.exit(1);
  }

  const relFiles = walkFiles(sourceDir);
  if (relFiles.length === 0) {
    console.error(`Source directory is empty: ${sourceDir}`);
    process.exit(1);
  }

  const versionDir = path.join(repoRoot, "registry", "templates", id, version);
  const filesDir = path.join(versionDir, "files");
  fs.mkdirSync(filesDir, { recursive: true });

  const checksums = {};
  for (const relPath of relFiles) {
    const sourcePath = path.join(sourceDir, relPath);
    const destPath = path.join(filesDir, relPath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(sourcePath, destPath);
    checksums[relPath] = sha256OfFile(sourcePath);
  }

  const versionManifestPath = path.join(versionDir, "manifest.json");
  fs.writeFileSync(
    versionManifestPath,
    `${JSON.stringify({ files: checksums }, null, 2)}\n`,
    "utf-8",
  );

  const topManifestPath = path.join(repoRoot, "registry", "templates.json");
  const topManifest = fs.existsSync(topManifestPath)
    ? JSON.parse(fs.readFileSync(topManifestPath, "utf-8"))
    : { templates: [] };

  const existing = topManifest.templates.find((t) => t.id === id);
  if (existing) {
    if (!existing.versions.includes(version)) {
      existing.versions.push(version);
    }
    existing.latest = version;
    if (flags.name) existing.name = flags.name;
    if (flags.description) existing.description = flags.description;
  } else {
    topManifest.templates.push({
      id,
      name: flags.name ?? id,
      description: flags.description ?? "",
      latest: version,
      versions: [version],
    });
  }

  fs.writeFileSync(topManifestPath, `${JSON.stringify(topManifest, null, 2)}\n`, "utf-8");

  console.log(`Published "${id}"@${version} — ${relFiles.length} files.`);
  console.log(`  ${path.relative(repoRoot, versionDir)}/`);
  console.log(`  ${path.relative(repoRoot, topManifestPath)} updated.`);
}

main();
