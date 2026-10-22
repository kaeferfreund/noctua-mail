import { NextResponse } from "next/server";

export async function POST(_request: Request, ..._context: unknown[]) {
  void _request; void _context;
  return NextResponse.json({ ok: false, code: "legacy_login_retired" }, { status: 410 });
}
