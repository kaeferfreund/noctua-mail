"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/app/components/ui/badge";
import type { SendSummary } from "@/lib/addons/outreach/types";
import { useOutreachFormat } from "./ui";

/** Sent mails with their outcome: recipients of a campaign, or what one contact received. */
export default function SendsTable({ sends, caption, showRecipient = true }: { sends: SendSummary[]; caption: string; showRecipient?: boolean }) {
  const t = useTranslations("outreach");
  const format = useOutreachFormat();
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">{showRecipient ? t("sends.recipient") : t("sends.subject")}</th>
            <th scope="col" className="px-3 py-2 font-medium">{t("sends.state")}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{t("sends.opens")}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{t("sends.clicks")}</th>
            <th scope="col" className="px-3 py-2 font-medium max-sm:hidden">{t("sends.sentAt")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {sends.map(send => (
            <tr key={send.sendId}>
              <td className="max-w-[14rem] truncate px-3 py-2" title={showRecipient ? send.recipients : send.subject}>{showRecipient ? send.recipients : send.subject}</td>
              <td className="px-3 py-2">
                <span className="flex flex-wrap gap-1">
                  <Badge variant={send.status === "failed" ? "destructive" : send.status === "sent" ? "secondary" : "outline"} title={send.error ?? undefined}>
                    {t(`sendStatus.${send.status}`)}
                  </Badge>
                  {send.bounced ? <Badge variant="destructive">{t("sends.bounced")}</Badge> : null}
                  {send.unsubscribed ? <Badge variant="outline">{t("sends.unsubscribed")}</Badge> : null}
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{format.number(send.opens)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{format.number(send.clicks)}</td>
              <td className="px-3 py-2 whitespace-nowrap text-muted-foreground tabular-nums max-sm:hidden">{send.sentAt ? format.dateTime(send.sentAt) : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
