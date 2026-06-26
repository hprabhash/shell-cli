import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  NetworkError,
  ValidationError,
  registryManifestSchema,
  templateVersionManifestSchema,
  type RegistryManifest,
  type TemplateVersionManifest,
} from "@shell-cli/shared";

const FETCH_TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchWithTimeout(url);
  } catch (error) {
    throw new NetworkError(`Could not reach ${url}.`, undefined, error);
  }
  if (!response.ok) {
    throw new NetworkError(`Registry responded with HTTP ${response.status} for ${url}.`);
  }
  try {
    return await response.json();
  } catch (error) {
    throw new NetworkError(`Registry response from ${url} was not valid JSON.`, undefined, error);
  }
}

/** Resolves any other registry resource as a relative URL against the manifest's own URL. */
export function resolveRegistryResource(registryUrl: string, relativePath: string): string {
  return new URL(relativePath, registryUrl).toString();
}

export async function fetchManifest(registryUrl: string): Promise<RegistryManifest> {
  const data = await fetchJson(registryUrl);
  const result = registryManifestSchema.safeParse(data);
  if (!result.success) {
    throw new NetworkError(
      `Registry manifest at ${registryUrl} failed validation: ${result.error.issues.map((issue) => issue.message).join("; ")}`,
    );
  }
  return result.data;
}

export async function fetchVersionManifest(
  registryUrl: string,
  id: string,
  version: string,
): Promise<TemplateVersionManifest> {
  const url = resolveRegistryResource(registryUrl, `templates/${id}/${version}/manifest.json`);
  const data = await fetchJson(url);
  const result = templateVersionManifestSchema.safeParse(data);
  if (!result.success) {
    throw new NetworkError(
      `Template version manifest at ${url} failed validation: ${result.error.issues.map((issue) => issue.message).join("; ")}`,
    );
  }
  return result.data;
}

function assertSafeRelativePath(relPath: string): void {
  const segments = relPath.split("/").filter((segment) => segment.length > 0);
  if (relPath.startsWith("/") || segments.length === 0 || segments.includes("..")) {
    throw new ValidationError(`Unsafe file path in template manifest: "${relPath}".`);
  }
}

function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Downloads every file listed in a template version's manifest into `destDir`,
 * verifying each one's sha256 before writing it. Throws on the first failure
 * (network error, checksum mismatch, unsafe path) — the caller is expected to
 * download into a disposable temp directory so a failure here never touches
 * already-active content (see `template-cache.ts`'s `installVersion`).
 */
export async function downloadTemplateVersionToDir(
  registryUrl: string,
  id: string,
  version: string,
  destDir: string,
): Promise<void> {
  const versionManifest = await fetchVersionManifest(registryUrl, id, version);
  const entries = Object.entries(versionManifest.files);
  if (entries.length === 0) {
    throw new ValidationError(`Template "${id}"@${version} has an empty file manifest.`);
  }

  const destRoot = path.resolve(destDir);
  for (const [relPath, expectedSha256] of entries) {
    assertSafeRelativePath(relPath);
    const destPath = path.resolve(destRoot, relPath);
    if (destPath !== destRoot && !destPath.startsWith(destRoot + path.sep)) {
      throw new ValidationError(`Unsafe file path in template manifest: "${relPath}".`);
    }

    const fileUrl = resolveRegistryResource(
      registryUrl,
      `templates/${id}/${version}/files/${relPath}`,
    );
    let response: Response;
    try {
      response = await fetchWithTimeout(fileUrl);
    } catch (error) {
      throw new NetworkError(`Could not download ${fileUrl}.`, undefined, error);
    }
    if (!response.ok) {
      throw new NetworkError(`Registry responded with HTTP ${response.status} for ${fileUrl}.`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const actualSha256 = sha256Hex(buffer);
    if (actualSha256 !== expectedSha256) {
      throw new NetworkError(
        `Checksum mismatch for "${relPath}" in "${id}"@${version} — expected ${expectedSha256}, got ${actualSha256}.`,
      );
    }

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, buffer);
  }
}
