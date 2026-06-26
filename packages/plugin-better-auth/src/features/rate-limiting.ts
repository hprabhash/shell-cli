import type { BetterAuthContribution, BetterAuthFeature } from "../contribution";

export const rateLimitingFeature: BetterAuthFeature = {
  id: "rate-limiting",
  label: "Rate Limiting",
  getContribution(): BetterAuthContribution {
    return {
      config: {
        rateLimit: {
          enabled: true,
          window: 60,
          max: 100,
        },
      },
    };
  },
};
