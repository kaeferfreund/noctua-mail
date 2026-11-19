"use client";

import { useEffect, useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge, Button, Text } from "@radix-ui/themes";
import { ChevronDown, Eye, MailX } from "lucide-react";
import type { AccountDateFormat, Folder, Message } from "@/lib/data";
import type { MessageTrackingSummary, TrackingEvent, TrackingEventsResponse } from "@/lib/addons/outreach/types";
import { getMessageDateDisplay } from "@/lib/dateFormatting";
import { isSentFolderRecord } from "@/lib/specialFolders";
import { ownAddressList, ownAddressMatcher, parseAddressEmails, type OwnAddressInput } from "@/lib/ownAddresses";
import type { UiLocale } from "@/lib/i18n/config";
import { isOutreachEnabledFor, outreachApiPath, useOutreachStatus } from "../useOutreachStatus";
import styles from "./Tracking.module.css";

const EVENTS_PAGE_SIZE = 50;

type Props = {
  message: Pick<Message, "accountId" | "messageId" | "from">;
  /** Folder of the message; a Sent folder marks it as sent by this mailbox. */
  folder?: Pick<Folder, "name" | "specialUse"> | null;
  /** Addresses of this mailbox; a message from one of them inside a thread was sent by it. */
  ownAddresses?: OwnAddressInput;
  isDraft: boolean;
  dateFormat?: AccountDateFormat;
};

/**
 * Status line „Geöffnet 2× · zuletzt heute, 14:03 · Berlin · Apple Mail" on a message this
 * mailbox sent. Renders nothing (and asks nothing) unless the addon is activated for the mailbox,
 * the message has a Message-ID and the server knows a tracked send for it.
 */
export default function MessageTrackingStatus({ message, folder, ownAddresses, isDraft, dateFormat }: Props) {
  const messageId = message.messageId?.trim();
  if (isDraft || !messageId || !message.accountId) return null;
  const sentByMailbox = isSentFolderRecord(folder) || ownAddressMatcher(ownAddressList(ownAddresses))(message.from);
  if (!sentByMailbox) return null;
  return <TrackingStatusLoader accountId={message.accountId} messageId={messageId} dateFormat={dateFormat} />;
}

function TrackingStatusLoader({ accountId, messageId, dateFormat }: { accountId: string; messageId: string; dateFormat?: AccountDateFormat }) {
  const status = useOutreachStatus();
  const enabled = isOutreachEnabledFor(status, accountId);
  const key = `${accountId}\n${messageId}`;
  const [loaded, setLoaded] = useState<{ key: string; tracking: MessageTrackingSummary | null } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    // One request per opened message; the line never polls.
    const controller = new AbortController();
    void fetch(outreachApiPath(accountId, `tracking?messageId=${encodeURIComponent(messageId)}`), { cache: "no-store", signal: controller.signal })
      .then(response => response.ok ? response.json() as Promise<{ ok?: boolean; tracking?: MessageTrackingSummary | null }> : null)
      .then(body => { if (!controller.signal.aborted) setLoaded({ key, tracking: body?.ok ? body.tracking ?? null : null }); })
      // The addon is optional: a failed request shows no line.
      .catch(() => {});
    return () => controller.abort();
  }, [accountId, enabled, key, messageId]);

  const tracking = enabled && loaded?.key === key ? loaded.tracking : null;
  if (!tracking) return null;
  return <TrackingStatusLine accountId={accountId} tracking={tracking} dateFormat={dateFormat} />;
}

