import { logger } from "../core/logger";

/**
 * Used by commands that are forward-declared in Phase 1 but implemented in a later
 * phase (e.g. `shell plugins`, `shell template list`). Exits 0 — this is an honest
 * "not built yet" notice, not a failure.
 */
export function notImplementedYet(
  featureName: string,
  phase: number,
  phaseDescription: string,
): void {
  logger.warn(
    `${featureName} isn't implemented yet — it's planned for Phase ${phase} (${phaseDescription}).`,
  );
  logger.info("See docs/architecture.md for the full roadmap.");
}
