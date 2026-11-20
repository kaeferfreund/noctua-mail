"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Text } from "@radix-ui/themes";
import CalendarEventBrowser from "@/app/components/calendar/CalendarEventBrowser";
import CalendarDropOverlay from "@/app/components/calendar/CalendarDropOverlay";
import { useCalendarIcsDrop } from "@/app/components/calendar/useCalendarIcsDrop";
import { AccountDateFormatProvider } from "@/app/components/AccountDateFormatContext";
import type { Account, AccountDateFormat } from "@/lib/data";
import { formatCalendarPageTitle } from "@/lib/appBranding";
import { useWindowTitle } from "@/lib/ui/windowTitle";
import { normalizeAccountDateFormat } from "@/lib/dateFormatting";
import { useDetachedSessionGuard } from "@/app/hooks/useDetachedSessionGuard";
import styles from "./page.module.css";

function CalendarWindowContent() {
  const searchParams = useSearchParams();
  const accountId = searchParams.get("accountId") ?? "";
  const { dropProps, isDragOver, status, resetStatus } = useCalendarIcsDrop({ accountId });
  const [dateFormat, setDateFormat] = useState<AccountDateFormat | undefined>();
  const [accountEmail, setAccountEmail] = useState("");

  const tShell = useTranslations("Shell");
  // After sign-out (or another person's sign-in) the calendar of the previous person unmounts.
  const sessionEnded = useDetachedSessionGuard();

  useWindowTitle(formatCalendarPageTitle(sessionEnded ? "" : accountEmail));

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { accounts?: Account[] } | null) => {
        if (cancelled || !body?.accounts) return;
        const account = body.accounts.find((a) => a.id === accountId);
        setAccountEmail(account?.email ?? "");
        setDateFormat(
          normalizeAccountDateFormat(account?.settings?.appearance?.dateFormat)
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  if (sessionEnded) {
    return (
      <div className={styles.page}>
        <div className={styles.state}>
          <Text size="2" color="gray">{tShell("detachedSignedOut")}</Text>
        </div>
      </div>
    );
  }
  if (!accountId) {
    return (
      <div className={styles.page}>
        <div className={styles.state}>
          <Text size="2" color="red">Missing accountId parameter.</Text>
        </div>
      </div>
    );
  }

  return (
    <AccountDateFormatProvider value={dateFormat}>
      <div className={styles.page}>
        <div className={styles.detailContainer} {...dropProps}>
          <CalendarEventBrowser accountId={accountId} />
          <CalendarDropOverlay isDragOver={isDragOver} status={status} onResetStatus={resetStatus} />
        </div>
      </div>
    </AccountDateFormatProvider>
  );
}

export default function CalendarWindowPage() {
  return (
    <Suspense fallback={<div className={styles.page}><div className={styles.state}><Text size="2" color="gray">Loading…</Text></div></div>}>
      <CalendarWindowContent />
    </Suspense>
  );
}
