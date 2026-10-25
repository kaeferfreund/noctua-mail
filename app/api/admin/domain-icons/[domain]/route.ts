import { NextResponse } from "next/server";
import { requireAdminSessionOr403 } from "../../_auth";
import { withAuthResponse } from "@/lib/auth";
import { getAccounts } from "@/lib/serverDb";
import { listMemberAccounts } from "@/lib/accountAccess";
import { requireBinarySameOrigin, requireBodylessSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { BodyReadTimeoutError, readBoundedBody } from "@/app/api/_helpers/readAuthJson";
import { domainIconOverrideResponse, senderIconResponse } from "@/app/api/_helpers/iconResponse";
import { createRateLimiter, getRequestIp } from "@/lib/rateLimit";
import { mailboxDomain, normalizeIconDomain, readDomainIconOverride, resetDomainIcon, saveDomainIcon } from "@/lib/domainIcons";
import { DOMAIN_ICON_MAX_BYTES, DomainIconError, normalizeDomainIcon } from "@/lib/domainIconImage";
import { resolveSenderIcon } from "@/lib/senderIcons";

type Params = { params: Promise<{ domain?: string }> };

// Next route bundles may load independent module graphs in the same server process.
const limitsKey = Symbol.for("noctua.domainIconLimits");
type Limits = { actor: ReturnType<typeof createRateLimiter>; ip: ReturnType<typeof createRateLimiter> };
const shared = globalThis as typeof globalThis & { [limitsKey]?: Limits };
const limits = shared[limitsKey] ??= {
  actor: createRateLimiter({ windowMs: 60_000, max: 10 }),
  ip: createRateLimiter({ windowMs: 60_000, max: 30 })
};

function failure(status: number, code: string, headers?: HeadersInit) {
  return NextResponse.json({ ok: false, code }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function rateLimited(request: Request, userId: string) {
  const actor = limits.actor.isLimited(userId), ip = limits.ip.isLimited(getRequestIp(request));
  return actor || ip ? failure(429, "rate_limited", { "Retry-After": "60" }) : null;
}

/** The admin's own mailboxes (memberships) at the domain, and whether only other mailboxes use it
 * (`foreign`: answered like an unknown domain). A domain no mailbox uses has neither. */
async function domainScope(domain: string, userId: string) {
  const mailboxes = (await listMemberAccounts(userId)).filter(account => mailboxDomain(account.email) === domain);
  return { mailboxes, foreign: !mailboxes.length && (await getAccounts()).some(account => mailboxDomain(account.email) === domain) };
}

/** The icon the sidebar shows for the domain: the upload, else the favicon
 * through the first mailbox with sender icons on (none fetched otherwise). */
export async function GET(request: Request, { params }: Params) {
  const session = await requireAdminSessionOr403(request); if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const domain = normalizeIconDomain((await params).domain);
    if (!domain) return failure(400, "invalid_domain");
    const { mailboxes, foreign } = await domainScope(domain, session.userId);
    if (foreign) return failure(404, "unknown_domain");
    const override = await readDomainIconOverride(domain);
    if (override) return domainIconOverrideResponse(request, override);
    if (!mailboxes.length) return failure(404, "unknown_domain");
    const source = mailboxes.find(account => account.settings?.appearance?.senderIcons ?? true);
    return senderIconResponse(await resolveSenderIcon({ from: domain, fromEmail: (source ?? mailboxes[0]).email, enabled: Boolean(source) }), true);
  });
}

/** Raw image bytes (`application/octet-stream`); stored re-encoded as a 64×64 PNG. */
export async function PUT(request: Request, { params }: Params) {
  const origin = requireBinarySameOrigin(request); if (origin) return origin;
  const session = await requireAdminSessionOr403(request); if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const limited = rateLimited(request, session.userId); if (limited) return limited;
    const domain = normalizeIconDomain((await params).domain);
    if (!domain) return failure(400, "invalid_domain");
    if (!(await domainScope(domain, session.userId)).mailboxes.length) return failure(404, "unknown_domain");
    let bytes: Uint8Array | null;
    try {
      bytes = await readBoundedBody(request, DOMAIN_ICON_MAX_BYTES);
    } catch (error) {
      if (error instanceof BodyReadTimeoutError) return failure(408, "upload_timeout");
      throw error;
    }
    if (!bytes) return failure(413, "too_large");
    if (!bytes.length) return failure(400, "empty_upload");
    let png: Buffer;
    try {
      png = await normalizeDomainIcon(bytes);
    } catch (error) {
      if (error instanceof DomainIconError) return failure(error.code === "unsupported_format" ? 415 : 422, error.code);
      throw error;
    }
    const saved = await saveDomainIcon(domain, png, session.userId);
    return NextResponse.json({ ok: true, ...saved }, { headers: { "Cache-Control": "no-store" } });
  });
}

/** Back to the favicon. */
export async function DELETE(request: Request, { params }: Params) {
  const origin = await requireBodylessSameOrigin(request); if (origin) return origin;
  const session = await requireAdminSessionOr403(request); if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const limited = rateLimited(request, session.userId); if (limited) return limited;
    const domain = normalizeIconDomain((await params).domain);
    if (!domain) return failure(400, "invalid_domain");
    if ((await domainScope(domain, session.userId)).foreign) return failure(404, "unknown_domain");
    const removed = await resetDomainIcon(domain, session.userId);
    return NextResponse.json({ ok: true, domain, removed }, { headers: { "Cache-Control": "no-store" } });
  });
}
