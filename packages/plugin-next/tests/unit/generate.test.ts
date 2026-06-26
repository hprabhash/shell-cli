import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import nextPlugin from "../../src/index";

const generate = nextPlugin.generate;
if (!generate) {
  throw new Error("plugin-next must implement generate()");
}

describe("plugin-next generate()", () => {
  let parentDir: string;
  let targetDir: string;

  beforeEach(() => {
    parentDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-next-generate-test-"));
    targetDir = path.join(parentDir, "my-app");
  });

  afterEach(() => {
    fs.rmSync(parentDir, { recursive: true, force: true });
  });

  it("scaffolds a real Next.js project tree", async () => {
    await generate({
      projectDir: targetDir,
      variables: { projectName: "my-app", packageManager: "pnpm" },
    });

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(targetDir, "package.json"), "utf-8"),
    ) as {
      name: string;
      dependencies: Record<string, string>;
    };
    expect(packageJson.name).toBe("my-app");
    expect(packageJson.dependencies.next).toBe("16.2.9");
    expect(packageJson.dependencies.react).toBe("19.2.7");

    expect(fs.readFileSync(path.join(targetDir, "app", "layout.tsx"), "utf-8")).toContain("my-app");
    expect(fs.readFileSync(path.join(targetDir, "app", "page.tsx"), "utf-8")).toContain("my-app");
    expect(fs.existsSync(path.join(targetDir, "app", "page.tsx.hbs"))).toBe(false);
    expect(fs.existsSync(path.join(targetDir, "tsconfig.json"))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, ".gitignore"))).toBe(true);
  });

  it("uses the right dev command per package manager in the README", async () => {
    await generate({
      projectDir: targetDir,
      variables: { projectName: "my-app", packageManager: "pnpm" },
    });
    expect(fs.readFileSync(path.join(targetDir, "README.md"), "utf-8")).toContain("pnpm dev");

    const npmTargetDir = path.join(parentDir, "my-npm-app");
    await generate({
      projectDir: npmTargetDir,
      variables: { projectName: "my-npm-app", packageManager: "npm" },
    });
    expect(fs.readFileSync(path.join(npmTargetDir, "README.md"), "utf-8")).toContain("npm run dev");
  });

  it("throws a PluginError when required variables are missing", async () => {
    await expect(generate({ projectDir: targetDir, variables: {} })).rejects.toThrow(/projectName/);
  });
});
