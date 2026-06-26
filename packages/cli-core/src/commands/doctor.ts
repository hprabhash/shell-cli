import type { Command } from "commander";

import { colors } from "../core/colors";
import { logger } from "../core/logger";
import { runAllChecks, type CheckResult } from "../core/system-checks";

function statusIcon(status: CheckResult["status"]): string {
  if (status === "pass") return colors.green("✔");
  if (status === "warn") return colors.yellow("⚠");
  return colors.red("✖");
}

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description(
      "Check your environment for issues that would prevent `shell create` from working.",
    )
    .action(async () => {
      logger.info(colors.bold("Running environment checks..."));
      const results = await runAllChecks();

      for (const result of results) {
        logger.info(`${statusIcon(result.status)} ${result.label}: ${result.message}`);
      }

      const failed = results.filter((r) => r.status === "fail").length;
      const warned = results.filter((r) => r.status === "warn").length;
      const passed = results.length - failed - warned;

      logger.info("");
      logger.info(
        `${passed} passed, ${warned} warning${warned === 1 ? "" : "s"}, ${failed} failed.`,
      );

      if (failed > 0) {
        process.exitCode = 1;
      }
    });
}
