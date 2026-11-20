import http from "node:http";
import https from "node:https";
import type { LookupAddress } from "node:dns";
import {
  assertPublicUrl,
  type AssertPublicUrlRejectionReason,
  type LookupFn,
  type PublicAddress
} from "./urlSafety";

/**
 * Server-side HTTP to untrusted destinations (URLs from mail headers or
 * user-configured servers). Every hop — the first URL and each redirect
 * target — goes through `assertPublicUrl`, and the socket connects to exactly
 * the addresses that check accepted (pinned `lookup`), so neither a redirect
 * nor a DNS answer that changes after the check (rebinding) can reach a
 * non-public address. Responses are size- and time-bounded.
 */

export type PublicRequestFailure =
  | AssertPublicUrlRejectionReason
  | "too-many-redirects"
  | "redirect-not-allowed"
  | "response-too-large"
  | "timeout"
  | "network-error";

export class PublicRequestError extends Error {
  readonly reason: PublicRequestFailure;
  constructor(reason: PublicRequestFailure, message?: string, options?: { cause?: unknown }) {
    super(message ?? `Outbound request rejected (${reason})`, options);
    this.name = "PublicRequestError";
    this.reason = reason;
  }
}

/** One request to one checked URL; the transport must connect only to `addresses`. */
export type PinnedHop = {
  url: URL;
  addresses: PublicAddress[];
  method: string;
  headers: Headers;
  body: Uint8Array | null;
  signal: AbortSignal;
  maxResponseBytes: number;
};

export type HopResponse = { status: number; statusText: string; headers: Headers; body: Uint8Array<ArrayBuffer> };
export type HopTransport = (hop: PinnedHop) => Promise<HopResponse>;

export type PublicRequestOptions = {
  method?: string;
  headers?: HeadersInit;
  body?: string | Uint8Array | null;
  /** Allowed URL schemes for every hop (default `["https:"]`, see `assertPublicUrl`). */
  protocols?: readonly string[];
  lookup?: LookupFn;
  /** Same meaning as `fetch`'s `redirect`; "follow" re-checks every hop. */
  redirect?: RequestRedirect;
  maxRedirects?: number;
  /** Deadline for the whole exchange including all redirects. */
  timeoutMs?: number;
  maxResponseBytes?: number;
  signal?: AbortSignal;
  /** Test seam; defaults to `pinnedHttpTransport`. */
  transport?: HopTransport;
};

export type PublicResponse = HopResponse & { url: string; redirected: boolean };

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const CREDENTIAL_HEADERS = ["authorization", "cookie", "proxy-authorization"];
export const DEFAULT_PUBLIC_MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RESPONSE_BYTES = 20 * 1024 * 1024;

function abortFailure(signal: AbortSignal, timeout: AbortSignal): unknown {
  return timeout.aborted ? new PublicRequestError("timeout") : signal.reason;
}

export async function publicRequest(rawUrl: string, options: PublicRequestOptions = {}): Promise<PublicResponse> {
  const transport = options.transport ?? pinnedHttpTransport;
  const maxRedirects = options.maxRedirects ?? DEFAULT_PUBLIC_MAX_REDIRECTS;
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const timeout = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const headers = new Headers(options.headers);
  let method = (options.method ?? "GET").toUpperCase();
  let body = typeof options.body === "string" ? new TextEncoder().encode(options.body) : (options.body ?? null);
  let current = rawUrl;

  for (let redirects = 0; ; redirects++) {
    if (signal.aborted) throw abortFailure(signal, timeout);
    const checked = await assertPublicUrl(current, { lookup: options.lookup, protocols: options.protocols });
    if (!checked.ok) throw new PublicRequestError(checked.reason);
    let response: HopResponse;
    try {
      response = await transport({ url: checked.url, addresses: checked.addresses, method, headers, body, signal, maxResponseBytes });
    } catch (error) {
      if (error instanceof PublicRequestError) throw error;
      if (signal.aborted) throw abortFailure(signal, timeout);
      const message = error instanceof Error ? error.message : "Network error";
      throw new PublicRequestError("network-error", message, { cause: error });
    }
    const location = REDIRECT_STATUSES.has(response.status) ? response.headers.get("location") : null;
    if (!location || options.redirect === "manual") {
      return { ...response, url: checked.url.toString(), redirected: redirects > 0 };
    }
    if (options.redirect === "error") throw new PublicRequestError("redirect-not-allowed");
    if (redirects >= maxRedirects) throw new PublicRequestError("too-many-redirects");
    let next: URL;
    try {
      next = new URL(location, checked.url);
    } catch {
      throw new PublicRequestError("invalid-url");
    }
    if (next.origin !== checked.url.origin) for (const name of CREDENTIAL_HEADERS) headers.delete(name);
    // Fetch-standard method rewrite: 303 (except HEAD) and POST after 301/302 become GET without body.
    if ((response.status === 303 && method !== "GET" && method !== "HEAD") ||
        ((response.status === 301 || response.status === 302) && method === "POST")) {
      method = "GET";
      body = null;
      headers.delete("content-type");
      headers.delete("content-length");
    }
    current = next.toString();
  }
}

