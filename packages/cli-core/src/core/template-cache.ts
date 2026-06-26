import fs from "node:fs";
import path from "node:path";

import {
  ConfigError,
  FileSystemError,
  REGISTRY_MANIFEST_CACHE_FILE_NAME,
  TEMPLATES_CACHE_SUBDIR_NAME,
  type RegistryManifest,
} from "@shell-cli/shared";
import semver from "semver";

import { downloadTemplateVersionToDir } from "./registry-client";

export interface TemplateState {
  active: string | null;
  cached: string[];
}

function getTemplatesRoot(cacheDir: string): string {
  return path.join(cacheDir, TEMPLATES_CACHE_SUBDIR_NAME);
}

function getTemplateDir(cacheDir: string, id: string): string {
  return path.join(getTemplatesRoot(cacheDir), id);
}

function getStatePath(cacheDir: string, id: string): string {
  return path.join(getTemplateDir(cacheDir, id), "state.json");
}

export function getVersionDir(cacheDir: string, id: string, version: string): string {
  return path.join(getTemplateDir(cacheDir, id), version);
}

export function readTemplateState(cacheDir: string, id: string): TemplateState {
  const statePath = getStatePath(cacheDir, id);
  if (!fs.existsSync(statePath)) {
    return { active: null, cached: [] };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, "utf-8")) as Partial<TemplateState>;
    return {
      active: typeof parsed.active === "string" ? parsed.active : null,
      cached: Array.isArray(parsed.cached)
        ? parsed.cached.filter((value): value is string => typeof value === "string")
        : [],
    };
  } catch {
    return { active: null, cached: [] };
  }
}

function writeTemplateState(cacheDir: string, id: string, state: TemplateState): void {
  const dir = getTemplateDir(cacheDir, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getStatePath(cacheDir, id), `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}

export function listCachedVersions(cacheDir: string, id: string): string[] {
  return readTemplateState(cacheDir, id).cached;
}

export function getActiveVersion(cacheDir: string, id: string): string | null {
  return readTemplateState(cacheDir, id).active;
}

/**
 * Downloads+verifies a template version into a disposable temp directory, then
 * atomically renames it into place. A failure at any point (network, checksum)
 * cleans up the temp directory and leaves any previously-cached/active version
 * completely untouched. Does not change which version is "active" — call
 * `activateVersion` separately once you're ready to switch to it.
 */
export async function installVersion(
  cacheDir: string,
  registryUrl: string,
  id: string,
  version: string,
): Promise<void> {
  const state = readTemplateState(cacheDir, id);
  if (state.cached.includes(version)) {
    return;
  }

  const templateDir = getTemplateDir(cacheDir, id);
  fs.mkdirSync(templateDir, { recursive: true });
  const tempDir = path.join(templateDir, `.tmp-${version}-${process.pid}-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    await downloadTemplateVersionToDir(registryUrl, id, version, tempDir);
  } catch (error) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }

  const versionDir = getVersionDir(cacheDir, id, version);
  try {
    fs.renameSync(tempDir, versionDir);
  } catch (error) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw new FileSystemError(
      `Could not finalize cached template "${id}"@${version}.`,
      undefined,
      error,
    );
  }

  writeTemplateState(cacheDir, id, {
    active: state.active,
    cached: [...new Set([...state.cached, version])],
  });
}

/** Switches the "active" version for a template to one that's already cached locally — no network call. */
export function activateVersion(cacheDir: string, id: string, version: string): void {
  const state = readTemplateState(cacheDir, id);
  if (!state.cached.includes(version)) {
    throw new ConfigError(
      `Template "${id}"@${version} isn't cached locally.`,
      `Run "shell template update ${id}" first.`,
    );
  }
  writeTemplateState(cacheDir, id, { active: version, cached: state.cached });
}

/** Picks the highest cached version strictly below `current` — the default rollback target when no version is given. */
export function findPreviousCachedVersion(
  cachedVersions: readonly string[],
  current: string,
): string | null {
  const older = cachedVersions.filter(
    (version) => semver.valid(version) !== null && semver.lt(version, current),
  );
  if (older.length === 0) {
    return null;
  }
  return older.sort(semver.compare).at(-1) ?? null;
}

function getManifestCachePath(cacheDir: string): string {
  return path.join(cacheDir, REGISTRY_MANIFEST_CACHE_FILE_NAME);
}

/** Returns `null` if there's no cached manifest yet, or it's unreadable — callers treat that as "no offline fallback available." */
export function readCachedManifest(cacheDir: string): RegistryManifest | null {
  const manifestPath = getManifestCachePath(cacheDir);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as RegistryManifest;
  } catch {
    return null;
  }
}

export function writeCachedManifest(cacheDir: string, manifest: RegistryManifest): void {
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(
    getManifestCachePath(cacheDir),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf-8",
  );
}
