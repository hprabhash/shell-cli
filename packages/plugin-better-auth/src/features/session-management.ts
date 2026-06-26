import { raw } from "../codegen/serialize-object";
import type { BetterAuthContribution, BetterAuthFeature } from "../contribution";

export const sessionManagementFeature: BetterAuthFeature = {
  id: "session-management",
  label: "Session Management",
  hint: "Explicit session expiry/refresh tuning",
  getContribution(): BetterAuthContribution {
    return {
      config: {
        session: {
          expiresIn: raw("60 * 60 * 24 * 7"),
          updateAge: raw("60 * 60 * 24"),
        },
      },
    };
  },
};
