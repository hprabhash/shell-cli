import { raw } from "../codegen/serialize-object";
import type { BetterAuthContribution, BetterAuthFeature } from "../contribution";

const SEND_RESET_PASSWORD = raw(
  [
    "async ({ user, url }) => {",
    "      // TODO: send this via your email provider.",
    "      console.log(`Password reset link for ${user.email}: ${url}`);",
    "    }",
  ].join("\n"),
);

export const passwordResetFeature: BetterAuthFeature = {
  id: "password-reset",
  label: "Password Reset",
  requires: ["email-password"],
  getContribution(): BetterAuthContribution {
    return {
      config: {
        emailAndPassword: {
          sendResetPassword: SEND_RESET_PASSWORD,
        },
      },
    };
  },
};
