import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CommandRunner } from "@hprabhash/shared";

import {
  checkGit,
  checkHomeDirWritable,
  checkNetwork,
  checkNodeVersion,
  checkPackageManagers,
  checkRegistry,
} from "../../src/core/system-checks";

function fakeRunner(
  responses: Record<string, { stdout: string; exitCode: number }>,
): CommandRunner {
  return (command) => {
    const response = responses[command];
    if (!response) {
      return Promise.resolve({ stdout: "", stderr: "not found", exitCode: 127 });
    }
    return Promise.resolve({ stdout: response.stdout, stderr: "", exitCode: response.exitCode });
  };
}

describe("checkNodeVersion", () => {
  it("passes for a supported version", () => {
    expect(checkNodeVersion("v22.12.0").status).toBe("pass");
  });

  it("fails for an unsupported version", () => {
    expect(checkNodeVersion("v20.11.0").status).toBe("fail");
  });
});

describe("checkGit", () => {
  it("passes when git is available", async () => {
    const result = await checkGit(
      fakeRunner({ git: { stdout: "git version 2.40.0", exitCode: 0 } }),
    );
    expect(result.status).toBe("pass");
  });

  it("warns when git is missing", async () => {
    const result = await checkGit(fakeRunner({}));
    expect(result.status).toBe("warn");
  });
});

describe("checkPackageManagers", () => {
  it("passes when at least one package manager is available", async () => {
    const result = await checkPackageManagers(
      fakeRunner({ npm: { stdout: "10.0.0", exitCode: 0 } }),
    );
    expect(result.status).toBe("pass");
    expect(result.message).toContain("npm");
  });

  it("fails when none are available", async () => {
    const result = await checkPackageManagers(fakeRunner({}));
    expect(result.status).toBe("fail");
  });
});

describe("checkHomeDirWritable", () => {
  let tmpHome: string;
  let originalHome: string | undefined;
  let originalUserProfile: string | undefined;

  beforeEach(() => {
    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "shell-cli-home-test-"));
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

  it("passes when the config directory is writable", () => {
    expect(checkHomeDirWritable().status).toBe("pass");
  });
});

describe("checkNetwork", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes when the registry responds ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    expect((await checkNetwork()).status).toBe("pass");
  });

  it("warns when the registry is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    expect((await checkNetwork()).status).toBe("warn");
  });
});

describe("checkRegistry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes when the template registry responds ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    expect((await checkRegistry("https://example.com/templates.json")).status).toBe("pass");
  });

  it("warns when the template registry is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    expect((await checkRegistry("https://example.com/templates.json")).status).toBe("warn");
  });
});
