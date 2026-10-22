import { NextResponse } from "next/server";
import { ErrorCode } from "@modelcontextprotocol/sdk/types.js";
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

  return context;
}

export async function GET() {
  return methodNotAllowedResponse();
}

export async function DELETE() {
  return methodNotAllowedResponse();
}
