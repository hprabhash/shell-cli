import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { registerPartialsDir, renderFile, renderString } from "../../src/engine";

describe("renderString", () => {
  it("substitutes variables", () => {
    expect(renderString("Hello {{name}}!", { name: "World" })).toBe("Hello World!");
  });

  it("does not HTML-escape variable values", () => {
    expect(renderString("{{value}}", { value: '"quoted" & <tag>' })).toBe('"quoted" & <tag>');
  });

  it("supports #if/#unless conditionals", () => {
    expect(renderString("{{#if flag}}yes{{else}}no{{/if}}", { flag: true })).toBe("yes");
    expect(renderString("{{#if flag}}yes{{else}}no{{/if}}", { flag: false })).toBe("no");
    expect(renderString("{{#unless flag}}yes{{/unless}}", { flag: false })).toBe("yes");
  });

  it("supports the eq/and/or/not helpers in subexpressions", () => {
    expect(renderString('{{#if (eq orm "prisma")}}yes{{else}}no{{/if}}', { orm: "prisma" })).toBe(
      "yes",
    );
    expect(renderString('{{#if (eq orm "prisma")}}yes{{else}}no{{/if}}', { orm: "drizzle" })).toBe(
      "no",
    );
    expect(renderString("{{#if (and a b)}}yes{{else}}no{{/if}}", { a: true, b: false })).toBe("no");
    expect(renderString("{{#if (or a b)}}yes{{else}}no{{/if}}", { a: false, b: true })).toBe("yes");
    expect(renderString("{{#if (not a)}}yes{{else}}no{{/if}}", { a: false })).toBe("yes");
  });
});

describe("renderFile", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "template-engine-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("renders a file's contents", () => {
    const filePath = path.join(tmpDir, "greeting.txt.hbs");
    fs.writeFileSync(filePath, "Hi {{name}}");
    expect(renderFile(filePath, { name: "Ada" })).toBe("Hi Ada");
  });

  it("throws a clear error for a missing file", () => {
    expect(() => renderFile(path.join(tmpDir, "missing.hbs"), {})).toThrow(
      /Could not read template file/,
    );
  });
});

describe("registerPartialsDir", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "template-engine-partials-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("registers nested partials by relative path", () => {
    fs.mkdirSync(path.join(tmpDir, "nested"));
    fs.writeFileSync(path.join(tmpDir, "nested", "header.hbs"), "== {{title}} ==");
    registerPartialsDir(tmpDir);
    expect(renderString("{{> nested/header}}", { title: "Hello" })).toBe("== Hello ==");
  });

  it("does nothing if the directory doesn't exist", () => {
    expect(() => {
      registerPartialsDir(path.join(tmpDir, "does-not-exist"));
    }).not.toThrow();
  });
});
