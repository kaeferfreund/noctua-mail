import { signOutWithPolicy } from "@/lib/authSecurity";
import { getDb } from "../../../../lib/db/connection";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/betterAuth";
import { forwardAuthHeaders } from "@/lib/auth";
import { requireBodylessSameOrigin } from "@/app/api/_helpers/requestOrigin";

export async function POST(request: Request) {
  const error = await requireBodylessSameOrigin(request);
  if (error) return error;
  const auth = await getAuth();
  const { response: current, headers: refresh } = await auth.api.getSession({ headers: request.headers, returnHeaders: true });
  let headers: Headers;
  try {
    ({headers}=await signOutWithPolicy(auth,await getDb(),request,current ? {sessionId:current.session.id,userId:current.user.id} : undefined));
  } catch (error) {
    const {AuthPolicyError}=await import("@/lib/authPolicy");
    if (error instanceof AuthPolicyError) return forwardAuthHeaders(NextResponse.json({ok:false,code:error.code},{status:error.status}),refresh);
    throw error;
  }
  return forwardAuthHeaders(forwardAuthHeaders(NextResponse.json({ ok: true }), refresh), headers);
}
