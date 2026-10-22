import { NextResponse } from "next/server";

export async function GET(_request: Request, ..._context: unknown[]) {
  void _request; void _context;
  return NextResponse.json({ ok: false, code: "auth_integration_pending" }, { status: 503 });
}

export async function POST(_request: Request, ..._context: unknown[]) {
  void _request; void _context;
  return NextResponse.json({ ok: false, code: "auth_integration_pending" }, { status: 503 });
}
