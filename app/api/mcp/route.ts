import { NextResponse } from "next/server";
import { ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { executeMcpHttpRequest } from "@/lib/mcpServer";
import { requireMcpAccountContext } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const body = await request.json().catch(() => null);
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
