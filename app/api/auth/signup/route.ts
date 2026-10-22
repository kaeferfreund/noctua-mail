import { NextResponse } from "next/server";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { getAuth } from "@/lib/betterAuth";
import { getDb } from "../../../../lib/db/connection";
import { provisionUser } from "@/lib/userProvisioning";
import { AuthPolicyError } from "@/lib/authPolicy";
import { createRateLimiter, getRequestIp } from "@/lib/rateLimit";
const attempts=createRateLimiter({windowMs:60000,max:3});

export async function POST(request:Request) {
  const hygiene=requireJsonSameOrigin(request); if (hygiene) return hygiene;
  const headers={"cache-control":"no-store","referrer-policy":"no-referrer"};
  if (attempts.isLimited(getRequestIp(request))) return NextResponse.json({ok:false,code:"signup_rate_limited"},{status:429,headers:{...headers,"retry-after":"60"}});
  try {
    const auth=await getAuth(), db=await getDb();
    const input:unknown=await request.json();
    const result=await provisionUser(auth,db,input);
    const body=input as {email:string;password:string};
    // Provisioning is committed. A failed setup sign-in must still return the new identity.
    let response:Response|undefined;
    try {
      response=await auth.handler(new Request(new URL("/api/ba/sign-in/email",request.url),{
        method:"POST",headers:{"content-type":"application/json",origin:new URL(request.url).origin,"x-forwarded-for":getRequestIp(request)},
        body:JSON.stringify({email:body.email.trim().toLowerCase(),password:body.password})
      }));
    } catch { /* The client can sign in separately without replaying signup. */ }
    const output=NextResponse.json({ok:true,userId:result.userId,accountId:null,security:{enrollmentRequired:true},loginRequired:!response?.ok},{status:201,headers});
    if (!response?.ok) return output;
    for (const cookie of response.headers.getSetCookie()) output.headers.append("set-cookie",cookie);
    return output;
  } catch (error) {
    return NextResponse.json({ok:false,code:error instanceof AuthPolicyError?error.code:error instanceof SyntaxError?"invalid_request":"provisioning_failed"},
      {status:error instanceof AuthPolicyError?error.status:error instanceof SyntaxError?400:503,headers});
  }
}
