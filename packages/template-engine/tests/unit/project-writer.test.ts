import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ProjectWriter } from "../../src/project-writer";

describe("ProjectWriter", () => {
  let parentDir: string;

  beforeEach(() => {
    parentDir = fs.mkdtempSync(path.join(os.tmpdir(), "project-writer-test-"));
  });

  afterEach(() => {
    fs.rmSync(parentDir, { recursive: true, force: true });
  });

  it("writes files, creating nested directories as needed", () => {
    const targetDir = path.join(parentDir, "fresh-target");
    const writer = new ProjectWriter(targetDir);
    writer.writeFile("src/index.ts", "export const x = 1;");
    expect(fs.readFileSync(path.join(targetDir, "src", "index.ts"), "utf-8")).toBe(
      "export const x = 1;",
    );
  });

  it("copies files byte-for-byte", () => {
    const sourceFile = path.join(parentDir, "source.bin");
    fs.writeFileSync(sourceFile, Buffer.from([0, 1, 2, 255]));
    const targetDir = path.join(parentDir, "fresh-target");
    const writer = new ProjectWriter(targetDir);
    writer.copyFile(sourceFile, "nested/dest.bin");
    expect(fs.readFileSync(path.join(targetDir, "nested", "dest.bin"))).toEqual(
      Buffer.from([0, 1, 2, 255]),
    );
  });

  it("rollback removes the whole target directory when it was created fresh", () => {
    const targetDir = path.join(parentDir, "fresh-target");
    const writer = new ProjectWriter(targetDir);
    writer.writeFile("a.txt", "a");
    writer.writeFile("nested/b.txt", "b");
    writer.rollback();
    expect(fs.existsSync(targetDir)).toBe(false);
  });

  it("rollback only removes what it added when the target directory pre-existed", () => {
    const targetDir = path.join(parentDir, "existing-target");
    fs.mkdirSync(targetDir);
    fs.writeFileSync(path.join(targetDir, "keep-me.txt"), "original");

    const writer = new ProjectWriter(targetDir);
    writer.writeFile("added.txt", "new");
    writer.writeFile("nested/also-added.txt", "new");
    writer.rollback();

    expect(fs.existsSync(targetDir)).toBe(true);
    expect(fs.readFileSync(path.join(targetDir, "keep-me.txt"), "utf-8")).toBe("original");
    expect(fs.existsSync(path.join(targetDir, "added.txt"))).toBe(false);
    expect(fs.existsSync(path.join(targetDir, "nested"))).toBe(false);
  });

  it("commit() then rollback() is a no-op", () => {
    const targetDir = path.join(parentDir, "fresh-target");
    const writer = new ProjectWriter(targetDir);
    writer.writeFile("a.txt", "a");
    writer.commit();
    writer.rollback();
    expect(fs.existsSync(path.join(targetDir, "a.txt"))).toBe(true);
  });

  it("patchFile restores the original content on rollback when the file pre-existed", () => {
    const targetDir = path.join(parentDir, "existing-target");
    fs.mkdirSync(targetDir);
    fs.writeFileSync(path.join(targetDir, "package.json"), '{"name":"original"}');

    const writer = new ProjectWriter(targetDir);
    writer.patchFile("package.json", '{"name":"patched"}');
    expect(fs.readFileSync(path.join(targetDir, "package.json"), "utf-8")).toBe(
      '{"name":"patched"}',
    );

    writer.rollback();
    expect(fs.readFileSync(path.join(targetDir, "package.json"), "utf-8")).toBe(
      '{"name":"original"}',
    );
  });

  it("patchFile behaves like writeFile (delete on rollback) when the file didn't pre-exist", () => {
    const targetDir = path.join(parentDir, "existing-target");
    fs.mkdirSync(targetDir);

    const writer = new ProjectWriter(targetDir);
    writer.patchFile("new-file.json", '{"name":"new"}');
    writer.rollback();

    expect(fs.existsSync(path.join(targetDir, "new-file.json"))).toBe(false);
    expect(fs.existsSync(targetDir)).toBe(true);
  });

  it("commit() keeps a patched file and clears patch tracking", () => {
    const targetDir = path.join(parentDir, "existing-target");
    fs.mkdirSync(targetDir);
    fs.writeFileSync(path.join(targetDir, "package.json"), '{"name":"original"}');

    const writer = new ProjectWriter(targetDir);
    writer.patchFile("package.json", '{"name":"patched"}');
    writer.commit();
    writer.rollback();

    expect(fs.readFileSync(path.join(targetDir, "package.json"), "utf-8")).toBe(
      '{"name":"patched"}',
    );
  });
});
