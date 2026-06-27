import path from "node:path";

import {
  SUPPORTED_PACKAGE_MANAGERS,
  UserCancelledError,
  ValidationError,
  type FrameworkId,
  type PackageManager,
  type Plugin,
  type ProjectPlan,
} from "@hprabhash/shared";
import type { Command } from "commander";

import { colors } from "../core/colors";
import { loadConfig } from "../core/config-store";
import { initGitRepo } from "../core/git";
import { runInstall } from "../core/install-dependencies";
import { logger } from "../core/logger";
import { detectAllPackageManagers, pickPreferredPackageManager } from "../core/package-manager";
import { findPluginById, getPluginMetadata, getPluginsByCategory } from "../core/plugin-registry";
import { intro, outro, promptConfirm, promptSelect, promptText } from "../core/prompts";
import { runPluginQuestions } from "../core/run-plugin-questions";
import {
  assertValidProjectName,
  describeTargetDirectory,
  validateProjectName,
} from "../utils/validate-project-name";

const NONE_AUTH_VALUE = "none";
const NONE_ORM_VALUE = "none";
const NONE_DATABASE_VALUE = "none";

interface CreateCommandOptions {
  yes?: boolean;
  pm?: string;
  framework?: string;
  orm?: string;
  database?: string;
  auth?: string;
  authFeatures?: string;
  git: boolean;
  install: boolean;
}

