import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  requireStringVariable,
  type CheckResult,
  type Plugin,
  type PluginGenerateContext,
  type PluginMetadata,
} from "@hprabhash/shared";
import { renderTemplateTree } from "@hprabhash/template-engine";

const metadata: PluginMetadata = {
  id: "next",
  name: "Next.js 16 (App Router)",
  category: "framework",
  version: "0.1.0",
  description: "TypeScript + App Router + Tailwind CSS",
};

/** Resolves relative to the built `dist/index.js` (its parent dir's package root) — fixed at runtime. */
function packageRoot(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function buildRunCommand(packageManager: string): string {
  return packageManager === "npm" ? "npm run dev" : `${packageManager} dev`;
}

const nextPlugin: Plugin = {
  register: () => metadata,

  // No extra questions beyond choosing this framework — genuinely nothing more to ask yet.
  questions: () => [],

  validate: () => ({ valid: true, problems: [] }),

  doctor: (): Promise<CheckResult[]> => Promise.resolve([]),

  generate: async (context: PluginGenerateContext): Promise<void> => {
    const projectName = requireStringVariable(context.variables, "projectName");
    const packageManager = requireStringVariable(context.variables, "packageManager");
    const templateDir = path.join(packageRoot(), "templates", "next-app");
    await renderTemplateTree(templateDir, context.projectDir, {
      projectName,
      packageManager,
      runCommand: buildRunCommand(packageManager),
    });
  },

  // install/postInstall intentionally omitted — running the package manager's
  // install command is generic across every framework plugin and handled once
  // by cli-core, not per-plugin. There's nothing Next.js-specific to do after
  // install yet.
};

export default nextPlugin;
