import type { BetterAuthContribution, BetterAuthFeature } from "../contribution";

export const organizationFeature: BetterAuthFeature = {
  id: "organization",
  label: "Organization",
  getContribution(selectedIds: ReadonlySet<string>): BetterAuthContribution {
    const teamsEnabled = selectedIds.has("teams");
    const optionsLiteral = teamsEnabled ? "{\n    teams: { enabled: true },\n  }" : "";
    return {
      serverImports: ['import { organization } from "better-auth/plugins";'],
      pluginCalls: [`organization(${optionsLiteral})`],
      clientImports: ['import { organizationClient } from "better-auth/client/plugins";'],
      clientPluginCalls: ["organizationClient()"],
    };
  },
};
