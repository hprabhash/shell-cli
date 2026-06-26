import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  activateVersion,
  findPreviousCachedVersion,
  getActiveVersion,
  getVersionDir,
  listCachedVersions,
  readCachedManifest,
  readTemplateState,
  writeCachedManifest,
} from "../../src/core/template-cache";

let cacheDir: string;

beforeEach(() => {
  cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "template-cache-test-"));
});

afterEach(() => {
  fs.rmSync(cacheDir, { recursive: true, force: true });
});

describe("readTemplateState", () => {
  it("returns an empty state when nothing is cached yet", () => {
    expect(readTemplateState(cacheDir, "next-app")).toEqual({ active: null, cached: [] });
  });

  it("returns an empty state when state.json is corrupt", () => {
    const dir = path.join(cacheDir, "templates", "next-app");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "state.json"), "not json");
    expect(readTemplateState(cacheDir, "next-app")).toEqual({ active: null, cached: [] });
  });
});

describe("activateVersion", () => {
  it("throws when the requested version isn't cached", () => {
    expect(() => {
      activateVersion(cacheDir, "next-app", "1.0.0");
    }).toThrow(/isn't cached locally/);
  });

  it("flips the active version once it's recorded as cached", () => {
    const dir = path.join(cacheDir, "templates", "next-app");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "state.json"),
      JSON.stringify({ active: null, cached: ["1.0.0"] }),
    );
    activateVersion(cacheDir, "next-app", "1.0.0");
    expect(getActiveVersion(cacheDir, "next-app")).toBe("1.0.0");
  });
});

describe("listCachedVersions / getActiveVersion", () => {
  it("reflect whatever is in state.json", () => {
    const dir = path.join(cacheDir, "templates", "next-app");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "state.json"),
      JSON.stringify({ active: "1.1.0", cached: ["1.0.0", "1.1.0"] }),
    );
    expect(listCachedVersions(cacheDir, "next-app")).toEqual(["1.0.0", "1.1.0"]);
    expect(getActiveVersion(cacheDir, "next-app")).toBe("1.1.0");
  });
});

describe("getVersionDir", () => {
  it("resolves under <cacheDir>/templates/<id>/<version>", () => {
    expect(getVersionDir(cacheDir, "next-app", "1.0.0")).toBe(
      path.join(cacheDir, "templates", "next-app", "1.0.0"),
    );
  });
});

describe("findPreviousCachedVersion", () => {
  it("picks the highest cached version strictly below current", () => {
    expect(findPreviousCachedVersion(["1.0.0", "1.1.0", "1.2.0"], "1.2.0")).toBe("1.1.0");
  });

  it("returns null when there's no older cached version", () => {
    expect(findPreviousCachedVersion(["1.0.0"], "1.0.0")).toBeNull();
    expect(findPreviousCachedVersion([], "1.0.0")).toBeNull();
  });

  it("ignores invalid semver entries", () => {
    expect(findPreviousCachedVersion(["not-a-version", "1.0.0"], "1.1.0")).toBe("1.0.0");
  });
});

describe("readCachedManifest / writeCachedManifest", () => {
  it("returns null when nothing has been cached yet", () => {
    expect(readCachedManifest(cacheDir)).toBeNull();
  });

  it("round-trips a manifest written to the cache", () => {
    const manifest = {
      templates: [
        { id: "next-app", name: "x", description: "x", latest: "1.0.0", versions: ["1.0.0"] },
      ],
    };
    writeCachedManifest(cacheDir, manifest);
    expect(readCachedManifest(cacheDir)).toEqual(manifest);
  });

  it("returns null when the cached manifest file is corrupt", () => {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, "registry-manifest.json"), "not json");
    expect(readCachedManifest(cacheDir)).toBeNull();
  });
});
