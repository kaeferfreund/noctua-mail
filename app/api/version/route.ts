import { NextResponse } from "next/server";
import { getRunningBuild } from "@/lib/buildVersionFile";

/**
 * GET /api/version — returns the current build version label. Polled by
 * `useReminderNotifications.ts` so the client can prompt a reload when a
 * new build ships. `force-dynamic` + `no-store` because we *want* stale
 * clients to see the new label immediately after a deploy.
 *
 * The label comes from the same per-process read of the build artifact as
 * the page's own label (lib/buildVersionFile.ts), so both always agree.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      buildVersionLabel: getRunningBuild().label
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}
