import { NextResponse } from "next/server";
import { getAuth } from "@/lib/betterAuth";
import { forwardAuthHeaders } from "@/lib/auth";
import { deleteSessionProofState } from "@/lib/serverDb";
import { requireBodylessSameOrigin } from "@/app/api/_helpers/requestOrigin";

export async function POST(request: Request) {
  const error = await requireBodylessSameOrigin(request);
  if (error) return error;
  const auth = await getAuth();
  const { response: current, headers: refresh } = await auth.api.getSession({ headers: request.headers, returnHeaders: true });
  const { headers } = await auth.api.signOut({ headers: request.headers, returnHeaders: true });
  if (current) await deleteSessionProofState(current.session.id);
  return forwardAuthHeaders(forwardAuthHeaders(NextResponse.json({ ok: true }), refresh), headers);
}
