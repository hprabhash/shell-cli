import type { SUPPORTED_DATABASES, SUPPORTED_ORMS, SUPPORTED_PACKAGE_MANAGERS } from "./constants";

export type PackageManager = (typeof SUPPORTED_PACKAGE_MANAGERS)[number];
/** Plugin-owned, not a closed enum — matches a registered plugin's `PluginMetadata.id`. */
export type FrameworkId = string;
export type DatabaseId = (typeof SUPPORTED_DATABASES)[number];
export type OrmId = (typeof SUPPORTED_ORMS)[number];

/** The resolved output of the `shell create` prompt flow, handed to the plugin/generation pipeline. */
export interface ProjectPlan {
  projectName: string;
  targetDir: string;
  framework: FrameworkId;
  packageManager: PackageManager;
  initGit: boolean;
  installDependencies: boolean;
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
