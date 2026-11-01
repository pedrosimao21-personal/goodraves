/** Text and HTML bodies of the account emails. Links are ours, so they need no escaping. */

import { SITE_URL } from "@/lib/site";

type Body ={ subject: string; text: string; html: string };

function layout(heading: string, intro: string, buttonLabel: string, link: string, outro: string): { text: string; html: string } {
  const text = `${heading}\n\n${intro}\n\n${link}\n\n${outro}\n\nGoodraves, your festival diary\n${SITE_URL}`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${heading}</title></head><body style="margin:0;padding:24px;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;color:#f2f0ea">
  <div style="max-width:480px;margin:0 auto;background:#141414;border:1px solid #2a2a2a;padding:28px">
    <h1 style="margin:0 0 16px;font-size:22px;letter-spacing:.02em;text-transform:uppercase">${heading}</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#c9c6bd">${intro}</p>
    <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#d4ff3a;color:#0a0a0a;text-decoration:none;font-weight:700;padding:12px 20px">${buttonLabel}</a></p>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#8a877e">Or paste this link into your browser:<br><span style="word-break:break-all">${link}</span></p>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#8a877e">${outro}</p>
    <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#8a877e">Goodraves, your festival diary &middot; <a href="${SITE_URL}" style="color:#8a877e">${SITE_URL.replace("https://", "")}</a></p>
  </div>
</body></html>`;
  return { text, html };
}

export function buildVerifyEmail(link: string): Body {
  return {
    subject: "Confirm your email for Goodraves",
    ...layout(
      "Confirm your email",
      "Confirm this address to log in with it and to reset your password by email. The link works for 24 hours.",
      "Confirm email",
      link,
      "Didn't create or change a Goodraves account? You can ignore this email."
    ),
  };
}

export function buildResetEmail(link: string): Body {
  return {
    subject: "Reset your Goodraves password",
    ...layout(
      "Reset your password",
      "Someone asked to reset the password of the Goodraves account with this address. The link works for one hour and only once.",
      "Choose a new password",
      link,
      "Didn't ask for this? Ignore this email: your password stays as it is."
    ),
  };
}
