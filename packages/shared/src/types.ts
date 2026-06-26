import type { SUPPORTED_DATABASES, SUPPORTED_ORMS, SUPPORTED_PACKAGE_MANAGERS } from "./constants";

export type PackageManager = (typeof SUPPORTED_PACKAGE_MANAGERS)[number];
/** Plugin-owned, not a closed enum — matches a registered plugin's `PluginMetadata.id`. */
export type FrameworkId = string;
export type DatabaseId = (typeof SUPPORTED_DATABASES)[number];
export type OrmId = (typeof SUPPORTED_ORMS)[number];

/**
 * The resolved output of the `shell create` prompt flow. In Phase 1 this is printed
 * as a summary only — nothing is written to disk. Phase 4 will hand this to the
 * plugin/template pipeline to actually generate a project.
 */
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

/** Minimal shape needed to invoke an external command; lets tests inject a fake without spawning real processes. */
export type CommandRunner = (command: string, args: readonly string[]) => Promise<CommandRunResult>;
