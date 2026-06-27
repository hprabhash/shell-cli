import fs from "node:fs";
import path from "node:path";

import type {
  CheckResult,
  Plugin,
  PluginGenerateContext,
  PluginMetadata,
  PluginPostInstallContext,
} from "@hprabhash/shared";
import {
  ProjectWriter,
  appendGitignoreEntries,
  mergeNextConfigServerExternalPackages,
  mergePackageJsonFragment,
} from "@hprabhash/template-engine";
import { execa } from "execa";

const metadata: PluginMetadata = {
  id: "prisma",
  name: "Prisma",
  category: "orm",
  version: "0.1.0",
  description: "Type-safe ORM, driver-adapter (Prisma 7) architecture",
};

const SCHEMA_PRISMA = `generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}
`;

const LIB_PRISMA_TS = `import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL ?? "";
const adapter = new PrismaPg({ connectionString });

export const prisma = new PrismaClient({ adapter });
`;

// Prisma 7 moved the datasource connection string for Migrate/introspection
// out of schema.prisma's datasource block entirely (it now rejects a `url`
// field there) and into this dedicated config file. The driver adapter above
// (used by the app's own PrismaClient at runtime) is unrelated to this file —
// this one only matters to the `prisma` CLI's own migrate/generate commands.
// Unlike schema.prisma's old `env("X")` (which the CLI populated from `.env`
// on its own), `prisma.config.ts` is loaded as a plain TS module — `env()`
// here just reads `process.env`, so `.env` needs loading explicitly.
const PRISMA_CONFIG_TS = `import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
`;

const prismaPlugin: Plugin = {
  register: () => metadata,

  questions: () => [],

  validate: () => ({ valid: true, problems: [] }),

  doctor: (): Promise<CheckResult[]> => Promise.resolve([]),

  // Both package.json and .gitignore are assumed to already exist — the
  // framework plugin (which always runs first) creates both.
  generate: (context: PluginGenerateContext): Promise<void> =>
    Promise.resolve().then(() => {
      const writer = new ProjectWriter(context.projectDir);
      try {
        writer.writeFile(path.join("prisma", "schema.prisma"), SCHEMA_PRISMA);
        writer.writeFile(path.join("lib", "prisma.ts"), LIB_PRISMA_TS);
        writer.writeFile("prisma.config.ts", PRISMA_CONFIG_TS);

        const packageJsonPath = path.join(context.projectDir, "package.json");
        const patchedPackageJson = mergePackageJsonFragment(
          fs.readFileSync(packageJsonPath, "utf-8"),
          {
            dependencies: {
              "@prisma/client": "^7.8.0",
              "@prisma/adapter-pg": "^7.8.0",
              pg: "^8.22.0",
            },
            devDependencies: {
              prisma: "^7.8.0",
              "@types/pg": "^8.20.0",
              dotenv: "^17.4.2",
            },
            // Next.js 16's default bundler, Turbopack, can't statically
            // resolve the generated Prisma client's dynamic `import()` of
            // its WASM query-compiler files even with `serverExternalPackages`
            // set (confirmed: identical `next build` only succeeds under
            // `--webpack`) — forcing webpack for both keeps dev/prod parity.
            scripts: {
              dev: "next dev --webpack",
              build: "next build --webpack",
            },
          },
        );
        writer.patchFile("package.json", patchedPackageJson);

        const gitignorePath = path.join(context.projectDir, ".gitignore");
        writer.patchFile(
          ".gitignore",
          appendGitignoreEntries(fs.readFileSync(gitignorePath, "utf-8"), ["/generated"]),
        );

        const nextConfigPath = path.join(context.projectDir, "next.config.ts");
        if (fs.existsSync(nextConfigPath)) {
          writer.patchFile(
            "next.config.ts",
            mergeNextConfigServerExternalPackages(fs.readFileSync(nextConfigPath, "utf-8"), [
              "@prisma/client",
              "pg",
            ]),
          );
        }
      } catch (error) {
        writer.rollback();
        throw error;
      }
      writer.commit();
    }),

  // Schema-file-only codegen — safe to automate without a live database
  // connection. Applying the schema (`prisma migrate dev`) needs a reachable
  // Postgres, which we can't assume exists; left to the user.
  postInstall: async (context: PluginPostInstallContext): Promise<void> => {
    await execa("npx", ["prisma", "generate"], { cwd: context.projectDir });
  },
};

export default prismaPlugin;
