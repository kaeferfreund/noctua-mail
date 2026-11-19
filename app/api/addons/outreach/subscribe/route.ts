import { NextResponse } from "next/server";
import { authenticateSubscribeToken, subscribeWithApiToken } from "@/lib/addons/outreach/contacts/apiTokens";
import { ContactError, parseContactInput, subscribeInput } from "@/lib/addons/outreach/contacts/input";
import { createRateLimiter, getRequestIp } from "@/lib/rateLimit";
import { outreachAddonEnabled } from "@/lib/addons/outreach/config";
import { contactErrorResponse, readContactJson } from "../accounts/[accountId]/contacts/_http";

const tokenLimiter = createRateLimiter({ max: 120 });
const ipLimiter = createRateLimiter({ max: 600 });

export async function POST(request: Request) {
  try {
    if (!outreachAddonEnabled()) throw new ContactError("Not found", 404);
    if (ipLimiter.isLimited(getRequestIp(request))) throw new ContactError("Too many requests", 429);
    const token = await authenticateSubscribeToken(request.headers.get("authorization"));
    if (tokenLimiter.isLimited(token.id)) throw new ContactError("Too many requests", 429);
    const input = parseContactInput(subscribeInput, await readContactJson(request));
    return NextResponse.json(await subscribeWithApiToken(token, input), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return contactErrorResponse(error);
  }
}
