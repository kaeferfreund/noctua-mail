import { NextResponse } from "next/server";
import { requireAdminSessionOr403 } from "../_auth";
import { withAuthResponse } from "@/lib/auth";
import { listAdminAudit, clampAuditLimit, decodeAdminAuditCursor, encodeAdminAuditCursor } from "@/lib/serverDb";
import { getDb } from "@/lib/db/connection";
import { listMemberAccountIds } from "@/lib/accountAccess";
/** Entries of mailboxes the admin is not a member of are hidden (entries without a mailbox stay). */
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
    const entries = await listAdminAudit({limit,before,visibleTo:{userId:source.userId,accountIds:await listMemberAccountIds(source.userId)}});
    const db = await getDb();
    // The admin user directory is global; mailbox labels require current membership.
    const userLabel = db.prepare("SELECT COALESCE(NULLIF(name,''), email) AS label FROM auth_user WHERE id=?");
    const accountLabel = db.prepare(`SELECT COALESCE(NULLIF(name,''), email) AS label FROM accounts a WHERE id=?
      AND (ownerUserId=? OR EXISTS (SELECT 1 FROM user_accounts WHERE accountId=a.id AND userId=?))`);
    const labeled = entries.map(entry => ({ ...entry,
      actorLabel: (userLabel.get(entry.actorUserId) as { label: string } | null)?.label ?? null,
      targetUserLabel: entry.targetUserId ? (userLabel.get(entry.targetUserId) as { label: string } | null)?.label ?? null : null,
      targetAccountLabel: entry.targetAccountId ? (accountLabel.get(entry.targetAccountId, source.userId, source.userId) as { label: string } | null)?.label ?? null : null
    }));
    const nextCursor = entries.length === limit ? encodeAdminAuditCursor(entries[entries.length - 1]) : null;
    return NextResponse.json({ok:true,entries:labeled,nextCursor},{headers:{"cache-control":"no-store"}});
  });
}
