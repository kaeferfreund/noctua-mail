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

export function useDetachedSendWarnings(accounts: { id: string; name?: string; email?: string }[]) {
  const [receipts, setReceipts] = useState<DetachedComposeEvent[]>([]);
  useEffect(() => {
    const reload = () => setReceipts(readDetachedComposeWarnings());
    const onStorage = (event: StorageEvent) => {
      if (event.key === DETACHED_COMPOSE_EVENT_STORAGE_KEY || event.key?.startsWith(DETACHED_COMPOSE_WARNING_PREFIX)) reload();
    };
    reload();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return {
    notices: receipts.map((receipt): InAppNotice => {
      const account = accounts.find(item => item.id === receipt.accountId);
      return {
        id: `${DETACHED_COMPOSE_WARNING_PREFIX}${receipt.eventId}`,
        type: "warning",
        title: `Email sent · ${account?.name || account?.email || receipt.accountId}`,
        description: [...(receipt.warnings ?? []), "Delivery succeeded. Do not send it again."].join(" "),
        expiresAt: null,
      };
    }),
    dismiss: (id: string) => {
      if (!id.startsWith(DETACHED_COMPOSE_WARNING_PREFIX)) return false;
      acknowledgeDetachedComposeWarning(id.slice(DETACHED_COMPOSE_WARNING_PREFIX.length));
      setReceipts(previous => previous.filter(receipt => `${DETACHED_COMPOSE_WARNING_PREFIX}${receipt.eventId}` !== id));
      return true;
    },
  };
}
