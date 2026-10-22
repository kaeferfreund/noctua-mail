import { NextResponse } from "next/server";
import { requireAdminSessionOr403 } from "../_auth";
import { withAuthResponse } from "@/lib/auth";
import { listAdminAudit, clampAuditLimit, decodeAdminAuditCursor, encodeAdminAuditCursor } from "@/lib/serverDb";
export async function GET(request:Request) {
  const source=await requireAdminSessionOr403(request);if(source instanceof NextResponse)return source;
  return withAuthResponse(source,async()=>{
    const params=new URL(request.url).searchParams;
    const before = params.get("before");
    if (before !== null) {
      try { decodeAdminAuditCursor(before); }
      catch { return NextResponse.json({ok:false,code:"invalid_cursor",message:"Invalid audit cursor"},{status:400,headers:{"cache-control":"no-store"}}); }
    }
    const limit = clampAuditLimit(params.has("limit") ? Number(params.get("limit")) : undefined);
    const entries = await listAdminAudit({limit,before});
    const nextCursor = entries.length === limit ? encodeAdminAuditCursor(entries[entries.length - 1]) : null;
    return NextResponse.json({ok:true,entries,nextCursor},{headers:{"cache-control":"no-store"}});
  });
}
