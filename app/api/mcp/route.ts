import { NextResponse } from "next/server";
import { ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { executeMcpHttpRequest } from "@/lib/mcpServer";
import { requireMcpAccountContext } from "@/lib/auth";
import { base64ImageLimit } from "@/lib/addons/outreach/media/format";
import { readBoundedBody } from "@/app/api/_helpers/readAuthJson";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fit a 5 MiB image encoded as base64 plus 16 KiB for the JSON-RPC envelope.
const bodyLimit = base64ImageLimit + 16 * 1024;

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
    const bytes = await readBoundedBody(request, bodyLimit);
    if (!bytes) {
      return NextResponse.json({
        jsonrpc: "2.0",
        error: { code: ErrorCode.InvalidRequest, message: "Request body too large" },
        id: null
      }, { status: 413 });
    }
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch { /* Keep the existing JSON-RPC response for unreadable or invalid JSON. */ }
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
