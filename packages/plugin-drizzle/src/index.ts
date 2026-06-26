import fs from "node:fs";
import path from "node:path";

import type {
  CheckResult,
  Plugin,
  PluginGenerateContext,
  PluginMetadata,
  PluginPostInstallContext,
} from "@shell-cli/shared";
import { ProjectWriter, mergePackageJsonFragment } from "@shell-cli/template-engine";
import { execa } from "execa";

const metadata: PluginMetadata = {
  id: "drizzle",
  name: "Drizzle",
  category: "orm",
  version: "0.1.0",
  description: "Lightweight, SQL-first TypeScript ORM",
};

const DRIZZLE_CONFIG_TS = `import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
`;

// \`export {}\` makes this a real ES module — \`lib/db/index.ts\`'s
// \`import * as schema from "./schema"\` would otherwise fail TypeScript's
// "File is not a module" check for a file containing only comments.
const SCHEMA_TS = `// Add your Drizzle table definitions here.
// If you're using Better Auth, \`npx auth generate\` adds its tables to this file automatically.

export {};
`;

const DB_INDEX_TS = `import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

export const db = drizzle(process.env.DATABASE_URL ?? "", { schema });
`;

const drizzlePlugin: Plugin = {
  register: () => metadata,

  questions: () => [],

  validate: () => ({ valid: true, problems: [] }),

  doctor: (): Promise<CheckResult[]> => Promise.resolve([]),

  // package.json is assumed to already exist — the framework plugin (which
  // always runs first) creates it. Drizzle's migration output (./drizzle) is
  // meant to be committed, so unlike Prisma's generated client, nothing needs
  // to be added to .gitignore.
  generate: (context: PluginGenerateContext): Promise<void> =>
    Promise.resolve().then(() => {
      const writer = new ProjectWriter(context.projectDir);
      try {
        writer.writeFile("drizzle.config.ts", DRIZZLE_CONFIG_TS);
        writer.writeFile(path.join("lib", "db", "schema.ts"), SCHEMA_TS);
        writer.writeFile(path.join("lib", "db", "index.ts"), DB_INDEX_TS);

        const packageJsonPath = path.join(context.projectDir, "package.json");
        const patchedPackageJson = mergePackageJsonFragment(
          fs.readFileSync(packageJsonPath, "utf-8"),
          {
            dependencies: {
              "drizzle-orm": "^0.45.2",
              pg: "^8.22.0",
            },
            devDependencies: {
              "drizzle-kit": "^0.31.10",
              "@types/pg": "^8.20.0",
            },
          },
        );
        writer.patchFile("package.json", patchedPackageJson);
      } catch (error) {
        writer.rollback();
        throw error;
      }
      writer.commit();
    }),

  // Schema-file-only migration codegen — safe to automate without a live
  // database connection. Applying it (`drizzle-kit migrate`/`push`) needs a
  // reachable Postgres, which we can't assume exists; left to the user.
  postInstall: async (context: PluginPostInstallContext): Promise<void> => {
    await execa("npx", ["drizzle-kit", "generate"], { cwd: context.projectDir });
  },
};

export default drizzlePlugin;
