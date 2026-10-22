import { getAuth } from "@/lib/betterAuth";

export const runtime = "nodejs";

async function pendingIntegration() {
  // Repeat the idempotent startup plan in Next's separate route module graph.
  await getAuth();
  // team-auth slice 6: enable only after the policy/lifecycle/reset controls land.
  return Response.json({ code: "auth_integration_pending" }, { status: 503 });
}

export { pendingIntegration as GET, pendingIntegration as POST, pendingIntegration as PATCH,
  pendingIntegration as PUT, pendingIntegration as DELETE };
