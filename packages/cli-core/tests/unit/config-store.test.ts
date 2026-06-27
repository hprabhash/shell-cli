import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getDefaultConfig } from "@hprabhash/shared";

import {
  getConfigValue,
  loadConfig,
  resetConfig,
  saveConfig,
  setConfigValue,
} from "../../src/core/config-store";

let tmpHome: string;
let originalHome: string | undefined;
let originalUserProfile: string | undefined;

beforeEach(() => {
  originalHome = process.env.HOME;
  originalUserProfile = process.env.USERPROFILE;
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "shell-cli-config-test-"));
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
});

afterEach(() => {
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = originalUserProfile;
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

describe("config-store", () => {
  it("returns defaults when no config file exists", () => {
    expect(loadConfig()).toEqual(getDefaultConfig());
  });

  it("round-trips set/get", () => {
    setConfigValue("packageManager", "pnpm");
    expect(getConfigValue("packageManager")).toBe("pnpm");
  });

  it("rejects an invalid value", () => {
    expect(() => setConfigValue("telemetry", "not-a-boolean")).toThrow();
  });

  it("persists across loads", () => {
    saveConfig({ ...getDefaultConfig(), telemetry: true });
    expect(loadConfig().telemetry).toBe(true);
  });

  it("reset restores defaults", () => {
    setConfigValue("packageManager", "yarn");
    resetConfig();
    expect(loadConfig().packageManager).toBeNull();
  });

  it("treats 'null' as clearing a nullable key", () => {
    setConfigValue("packageManager", "npm");
    setConfigValue("packageManager", "null");
    expect(getConfigValue("packageManager")).toBeNull();
  });
});
