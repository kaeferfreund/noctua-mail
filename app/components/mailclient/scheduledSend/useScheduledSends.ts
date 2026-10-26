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
  readScheduledSendRefusal,
  releaseDraftScheduleForEdit,
  scheduleDraftSend,
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
 * with „Rückgängig“, the guard that cancels a schedule before its draft is edited, and
 * the dialog that plans a saved draft without opening compose.
 */
export function useScheduledSendControls(input: {
  accountId: string | null;
  enabled: boolean;
  locale: string;
  apiFetch: ApiFetch;
  pushNotice: (notice: NoticeInput) => void;
  reportError: (message: string) => void;
  readErrorMessage: (response: Response) => Promise<string>;
  /** Loads the saved draft row (for reopening it in compose). */
  loadDraft: (draftId: string) => Promise<Message | null>;
  editDraft: (draft: Message) => void;
  sendDraft: (draft: Message) => Promise<void>;
}) {
  const t = useTranslations("Compose.schedule");
  const { accountId, enabled, locale, apiFetch, pushNotice, reportError, readErrorMessage, loadDraft, editDraft, sendDraft } = input;
  const { byDraftId, refresh, cancel, releaseForEdit } = useScheduledSends({ accountId, enabled, apiFetch });

  const unschedule = useCallback(async (schedule: ScheduledSendView, notify = true) => {
    const result = await cancel(schedule);
    if (!result.ok) reportError(result.reason === "busy" ? t("busy") : t("unscheduleFailed"));
    else if (notify) pushNotice({ type: "success", title: t("unscheduled") });
    return result.ok;
  }, [cancel, pushNotice, reportError, t]);

  /** „Rückgängig“ cancels the schedule; a draft planned from compose reopens there. */
  const announce = useCallback((schedule: ScheduledSendView, subject: string, reopenOnUndo = true) => {
    pushNotice({
      type: "success",
      title: t("scheduled", { time: formatScheduledSendTime(schedule.sendAt, locale) }),
      description: subject.trim().slice(0, 180) || undefined,
      actionKind: "undo",
      actionLabel: t("undo"),
      onAction: async () => {
        if (!await unschedule(schedule, false) || !reopenOnUndo) return;
        const draft = await loadDraft(schedule.draftId).catch(() => null);
        if (draft) editDraft(draft);
        else reportError(t("undoReopenFailed"));
      }
    });
  }, [editDraft, loadDraft, locale, pushNotice, reportError, t, unschedule]);

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

  // The saved draft „Senden planen“ was opened for from the list or the reader.
  const [scheduleTarget, setScheduleTarget] = useState<Message | null>(null);
  const openSchedule = useCallback((draft: Message) => setScheduleTarget(draft), []);
  const scheduleTargetDraft = useCallback(async (sendAt: number) => {
    const draft = scheduleTarget;
    if (!draft || !accountId || draft.accountId !== accountId) return false;
    const result = await scheduleDraftSend(apiFetch, accountId, draft.id, sendAt);
    if (!result.ok) {
      const refusal = result.response ? await readScheduledSendRefusal(result.response) : null;
      reportError(refusal === "scheduled_send_invite" ? t("inviteUnsupported")
        : (result.response && await readErrorMessage(result.response)) || t("failed"));
      return false;
    }
    void refresh();
    announce(result.value, draft.subject ?? "", false);
    return true;
  }, [accountId, announce, apiFetch, readErrorMessage, refresh, reportError, scheduleTarget, t]);
  const scheduleDialog = {
    open: Boolean(enabled && scheduleTarget && scheduleTarget.accountId === accountId),
    onOpenChange: (open: boolean) => { if (!open) setScheduleTarget(null); },
    onSchedule: scheduleTargetDraft
  };

  /** Compose was refused because the schedule is sending or already sent the draft. */
  const onScheduledSendConflict = useCallback(() => { void refresh(); }, [refresh]);

  const controls = useMemo<ScheduledSendControls>(() => ({
    byDraftId,
    unschedule: async (schedule) => { await unschedule(schedule); },
    sendNow: async (message) => { await sendDraft(message); await refresh(); },
    schedule: enabled ? openSchedule : undefined
  }), [byDraftId, enabled, openSchedule, refresh, sendDraft, unschedule]);

  return { controls, scheduleDialog, refresh, onScheduledSend, onDetachedScheduled, releaseBeforeEdit, onScheduledSendConflict };
}
