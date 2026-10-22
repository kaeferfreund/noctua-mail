import { NextResponse } from "next/server";
import { requireAdminSessionOr403 } from "./_auth";
import { requireJsonSameOrigin,requireBodylessSameOrigin } from "../_helpers/requestOrigin";
import { forwardAuthHeaders } from "@/lib/auth";
import { getAuth } from "@/lib/betterAuth";
import { getDb } from "../../../lib/db/connection";
import { AuthPolicyError } from "@/lib/authPolicy";
import { issueOnboardingInvite,issueRecovery,updateUserLifecycle,removeUserLifecycle,mutateAdminSecurity,type AdminSecurityAction } from "@/lib/userLifecycle";
import { createRateLimiter } from "@/lib/rateLimit";
const recoveryAttempts=createRateLimiter({windowMs:60000,max:3});

export async function handleAdminUser(request:Request,action:"invite"|"update"|"delete"|"recovery"|AdminSecurityAction,userId="",passkeyId?:string) {
  const bodyless=action==="passkey-remove"||action==="sessions-revoke";
  const origin=bodyless?await requireBodylessSameOrigin(request):requireJsonSameOrigin(request);if(origin)return origin;
  const source=await requireAdminSessionOr403(request);if(source instanceof NextResponse)return source;
  const headers=source.responseHeaders;headers.set("cache-control","no-store");headers.set("referrer-policy","no-referrer");
  try {
    if(["recovery","mfa-reset","passkey-remove","sessions-revoke"].includes(action) && recoveryAttempts.isLimited(source.userId))return forwardAuthHeaders(NextResponse.json({ok:false,code:"recovery_rate_limited"},{status:429,headers:{"retry-after":"60"}}),headers);
    const auth=await getAuth(),db=await getDb(),body:unknown=bodyless?{}:await request.json();
    const result=action==="invite"?await issueOnboardingInvite(db,source,body):action==="update"?await updateUserLifecycle(auth,db,source,request,userId,body):action==="delete"?await removeUserLifecycle(auth,db,source,request,userId,body):action==="recovery"?await issueRecovery(auth,db,source,request,userId,body):await mutateAdminSecurity(db,source,request,userId,body,action,passkeyId);
    return forwardAuthHeaders(NextResponse.json(result,{status:action==="invite"?201:200}),headers);
  } catch(error) {
    const status=error instanceof AuthPolicyError?error.status:error instanceof SyntaxError?400:503;
    return forwardAuthHeaders(NextResponse.json({ok:false,code:error instanceof AuthPolicyError?error.code:status===400?"invalid_request":"admin_operation_failed"},{status}),headers);
  }
}
