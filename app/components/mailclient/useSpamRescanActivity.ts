"use client";

import { useCallback, useEffect, useState } from "react";
import { adminRequest, type AdminFetch } from "@/app/hooks/useAdminApi";
import { SPAM_RESCAN_EVENT, type SpamRescanActivity } from "@/lib/mail/spam/rescanTypes";

const POLL_MS = 2_000;

/**
 * Admin INBOX rescans (doc/SPAM-DETECTION.md) for the activity panel. Read
 * once on load and whenever the admin UI announces a start, cancel or move;
 * polled only while a job runs. Non-admins never ask.
 */
export function useSpamRescanActivity(apiFetch: AdminFetch, enabled: boolean) {
  const [jobs, setJobs] = useState<SpamRescanActivity[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let timer: number | undefined;
    const refresh = async () => {
      window.clearTimeout(timer);
      let next: SpamRescanActivity[] | null;
      try { next = (await adminRequest<{ jobs: SpamRescanActivity[] }>(apiFetch, "/api/admin/spam-rescan")).jobs; } catch { next = null; }
      if (!active || !next) return;
      setJobs(next);
      if (next.length) timer = window.setTimeout(() => void refresh(), POLL_MS);
    };
    const onEvent = () => { void refresh(); };
    void refresh();
    window.addEventListener(SPAM_RESCAN_EVENT, onEvent);
    return () => { active = false; window.clearTimeout(timer); window.removeEventListener(SPAM_RESCAN_EVENT, onEvent); };
  }, [apiFetch, enabled]);
  const cancel = useCallback((job: SpamRescanActivity) => {
    void adminRequest(apiFetch, `/api/admin/accounts/${encodeURIComponent(job.accountId)}/spam-rescan/cancel`, { method: "POST" })
      .catch(() => {})
      .finally(() => window.dispatchEvent(new CustomEvent(SPAM_RESCAN_EVENT)));
  }, [apiFetch]);
  return { jobs: enabled ? jobs : [], cancel };
}
