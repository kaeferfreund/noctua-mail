"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Switch, Text } from "@radix-ui/themes";
import { isOutreachEnabledFor, useOutreachStatus } from "../useOutreachStatus";
import styles from "./Tracking.module.css";

type ComposeFormat = "text" | "html" | "markdown";

export type ComposeTracking = {
  /** The switch is shown: addon active for the sending mailbox, tracking address configured, HTML or Markdown mail. */
  offered: boolean;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  /**
   * Extra field for the immediate send request. Empty (byte-identical request) unless the switch
   * is offered for the format actually sent. „Später senden" never calls this: planned mails are
   * not tracked in this version.
   */
  sendField: (format: ComposeFormat) => { tracking?: boolean };
};

/**
 * Compose state of „Öffnungen und Klicks verfolgen". Preselected from the mailbox's
 * `trackMailDefault`; a manual choice holds for one compose session (`sessionKey`) of one mailbox.
 */
export function useComposeTracking({ accountId, format, sessionKey }: {
  accountId: string | null | undefined;
  format: ComposeFormat;
  sessionKey: string;
}): ComposeTracking {
  const status = useOutreachStatus();
  const [choice, setChoice] = useState<{ accountId: string; sessionKey: string; enabled: boolean } | null>(null);
  const active = status.trackingConfigured && isOutreachEnabledFor(status, accountId);
  const offeredFor = (value: ComposeFormat) => active && value !== "text";
  const preset = status.accounts.find(account => account.accountId === accountId)?.trackMailDefault ?? false;
  const enabled = choice && choice.accountId === accountId && choice.sessionKey === sessionKey ? choice.enabled : preset;
  return {
    offered: offeredFor(format),
    enabled,
    setEnabled: next => { if (accountId) setChoice({ accountId, sessionKey, enabled: next }); },
    sendField: value => offeredFor(value) ? { tracking: enabled } : {}
  };
}

/** The switch below the message field; renders nothing when tracking is not offered. */
export function ComposeTrackingSwitch({ tracking }: { tracking: ComposeTracking }) {
  const t = useTranslations("outreachTracking.compose");
  const hintId = useId();
  if (!tracking.offered) return null;
  return (
    <div className={styles.composeRow} data-outreach-compose-tracking="">
      <Text as="label" size="2" className={styles.composeLabel}>
        <Switch size="1" checked={tracking.enabled} onCheckedChange={tracking.setEnabled} aria-describedby={hintId} />
        {t("label")}
      </Text>
      <Text id={hintId} size="1" color="gray">{t("hint")}</Text>
    </div>
  );
}
