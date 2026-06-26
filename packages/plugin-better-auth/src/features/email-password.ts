import type { BetterAuthContribution, BetterAuthFeature } from "../contribution";

export const emailPasswordFeature: BetterAuthFeature = {
  id: "email-password",
  label: "Email Password",
  getContribution(): BetterAuthContribution {
    return {
      config: {
        emailAndPassword: {
          enabled: true,
        },
      },
    };
  },
};
