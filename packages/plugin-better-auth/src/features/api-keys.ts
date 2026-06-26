import type { BetterAuthContribution, BetterAuthFeature } from "../contribution";

export const apiKeysFeature: BetterAuthFeature = {
  id: "api-keys",
  label: "API Keys",
  getContribution(): BetterAuthContribution {
    return {
      serverImports: ['import { apiKey } from "@better-auth/api-key";'],
      pluginCalls: ["apiKey()"],
      clientImports: ['import { apiKeyClient } from "@better-auth/api-key/client";'],
      clientPluginCalls: ["apiKeyClient()"],
      dependencies: { "@better-auth/api-key": "^1.6.22" },
    };
  },
};
