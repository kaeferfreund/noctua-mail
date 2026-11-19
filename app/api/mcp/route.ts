import { NextResponse } from "next/server";
import { ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { executeMcpHttpRequest } from "@/lib/mcpServer";
import { requireMcpAccountContext } from "@/lib/auth";
import { MCP_REQUEST_BODY_MAX_BYTES, MCP_REQUEST_BODY_TIMEOUT_MS } from "@/lib/mcpAttachments";
import { BodyReadTimeoutError, readBoundedBody } from "@/app/api/_helpers/readAuthJson";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bodyError(status: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", error: { code: ErrorCode.InvalidRequest, message }, id: null }, { status });
}

function methodNotAllowedResponse() {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      error: { code: ErrorCode.InvalidRequest, message: "Method not allowed" },
      id: null
    },
    {
      status: 405,
      headers: {
        Allow: "POST"
      }
    }
  );
}

export async function POST(request: Request) {
  const context = await requireMcpAccountContext(request);
  if (context instanceof NextResponse) {
    return context;
  }

  let body: unknown = null;
  try {
    const bytes = await readBoundedBody(request, MCP_REQUEST_BODY_MAX_BYTES, MCP_REQUEST_BODY_TIMEOUT_MS);
    if (!bytes) return bodyError(413, "Request body too large");
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    if (error instanceof BodyReadTimeoutError) return bodyError(408, "Request body timed out");
    /* Keep the existing JSON-RPC response for unreadable or invalid JSON. */
  }
  const result = await executeMcpHttpRequest({ ...context, body,
    authInfo: { token: "", clientId: `mcp:${context.tokenRecord.id}`, scopes: context.tokenRecord.scopes ?? [], extra: { userId: context.tokenRecord.createdByUserId } } });
  return result.responses.length ? NextResponse.json(result.responses.length === 1 ? result.responses[0] : result.responses) : new Response(null, { status: 202 });
}

export async function GET() {
  return methodNotAllowedResponse();
}

export async function DELETE() {
  return methodNotAllowedResponse();
}
