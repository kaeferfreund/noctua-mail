import { NextResponse } from "next/server";
import { requireBodylessSameOrigin, requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { readBoundedBody } from "@/app/api/_helpers/readAuthJson";
import type { AccountContext } from "@/app/api/_helpers/accountContext";
import { ContactError } from "@/lib/addons/outreach/contacts/input";
import { withAuthResponse } from "@/lib/auth";

export function contactErrorResponse(error: unknown) {
  if (!(error instanceof ContactError)) throw error;
  return NextResponse.json({ ok: false, message: error.message, ...(error.code ? { code: error.code } : {}), ...error.details }, {
    status: error.status,
    headers: { "Cache-Control": "no-store", ...(error.status === 401 ? { "WWW-Authenticate": "Bearer" } : {}) }
  });
}

export async function readContactJson(request: Request): Promise<unknown> {
  const type = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (type !== "application/json") throw new ContactError("Expected a JSON body", 400, "json_required");
  const bytes = await readBoundedBody(request, 128 * 1024).catch(() => {
    throw new ContactError("Could not read request body");
  });
  if (!bytes) throw new ContactError("Request body too large", 413);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new ContactError("Invalid JSON");
  }
}

export function contactResponse(context: AccountContext, request: Request, write: "json" | "bodyless" | null,
  run: () => Promise<object>) {
  return withAuthResponse(context, async () => {
    const error = write === "json" ? requireJsonSameOrigin(request)
      : write === "bodyless" ? await requireBodylessSameOrigin(request) : null;
    if (error) return error;
    try {
      return NextResponse.json({ ok: true, ...await run() }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return contactErrorResponse(error);
    }
  });
}
