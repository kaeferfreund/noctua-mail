"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Message } from "@/lib/data";
import type { ScheduledSendView } from "@/lib/scheduledSendView";
import { formatScheduledSendTime } from "@/lib/scheduleSendTime";
import type { NoticeInput } from "../types";
import type { ScheduledSendControls } from "./ScheduledSend";
import {
  cancelDraftSchedule,
  listScheduledDraftSends,
  releaseDraftScheduleForEdit,
  type ScheduleReleaseResult
} from "./scheduledSendClient";

type ApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
/** While a schedule is open the list is re-read this often, so a sent draft loses its badge. */
export const SCHEDULED_SEND_REFRESH_MS = 30_000;
const NO_ROWS: ScheduledSendView[] = [];

/**
 * Schedules of the active mailbox for the drafts badge and the opened-draft bar. Only
 * members who may send (editor+) load them, matching the routes' role check.
 */
export function useScheduledSends({ accountId, enabled, apiFetch }: { accountId: string | null; enabled: boolean; apiFetch: ApiFetch }) {
  const [state, setState] = useState<{ accountId: string | null; rows: ScheduledSendView[] }>({ accountId: null, rows: [] });
  const generation = useRef(0);

  /** Re-reads the mailbox's schedules; resolves with the fresh rows (null when the read failed or was superseded). */
  const refresh = useCallback(async (): Promise<ScheduledSendView[] | null> => {
    const current = ++generation.current;
    if (!accountId || !enabled) return [];
    const result = await listScheduledDraftSends(apiFetch, accountId);
    if (current !== generation.current) return null;
    // A failed read keeps the last known rows of this mailbox instead of hiding badges.
    setState(previous => result.ok ? { accountId, rows: result.value } : previous.accountId === accountId ? previous : { accountId, rows: [] });
    return result.ok ? result.value : null;
  }, [accountId, apiFetch, enabled]);

  useEffect(() => { void refresh(); }, [refresh]);

  const rows = useMemo(() => (enabled && state.accountId === accountId ? state.rows : NO_ROWS), [accountId, enabled, state]);
  const hasOpen = rows.some(row => row.status === "queued" || row.status === "sending");
  useEffect(() => {
    if (!hasOpen) return;
    const timer = setInterval(() => { void refresh(); }, SCHEDULED_SEND_REFRESH_MS);
    return () => clearInterval(timer);
  }, [hasOpen, refresh]);

  const byDraftId = useMemo(() => new Map(rows.map(row => [row.draftId, row])), [rows]);

  /** Cancels (a 404 only counts as gone after a fresh read of the draft) and re-reads the list. */
  const cancel = useCallback(async (schedule: ScheduledSendView): Promise<ScheduleReleaseResult> => {
    if (!accountId) return { ok: false, reason: "failed" };
    const result = await cancelDraftSchedule(apiFetch, accountId, schedule);
    await refresh();
    return result;
  }, [accountId, apiFetch, refresh]);

  /** Fresh server read for one draft, then cancel: covers schedules of other tabs and members. */
  const releaseForEdit = useCallback(async (draftId: string): Promise<ScheduleReleaseResult> => {
    if (!accountId || !enabled) return { ok: true };
    const result = await releaseDraftScheduleForEdit(apiFetch, accountId, draftId);
    await refresh();
    return result;
  }, [accountId, apiFetch, enabled, refresh]);

  return { byDraftId, refresh, cancel, releaseForEdit };
}

/**
 * MailClient's side of „Senden planen“: provider controls for the badge/bar, the toast
 * with „Rückgängig“, and the guard that cancels a schedule before its draft is edited.
 */
export function useScheduledSendControls(input: {
  accountId: string | null;
  enabled: boolean;
  locale: string;
  apiFetch: ApiFetch;
  pushNotice: (notice: NoticeInput) => void;
  reportError: (message: string) => void;
  /** Loads the saved draft row (for reopening it in compose). */
  loadDraft: (draftId: string) => Promise<Message | null>;
  editDraft: (draft: Message) => void;
  sendDraft: (draft: Message) => Promise<void>;
}) {
  const t = useTranslations("Compose.schedule");
  const { accountId, enabled, locale, apiFetch, pushNotice, reportError, loadDraft, editDraft, sendDraft } = input;
  const { byDraftId, refresh, cancel, releaseForEdit } = useScheduledSends({ accountId, enabled, apiFetch });

  const unschedule = useCallback(async (schedule: ScheduledSendView, notify = true) => {
    const result = await cancel(schedule);
    if (!result.ok) reportError(result.reason === "busy" ? t("busy") : t("unscheduleFailed"));
    else if (notify) pushNotice({ type: "success", title: t("unscheduled") });
    return result.ok;
  }, [cancel, pushNotice, reportError, t]);

  const announce = useCallback((schedule: ScheduledSendView, subject: string) => {
    pushNotice({
      type: "success",
      title: t("scheduled", { time: formatScheduledSendTime(schedule.sendAt, locale) }),
      description: subject.trim().slice(0, 180) || undefined,
      actionKind: "undo",
      actionLabel: t("undo"),
      onAction: async () => {
        if (!await unschedule(schedule, false)) return;
        const draft = await loadDraft(schedule.draftId);
        if (draft) editDraft(draft);
      }
    });
  }, [editDraft, loadDraft, locale, pushNotice, t, unschedule]);

  /** Compose (inline/modal) planned a send. */
  const onScheduledSend = useCallback(({ scheduledSend, subject }: { scheduledSend: ScheduledSendView; subject: string }) => {
    void refresh();
    announce(scheduledSend, subject);
  }, [announce, refresh]);

  /** A detached compose window planned a send and closed. */
  const onDetachedScheduled = useCallback(async (draftId: string) => {
    const schedule = (await refresh())?.find(row => row.draftId === draftId);
    if (schedule) announce(schedule, "");
  }, [announce, refresh]);

  /** „Bearbeiten hebt die Planung auf“: resolves false when the draft must not open (sending now). */
  const releaseBeforeEdit = useCallback(async (draftId: string) => {
    const result = await releaseForEdit(draftId);
    if (!result.ok) reportError(result.reason === "busy" ? t("busy") : t("unscheduleFailed"));
    return result.ok;
  }, [releaseForEdit, reportError, t]);

  /** Compose was refused because the schedule is sending or already sent the draft. */
  const onScheduledSendConflict = useCallback(() => { void refresh(); }, [refresh]);

  const controls = useMemo<ScheduledSendControls>(() => ({
    byDraftId,
    unschedule: async (schedule) => { await unschedule(schedule); },
    sendNow: async (message) => { await sendDraft(message); await refresh(); }
  }), [byDraftId, refresh, sendDraft, unschedule]);

  return { controls, refresh, onScheduledSend, onDetachedScheduled, releaseBeforeEdit, onScheduledSendConflict };
}
