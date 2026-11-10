"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import type { Account } from "@/lib/data";
import type { NoticeInput } from "../types";
import { summarizeMailboxSkips, type MailboxSkipReport, type ReportMailboxSkips } from "./mailboxFanOut";

/**
 * One warning per action about the messages it left out (no permission, or no
 * matching folder in their mailbox): how many, in which mailboxes, and that
 * the others were done — or that nothing could be done.
 */
export function useMailboxSkipNotice(params: {
  accountById: Map<string, Pick<Account, "email" | "name">>;
  pushNotice: (notice: NoticeInput) => void;
}): ReportMailboxSkips {
  const { accountById, pushNotice } = params;
  const tn = useTranslations("Notifications");
  return useCallback(
    (report: MailboxSkipReport) => {
      const summary = summarizeMailboxSkips(report);
      if (summary.skippedCount === 0) return;
      const action = tn(`mailboxSkip.action.${report.action}`);
      const lines = summary.reasons.map((entry) => {
        const mailboxes = entry.accountIds
          .map((accountId) => accountById.get(accountId)?.email || accountById.get(accountId)?.name || accountId)
          .join(", ");
        const values = {
          action,
          reason: entry.reason,
          mailboxes,
          mailboxCount: entry.accountIds.length,
          skipped: entry.count,
          total: summary.total
        };
        return summary.doneCount === 0 && summary.reasons.length === 1
          ? tn("mailboxSkip.all", values)
          : tn("mailboxSkip.some", values);
      });
      // Short title; the full sentence (count, mailboxes, the rest done) wraps in
      // the description, so the mailbox names are never cut off.
      const titleValues = { action, skipped: summary.skippedCount, total: summary.total };
      pushNotice({
        type: "warning",
        title: summary.doneCount === 0 ? tn("mailboxSkip.titleAll", titleValues) : tn("mailboxSkip.titleSome", titleValues),
        description: [...lines, ...(summary.doneCount > 0 ? [tn("mailboxSkip.rest", { action })] : [])].join(" "),
        wrapDescription: true
      });
    },
    [accountById, pushNotice, tn]
  );
}
