"use client";
import { useEffect, useState } from "react";
import type { InAppNotice } from "../InAppNoticeStack";
import {
  acknowledgeDetachedComposeWarning,
  DETACHED_COMPOSE_EVENT_STORAGE_KEY,
  DETACHED_COMPOSE_WARNING_PREFIX,
  readDetachedComposeWarnings,
  type DetachedComposeEvent,
} from "@/lib/ui/detachedComposeHandoff";

export function useDetachedSendWarnings(
  accounts: { id: string; name?: string; email?: string }[],
  ownerUserId: string | null | undefined,
) {
  const [receiptEntry, setReceiptEntry] = useState<{ ownerUserId: string | null | undefined; receipts: DetachedComposeEvent[] } | null>(null);
  const accountIdsKey = JSON.stringify(accounts.map(account => account.id).sort());
  // Filter during render as well: logout/access changes must hide old state
  // immediately, before the subscription effect reloads storage.
  const receipts = receiptEntry?.ownerUserId === ownerUserId
    ? receiptEntry?.receipts.filter(receipt => accounts.some(account => account.id === receipt.accountId)) ?? []
    : [];
  useEffect(() => {
    const reload = () => setReceiptEntry({ ownerUserId, receipts: readDetachedComposeWarnings(ownerUserId, JSON.parse(accountIdsKey)) });
    const onStorage = (event: StorageEvent) => {
      if (event.key === DETACHED_COMPOSE_EVENT_STORAGE_KEY || event.key?.startsWith(DETACHED_COMPOSE_WARNING_PREFIX)) reload();
    };
    reload();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [ownerUserId, accountIdsKey]);
  return {
    notices: receipts.map((receipt): InAppNotice => {
      const account = accounts.find(item => item.id === receipt.accountId);
      return {
        id: `${DETACHED_COMPOSE_WARNING_PREFIX}${receipt.eventId}`,
        type: "warning",
        title: `Email sent · ${account?.name || account?.email || receipt.accountId}`,
        description: [...(receipt.warnings ?? []), "Delivery succeeded. Do not send it again."].join(" "),
        expiresAt: null,
        wrapDescription: true,
      };
    }),
    dismiss: (id: string) => {
      if (!id.startsWith(DETACHED_COMPOSE_WARNING_PREFIX)) return false;
      acknowledgeDetachedComposeWarning(id.slice(DETACHED_COMPOSE_WARNING_PREFIX.length));
      setReceiptEntry(previous => previous ? { ...previous, receipts: previous.receipts.filter(receipt => `${DETACHED_COMPOSE_WARNING_PREFIX}${receipt.eventId}` !== id) } : null);
      return true;
    },
  };
}
