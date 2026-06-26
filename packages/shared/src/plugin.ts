import { z } from "zod";

import { PluginError } from "./errors";
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
 * Every plugin (framework, auth, ORM, database, UI, ...) implements this.
 * `install`/`generate`/`postInstall` stay optional even though `plugin-next`
 * implements `generate` for real as of Phase 4 — a plugin that genuinely has
 * nothing to install or run post-generation (e.g. a database provider that's
 * just a connection string) shouldn't have to fake an empty implementation.
 * The other four are required because "no extra questions" / "valid" / "no
 * checks" are genuinely correct answers even for a plugin with nothing else to do.
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

/**
 * Reads a required string out of a plugin's generic `variables` bag, throwing a
 * clear `PluginError` if it's missing or the wrong type — the boundary check
 * between the generic `Record<string, unknown>` context and a specific plugin's
 * actual needs.
 */
export function requireStringVariable(variables: Record<string, unknown>, key: string): string {
  const value = variables[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new PluginError(`Expected a non-empty string variable "${key}".`);
  }
  return value;
}
