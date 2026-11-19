import { isIP } from "node:net";
import { escapeUTF8 } from "entities";
import { readBoundedBody } from "@/app/api/_helpers/readAuthJson";
import { outreachAddonEnabled } from "@/lib/addons/outreach/config";
import { getUnsubscribeOrganization, unsubscribeByToken } from "@/lib/addons/outreach/contacts/unsubscribe";
import { createRateLimiter, getRequestIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ max: 120 });
const headers = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
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
    button: "Abbestellen", done: "Wenn der Link gültig ist, wurde die Adresse vom Newsletter abgemeldet." },
  en: { heading: "Unsubscribe from the newsletter", description: "Use this form to unsubscribe from the newsletter.",
    button: "Unsubscribe", done: "If this link is valid, the address has been unsubscribed from the newsletter." }
};

function page(request: Request, organization: string, submitted: boolean, status = 200) {
  const language = pickLanguage(request.headers.get("accept-language"));
  const { heading, description, button, done } = copy[language];
  const form = `<p>${description}</p><form method="post">
  <button name="List-Unsubscribe" value="One-Click" type="submit">${button}</button>
  </form>`;
  return new Response(`<!doctype html><html lang="${language}"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${heading}</title>
<main><h1>${heading}</h1>${organization ? `<p>${escapeUTF8(organization)}</p>` : ""}
${submitted ? `<p>${done}</p>` : form}</main></html>`,
  { status, headers: { ...headers, "Content-Language": language } });
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
  if (limiter.isLimited(getRequestIp(request))) return new Response(null, { status: 429, headers });
  return page(request, await getUnsubscribeOrganization((await params).token), false);
}

export async function POST(request: Request, { params }: RouteParams) {
  if (!outreachAddonEnabled()) return new Response(null, { status: 404, headers });
  const ip = getRequestIp(request);
  if (limiter.isLimited(ip)) return new Response(null, { status: 429, headers });
  if (!(await validForm(request))) return page(request, "", false, 400);
  await unsubscribeByToken((await params).token, {
    ip: isIP(ip) ? ip : null,
    userAgent: request.headers.get("user-agent")?.slice(0, 1024)
  });
  return page(request, "", true);
}
