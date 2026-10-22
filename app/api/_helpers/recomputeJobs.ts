import { requireAccountContext } from "@/app/api/_helpers/accountContext";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { requireActiveUserSession } from "@/lib/auth";

type RecomputeJob = {
  id: string;
  accountId: string;
  status: "running" | "done" | "failed";
  error?: string;
};

type RecomputeHandlerOptions = {
  accountId?: string;
};

export async function handleRecomputeStartRequest(
  request: Request,
  startJob: (accountId: string) => RecomputeJob,
  failedDefaultMessage: string,
  options?: RecomputeHandlerOptions
) {
  const auth = await requireActiveUserSession(request);
  if (auth instanceof NextResponse) return auth;
  return withAuthResponse(auth, async () => {
    const accountId = options?.accountId?.trim() || "";
    if (!accountId) {
      return NextResponse.json({ ok: false, message: "Missing accountId" }, { status: 400 });
    }
    const access = await requireAccountContext(request, accountId, { minRole: "viewer" });
    if (access instanceof NextResponse) return access;
    const job = startJob(accountId);
    if (job.status === "failed") {
      return NextResponse.json(
        { ok: false, message: job.error || failedDefaultMessage },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, jobId: job.id, status: job.status }, { status: 202 });
  });
}

export async function handleRecomputeStatusRequest(
  request: Request,
  getJob: (jobId: string) => RecomputeJob | null,
  options?: RecomputeHandlerOptions
) {
  const session = await requireActiveUserSession(request);
  if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");
    if (!jobId) {
      return NextResponse.json({ ok: false, message: "Missing jobId" }, { status: 400 });
    }
    const job = getJob(jobId);
    if (!job) {
      return NextResponse.json({ ok: false, message: "Job not found" }, { status: 404 });
    }
    const routeAccountId = options?.accountId?.trim() || "";
    if (!routeAccountId) {
      return NextResponse.json({ ok: false, message: "Missing accountId" }, { status: 400 });
    }
    const access = await requireAccountContext(request, routeAccountId, { minRole: "viewer" });
    if (access instanceof NextResponse) {
      return NextResponse.json({ ok: false, message: "Job not found" }, { status: 404 });
    }
    if (job.accountId !== routeAccountId) {
      return NextResponse.json({ ok: false, message: "Job not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, job });
  });
}
