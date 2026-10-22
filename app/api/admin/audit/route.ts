import { NextResponse } from "next/server";
import { requireAdminSessionOr403 } from "../_auth";
import { withAuthResponse } from "@/lib/auth";
import { listAdminAudit } from "@/lib/serverDb";
export async function GET(request:Request) {
  const source=await requireAdminSessionOr403(request);if(source instanceof NextResponse)return source;
  return withAuthResponse(source,async()=>{
    const params=new URL(request.url).searchParams;
    return NextResponse.json({ok:true,entries:await listAdminAudit({limit:params.has("limit")?Number(params.get("limit")):undefined,before:params.has("before")?Number(params.get("before")):undefined})},{headers:{"cache-control":"no-store"}});
  });
}
