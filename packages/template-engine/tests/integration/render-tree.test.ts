import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { renderTemplateTree } from "../../src/render-tree";

describe("renderTemplateTree", () => {
  let parentDir: string;
  let templateDir: string;

  beforeEach(() => {
    parentDir = fs.mkdtempSync(path.join(os.tmpdir(), "render-tree-test-"));
    templateDir = path.join(parentDir, "template");
    fs.mkdirSync(path.join(templateDir, "_partials"), { recursive: true });
    fs.mkdirSync(path.join(templateDir, "src"), { recursive: true });

    // Trailing newline matters: Handlebars treats a partial reference that's alone on
    // its line as "standalone" and strips the line break that follows it, so the
    // partial's own content must supply it.
    fs.writeFileSync(
      path.join(templateDir, "_partials", "header.hbs"),
      "// Generated for {{projectName}}\n",
    );
    fs.writeFileSync(
      path.join(templateDir, "README.md.hbs"),
      "{{> header}}\n# {{projectName}}\n{{#if useTailwind}}Tailwind enabled{{else}}No Tailwind{{/if}}\n",
    );
    fs.writeFileSync(
      path.join(templateDir, "src", "index.ts.hbs"),
      'export const name = "{{projectName}}";\n',
    );
    fs.writeFileSync(path.join(templateDir, "LICENSE"), "MIT\n");
  });

  afterEach(() => {
    fs.rmSync(parentDir, { recursive: true, force: true });
  });

  it("renders .hbs files, copies everything else, strips the .hbs suffix, and excludes _partials from output", async () => {
    const targetDir = path.join(parentDir, "target");

    const result = await renderTemplateTree(templateDir, targetDir, {
      projectName: "my-app",
      useTailwind: true,
    });

    expect(fs.readFileSync(path.join(targetDir, "README.md"), "utf-8")).toBe(
      "// Generated for my-app\n# my-app\nTailwind enabled\n",
    );
    expect(fs.readFileSync(path.join(targetDir, "src", "index.ts"), "utf-8")).toBe(
      'export const name = "my-app";\n',
    );
    expect(fs.readFileSync(path.join(targetDir, "LICENSE"), "utf-8")).toBe("MIT\n");
    expect(fs.existsSync(path.join(targetDir, "README.md.hbs"))).toBe(false);
    expect(fs.existsSync(path.join(targetDir, "_partials"))).toBe(false);
    expect(result.filesWritten).toHaveLength(3);
  });

  it("rolls back a freshly-created target directory if rendering fails partway through", async () => {
    fs.writeFileSync(path.join(templateDir, "src", "index.ts.hbs"), "{{#if}}{{/if_typo}}");

    const targetDir = path.join(parentDir, "target-fail");
    await expect(
      renderTemplateTree(templateDir, targetDir, { projectName: "my-app", useTailwind: true }),
    ).rejects.toThrow();

    expect(fs.existsSync(targetDir)).toBe(false);
  });

  it("leaves a pre-existing target directory's prior content untouched after a rollback", async () => {
    fs.writeFileSync(path.join(templateDir, "src", "index.ts.hbs"), "{{#if}}{{/if_typo}}");

    const targetDir = path.join(parentDir, "target-existing");
    fs.mkdirSync(targetDir);
    fs.writeFileSync(path.join(targetDir, "keep-me.txt"), "original");

    await expect(
      renderTemplateTree(templateDir, targetDir, { projectName: "my-app", useTailwind: true }),
    ).rejects.toThrow();

    expect(fs.readFileSync(path.join(targetDir, "keep-me.txt"), "utf-8")).toBe("original");
    expect(fs.existsSync(path.join(targetDir, "README.md"))).toBe(false);
  });

  it("throws a clear error when the template root doesn't exist", async () => {
    await expect(
      renderTemplateTree(
        path.join(parentDir, "no-such-template"),
        path.join(parentDir, "target2"),
        {},
      ),
    ).rejects.toThrow(/Template directory not found/);
  });
});