function regionName(code: string | null, locale: string) {
  if (!code) return null;
  if (!/^[A-Za-z]{2}$/.test(code)) return code;
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

function eventLocation(event: TrackingEvent, locale: string, full: boolean) {
  const country = regionName(event.country, locale);
  if (!full) return event.city || event.region || country;
  return [...new Set([event.city, event.region, country].filter((part): part is string => Boolean(part)))].join(", ") || null;
}

function eventClient(event: TrackingEvent, full: boolean) {
  if (!full) return event.clientName || event.clientOs;
  return [event.clientName, event.clientOs].filter(Boolean).join(" / ") || null;
}

function useEventTime(dateFormat?: AccountDateFormat) {
  const t = useTranslations("outreachTracking.status");
  const locale = useLocale() as UiLocale;
  const labels = { today: t("today"), yesterday: t("yesterday") };
  return (at: number) => getMessageDateDisplay(at, "", dateFormat, locale, { labels });
}

function TrackingStatusLine({ accountId, tracking, dateFormat }: { accountId: string; tracking: MessageTrackingSummary; dateFormat?: AccountDateFormat }) {
  const t = useTranslations("outreachTracking.status");
  const locale = useLocale();
  const eventTime = useEventTime(dateFormat);
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const several = parseAddressEmails(tracking.recipients).length > 1;

  const parts: string[] = [];
  if (tracking.bounced) {
    parts.push(t("bounced"));
  } else {
    const opened = tracking.trackOpens && tracking.opens > 0;
    if (opened) parts.push(t(several ? "openedSeveral" : "opened", { count: tracking.opens }));
    if (tracking.clicks > 0) parts.push(t(several && !opened ? "clicksSeveral" : "clicks", { count: tracking.clicks }));
    if (!opened && tracking.clicks === 0) {
      if (!tracking.trackOpens) parts.push(t("noClicks"));
      else parts.push(t(tracking.machineOpens > 0 ? "notOpenedMachine" : "notOpened"));
    }
    const lastAt = tracking.lastEvent?.at ?? Math.max(tracking.lastOpenedAt ?? 0, tracking.lastClickedAt ?? 0);
    if (lastAt > 0 && (opened || tracking.clicks > 0)) parts.push(t("last", { when: eventTime(lastAt).text }));
    if (tracking.lastEvent) {
      const where = eventLocation(tracking.lastEvent, locale, false);
      const client = eventClient(tracking.lastEvent, false);
      if (where) parts.push(where);
      if (client) parts.push(client);
    }
  }
  const summary = parts.join(" · ");

  return (
    <div className={styles.status} data-outreach-tracking-status="">
      <button
        type="button"
        className={styles.statusToggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title={open ? t("hideEvents") : t("showEvents")}
        onClick={() => setOpen(value => !value)}
      >
        {tracking.bounced ? <MailX size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
        <span className={styles.statusText}>{summary}</span>
        <ChevronDown size={14} aria-hidden="true" className={open ? styles.chevronOpen : styles.chevron} />
      </button>
      {open && <TrackingEventsPanel id={panelId} accountId={accountId} sendId={tracking.sendId} dateFormat={dateFormat} />}
    </div>
  );
}

type EventsState = { events: TrackingEvent[]; nextBefore: number | null; status: "loading" | "ready" | "error" };

async function fetchEvents(accountId: string, sendId: string, before: number | null, signal?: AbortSignal) {
  const query = new URLSearchParams({ sendId, includeMachine: "1", limit: String(EVENTS_PAGE_SIZE) });
  if (before !== null) query.set("before", String(before));
  const response = await fetch(outreachApiPath(accountId, `tracking/events?${query}`), { cache: "no-store", signal });
  const body = response.ok ? await response.json() as TrackingEventsResponse : null;
  if (!body?.ok || !Array.isArray(body.events)) throw new Error("tracking events unavailable");
  return body;
}

function TrackingEventsPanel({ id, accountId, sendId, dateFormat }: { id: string; accountId: string; sendId: string; dateFormat?: AccountDateFormat }) {
  const t = useTranslations("outreachTracking.events");
  const locale = useLocale();
  const eventTime = useEventTime(dateFormat);
  const [state, setState] = useState<EventsState>({ events: [], nextBefore: null, status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    void fetchEvents(accountId, sendId, null, controller.signal)
      .then(body => setState({ events: body.events, nextBefore: body.nextBefore, status: "ready" }))
      .catch(() => { if (!controller.signal.aborted) setState(current => ({ ...current, status: "error" })); });
    return () => controller.abort();
  }, [accountId, sendId]);

  const loadOlder = () => {
    const before = state.nextBefore;
    if (before === null) return;
    setState(current => ({ ...current, status: "loading" }));
    void fetchEvents(accountId, sendId, before)
      .then(body => setState(current => ({ events: [...current.events, ...body.events], nextBefore: body.nextBefore, status: "ready" })))
      .catch(() => setState(current => ({ ...current, status: "error" })));
  };

  return (
    <div id={id} className={styles.panel} role="region" aria-label={t("title")}>
      <Text as="p" size="1" color="gray">{t("estimate")}</Text>
      {state.events.length > 0 && (
        <ul className={styles.eventList}>
          {state.events.map(event => {
            const time = eventTime(event.at);
            const where = eventLocation(event, locale, true);
            const client = eventClient(event, true);
            return (
              <li key={event.id} className={styles.event} data-tracking-event={event.type}>
                <div className={styles.eventHead}>
                  <Text size="1" weight="medium" title={time.tooltip}>{time.text}</Text>
                  <Text size="1">{t(`type.${event.type}`)}</Text>
                  {event.machine && (
                    <Badge size="1" variant="soft" color="gray" title={t("machineTitle")}>{t("machine")}</Badge>
                  )}
                </div>
                {(where || client || event.ip) && (
                  <Text as="div" size="1" color="gray" className={styles.eventMeta}>
                    {[where, client, event.ip ? t(event.ipTruncated ? "ipTruncated" : "ip", { ip: event.ip }) : null].filter(Boolean).join(" · ")}
                  </Text>
                )}
                {event.url && (
                  <Text as="div" size="1" color="gray" className={styles.eventUrl}>
                    {t(event.type === "click" ? "link" : "detail", { value: event.url })}
                  </Text>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {state.status === "loading" && <Text as="p" size="1" color="gray" role="status">{t("loading")}</Text>}
      {state.status === "error" && <Text as="p" size="1" color="red" role="alert">{t("loadFailed")}</Text>}
      {state.status === "ready" && state.events.length === 0 && <Text as="p" size="1" color="gray">{t("empty")}</Text>}
      {state.status !== "loading" && state.nextBefore !== null && (
        <div>
          <Button type="button" size="1" variant="soft" color="gray" onClick={loadOlder}>{t("more")}</Button>
        </div>
      )}
    </div>
  );
}