function toHeaders(raw: http.IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(raw)) {
    if (Array.isArray(value)) for (const item of value) headers.append(name, item);
    else if (value !== undefined) headers.set(name, value);
  }
  return headers;
}

/**
 * Default transport: Node's http/https client with a `lookup` that answers
 * only with the checked addresses, so the TCP connection cannot go anywhere
 * else. TLS still verifies the certificate against the URL's host name.
 * `agent: false` prevents reuse of a socket opened for a different hop.
 */
export const pinnedHttpTransport: HopTransport = (hop) => new Promise<HopResponse>((resolve, reject) => {
  const pinned: LookupAddress[] = hop.addresses.map(({ address, family }) => ({ address, family }));
  if (pinned.length === 0) {
    reject(new PublicRequestError("no-dns-records"));
    return;
  }
  const lookup = (
    _hostname: string,
    options: { all?: boolean } | number | undefined,
    callback: (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void
  ) => {
    if (typeof options === "object" && options?.all) callback(null, pinned);
    else callback(null, pinned[0].address, pinned[0].family);
  };
  const headers: Record<string, string> = {};
  hop.headers.forEach((value, name) => { headers[name] = value; });
  headers["accept-encoding"] ??= "identity";
  if (hop.body) headers["content-length"] = String(hop.body.byteLength);
  let hostname = hop.url.hostname;
  if (hostname.startsWith("[") && hostname.endsWith("]")) hostname = hostname.slice(1, -1);
  const client = hop.url.protocol === "https:" ? https : http;
  let settled = false;
  const fail = (error: unknown) => {
    if (settled) return;
    settled = true;
    reject(error);
  };
  const request = client.request({
    protocol: hop.url.protocol,
    hostname,
    port: hop.url.port || undefined,
    path: `${hop.url.pathname}${hop.url.search}`,
    method: hop.method,
    headers,
    lookup: lookup as never,
    agent: false,
    signal: hop.signal
  }, (response) => {
    const chunks: Buffer[] = [];
    let size = 0;
    response.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > hop.maxResponseBytes) {
        fail(new PublicRequestError("response-too-large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    response.on("end", () => {
      if (settled) return;
      settled = true;
      resolve({
        status: response.statusCode ?? 0,
        statusText: response.statusMessage ?? "",
        headers: toHeaders(response.headers),
        body: new Uint8Array(Buffer.concat(chunks))
      });
    });
    response.on("error", fail);
  });
  request.on("error", fail);
  request.end(hop.body ? Buffer.from(hop.body) : undefined);
});

const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);

/**
 * `fetch`-compatible wrapper around `publicRequest` for libraries that accept
 * a custom fetch (e.g. tsdav's `createDAVClient({ fetch })`). Each call is
 * checked, pinned and redirect-checked as described above.
 */
export function createPublicFetch(defaults: Omit<PublicRequestOptions, "method" | "headers" | "body" | "redirect" | "signal"> = {}): typeof fetch {
  const publicFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : null;
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    const headers = new Headers(init?.headers ?? request?.headers);
    const rawBody = init?.body !== undefined ? init.body : request?.body ?? null;
    let body: Uint8Array | null = null;
    if (rawBody != null) {
      const encoded = new Response(rawBody);
      const defaultType = encoded.headers.get("content-type");
      if (defaultType && !headers.has("content-type")) headers.set("content-type", defaultType);
      body = new Uint8Array(await encoded.arrayBuffer());
    }
    const result = await publicRequest(url, {
      ...defaults,
      method,
      headers,
      body,
      redirect: init?.redirect ?? request?.redirect,
      signal: init?.signal ?? request?.signal ?? undefined
    });
    if (result.status < 200 || result.status > 599) {
      throw new PublicRequestError("network-error", `Unexpected HTTP status ${result.status}`);
    }
    const response = new Response(
      NULL_BODY_STATUSES.has(result.status) || method === "HEAD" ? null : result.body,
      { status: result.status, statusText: result.statusText, headers: result.headers }
    );
    Object.defineProperty(response, "url", { value: result.url });
    Object.defineProperty(response, "redirected", { value: result.redirected });
    return response;
  };
  return publicFetch as unknown as typeof fetch;
}
