import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  assertValidProjectName,
  describeTargetDirectory,
  validateProjectName,
} from "../../src/utils/validate-project-name";

describe("validateProjectName", () => {
  it("accepts simple lowercase names", () => {
    expect(validateProjectName("my-app").valid).toBe(true);
  });

  it("rejects empty names", () => {
    expect(validateProjectName("").valid).toBe(false);
  });

  it("rejects uppercase names", () => {
    expect(validateProjectName("MyApp").valid).toBe(false);
  });

  it("rejects names with spaces", () => {
    expect(validateProjectName("my app").valid).toBe(false);
  });

  it("rejects names starting with a dot", () => {
    expect(validateProjectName(".myapp").valid).toBe(false);
  });

  it("accepts names with dots, hyphens, and underscores", () => {
    expect(validateProjectName("my_app.v2-final").valid).toBe(true);
  });
});

describe("assertValidProjectName", () => {
  it("throws for invalid names", () => {
    expect(() => {
      assertValidProjectName("Invalid Name");
    }).toThrow();
  });

  it("does not throw for valid names", () => {
    expect(() => {
      assertValidProjectName("valid-name");
    }).not.toThrow();
  });
});

describe("describeTargetDirectory", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shell-cli-target-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reports non-existent directories as not existing and empty", () => {
    const target = path.join(tmpDir, "does-not-exist");
    expect(describeTargetDirectory(target)).toEqual({ exists: false, isEmpty: true });
  });

  it("reports existing empty directories as empty", () => {
    expect(describeTargetDirectory(tmpDir)).toEqual({ exists: true, isEmpty: true });
  });

  it("reports existing non-empty directories as not empty", () => {
    fs.writeFileSync(path.join(tmpDir, "file.txt"), "hi");
    expect(describeTargetDirectory(tmpDir)).toEqual({ exists: true, isEmpty: false });
  });
});
