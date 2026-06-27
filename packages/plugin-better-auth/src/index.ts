import fs from "node:fs";
import path from "node:path";

import {
  PluginError,
  type CheckResult,
  type Plugin,
  type PluginGenerateContext,
  type PluginMetadata,
  type PluginPostInstallContext,
  type PluginQuestionDefinition,
} from "@hprabhash/shared";
import {
  ProjectWriter,
  mergeEnvFile,
  mergeNextConfigServerExternalPackages,
  mergePackageJsonFragment,
} from "@hprabhash/template-engine";
import { execa } from "execa";

import { mergeContributions } from "./contribution";
import { resolveDatabaseAdapter } from "./database-adapter";
import { ALL_FEATURES, getFeatureById, validateFeatureSelection } from "./features";
import {
  AUTH_ROUTE_SOURCE,
  buildAuthClientFileSource,
  buildAuthFileSource,
  buildBetterAuthEnvEntries,
  generateBetterAuthSecret,
} from "./generate-files";

const metadata: PluginMetadata = {
  id: "better-auth",
  name: "Better Auth",
  category: "auth",
  version: "0.1.0",
  description: "Email/password, OAuth, 2FA, organizations, passkeys, API keys, and more",
};

function buildFeatureQuestion(): PluginQuestionDefinition {
  return {
    type: "multiselect",
    key: "features",
    message: "Better Auth features:",
    options: ALL_FEATURES.map((feature) => ({
      value: feature.id,
      label: feature.label,
      ...(feature.hint !== undefined && { hint: feature.hint }),
    })),
    required: true,
  };
}

function readFeatureIds(variables: Record<string, unknown>): string[] {
  const rawFeatures = variables.features;
  if (!Array.isArray(rawFeatures)) {
    throw new PluginError('Expected a "features" array variable for the Better Auth plugin.');
  }
  return rawFeatures.map(String);
}

function readOrm(variables: Record<string, unknown>): string | null {
  return typeof variables.orm === "string" ? variables.orm : null;
}

function readIfExists(filePath: string): string | null {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : null;
}

const betterAuthPlugin: Plugin = {
  register: () => metadata,

  questions: () => [buildFeatureQuestion()],

  validate: (answers: Record<string, unknown>) => {
    const features = answers.features;
    if (!Array.isArray(features)) {
      return { valid: false, problems: ['Expected a "features" selection.'] };
    }
    return validateFeatureSelection(features.map(String));
  },

  doctor: (): Promise<CheckResult[]> => Promise.resolve([]),

  // Everything here is synchronous — wrapping in `.then()` rather than `async` (with
  // no `await`) still gives callers a real Promise that rejects properly on a
  // synchronous throw, consistent with `render-tree.ts` in Phase 3.
  generate: (context: PluginGenerateContext): Promise<void> =>
    Promise.resolve().then(() => {
      const featureIds = readFeatureIds(context.variables);
      const validation = validateFeatureSelection(featureIds);
      if (!validation.valid) {
        throw new PluginError(
          `Invalid Better Auth feature selection: ${validation.problems.join(" ")}`,
        );
      }

      const selectedSet = new Set(featureIds);
      const contributions = featureIds.map((id) => {
        const feature = getFeatureById(id);
        if (!feature) {
          throw new PluginError(`Unknown Better Auth feature "${id}".`);
        }
        return feature.getContribution(selectedSet);
      });
      const merged = mergeContributions(contributions);
      const databaseAdapter = resolveDatabaseAdapter(readOrm(context.variables));

      const writer = new ProjectWriter(context.projectDir);
      try {
        writer.writeFile("lib/auth.ts", buildAuthFileSource(merged, databaseAdapter));
        writer.writeFile("lib/auth-client.ts", buildAuthClientFileSource(merged));
        writer.writeFile(
          path.join("app", "api", "auth", "[...all]", "route.ts"),
          AUTH_ROUTE_SOURCE,
        );

        const envPath = path.join(context.projectDir, ".env");
        const envExamplePath = path.join(context.projectDir, ".env.example");
        const envEntries = buildBetterAuthEnvEntries(merged, generateBetterAuthSecret());
        const envExampleEntries = buildBetterAuthEnvEntries(merged, undefined);
        writer.patchFile(".env", mergeEnvFile(readIfExists(envPath), envEntries));
        writer.patchFile(
          ".env.example",
          mergeEnvFile(readIfExists(envExamplePath), envExampleEntries),
        );

        const packageJsonPath = path.join(context.projectDir, "package.json");
        const existingPackageJson = fs.readFileSync(packageJsonPath, "utf-8");
        const patchedPackageJson = mergePackageJsonFragment(existingPackageJson, {
          dependencies: {
            "better-auth": "^1.6.22",
            ...databaseAdapter.dependencies,
            ...merged.dependencies,
          },
          devDependencies: {
            auth: "^1.6.22",
            ...databaseAdapter.devDependencies,
            ...merged.devDependencies,
          },
          // Next.js 16's default bundler, Turbopack, can't resolve Better
          // Auth's own nested dependency on `@better-auth/telemetry` through
          // pnpm's peer-hashed package layout (confirmed: identical `next
          // build` only succeeds under `--webpack`) — forcing webpack for
          // both keeps dev/prod parity.
          scripts: {
            dev: "next dev --webpack",
            build: "next build --webpack",
          },
          onlyBuiltDependencies: databaseAdapter.onlyBuiltDependencies,
        });
        writer.patchFile("package.json", patchedPackageJson);

        const nextConfigPath = path.join(context.projectDir, "next.config.ts");
        if (fs.existsSync(nextConfigPath)) {
          writer.patchFile(
            "next.config.ts",
            mergeNextConfigServerExternalPackages(
              fs.readFileSync(nextConfigPath, "utf-8"),
              databaseAdapter.serverExternalPackages,
            ),
          );
        }
      } catch (error) {
        writer.rollback();
        throw error;
      }
      writer.commit();
    }),

  // No install() — installing the dependencies generate() added to package.json is
  // generic across every plugin and handled once by cli-core, not per-plugin.

  postInstall: async (context: PluginPostInstallContext): Promise<void> => {
    const orm = readOrm(context.variables);
    await execa("npx", ["auth", "generate", "--yes"], { cwd: context.projectDir });
    // `auth migrate` applies Better Auth's own kysely-based migration — only
    // meaningful for the no-ORM sqlite path (no live server required). With an
    // ORM selected, the schema lives in *its* migration system instead, and
    // applying it needs a reachable database we can't assume exists; the user
    // runs their ORM's own migrate/push command against a real one.
    if (orm === null) {
      await execa("npx", ["auth", "migrate", "--yes"], { cwd: context.projectDir });
    }
  },
};

export default betterAuthPlugin;
