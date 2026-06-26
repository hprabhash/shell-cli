import type { BetterAuthContribution, BetterAuthFeature } from "../contribution";

export const twoFactorFeature: BetterAuthFeature = {
  id: "two-factor",
  label: "Two Factor Authentication",
  getContribution(): BetterAuthContribution {
    return {
      serverImports: ['import { twoFactor } from "better-auth/plugins";'],
      pluginCalls: ["twoFactor()"],
      clientImports: ['import { twoFactorClient } from "better-auth/client/plugins";'],
      clientPluginCalls: ["twoFactorClient()"],
    };
  },
};