interface SelectedPlugin {
  plugin: Plugin;
  variables: Record<string, unknown>;
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

function assertRegisteredOrm(id: string): string {
  const plugin = findPluginById(id, getPluginsByCategory("orm"));
  if (!plugin) {
    const available = getPluginsByCategory("orm").map((p) => getPluginMetadata(p).id);
    throw new ValidationError(
      `ORM "${id}" isn't registered.`,
      `Available: ${available.join(", ") || "none"}, or "${NONE_ORM_VALUE}".`,
    );
  }
  return id;
}

function assertRegisteredDatabase(id: string): string {
  const plugin = findPluginById(id, getPluginsByCategory("database"));
  if (!plugin) {
    const available = getPluginsByCategory("database").map((p) => getPluginMetadata(p).id);
    throw new ValidationError(
      `Database "${id}" isn't registered.`,
      `Available: ${available.join(", ") || "none"}, or "${NONE_DATABASE_VALUE}".`,
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

/** Returns the selected ORM plugin id, or `null` if the user opted out — an ORM is optional, unlike framework. */
async function resolveOrm(command: Command, yes: boolean): Promise<string | null> {
  const opts = command.opts<CreateCommandOptions>();
  const ormPlugins = getPluginsByCategory("orm");

  if (opts.orm !== undefined) {
    if (opts.orm === NONE_ORM_VALUE) {
      return null;
    }
    return assertRegisteredOrm(opts.orm);
  }

  if (yes || ormPlugins.length === 0) {
    return null;
  }

  const selected = await promptSelect({
    message: "ORM:",
    options: [
      { value: NONE_ORM_VALUE, label: "None" },
      ...ormPlugins.map((plugin) => {
        const metadata = getPluginMetadata(plugin);
        return { value: metadata.id, label: metadata.name, hint: metadata.description };
      }),
    ],
    initialValue: NONE_ORM_VALUE,
  });
  return selected === NONE_ORM_VALUE ? null : selected;
}

/**
 * Returns the selected database plugin id, or `null`. Only asked when an ORM was
 * selected — there's no database to provision without an ORM to use it yet.
 */
async function resolveDatabase(
  command: Command,
  yes: boolean,
  ormSelected: boolean,
): Promise<string | null> {
  const opts = command.opts<CreateCommandOptions>();

  if (!ormSelected) {
    if (opts.database !== undefined && opts.database !== NONE_DATABASE_VALUE) {
      throw new ValidationError(
        "--database requires an ORM.",
        "Pass --orm <id> as well, or omit --database.",
      );
    }
    return null;
  }

  if (opts.database !== undefined) {
    if (opts.database === NONE_DATABASE_VALUE) {
      return null;
    }
    return assertRegisteredDatabase(opts.database);
  }

  const databasePlugins = getPluginsByCategory("database");
  const choices = databasePlugins.map((plugin) => getPluginMetadata(plugin));
  const [firstChoice] = choices;
  if (firstChoice === undefined) {
    return null;
  }

  if (yes) {
    return firstChoice.id;
  }

  const selected = await promptSelect({
    message: "Database:",
    options: choices.map((metadata) => ({
      value: metadata.id,
      label: metadata.name,
      hint: metadata.description,
    })),
  });
  return assertRegisteredDatabase(selected);
}

/** Returns the selected auth plugin id, or `null` if the user opted out — auth is optional, unlike framework. */
async function resolveAuth(command: Command, yes: boolean): Promise<string | null> {
  const opts = command.opts<CreateCommandOptions>();
  const authPlugins = getPluginsByCategory("auth");

  if (opts.auth !== undefined) {
    if (opts.auth === NONE_AUTH_VALUE) {
      return null;
    }
    if (!findPluginById(opts.auth, authPlugins)) {
      const available = authPlugins.map((p) => getPluginMetadata(p).id);
      throw new ValidationError(
        `Authentication plugin "${opts.auth}" isn't registered.`,
        `Available: ${available.join(", ") || "none"}, or "${NONE_AUTH_VALUE}".`,
      );
    }
    return opts.auth;
  }

  if (yes || authPlugins.length === 0) {
    return null;
  }

  const selected = await promptSelect({
    message: "Authentication:",
    options: [
      { value: NONE_AUTH_VALUE, label: "None" },
      ...authPlugins.map((plugin) => {
        const metadata = getPluginMetadata(plugin);
        return { value: metadata.id, label: metadata.name, hint: metadata.description };
      }),
    ],
    initialValue: NONE_AUTH_VALUE,
  });
  return selected === NONE_AUTH_VALUE ? null : selected;
}

/** Runs the auth plugin's own `questions()`/`validate()` — its multiselect feature picker. */
async function resolveAuthFeatures(
  plugin: Plugin,
  command: Command,
  yes: boolean,
): Promise<string[]> {
  const opts = command.opts<CreateCommandOptions>();
  if (opts.authFeatures !== undefined) {
    return opts.authFeatures
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
  }

  if (yes) {
    return ["email-password"];
  }

  const answers = await runPluginQuestions(plugin.questions());
  const validation = plugin.validate(answers);
  if (!validation.valid) {
    throw new ValidationError(
      `Invalid selection for the "${getPluginMetadata(plugin).name}" plugin.`,
      validation.problems.join(" "),
    );
  }
  const features = answers.features;
  return Array.isArray(features) ? features.map(String) : [];
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
  logger.info(`  ORM:                   ${plan.orm ?? "none"}`);
  logger.info(`  Database:              ${plan.database ?? "none"}`);
  logger.info(`  Authentication:        ${plan.auth ?? "none"}`);
  if (plan.authFeatures.length > 0) {
    logger.info(`    Features:            ${plan.authFeatures.join(", ")}`);
  }
  logger.info(`  Package manager:       ${plan.packageManager}`);
  logger.info(`  Initialize git:        ${plan.initGit ? "yes" : "no"}`);
  logger.info(`  Install dependencies:  ${plan.installDependencies ? "yes" : "no"}`);
  logger.debug(JSON.stringify(plan, null, 2));
}

async function generateAll(
  selectedPlugins: readonly SelectedPlugin[],
  targetDir: string,
): Promise<void> {
  for (const { plugin, variables } of selectedPlugins) {
    const metadata = getPluginMetadata(plugin);
    const generate = plugin.generate;
    if (!generate) {
      logger.warn(`The "${metadata.id}" plugin doesn't implement generation yet — skipped.`);
      continue;
    }
    await logger.spinner(`Scaffolding (${metadata.name})...`, () =>
      generate({ projectDir: targetDir, variables }),
    );
  }
}

async function runGitInitStep(targetDir: string): Promise<void> {
  const result = await logger.spinner("Initializing git repository...", () =>
    initGitRepo(targetDir),
  );
  if (!result.initialized) {
    logger.warn("Could not initialize a git repository — is git installed?");
  } else if (!result.committed) {
    logger.warn(
      "Initialized git but couldn't create the initial commit (often a missing git user.name/user.email). Commit manually when ready.",
    );
  }
}

async function runInstallStep(targetDir: string, packageManager: PackageManager): Promise<void> {
  const result = await logger.spinner(`Installing dependencies with ${packageManager}...`, () =>
    runInstall(targetDir, packageManager),
  );
  if (!result.success) {
    logger.warn(
      `Dependency installation failed. Run "${packageManager} install" manually to retry.`,
    );
    if (result.output.length > 0) {
      logger.debug(result.output);
    }
  }
}

/** Runs after dependency install (e.g. Better Auth's DB migration needs the `auth` CLI to be resolvable). Failures warn, not crash. */
async function runPostInstallAll(
  selectedPlugins: readonly SelectedPlugin[],
  targetDir: string,
): Promise<void> {
  for (const { plugin, variables } of selectedPlugins) {
    const postInstall = plugin.postInstall;
    if (!postInstall) {
      continue;
    }
    const metadata = getPluginMetadata(plugin);
    try {
      await logger.spinner(`Running post-install steps (${metadata.name})...`, () =>
        postInstall({ projectDir: targetDir, variables }),
      );
    } catch (error) {
      logger.warn(
        `Post-install step for "${metadata.name}" failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

function printSuccessMessage(plan: ProjectPlan): void {
  const runCommand = plan.packageManager === "npm" ? "npm run dev" : `${plan.packageManager} dev`;
  logger.info("");
  logger.success(`Created ${plan.projectName} at ${plan.targetDir}`);
  logger.info("");
  logger.info("Next steps:");
  logger.info(`  cd ${plan.projectName}`);
  if (!plan.installDependencies) {
    logger.info(`  ${plan.packageManager} install`);
  }
  if (plan.database === "postgresql") {
    logger.info("  docker compose up -d");
  }
  if (plan.orm === "prisma") {
    logger.info("  npx prisma migrate dev");
  } else if (plan.orm === "drizzle") {
    logger.info("  npx drizzle-kit push");
  }
  logger.info(`  ${runCommand}`);
}

export function registerCreateCommand(program: Command): void {
  const createCommand = program
    .command("create [name]")
    .description("Scaffold a new project.")
    .option("-y, --yes", "Skip prompts and use defaults / flags.")
    .option("--pm <packageManager>", "Package manager to use (npm, pnpm, yarn, bun).")
    .option("--framework <id>", "Framework to scaffold.")
    .option("--orm <id>", `ORM to use (or "${NONE_ORM_VALUE}").`)
    .option("--database <id>", `Database to use (or "${NONE_DATABASE_VALUE}"). Requires --orm.`)
    .option("--auth <id>", `Authentication plugin to use (or "${NONE_AUTH_VALUE}").`)
    .option(
      "--auth-features <ids>",
      "Comma-separated auth feature ids (skips the interactive picker).",
    )
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
      const ormPluginId = await resolveOrm(createCommand, yes);
      const databasePluginId = await resolveDatabase(createCommand, yes, ormPluginId !== null);
      const authPluginId = await resolveAuth(createCommand, yes);
      const packageManager = await resolvePackageManager(createCommand, yes);
      const initGit = await resolveGit(createCommand, yes);
      const installDependencies = await resolveInstall(createCommand, yes);

      // Execution order is framework -> database -> orm -> auth, independent of the
      // prompt order above: the ORM's postInstall codegen (e.g. `prisma generate`,
      // which produces the client `lib/auth.ts` imports) must run before Better
      // Auth's `auth generate --yes`, which needs that generated client importable.
      const selectedPlugins: SelectedPlugin[] = [];
      const frameworkPlugin = findPluginById(framework);
      if (frameworkPlugin) {
        selectedPlugins.push({
          plugin: frameworkPlugin,
          variables: { projectName, packageManager },
        });
      }

      if (databasePluginId !== null) {
        const databasePlugin = findPluginById(databasePluginId, getPluginsByCategory("database"));
        if (!databasePlugin) {
          throw new ValidationError(`Database plugin "${databasePluginId}" isn't registered.`);
        }
        selectedPlugins.push({
          plugin: databasePlugin,
          variables: { projectName, packageManager },
        });
      }

      if (ormPluginId !== null) {
        const ormPlugin = findPluginById(ormPluginId, getPluginsByCategory("orm"));
        if (!ormPlugin) {
          throw new ValidationError(`ORM plugin "${ormPluginId}" isn't registered.`);
        }
        selectedPlugins.push({ plugin: ormPlugin, variables: { projectName, packageManager } });
      }

      let authFeatures: string[] = [];
      if (authPluginId !== null) {
        const authPlugin = findPluginById(authPluginId, getPluginsByCategory("auth"));
        if (!authPlugin) {
          throw new ValidationError(`Authentication plugin "${authPluginId}" isn't registered.`);
        }
        authFeatures = await resolveAuthFeatures(authPlugin, createCommand, yes);
        selectedPlugins.push({
          plugin: authPlugin,
          variables: { features: authFeatures, orm: ormPluginId },
        });
      }

      const plan: ProjectPlan = {
        projectName,
        targetDir,
        framework,
        packageManager,
        initGit,
        installDependencies,
        orm: ormPluginId,
        database: databasePluginId,
        auth: authPluginId,
        authFeatures,
      };

      printPlanSummary(plan);

      await generateAll(selectedPlugins, targetDir);
      if (plan.initGit) {
        await runGitInitStep(plan.targetDir);
      }
      if (plan.installDependencies) {
        await runInstallStep(plan.targetDir, plan.packageManager);
        await runPostInstallAll(selectedPlugins, targetDir);
      } else if (selectedPlugins.some(({ plugin }) => plugin.postInstall)) {
        logger.info(
          "Skipped post-install steps (e.g. database migrations) since dependencies weren't installed.",
        );
      }

      printSuccessMessage(plan);
      outro("Done.");
    });
}
