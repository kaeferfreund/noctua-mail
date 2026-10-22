import { NextResponse } from "next/server";
import { readAuthEnv } from "@/lib/betterAuth";

function requireSameOrigin(request: Request) {
  const configured = readAuthEnv().baseURL;
  let origin = request.headers.get("origin");
  if (origin === null) {
    const referer = request.headers.get("referer");
    try { origin = referer ? new URL(referer).origin : null; } catch { origin = null; }
  }
  if (origin !== configured || request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ ok: false, code: "invalid_origin" }, { status: 403 });
  }
  return null;
}

export function requireJsonSameOrigin(request: Request) {
  const error = requireSameOrigin(request);
  if (error) return error;
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return NextResponse.json({ ok: false, code: "json_required" }, { status: 400 });
  }
  return null;
}

export async function requireBodylessSameOrigin(request: Request) {
  const error = requireSameOrigin(request);
  if (error) return error;
  if ((await request.arrayBuffer()).byteLength !== 0) {
    return NextResponse.json({ ok: false, code: "unexpected_body" }, { status: 400 });
  }
  return null;
}

/** Bodyless commands accept no payload; commands carrying JSON share the JSON guard. */
export function requireMutationSameOrigin(request: Request) {
  return request.body === null ? requireSameOrigin(request) : requireJsonSameOrigin(request);
}
