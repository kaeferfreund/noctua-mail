import { getAuth } from "@/lib/betterAuth";
import { expireLegacyCookie } from "@/lib/authCookies";

export const runtime = "nodejs";

async function handle(request: Request) {
  const response = await (await getAuth()).handler(request);
  expireLegacyCookie(request, response.headers);
  return response;
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
