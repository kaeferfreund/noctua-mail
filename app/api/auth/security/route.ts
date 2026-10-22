import {NextResponse} from "next/server";
import {requireActiveUserSession,withAuthResponse} from "@/lib/auth";
import {getDb} from "../../../../lib/db/connection";
import {enrollmentState} from "../../../../lib/db/authPolicy";
import {hasAppPassword} from "@/lib/authSecurity";
export async function GET(request:Request) {
  const session=await requireActiveUserSession(request,{allowRestricted:true});
  if(session instanceof NextResponse)return session;
  return withAuthResponse(session,async()=>{
    const db=await getDb();
    const factor=enrollmentState(db,session.userId);
    const restricted=session.enrollmentRequired||session.reauthRequired;
    return NextResponse.json({ok:true,hasPassword:hasAppPassword(db,session.userId),totpEnrolled:factor.complete,
      mfaStateInconsistent:factor.inconsistent,enrollmentRequired:session.enrollmentRequired,reauthRequired:session.reauthRequired,
      passkeys:restricted?[]:db.prepare(`SELECT id,name,createdAt,deviceType,backedUp FROM auth_passkey WHERE userId=? ORDER BY createdAt,id`).all(session.userId).map((row:{id:string;name:string|null;createdAt:string;deviceType:string;backedUp:number})=>({...row,backedUp:row.backedUp===1}))
    },{headers:{"cache-control":"no-store"}});
  });
}
