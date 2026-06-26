import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { initGitRepo } from "../../src/core/git";

describe("initGitRepo", () => {
  let targetDir: string;

  beforeEach(() => {
    targetDir = fs.mkdtempSync(path.join(os.tmpdir(), "init-git-repo-test-"));
  });

  afterEach(() => {
    fs.rmSync(targetDir, { recursive: true, force: true });
  });

  it("initializes a real git repository against a real temp dir using the default runner", async () => {
    fs.writeFileSync(path.join(targetDir, "file.txt"), "hello");

    const result = await initGitRepo(targetDir);

    expect(result.initialized).toBe(true);
    expect(fs.existsSync(path.join(targetDir, ".git"))).toBe(true);
    // `committed` depends on whether this machine has a git identity configured —
    // asserted loosely here; the failure-mode tests below cover both outcomes explicitly.
    expect(typeof result.committed).toBe("boolean");
  });

  it("reports initialized: false when git init itself fails", async () => {
    const result = await initGitRepo(targetDir, (command) => {
      if (command === "git") {
        return Promise.resolve({ stdout: "", stderr: "git not found", exitCode: 127 });
      }
      return Promise.resolve({ stdout: "", stderr: "", exitCode: 0 });
    });

    expect(result).toEqual({ initialized: false, committed: false });
  });

  it("reports committed: false when the commit step fails but init succeeded", async () => {
    let callCount = 0;
    const result = await initGitRepo(targetDir, (_command, args) => {
      callCount += 1;
      if (args[0] === "init") {
        return Promise.resolve({ stdout: "", stderr: "", exitCode: 0 });
      }
      if (args[0] === "add") {
        return Promise.resolve({ stdout: "", stderr: "", exitCode: 0 });
      }
      // commit fails (e.g. no identity configured)
      return Promise.resolve({ stdout: "", stderr: "no identity", exitCode: 1 });
    });

    expect(result).toEqual({ initialized: true, committed: false });
    expect(callCount).toBe(3);
  });
});
