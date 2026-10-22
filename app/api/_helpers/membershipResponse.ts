import { NextResponse } from "next/server";

/** Give shared guard failures the membership routes' stable error envelope. */
export async function membershipErrorResponse(response: NextResponse): Promise<NextResponse> {
  const body = await response.json();
  const code = body.code ?? (response.status === 401 ? "unauthorized" : response.status === 403 ? "forbidden" : response.status === 404 ? "account_not_found" : "invalid_request");
  const messages: Record<string, string> = {
    invalid_origin: "Invalid origin", json_required: "JSON content type required", unexpected_body: "Unexpected request body"
  };
  return NextResponse.json({ ...body, ok: false, code, message: body.message ?? messages[code] ?? "Request rejected" }, { status: response.status, headers: response.headers });
}
