import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { getBuildVersionLabel } from "@/lib/buildVersion";
import { getBuildVersionFilePath } from "@/lib/buildVersionFile";

/**
 * GET /api/version — returns the current build version label. Polled by
 * `useReminderNotifications.ts` so the client can prompt a reload when a
 * new build ships. `force-dynamic` + `no-store` because we *want* stale
 * clients to see the new label immediately after a deploy.
 *
 * The build-version file is read once per process and memoized: it is
 * written at build time, so a deploy always restarts the process and the
 * first poll after the restart reads the new file. A file changed without
 * a process restart is not picked up.
 */

export const dynamic = "force-dynamic";

type BuildVersionPayload = {
  ok: boolean;
  buildVersionLabel: string;
};

const readBuildVersionFile = async (): Promise<BuildVersionPayload | null> => {
  try {
    const filePath = getBuildVersionFilePath();
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<BuildVersionPayload> | null;
    if (!parsed || typeof parsed.buildVersionLabel !== "string") return null;
    return {
      ok: true,
      buildVersionLabel: parsed.buildVersionLabel
    };
  } catch {
    return null;
  }
};

let buildVersionPayloadPromise: Promise<BuildVersionPayload | null> | null = null;

export function loadBuildVersionPayload(
  reader: () => Promise<BuildVersionPayload | null> = readBuildVersionFile
) {
  buildVersionPayloadPromise ??= reader();
  return buildVersionPayloadPromise;
}

export function resetBuildVersionPayloadCacheForTests() {
  buildVersionPayloadPromise = null;
}

export async function GET() {
  const buildVersionPayload = await loadBuildVersionPayload();
  const buildVersionLabel = buildVersionPayload?.buildVersionLabel ?? getBuildVersionLabel();
  return NextResponse.json(
    {
      ok: true,
      buildVersionLabel
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}
