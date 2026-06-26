import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import betterAuthPlugin from "../../src/index";

const generate = betterAuthPlugin.generate;
if (!generate) {
  throw new Error("plugin-better-auth must implement generate()");
}

function assertNoDiagnostics(label: string, source: string): void {
  const result = ts.transpileModule(source, {
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const diagnostics = result.diagnostics ?? [];
  if (diagnostics.length > 0) {
    const messages = diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
    throw new Error(`${label} has TypeScript diagnostics:\n${messages.join("\n")}`);
  }
}

describe("plugin-better-auth generate() (integration)", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-better-auth-generate-test-"));
    // Simulate the Next.js plugin having already run.
    fs.writeFileSync(
      path.join(projectDir, "package.json"),
      JSON.stringify(
        { name: "my-app", version: "0.1.0", private: true, dependencies: { next: "16.2.9" } },
        null,
        2,
      ),
    );
  });

  afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it("composes a realistic feature combination into a syntactically valid auth.ts/auth-client.ts", async () => {
    await generate({
      projectDir,
      variables: {
        features: ["email-password", "google", "two-factor", "organization", "teams"],
      },
    });

    const authSource = fs.readFileSync(path.join(projectDir, "lib", "auth.ts"), "utf-8");
    const clientSource = fs.readFileSync(path.join(projectDir, "lib", "auth-client.ts"), "utf-8");

    expect(authSource).toContain("emailAndPassword");
    expect(authSource).toContain("socialProviders");
    expect(authSource).toContain("GOOGLE_CLIENT_ID");
    expect(authSource).toContain("twoFactor()");
    expect(authSource).toContain("teams: { enabled: true }");
    expect(clientSource).toContain("twoFactorClient()");
    expect(clientSource).toContain("organizationClient()");

    assertNoDiagnostics("lib/auth.ts", authSource);
    assertNoDiagnostics("lib/auth-client.ts", clientSource);
  });

  it("merges its dependencies into the pre-existing package.json without dropping Next.js's", async () => {
    await generate({ projectDir, variables: { features: ["passkeys", "api-keys"] } });

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(projectDir, "package.json"), "utf-8"),
    ) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(packageJson.dependencies.next).toBe("16.2.9");
    expect(packageJson.dependencies["better-auth"]).toBeDefined();
    expect(packageJson.dependencies["@better-auth/passkey"]).toBeDefined();
    expect(packageJson.dependencies["@better-auth/api-key"]).toBeDefined();
    expect(packageJson.devDependencies.auth).toBeDefined();
  });

  it("writes .env with a real secret and .env.example with a blank one", async () => {
    await generate({ projectDir, variables: { features: ["google"] } });

    const env = fs.readFileSync(path.join(projectDir, ".env"), "utf-8");
    const envExample = fs.readFileSync(path.join(projectDir, ".env.example"), "utf-8");

    expect(env).toMatch(/BETTER_AUTH_SECRET=\S+/);
    expect(envExample).toMatch(/BETTER_AUTH_SECRET=\s*$/m);
    expect(env).toContain("GOOGLE_CLIENT_ID=");
    expect(envExample).toContain("GOOGLE_CLIENT_ID=");
  });

  it("writes the auth API route handler", async () => {
    await generate({ projectDir, variables: { features: [] } });
    const route = fs.readFileSync(
      path.join(projectDir, "app", "api", "auth", "[...all]", "route.ts"),
      "utf-8",
    );
    expect(route).toContain("toNextJsHandler");
  });

  it("rejects an invalid feature combination", async () => {
    await expect(generate({ projectDir, variables: { features: ["teams"] } })).rejects.toThrow(
      /requires/,
    );
  });

  it("rolls back files already written if a later step fails (missing package.json)", async () => {
    // A fresh dir with no package.json simulates the Next.js plugin not having run —
    // generate() writes lib/auth.ts etc. successfully, then fails reading package.json
    // partway through, after several files already exist.
    const dirWithoutPackageJson = fs.mkdtempSync(
      path.join(os.tmpdir(), "plugin-better-auth-no-pkg-"),
    );
    try {
      await expect(
        generate({ projectDir: dirWithoutPackageJson, variables: { features: ["google"] } }),
      ).rejects.toThrow();

      expect(fs.existsSync(path.join(dirWithoutPackageJson, "lib", "auth.ts"))).toBe(false);
      expect(fs.existsSync(path.join(dirWithoutPackageJson, ".env"))).toBe(false);
      expect(fs.existsSync(path.join(dirWithoutPackageJson, "app"))).toBe(false);
    } finally {
      fs.rmSync(dirWithoutPackageJson, { recursive: true, force: true });
    }
  });
});
