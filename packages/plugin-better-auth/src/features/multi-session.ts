import type { BetterAuthContribution, BetterAuthFeature } from "../contribution";

export const multiSessionFeature: BetterAuthFeature = {
  id: "multi-session",
  label: "Multi Session",
  getContribution(): BetterAuthContribution {
    return {
      serverImports: ['import { multiSession } from "better-auth/plugins";'],
      pluginCalls: ["multiSession()"],
      clientImports: ['import { multiSessionClient } from "better-auth/client/plugins";'],
      clientPluginCalls: ["multiSessionClient()"],
    };
  },
};
