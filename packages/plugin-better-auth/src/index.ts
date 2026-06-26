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
} from "@shell-cli/shared";
import { ProjectWriter, mergePackageJsonFragment } from "@shell-cli/template-engine";
import { execa } from "execa";

import { mergeContributions } from "./contribution";
import { ALL_FEATURES, getFeatureById, validateFeatureSelection } from "./features";
import {
  AUTH_ROUTE_SOURCE,
  buildAuthClientFileSource,
  buildAuthFileSource,
  buildEnvFileContent,
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

      const writer = new ProjectWriter(context.projectDir);
      try {
        writer.writeFile("lib/auth.ts", buildAuthFileSource(merged));
        writer.writeFile("lib/auth-client.ts", buildAuthClientFileSource(merged));
        writer.writeFile(
          path.join("app", "api", "auth", "[...all]", "route.ts"),
          AUTH_ROUTE_SOURCE,
        );

        writer.writeFile(".env", buildEnvFileContent(merged, generateBetterAuthSecret()));
        writer.writeFile(".env.example", buildEnvFileContent(merged, undefined));

        const packageJsonPath = path.join(context.projectDir, "package.json");
        const existingPackageJson = fs.readFileSync(packageJsonPath, "utf-8");
        const patchedPackageJson = mergePackageJsonFragment(existingPackageJson, {
          dependencies: {
            "better-auth": "^1.6.22",
            "better-sqlite3": "^12.11.1",
            ...merged.dependencies,
          },
          devDependencies: {
            auth: "^1.6.22",
            "@types/better-sqlite3": "^7.6.13",
            ...merged.devDependencies,
          },
        });
        writer.patchFile("package.json", patchedPackageJson);
      } catch (error) {
        writer.rollback();
        throw error;
      }
      writer.commit();
    }),

  // No install() — installing the dependencies generate() added to package.json is
  // generic across every plugin and handled once by cli-core, not per-plugin.

  postInstall: async (context: PluginPostInstallContext): Promise<void> => {
    await execa("npx", ["auth", "generate", "--yes"], { cwd: context.projectDir });
    await execa("npx", ["auth", "migrate", "--yes"], { cwd: context.projectDir });
  },
};

export default betterAuthPlugin;
