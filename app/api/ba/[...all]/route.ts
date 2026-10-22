/**
 * SPIKE (branch spike/better-auth): Better Auth's HTTP surface, mounted at
 * /api/ba/* (AUTH_BASE_PATH in lib/betterAuth.ts).
 *
 * Why /api/ba and not Better Auth's default /api/auth: Noctua already owns
 * /api/auth/{login,logout,me,signup,switch-account}. Next.js would let those
 * static routes win over a catch-all at /api/auth/[...all], but the two auth
 * stacks would then share one prefix during the migration (Better Auth also
 * owns /api/auth/ok and /api/auth/error), and every "is this a Better Auth
 * URL?" decision (the client's 401-means-logout heuristic, rate limiting,
 * proxy checks) would need the exact route list. A separate prefix keeps the
 * boundary explicit; once Noctua's routes are gone it can move to /api/auth.
 *
 * The instance is resolved per request because the master DB, and with it
 * the Better Auth instance, opens lazily. instrumentation.ts runs the
 * migrations at startup; its instance is a different bundle's copy (Next
 * bundles instrumentation apart from the route graph, see the spike report),
 * so this route builds its own on the first request, on a migrated schema.
 */
import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/betterAuth";

export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler(async (request: Request) =>
  (await getAuth()).handler(request)
);
