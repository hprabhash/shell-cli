import type { SUPPORTED_PACKAGE_MANAGERS } from "./constants";

export type PackageManager = (typeof SUPPORTED_PACKAGE_MANAGERS)[number];
/** Plugin-owned, not a closed enum — matches a registered plugin's `PluginMetadata.id`. */
export type FrameworkId = string;
export type DatabaseId = string;
export type OrmId = string;

/** The resolved output of the `shell create` prompt flow, handed to the plugin/generation pipeline. */
export interface ProjectPlan {
  projectName: string;
  targetDir: string;
  framework: FrameworkId;
  packageManager: PackageManager;
  initGit: boolean;
  installDependencies: boolean;
  /** `null` when no ORM was selected — ORM is optional, unlike `framework`. */
  orm: OrmId | null;
  /** `null` whenever `orm` is `null` — there's no database without an ORM to use it yet. */
  database: DatabaseId | null;
  /** `null` when no auth plugin was selected — auth is optional, unlike `framework`. */
  auth: string | null;
  /** Selected feature ids for the chosen auth plugin; empty when `auth` is `null`. */
  authFeatures: string[];
}

export interface CommandRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface CommandRunnerOptions {
  cwd?: string;
}

/** Minimal shape needed to invoke an external command; lets tests inject a fake without spawning real processes. */
export type CommandRunner = (
  command: string,
  args: readonly string[],
  options?: CommandRunnerOptions,
) => Promise<CommandRunResult>;
