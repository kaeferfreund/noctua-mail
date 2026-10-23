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

function isJsonRequest(request: Request) {
  return request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() === "application/json";
}

export function requireJsonSameOrigin(request: Request) {
  const error = requireSameOrigin(request);
  if (error) return error;
  if (!isJsonRequest(request)) {
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

/**
 * Commands whose input is optional. A JSON body stays unread for the handler.
 * Any other request is valid only when empty, whatever its headers: fetch and
 * Next always expose a body stream, so emptiness is read, not inferred.
 */
export async function requireMutationSameOrigin(request: Request) {
  const error = requireSameOrigin(request);
  if (error) return error;
  if (isJsonRequest(request) || (await request.arrayBuffer()).byteLength === 0) return null;
  return NextResponse.json({ ok: false, code: "json_required" }, { status: 400 });
}
