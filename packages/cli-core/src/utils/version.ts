import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { NetworkError, NPM_REGISTRY_BASE_URL } from "@shell-cli/shared";
import semver from "semver";

interface OwnPackageJson {
  name: string;
  version: string;
}

/**
 * Resolves relative to the built `dist/bin.js` (its parent dir's package.json) — this
 * only ever runs from the built artifact, never raw `src`, so the path is fixed.
 */
function readOwnPackageJson(): OwnPackageJson {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const packageJsonPath = path.join(here, "..", "package.json");
  const raw = fs.readFileSync(packageJsonPath, "utf-8");
  return JSON.parse(raw) as OwnPackageJson;
}

export function getCurrentVersion(): string {
  return readOwnPackageJson().version;
}

export function getOwnPackageName(): string {
  return readOwnPackageJson().name;
}

export function isUpdateAvailable(current: string, latest: string): boolean {
  return semver.gt(latest, current);
}

export async function getLatestPublishedVersion(packageName: string): Promise<string> {
  const url = `${NPM_REGISTRY_BASE_URL}/${packageName}/latest`;
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 5000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new NetworkError(
        `npm registry responded with HTTP ${response.status} for "${packageName}".`,
      );
    }
    const data = (await response.json()) as { version?: unknown };
    if (typeof data.version !== "string") {
      throw new NetworkError(
        `Unexpected response shape from the npm registry for "${packageName}".`,
      );
    }
    return data.version;
  } catch (error) {
    if (error instanceof NetworkError) throw error;
    throw new NetworkError(
      "Could not reach the npm registry to check for updates.",
      undefined,
      error,
    );
  } finally {
    clearTimeout(timeout);
  }
}
