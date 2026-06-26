import type { BetterAuthContribution, BetterAuthFeature } from "../contribution";

export const adminFeature: BetterAuthFeature = {
  id: "admin",
  label: "Admin",
  getContribution(): BetterAuthContribution {
    return {
      serverImports: ['import { admin } from "better-auth/plugins";'],
      pluginCalls: ["admin()"],
      clientImports: ['import { adminClient } from "better-auth/client/plugins";'],
      clientPluginCalls: ["adminClient()"],
    };
  },
};
