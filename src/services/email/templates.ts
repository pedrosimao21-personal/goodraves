import { renderEmail } from "./layout";

/** Text and HTML bodies of the account emails: the confirmation and the password-reset link. */

type Body = { subject: string; text: string; html: string };

export function buildVerifyEmail(link: string): Body {
  return {
    subject: "Confirm your email for Goodraves",
    ...renderEmail({
      heading: "Confirm your email",
      intro: "Confirm this address to log in with it and to reset your password by email. The link works for 24 hours.",
      button: { label: "Confirm email", link },
      outro: "Didn't create or change a Goodraves account? You can ignore this email.",
    }),
  };
}

export function buildResetEmail(link: string): Body {
  return {
    subject: "Reset your Goodraves password",
    ...renderEmail({
      heading: "Reset your password",
      intro: "Someone asked to reset the password of the Goodraves account with this address. The link works for one hour and only once.",
      button: { label: "Choose a new password", link },
      outro: "Didn't ask for this? Ignore this email: your password stays as it is.",
    }),
  };
}
