import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { fetchManifest } from "../../src/core/registry-client";
import {
  activateVersion,
  findPreviousCachedVersion,
  getActiveVersion,
  getVersionDir,
  installVersion,
  listCachedVersions,
  readTemplateState,
} from "../../src/core/template-cache";
import { WIDGET_FILES, startTestRegistryServer } from "../fixtures/test-registry-server";

describe("template registry (integration, real local HTTP server)", () => {
  let registryUrl: string;
  let closeServer: () => Promise<void>;
  let cacheDir: string;

  beforeAll(async () => {
    const server = await startTestRegistryServer();
    registryUrl = server.url;
    closeServer = server.close;
  });

  afterAll(async () => {
    await closeServer();
  });

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "template-registry-test-"));
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it("fetches and validates the real manifest over HTTP", async () => {
    const manifest = await fetchManifest(registryUrl);
    expect(manifest.templates).toHaveLength(1);
    expect(manifest.templates[0]).toMatchObject({ id: "widget", latest: "1.1.0" });
  });

  it("installs a version, writing real verified file content to disk", async () => {
    await installVersion(cacheDir, registryUrl, "widget", "1.0.0");

    const versionDir = getVersionDir(cacheDir, "widget", "1.0.0");
    expect(fs.readFileSync(path.join(versionDir, "package.json"), "utf-8")).toBe(
      WIDGET_FILES["1.0.0"]?.["package.json"],
    );
    expect(fs.readFileSync(path.join(versionDir, "README.md"), "utf-8")).toBe(
      WIDGET_FILES["1.0.0"]?.["README.md"],
    );

    expect(readTemplateState(cacheDir, "widget")).toEqual({ active: null, cached: ["1.0.0"] });
  });

  it("activate -> install another version -> activate -> rollback round-trips correctly", async () => {
    // Dedicated server for this test (rather than the shared one) since the
    // test deliberately closes it partway through to prove rollback needs no network.
    const server = await startTestRegistryServer();
    try {
      await installVersion(cacheDir, server.url, "widget", "1.0.0");
      activateVersion(cacheDir, "widget", "1.0.0");
      expect(getActiveVersion(cacheDir, "widget")).toBe("1.0.0");

      await installVersion(cacheDir, server.url, "widget", "1.1.0");
      // installVersion never changes "active" on its own.
      expect(getActiveVersion(cacheDir, "widget")).toBe("1.0.0");

      activateVersion(cacheDir, "widget", "1.1.0");
      expect(getActiveVersion(cacheDir, "widget")).toBe("1.1.0");

      const cached = listCachedVersions(cacheDir, "widget");
      const previous = findPreviousCachedVersion(cached, "1.1.0");
      expect(previous).toBe("1.0.0");

      // Rollback needs no network — prove it by closing the server first.
      await server.close();
      activateVersion(cacheDir, "widget", previous ?? "");
      expect(getActiveVersion(cacheDir, "widget")).toBe("1.0.0");
      const versionDir = getVersionDir(cacheDir, "widget", "1.0.0");
      expect(fs.readFileSync(path.join(versionDir, "package.json"), "utf-8")).toBe(
        WIDGET_FILES["1.0.0"]?.["package.json"],
      );
    } finally {
      await server.close().catch(() => undefined);
    }
  });

  it("rejects a version whose served files don't match the declared checksum, leaving the active version untouched", async () => {
    await installVersion(cacheDir, registryUrl, "widget", "1.0.0");
    activateVersion(cacheDir, "widget", "1.0.0");

    await expect(installVersion(cacheDir, registryUrl, "widget", "9.9.9")).rejects.toThrow(
      /Checksum mismatch/,
    );

    // The broken version was never finalized into the cache.
    expect(fs.existsSync(getVersionDir(cacheDir, "widget", "9.9.9"))).toBe(false);
    // No leftover temp directories from the failed attempt.
    const templateDir = path.join(cacheDir, "templates", "widget");
    const leftovers = fs.readdirSync(templateDir).filter((entry) => entry.startsWith(".tmp-"));
    expect(leftovers).toEqual([]);

    // The previously-active version is completely unaffected.
    expect(getActiveVersion(cacheDir, "widget")).toBe("1.0.0");
    expect(listCachedVersions(cacheDir, "widget")).toEqual(["1.0.0"]);
    const versionDir = getVersionDir(cacheDir, "widget", "1.0.0");
    expect(fs.readFileSync(path.join(versionDir, "package.json"), "utf-8")).toBe(
      WIDGET_FILES["1.0.0"]?.["package.json"],
    );
  });

  it("installVersion is a no-op when the version is already cached", async () => {
    await installVersion(cacheDir, registryUrl, "widget", "1.0.0");
    const versionDir = getVersionDir(cacheDir, "widget", "1.0.0");
    const before = fs.statSync(versionDir).mtimeMs;

    await installVersion(cacheDir, registryUrl, "widget", "1.0.0");
    expect(fs.statSync(versionDir).mtimeMs).toBe(before);
  });
});
