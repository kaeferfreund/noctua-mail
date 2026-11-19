import type { Database } from "bun:sqlite";
import { NextResponse } from "next/server";
import type { AccountContext } from "@/app/api/_helpers/accountContext";
import { withAuthResponse } from "@/lib/auth";
import { requireBodylessSameOrigin, requireJsonSameOrigin, requireMutationSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { BodyReadTimeoutError, readBoundedBody } from "@/app/api/_helpers/readAuthJson";
import { requireOutreachContext, type AccountRouteParams } from "@/app/api/addons/outreach/_helpers/outreachContext";
import { OutboundAuthorizationError } from "@/lib/outboundAuthorization";
import { SenderIdentityError } from "@/lib/senderIdentityError";
import { getOutreachDb } from "../db";
import { OUTREACH_VIA_APP } from "../via";
import { itemId, SendingError, validated } from "./input";

type Mode = "read" | "preview" | "json" | "command" | "delete";
type RouteInput = {
  db: Database; accountId: string; userId: string; authorization: { request: Request }; via: typeof OUTREACH_VIA_APP;
  body: unknown; params: Awaited<AccountRouteParams["params"]>; query: URLSearchParams;
};

export function routeId(params: RouteInput["params"], name: string) {
  return validated(itemId, params[name]);
}

export function sendingRoute(mode: Mode, handler: (input: RouteInput) => unknown | Promise<unknown>,
  dependencies: { context: typeof requireOutreachContext; db: typeof getOutreachDb } = {
    context: requireOutreachContext, db: getOutreachDb
  }) {
  const readsOnly = mode === "read" || mode === "preview";
  const hasJsonBody = mode === "json" || mode === "preview";
  return async (request: Request, { params }: AccountRouteParams): Promise<NextResponse> => {
    const context: AccountContext | NextResponse = await dependencies.context(request, params, { minRole: readsOnly ? "viewer" : "editor" });
    if (context instanceof NextResponse) return context;
    return withAuthResponse(context, async () => {
      const guard = hasJsonBody ? requireJsonSameOrigin(request)
        : mode === "delete" ? await requireBodylessSameOrigin(request)
        : mode === "command" ? await requireMutationSameOrigin(request) : null;
      if (guard) return guard;
      try {
        let body: unknown;
        if (hasJsonBody) {
          const bytes = await readBoundedBody(request, 8 * 1024 * 1024);
          if (!bytes) throw new SendingError(413, "Anfrage ist zu groß.");
          body = JSON.parse(new TextDecoder().decode(bytes));
        }
        return NextResponse.json(await handler({ db: await dependencies.db(), accountId: context.accountId,
          userId: context.userId, authorization: { request }, via: OUTREACH_VIA_APP, body, params: await params, query: new URL(request.url).searchParams }));
      } catch (error) {
        if (error instanceof OutboundAuthorizationError) return error.response;
        if (error instanceof SenderIdentityError || error instanceof SendingError) {
          return NextResponse.json({ ok: false, message: error.message, code: error.code }, { status: error.status });
        }
        if (error instanceof BodyReadTimeoutError || error instanceof SyntaxError) {
          return NextResponse.json({ ok: false, message: "Ungültige JSON-Anfrage." }, { status: 400 });
        }
        console.warn("[outreach] sending request failed");
        return NextResponse.json({ ok: false, message: "Die Anfrage konnte nicht verarbeitet werden." }, { status: 500 });
      }
    });
  };
}
