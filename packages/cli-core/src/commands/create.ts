import path from "node:path";

import {
  SUPPORTED_PACKAGE_MANAGERS,
  UserCancelledError,
  ValidationError,
  type FrameworkId,
  type PackageManager,
  type ProjectPlan,
} from "@shell-cli/shared";
import type { Command } from "commander";

import { colors } from "../core/colors";
import { loadConfig } from "../core/config-store";
import { logger } from "../core/logger";
import { detectAllPackageManagers, pickPreferredPackageManager } from "../core/package-manager";
import { findPluginById, getPluginMetadata, getPluginsByCategory } from "../core/plugin-registry";
import { intro, outro, promptConfirm, promptSelect, promptText } from "../core/prompts";
import {
  assertValidProjectName,
  describeTargetDirectory,
  validateProjectName,
} from "../utils/validate-project-name";

interface CreateCommandOptions {
  yes?: boolean;
  pm?: string;
  framework?: string;
  git: boolean;
  install: boolean;
}

function assertRegisteredFramework(id: string): FrameworkId {
  const plugin = findPluginById(id, getPluginsByCategory("framework"));
  if (!plugin) {
    const available = getPluginsByCategory("framework").map((p) => getPluginMetadata(p).id);
    throw new ValidationError(
      `Framework "${id}" isn't registered.`,
      `Available: ${available.join(", ") || "none"}. See docs/architecture.md for the roadmap.`,
    );
  }
  return id;
}

function assertSupportedPackageManager(id: string): PackageManager {
  if (!(SUPPORTED_PACKAGE_MANAGERS as readonly string[]).includes(id)) {
    throw new ValidationError(
      `Package manager "${id}" isn't supported.`,
      `Supported: ${SUPPORTED_PACKAGE_MANAGERS.join(", ")}.`,
    );
  }
  return id as PackageManager;
}

async function resolveProjectName(name: string | undefined, yes: boolean): Promise<string> {
  if (name !== undefined) {
    assertValidProjectName(name);
    return name;
  }
  if (yes) {
    throw new ValidationError(
      "A project name is required when using --yes.",
      "Usage: shell create <name> --yes",
    );
  }
  return promptText({
    message: "Project name:",
    placeholder: "my-app",
    validate: (value) => {
      const result = validateProjectName(value ?? "");
      return result.valid ? undefined : result.problems[0];
    },
  });
}

async function confirmTargetDirectory(targetDir: string, yes: boolean): Promise<void> {
  const state = describeTargetDirectory(targetDir);
  if (!state.exists || state.isEmpty) {
    return;
  }
  if (yes) {
    throw new ValidationError(
      `Directory "${targetDir}" already exists and is not empty.`,
      "Choose a different name, or remove --yes to be prompted instead.",
    );
  }
  const proceed = await promptConfirm({
    message: `Directory "${targetDir}" already exists and is not empty. Continue anyway?`,
    initialValue: false,
  });
  if (!proceed) {
    throw new UserCancelledError("Aborted — target directory was not empty.");
  }
}

async function resolveFramework(command: Command, yes: boolean): Promise<FrameworkId> {
  const opts = command.opts<CreateCommandOptions>();
  if (opts.framework !== undefined) {
    return assertRegisteredFramework(opts.framework);
  }

  const frameworkPlugins = getPluginsByCategory("framework");
  const choices = frameworkPlugins.map((plugin) => getPluginMetadata(plugin));
  const [firstChoice] = choices;
  if (firstChoice === undefined) {
    throw new ValidationError("No framework plugins are registered.");
  }

  if (yes) {
    return firstChoice.id;
  }

  const selected = await promptSelect({
    message: "Framework:",
    options: choices.map((metadata) => ({
      value: metadata.id,
      label: metadata.name,
      hint: metadata.description,
    })),
  });
  return assertRegisteredFramework(selected);
}

async function resolvePackageManager(command: Command, yes: boolean): Promise<PackageManager> {
  const opts = command.opts<CreateCommandOptions>();
  if (opts.pm !== undefined) {
    return assertSupportedPackageManager(opts.pm);
  }

  const config = loadConfig();
  const detected = await detectAllPackageManagers();
  const available = detected.filter((info) => info.available);
  const preferred = pickPreferredPackageManager(detected, config.packageManager);

  if (yes || available.length === 0) {
    return preferred;
  }

  return promptSelect<PackageManager>({
    message: "Package manager:",
    options: available.map((info) => ({
      value: info.name,
      label: info.name,
      hint: info.version,
    })),
    initialValue: preferred,
  });
}

async function resolveGit(command: Command, yes: boolean): Promise<boolean> {
  const opts = command.opts<CreateCommandOptions>();
  if (command.getOptionValueSource("git") === "cli") {
    return opts.git;
  }
  if (yes) {
    return true;
  }
  return promptConfirm({ message: "Initialize a git repository?", initialValue: true });
}

async function resolveInstall(command: Command, yes: boolean): Promise<boolean> {
  const opts = command.opts<CreateCommandOptions>();
  if (command.getOptionValueSource("install") === "cli") {
    return opts.install;
  }
  if (yes) {
    return true;
  }
  return promptConfirm({ message: "Install dependencies?", initialValue: true });
}

function printPlanSummary(plan: ProjectPlan): void {
  logger.info("");
  logger.info(colors.bold("Resolved project plan:"));
  logger.info(`  Project name:          ${plan.projectName}`);
  logger.info(`  Target directory:      ${plan.targetDir}`);
  logger.info(`  Framework:             ${plan.framework}`);
  logger.info(`  Package manager:       ${plan.packageManager}`);
  logger.info(`  Initialize git:        ${plan.initGit ? "yes" : "no"}`);
  logger.info(`  Install dependencies:  ${plan.installDependencies ? "yes" : "no"}`);
  logger.debug(JSON.stringify(plan, null, 2));
}

export function registerCreateCommand(program: Command): void {
  const createCommand = program
    .command("create [name]")
    .description("Scaffold a new project.")
    .option("-y, --yes", "Skip prompts and use defaults / flags.")
    .option("--pm <packageManager>", "Package manager to use (npm, pnpm, yarn, bun).")
    .option("--framework <id>", "Framework to scaffold.")
    .option("--git", "Initialize a git repository.", true)
    .option("--no-git", "Skip git initialization.")
    .option("--install", "Install dependencies.", true)
    .option("--no-install", "Skip dependency installation.")
    .action(async (name: string | undefined, options: CreateCommandOptions) => {
      const yes = options.yes ?? false;

      intro("shell create");

      const projectName = await resolveProjectName(name, yes);
      const targetDir = path.resolve(process.cwd(), projectName);
      await confirmTargetDirectory(targetDir, yes);

      const framework = await resolveFramework(createCommand, yes);
      const packageManager = await resolvePackageManager(createCommand, yes);
      const initGit = await resolveGit(createCommand, yes);
      const installDependencies = await resolveInstall(createCommand, yes);

      const plan: ProjectPlan = {
        projectName,
        targetDir,
        framework,
        packageManager,
        initGit,
        installDependencies,
      };

      printPlanSummary(plan);
      outro("No files were written — project generation lands in Phase 4 (Next.js plugin).");
    });
}
