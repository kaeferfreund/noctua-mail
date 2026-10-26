"use client";

import { useCallback, useEffect, useState } from "react";
import { adminRequest, type AdminFetch } from "@/app/hooks/useAdminApi";
import { SPAM_RESCAN_EVENT, type SpamRescanActivity } from "@/lib/mail/spam/rescanTypes";

const POLL_MS = 2_000;
const MAX_POLL_FAILURES = 3;

/**
 * Admin INBOX rescans (doc/SPAM-DETECTION.md) for the activity panel. One read on mount restores activity after a reload; an open panel polls
 * even while idle, so jobs started by another admin appear there. Events
 * refresh this tab immediately; running jobs keep polling with the panel closed.
 * Non-admins never ask.
 */
export function useSpamRescanActivity(apiFetch: AdminFetch, enabled: boolean, panelOpen: boolean) {
  const [jobs, setJobs] = useState<SpamRescanActivity[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let running = false;
    let failures = 0;
    let timer: number | undefined;
    const refresh = async () => {
      window.clearTimeout(timer);
      let next: SpamRescanActivity[] | null;
      try { next = (await adminRequest<{ jobs: SpamRescanActivity[] }>(apiFetch, "/api/admin/spam-rescan")).jobs; } catch { next = null; }
      if (!active) return;
      if (next) { failures = 0; running = next.length > 0; setJobs(next); }
      else if (++failures >= MAX_POLL_FAILURES) running = false;
      if (failures < MAX_POLL_FAILURES && (panelOpen || running)) timer = window.setTimeout(() => void refresh(), POLL_MS);
    };
    const onEvent = () => { void refresh(); };
    void refresh();
    window.addEventListener(SPAM_RESCAN_EVENT, onEvent);
    return () => { active = false; window.clearTimeout(timer); window.removeEventListener(SPAM_RESCAN_EVENT, onEvent); };
  }, [apiFetch, enabled, panelOpen]);
  const cancel = useCallback((job: SpamRescanActivity) => {
    void adminRequest(apiFetch, `/api/admin/accounts/${encodeURIComponent(job.accountId)}/spam-rescan/cancel`, { method: "POST" })
      .catch(() => {})
      .finally(() => window.dispatchEvent(new CustomEvent(SPAM_RESCAN_EVENT)));
  }, [apiFetch]);
  return { jobs: enabled ? jobs : [], cancel };
}
