import { SITE_URL } from "@/lib/site";

/** Shared look of every email we send: text and HTML bodies from the same parts. */

export type EmailParts = {
  heading: string;
  intro: string;
  /** Short plain lines under the intro (a festival's date and place, a recap's list). */
  details?: string[];
  button: { label: string; link: string };
  outro: string;
  /** Why the reader gets this, plus a link to switch it off: notifications only. */
  unsubscribe?: { reason: string; url: string };
};

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const SITE_HOST = SITE_URL.replace("https://", "");

function renderText(parts: EmailParts): string {
  const sections = [parts.heading, parts.intro];
  if (parts.details?.length) sections.push(parts.details.map((line) => `- ${line}`).join("\n"));
  sections.push(parts.button.link, parts.outro);
  if (parts.unsubscribe) sections.push(`${parts.unsubscribe.reason}\nUnsubscribe: ${parts.unsubscribe.url}`);
  sections.push(`Goodraves, your festival diary\n${SITE_URL}`);
  return sections.join("\n\n");
}

function renderDetails(details: string[]): string {
  const items = details.map((line) => `<li style="margin:0 0 6px">${escapeHtml(line)}</li>`).join("");
  return `<ul style="margin:0 0 24px;padding-left:20px;font-size:15px;line-height:1.5;color:#f2f0ea">${items}</ul>`;
}

function renderUnsubscribe({ reason, url }: { reason: string; url: string }): string {
  return `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#8a877e">${escapeHtml(reason)} <a href="${escapeHtml(url)}" style="color:#8a877e">Unsubscribe</a></p>`;
}

function renderHtml(parts: EmailParts): string {
  const { heading, intro, details, button, outro, unsubscribe } = parts;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(heading)}</title></head><body style="margin:0;padding:24px;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;color:#f2f0ea">
  <div style="max-width:480px;margin:0 auto;background:#141414;border:1px solid #2a2a2a;padding:28px">
    <h1 style="margin:0 0 16px;font-size:22px;letter-spacing:.02em;text-transform:uppercase">${escapeHtml(heading)}</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#c9c6bd">${escapeHtml(intro)}</p>
    ${details?.length ? renderDetails(details) : ""}<p style="margin:0 0 24px"><a href="${escapeHtml(button.link)}" style="display:inline-block;background:#d4ff3a;color:#0a0a0a;text-decoration:none;font-weight:700;padding:12px 20px">${escapeHtml(button.label)}</a></p>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#8a877e">Or paste this link into your browser:<br><span style="word-break:break-all">${escapeHtml(button.link)}</span></p>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#8a877e">${escapeHtml(outro)}</p>
    ${unsubscribe ? renderUnsubscribe(unsubscribe) : ""}<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#8a877e">Goodraves, your festival diary &middot; <a href="${SITE_URL}" style="color:#8a877e">${SITE_HOST}</a></p>
  </div>
</body></html>`;
}

export function renderEmail(parts: EmailParts): { text: string; html: string } {
  return { text: renderText(parts), html: renderHtml(parts) };
}
