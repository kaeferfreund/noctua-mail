import { requireAccountContext } from "@/app/api/_helpers/accountContext";
import { getRequestClientId } from "./clientId";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { requireActiveUserSession } from "@/lib/auth";
import { getSyncJob, startSyncJob } from "@/lib/syncJobs";
import type { SyncPayload } from "@/lib/syncOperation";

type SyncHandlerOptions = {
  accountId?: string;
};

export async function handleSyncStartRequest(
  request: Request,
  options?: SyncHandlerOptions
) {
  const session = await requireActiveUserSession(request);
  if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const clientId = getRequestClientId(request);
    const body = (await request.json().catch(() => null)) as Omit<SyncPayload, "accountId"> &
      Partial<Pick<SyncPayload, "accountId">> | null;
    const accountId = options?.accountId?.trim() || "";

    if (!accountId) {
      return NextResponse.json({ ok: false, message: "Missing accountId" }, { status: 400 });
    }
    const access = await requireAccountContext(request, accountId, { minRole: "viewer" });
    if (access instanceof NextResponse) return access;

    const payload: SyncPayload = {
      accountId,
      folderId: body?.folderId,
      fullSync: body?.fullSync,
      mode: body?.mode,
      recategorizeFolder: body?.recategorizeFolder,
      resumeFromUid: body?.resumeFromUid,
      backfillUids: Array.isArray(body?.backfillUids)
        ? body.backfillUids.filter((uid): uid is number => Number.isFinite(uid) && uid > 0)
        : undefined
    };

    const job = startSyncJob(payload, clientId);
    if (job.status === "failed") {
      return NextResponse.json(
        { ok: false, message: job.error || "Failed to start sync job." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: true, jobId: job.id, status: job.status },
      { status: 202 }
    );
  });
}

export async function handleSyncStatusRequest(
  request: Request,
  options?: SyncHandlerOptions
) {
  const clientId = getRequestClientId(request);
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  const routeAccountId = options?.accountId?.trim() || "";
  const logStatus = (outcome: string, extra?: Record<string, unknown>) => {
    console.info(
      `[sync-status] ${JSON.stringify({
        outcome,
        clientId: clientId || undefined,
        routeAccountId: routeAccountId || undefined,
        jobId: jobId || undefined,
        ...extra
      })}`
    );
  };

  const session = await requireActiveUserSession(request);
  if (session instanceof NextResponse) {
    logStatus("unauthorized");
    return session;
  }
  return withAuthResponse(session, async () => {
    if (!jobId) {
      logStatus("missing-job-id");
      return NextResponse.json({ ok: false, message: "Missing jobId" }, { status: 400 });
    }
    const job = getSyncJob(jobId);
    if (!job) {
      logStatus("job-not-found");
      return NextResponse.json({ ok: false, message: "Job not found" }, { status: 404 });
    }
    if (!routeAccountId) {
      logStatus("missing-account-id");
      return NextResponse.json({ ok: false, message: "Missing accountId" }, { status: 400 });
    }
    const access = await requireAccountContext(request, routeAccountId, { minRole: "viewer" });
    if (access instanceof NextResponse) {
      logStatus("forbidden", { accountId: routeAccountId });
      return NextResponse.json({ ok: false, message: "Job not found" }, { status: 404 });
    }
    if (job.payload.accountId !== routeAccountId) {
      logStatus("account-mismatch", { accountId: job.payload.accountId });
      return NextResponse.json({ ok: false, message: "Job not found" }, { status: 404 });
    }
    logStatus("ok", {
      accountId: job.payload.accountId,
      status: job.status,
      pid: job.pid,
      progressPhase: job.progress?.phase,
      progressProcessed: job.progress?.processed,
      progressUpdatedAt: job.progress?.updatedAt,
      progressMessage: job.progress?.message
    });
    return NextResponse.json({ ok: true, job });
  });
}
