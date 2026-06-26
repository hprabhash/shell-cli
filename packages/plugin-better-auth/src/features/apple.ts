import { raw } from "../codegen/serialize-object";
import type { BetterAuthContribution, BetterAuthFeature } from "../contribution";

const GET_APPLE_CLIENT_SECRET_HELPER = [
  "async function getAppleClientSecret(): Promise<string> {",
  '  const { SignJWT, importPKCS8 } = await import("jose");',
  '  const privateKey = await importPKCS8(process.env.APPLE_PRIVATE_KEY as string, "ES256");',
  "  return new SignJWT({})",
  '    .setProtectedHeader({ alg: "ES256", kid: process.env.APPLE_KEY_ID as string })',
  "    .setIssuer(process.env.APPLE_TEAM_ID as string)",
  "    .setIssuedAt()",
  '    .setExpirationTime("180d")',
  '    .setAudience("https://appleid.apple.com")',
  "    .setSubject(process.env.APPLE_CLIENT_ID as string)",
  "    .sign(privateKey);",
  "}",
].join("\n");

const APPLE_PROVIDER_VALUE = raw(
  [
    "async () => ({",
    "      clientId: process.env.APPLE_CLIENT_ID as string,",
    "      clientSecret: await getAppleClientSecret(),",
    "    })",
  ].join("\n"),
);

/**
 * Apple is the one social provider that doesn't fit the uniform
 * `{clientId, clientSecret}` shape: its `clientSecret` must be a JWT signed at
 * request time from a downloaded `.p8` private key, per Better Auth's docs.
 */
export const appleFeature: BetterAuthFeature = {
  id: "apple",
  label: "Apple",
  hint: "Requires an Apple Developer account; client secret is a dynamically-signed JWT",
  getContribution(): BetterAuthContribution {
    return {
      config: {
        socialProviders: {
          apple: APPLE_PROVIDER_VALUE,
        },
      },
      trustedOrigins: ["https://appleid.apple.com"],
      dependencies: { jose: "^6.2.3" },
      helperCode: [GET_APPLE_CLIENT_SECRET_HELPER],
      envVars: [
        { key: "APPLE_CLIENT_ID", comment: "Apple Service ID" },
        { key: "APPLE_TEAM_ID", comment: "Apple Developer Team ID" },
        { key: "APPLE_KEY_ID", comment: "Apple Sign In Key ID" },
        { key: "APPLE_PRIVATE_KEY", comment: "Contents of the downloaded .p8 private key" },
      ],
    };
  },
};
