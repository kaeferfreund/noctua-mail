import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { NextResponse } from "next/server";
import { requireActiveUserSession, withAuthResponse } from "@/lib/auth";
import { getUserById } from "@/lib/db";
import { getAccountById } from "@/lib/serverDb";
import { resolveAccountRole, roleAtLeast } from "@/lib/accountAccess";
import { resolvePublicHost } from "@/lib/net/urlSafety";
import net from "net";
import tls from "tls";
import { createRateLimiter, getRequestIp } from "@/lib/rateLimit";
import { readJsonBody } from "@/app/api/_helpers/readJsonBody";

/**
 * POST /api/probe — tests whether an IMAP/SMTP host:port supports implicit
 * TLS and/or STARTTLS. Invoked from the "Detect" buttons in the mailbox
 * settings (managers, with `accountId`) and the admin "create mailbox" dialog.
 *
 * Destination policy (the server opens TCP/TLS connections, so this must not
 * become a scanner for the server's network):
 * - admins may probe any host and port; they configure mail hosts anyway;
 * - everyone else needs the manager role on `accountId`. The mailbox's
 *   configured host for that protocol may be probed on its configured port or
 *   a standard port. Any other host must resolve only to public addresses
 *   (`resolvePublicHost`), only standard mail ports are allowed, and the
 *   socket connects to the checked address.
 * Each probe reads at most `MAX_PROBE_BYTES` and ends after `TIMEOUT_MS`.
 */

const TIMEOUT_MS = 3500;
const MAX_PROBE_BYTES = 8 * 1024;
const STANDARD_PORTS = { imap: [143, 993], smtp: [25, 465, 587] } as const;

const probeLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

type Protocol = "imap" | "smtp";
/** `address` is where the socket connects; `servername` is the name TLS verifies/sends as SNI. */
type ProbeTarget = { address: string; servername?: string; port: number };

/**
 * Runs one probe connection with an absolute deadline and a cap on buffered
 * peer data. `decide` returns a result once the collected data is conclusive.
 */
function runProbe(
  connect: () => net.Socket,
  options: { greeting?: string; secureConnect?: boolean; decide?: (data: string) => boolean | undefined }
) {
  return new Promise<boolean>((resolve) => {
    let finished = false;
    let data = "";
    const done = (result: boolean) => {
      if (finished) return;
      finished = true;
      clearTimeout(deadline);
      socket.destroy();
      resolve(result);
    };
    const deadline = setTimeout(() => done(false), TIMEOUT_MS);
    const socket = connect();
    socket.on(options.secureConnect ? "secureConnect" : "connect", () => {
      if (options.secureConnect) done(true);
      else if (options.greeting) socket.write(options.greeting);
    });
    socket.on("data", (chunk: Buffer) => {
      if (!options.decide) return;
      data += chunk.toString("latin1");
      if (data.length > MAX_PROBE_BYTES) return done(false);
      const result = options.decide(data);
      if (result !== undefined) done(result);
    });
    socket.on("timeout", () => done(false));
    socket.on("error", () => done(false));
    socket.on("end", () => done(false));
    socket.on("close", () => done(false));
  });
}

function probeImplicitTLS(target: ProbeTarget) {
  return runProbe(() => tls.connect({
    host: target.address,
    port: target.port,
    ...(target.servername ? { servername: target.servername } : {}),
    rejectUnauthorized: false
  }), { secureConnect: true });
}

function probeImapStartTLS(target: ProbeTarget) {
  return runProbe(() => net.connect({ host: target.address, port: target.port }), {
    greeting: "a1 CAPABILITY\r\n",
    decide: (data) => data.includes("CAPABILITY") ? data.toUpperCase().includes("STARTTLS") : undefined
  });
}

function probeSmtpStartTLS(target: ProbeTarget) {
  return runProbe(() => net.connect({ host: target.address, port: target.port }), {
    greeting: "EHLO noctua.local\r\n",
    decide: (data) => {
      if (!data.includes("\r\n")) return undefined;
      if (data.toUpperCase().includes("STARTTLS")) return true;
      if (data.includes("\r\n.")) return false;
      return undefined;
    }
  });
}

const normalizeHost = (host: string) => host.trim().toLowerCase().replace(/\.$/, "");
/** TLS SNI/identity name: host names only, never IP literals. */
const tlsName = (host: string) => net.isIP(host) ? undefined : host;
const deny = () => NextResponse.json({ ok: false, message: "Probe destination not allowed" }, { status: 403 });

async function resolveProbeTarget(
  userId: string,
  payload: { protocol: Protocol; host: string; port: number; accountId?: string }
): Promise<ProbeTarget | NextResponse> {
  const standardPort = (STANDARD_PORTS[payload.protocol] as readonly number[]).includes(payload.port);
  const user = await getUserById(userId);
  if (user?.role === "admin") return { address: payload.host, servername: tlsName(payload.host), port: payload.port };
  // Unknown and inaccessible mailboxes get the same answer.
  if (!payload.accountId || !roleAtLeast(await resolveAccountRole(userId, payload.accountId), "manager")) return deny();
  const account = await getAccountById(payload.accountId);
  if (!account) return deny();
  const configured = account[payload.protocol];
  if (normalizeHost(configured.host) === normalizeHost(payload.host)) {
    if (!standardPort && payload.port !== configured.port) return deny();
    return { address: payload.host, servername: tlsName(payload.host), port: payload.port };
  }
  if (!standardPort) return deny();
  const resolved = await resolvePublicHost(payload.host);
  if (!resolved.ok) return deny();
  return { address: resolved.addresses[0].address, servername: tlsName(payload.host), port: payload.port };
}

function parsePayload(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const { protocol, host, port, accountId } = body as Record<string, unknown>;
  if (protocol !== "imap" && protocol !== "smtp") return null;
  if (typeof host !== "string" || !host.trim() || host.trim().length > 253) return null;
  if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  if (accountId !== undefined && typeof accountId !== "string") return null;
  return { protocol: protocol as Protocol, host: host.trim(), port, accountId: accountId?.trim() || undefined };
}

export async function POST(request: Request) {
  const originError = requireJsonSameOrigin(request); if (originError) return originError;
  const session = await requireActiveUserSession(request);
  if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const ip = getRequestIp(request);

    if (probeLimiter.isLimited(ip)) {
      return NextResponse.json(
        { ok: false, message: "Too many requests — try again later" },
        { status: 429 }
      );
    }

    const body = await readJsonBody<unknown>(request);
    if (!body.ok) return body.response;
    const payload = parsePayload(body.value);
    if (!payload) {
      return NextResponse.json({ ok: false, message: "Protocol, host and port required" }, { status: 400 });
    }

    const target = await resolveProbeTarget(session.userId, payload);
    if (target instanceof NextResponse) return target;

    const supportsTLS = await probeImplicitTLS(target);
    const supportsStartTLS = payload.protocol === "imap"
      ? await probeImapStartTLS(target)
      : await probeSmtpStartTLS(target);

    return NextResponse.json({ ok: true, supportsTLS, supportsStartTLS });
  });
}
