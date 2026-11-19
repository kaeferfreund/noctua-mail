import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { escapeUTF8 } from "entities";
import { readBoundedBody } from "@/app/api/_helpers/readAuthJson";
import { outreachAddonEnabled } from "@/lib/addons/outreach/config";
import { getUnsubscribeOrganization, unsubscribeByToken } from "@/lib/addons/outreach/contacts/unsubscribe";
import { createRateLimiter, getRequestIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Viewing and submitting have budgets of their own. One-click unsubscribes (RFC 8058) arrive from a
// mail provider's shared addresses, so the submit budget covers a whole campaign's recipients at once.
const viewLimiter = createRateLimiter({ max: 120 });
const submitLimiter = createRateLimiter({ max: 2_000 });
// The page loads nothing: its one static style block is allowed by hash, everything else is denied.
const style = `:root{color-scheme:light dark}
body{margin:0;padding:24px 16px;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f4f4f5;color:#18181b}
main{max-width:28rem;margin:8vh auto 0;padding:24px;border:1px solid #d4d4d8;border-radius:12px;background:#fff}
h1{margin:0 0 12px;font-size:1.25rem;line-height:1.3}
p{margin:0 0 16px}
.org{color:#52525b}
button{font:inherit;font-weight:600;padding:10px 18px;border:0;border-radius:8px;background:#18181b;color:#fff;cursor:pointer}
button:focus-visible{outline:3px solid #6366f1;outline-offset:2px}
@media (prefers-color-scheme:dark){body{background:#18181b;color:#f4f4f5}main{background:#27272a;border-color:#3f3f46}.org{color:#a1a1aa}button{background:#f4f4f5;color:#18181b}}`;
const styleHash = createHash("sha256").update(style).digest("base64");
const headers = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": `default-src 'none'; style-src 'sha256-${styleHash}'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Content-Type": "text/html; charset=utf-8",
  Vary: "Accept-Language"
};

type RouteParams = { params: Promise<{ token: string }> };

function pickLanguage(header: string | null): "de" | "en" {
  const preferences = (header ?? "").split(",").map(value => {
    const [locale, quality] = value.trim().toLowerCase().split(";");
    return { language: locale.split("-")[0], weight: quality === undefined ? 1 : Number(quality.trim().replace(/^q=/, "")) };
  }).filter(({ language, weight }) => (language === "de" || language === "en") && weight > 0 && weight <= 1);
  preferences.sort((left, right) => right.weight - left.weight);
  return preferences[0]?.language === "de" ? "de" : "en";
}

const copy = {
  de: { heading: "Newsletter abbestellen", description: "Mit diesem Formular können Sie den Newsletter abbestellen.",
    button: "Abbestellen", done: "Wenn der Link gültig ist, wurde die Adresse vom Newsletter abgemeldet.",
    busy: "Die Abmeldung ist gerade nicht möglich. Bitte versuchen Sie es in einer Minute erneut." },
  en: { heading: "Unsubscribe from the newsletter", description: "Use this form to unsubscribe from the newsletter.",
    button: "Unsubscribe", done: "If this link is valid, the address has been unsubscribed from the newsletter.",
    busy: "Unsubscribing is not possible right now. Please try again in a minute." }
};

function page(request: Request, organization: string, submitted: boolean, status = 200) {
  const language = pickLanguage(request.headers.get("accept-language"));
  const { heading, description, button, done, busy } = copy[language];
  const form = `${status === 429 ? `<p>${busy}</p>` : `<p>${description}</p>`}<form method="post">
  <button name="List-Unsubscribe" value="One-Click" type="submit">${button}</button>
  </form>`;
  return new Response(`<!doctype html><html lang="${language}"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${heading}</title><style>${style}</style>
<main><h1>${heading}</h1>${organization ? `<p class="org">${escapeUTF8(organization)}</p>` : ""}
${submitted ? `<p>${done}</p>` : form}</main></html>`,
  { status, headers: { ...headers, "Content-Language": language, ...(status === 429 ? { "Retry-After": "60" } : {}) } });
}

async function validForm(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  const mediaType = type.split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/x-www-form-urlencoded" && mediaType !== "multipart/form-data") return false;
  try {
    const bytes = await readBoundedBody(request, 4096);
    if (!bytes) return false;
    const fields = mediaType === "multipart/form-data"
      ? await new Response(new Uint8Array(bytes), { headers: { "Content-Type": type } }).formData()
      : new URLSearchParams(new TextDecoder().decode(bytes));
    const values = fields.getAll("List-Unsubscribe");
    return values.length === 1 && values[0] === "One-Click";
  } catch {
    return false;
  }
}

export async function GET(request: Request, { params }: RouteParams) {
  if (!outreachAddonEnabled()) return new Response(null, { status: 404, headers });
  if (viewLimiter.isLimited(getRequestIp(request))) return new Response(null, { status: 429, headers });
  return page(request, await getUnsubscribeOrganization((await params).token), false);
}

export async function POST(request: Request, { params }: RouteParams) {
  if (!outreachAddonEnabled()) return new Response(null, { status: 404, headers });
  const ip = getRequestIp(request);
  // A refused submit says so and keeps the form; it never shows the confirmation.
  if (submitLimiter.isLimited(ip)) return page(request, "", false, 429);
  if (!(await validForm(request))) return page(request, "", false, 400);
  await unsubscribeByToken((await params).token, {
    ip: isIP(ip) ? ip : null,
    userAgent: request.headers.get("user-agent")?.slice(0, 1024)
  });
  return page(request, "", true);
}
