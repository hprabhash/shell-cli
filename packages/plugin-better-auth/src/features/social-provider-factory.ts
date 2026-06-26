import { raw } from "../codegen/serialize-object";
import type { BetterAuthContribution, BetterAuthFeature } from "../contribution";

/**
 * Google, GitHub, Discord, and Microsoft all configure as a plain
 * `{clientId, clientSecret}` object under `socialProviders` — confirmed
 * identical across all four in Better Auth's docs. Apple is the one exception
 * (a dynamically-signed JWT secret) and gets its own bespoke feature module.
 */
export function createSocialProviderFeature(
  id: string,
  label: string,
  envPrefix: string,
): BetterAuthFeature {
  return {
    id,
    label,
    getContribution(): BetterAuthContribution {
      return {
        config: {
          socialProviders: {
            [id]: {
              clientId: raw(`process.env.${envPrefix}_CLIENT_ID as string`),
              clientSecret: raw(`process.env.${envPrefix}_CLIENT_SECRET as string`),
            },
          },
        },
        envVars: [
          { key: `${envPrefix}_CLIENT_ID`, comment: `${label} OAuth client ID` },
          { key: `${envPrefix}_CLIENT_SECRET`, comment: `${label} OAuth client secret` },
        ],
      };
    },
  };
}
