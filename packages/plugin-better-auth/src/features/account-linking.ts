import type { BetterAuthContribution, BetterAuthFeature } from "../contribution";

export const accountLinkingFeature: BetterAuthFeature = {
  id: "account-linking",
  label: "Account Linking",
  getContribution(): BetterAuthContribution {
    return {
      config: {
        account: {
          accountLinking: {
            enabled: true,
          },
        },
      },
    };
  },
};
