import type { BetterAuthContribution, BetterAuthFeature } from "../contribution";

/**
 * Teams is a sub-option of Better Auth's `organization()` plugin, not an
 * independent plugin — but the spec lists it as its own checkbox, so it stays
 * a separate selectable feature. `organization.ts` reads whether `teams` is
 * also selected and adjusts its own `organization({ teams: ... })` call; this
 * feature contributes nothing on its own beyond existing as a checkbox with a
 * `requires` constraint that `validate()` enforces.
 */
export const teamsFeature: BetterAuthFeature = {
  id: "teams",
  label: "Teams",
  hint: "Requires Organization",
  requires: ["organization"],
  getContribution(): BetterAuthContribution {
    return {};
  },
};
