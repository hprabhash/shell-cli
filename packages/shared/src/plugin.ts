import { z } from "zod";

import type { PackageManager } from "./types";

export type CheckStatus = "pass" | "warn" | "fail";

export interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  message: string;
}

export const pluginCategorySchema = z.enum([
  "framework",
  "database",
  "orm",
  "auth",
  "ui",
  "deployment",
  "other",
]);

export const pluginMetadataSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9-]*$/, "must be lowercase kebab-case"),
  name: z.string().min(1),
  category: pluginCategorySchema,
  version: z.string().min(1),
  description: z.string().optional(),
});

export type PluginCategory = z.infer<typeof pluginCategorySchema>;
export type PluginMetadata = z.infer<typeof pluginMetadataSchema>;

/**
 * Declarative only for now — Phase 5 (Better Auth) builds the generic engine that
 * runs these through `core/prompts.ts`, once a real multi-question plugin exists to
 * design it against. For Phase 2 this just needs to exist and round-trip.
 */
export type PluginQuestionDefinition =
  | { type: "text"; key: string; message: string; placeholder?: string }
  | {
      type: "select";
      key: string;
      message: string;
      options: { value: string; label: string; hint?: string }[];
    }
  | {
      type: "multiselect";
      key: string;
      message: string;
      options: { value: string; label: string; hint?: string }[];
      required?: boolean;
    }
  | { type: "confirm"; key: string; message: string; initialValue?: boolean };

export interface PluginInstallContext {
  projectDir: string;
  packageManager: PackageManager;
}

export interface PluginGenerateContext {
  projectDir: string;
  variables: Record<string, unknown>;
}

export interface PluginPostInstallContext {
  projectDir: string;
}

/**
 * Every plugin (framework, auth, ORM, database, UI, ...) implements this. `install`,
 * `generate`, and `postInstall` are optional because no plugin can do real work
 * there yet — there's no template engine until Phase 3, no package-install pipeline
 * until Phase 4. The other four are required because "no extra questions" / "valid"
 * / "no checks" are genuinely correct answers today, not placeholders.
 */
export interface Plugin {
  register: () => PluginMetadata;
  questions: () => PluginQuestionDefinition[];
  validate: (answers: Record<string, unknown>) => { valid: boolean; problems: string[] };
  doctor: () => Promise<CheckResult[]>;
  install?: (context: PluginInstallContext) => Promise<void>;
  generate?: (context: PluginGenerateContext) => Promise<void>;
  postInstall?: (context: PluginPostInstallContext) => Promise<void>;
}
