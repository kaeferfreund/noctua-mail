import { readAuthJson } from "./readAuthJson";
import { NextResponse } from "next/server";
import { requireJsonSameOrigin } from "./requestOrigin";
import { requireActiveUserSession, forwardAuthHeaders } from "@/lib/auth";
import { getAuth } from "@/lib/betterAuth";
import { getDb } from "../../../lib/db/connection";
import { AuthPolicyError } from "@/lib/authPolicy";
import { reauthenticate, mutateSecurity, type SecurityAction } from "@/lib/authSecurity";

export async function handleAuthSecurity(request: Request, action: SecurityAction | "reauth") {
  const originError = requireJsonSameOrigin(request);
  if (originError) return originError;
  const session = await requireActiveUserSession(request,{allowRestricted:action === "reauth" || action === "password"});
  if (session instanceof NextResponse) return session;
  const headers = session.responseHeaders;
  headers.set("cache-control","no-store");
  try {
    const body = await readAuthJson(request);
    if (body instanceof NextResponse) return forwardAuthHeaders(body,headers);
    const auth = await getAuth();
    const db = await getDb();
    const source = {...session,sessionId:session.sessionId};
    if (action === "reauth") return forwardAuthHeaders(NextResponse.json(await reauthenticate(auth,db,source,request,body)),headers);
    const result = await mutateSecurity(auth,db,source,request,body,action);
    for (const cookie of result.headers.getSetCookie()) headers.append("set-cookie",cookie);
    return forwardAuthHeaders(NextResponse.json(result.body),headers);
  } catch (error) {
    const policy = error instanceof AuthPolicyError;
    const library = error as {statusCode?:number;body?:{code?:string}};
    let status = policy ? error.status : library.statusCode && library.statusCode < 500 ? library.statusCode : error instanceof SyntaxError ? 400 : 503;
    let code = policy ? error.code : library.body?.code ?? (status === 400 ? "invalid_request" : "security_operation_failed");
    if (["invalid_credentials","INVALID_PASSWORD","INVALID_CODE","INVALID_BACKUP_CODE"].includes(code)) { status=403;code="invalid_proof"; }
    if (status === 429) { code="proof_rate_limited";headers.set("retry-after",library.body?.code === "ACCOUNT_TEMPORARILY_LOCKED" ? "900" : "60"); }
    return forwardAuthHeaders(NextResponse.json({ok:false,code},{status,headers:{"cache-control":"no-store"}}),headers);
  }
}
