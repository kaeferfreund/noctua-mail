"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import type { Account } from "@/lib/data";
import type { AdminFetch } from "@/app/hooks/useAdminApi";
import { DEFAULT_APP_TITLE } from "@/lib/appBranding";
import { useWindowTitle } from "@/lib/ui/windowTitle";
import { emptyDeepLink, serializeDeepLink } from "@/lib/navigation/deepLinks";
import { isOutreachEnabledFor, useOutreachStatus } from "../useOutreachStatus";
import OutreachManage from "./OutreachManage";
import { outreachPageHref, parseOutreachLocation, type OutreachLocation } from "./location";

type Me = { accounts?: Account[] };

function readLocation(): { accountId: string; location: OutreachLocation } {
  const params = new URLSearchParams(window.location.search);
  return { accountId: params.get("accountId") ?? "", location: parseOutreachLocation(params) };
}

/**
 * `/newsletter?accountId=…&section=…&id=…`: a page of its own like the calendar window, so
 * sections and items are deep-linkable and Back/Forward move between them.
 */
export default function OutreachManagePage({ fetchImpl = fetch }: { fetchImpl?: AdminFetch }) {
  const t = useTranslations("outreach");
  const status = useOutreachStatus();
  const [place, setPlace] = useState<{ accountId: string; location: OutreachLocation } | null>(null);
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  useWindowTitle(account ? `${t("title")} · ${account.email}` : `${t("title")} · ${DEFAULT_APP_TITLE}`);

  useEffect(() => {
    const sync = () => setPlace(readLocation());
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const accountId = place?.accountId ?? "";
  useEffect(() => {
    if (!accountId) return;
    let active = true;
    fetchImpl("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then(response => response.ok ? response.json() as Promise<Me> : null)
      .then(body => { if (active) setAccount(body?.accounts?.find(entry => entry.id === accountId) ?? null); })
      .catch(() => { if (active) setAccount(null); });
    return () => { active = false; };
  }, [accountId, fetchImpl]);
  const onLocationChange = useCallback((location: OutreachLocation) => {
    window.history.pushState(null, "", outreachPageHref(accountId, location));
    setPlace({ accountId, location });
  }, [accountId]);

  const mailHref = serializeDeepLink({ ...emptyDeepLink(), accountId }, "/");
  if (!place || (accountId && (account === undefined || !status.loaded))) {
    return <PageState text={t("loading")} />;
  }
  if (!accountId || !account) return <PageState text={t("page.noMailbox")} mailHref="/" />;
  if (!isOutreachEnabledFor(status, accountId)) return <PageState text={t("page.notActivated")} mailHref={mailHref} />;
  return (
    <div className="h-[var(--app-height,100dvh)] pt-[var(--sat,0px)]">
      <OutreachManage accountId={accountId} accountLabel={account.name?.trim() || account.email} role={account.accessRole ?? "viewer"}
        location={place.location} onLocationChange={onLocationChange} mailHref={mailHref} fetchImpl={fetchImpl} />
    </div>
  );
}

function PageState({ text, mailHref }: { text: string; mailHref?: string }) {
  const t = useTranslations("outreach");
  return (
    <div className="flex h-[var(--app-height,100dvh)] flex-col items-center justify-center gap-3 p-6 text-center">
      <p role="status" className="max-w-prose text-sm text-muted-foreground">{text}</p>
      {mailHref ? <a href={mailHref} className="text-sm underline">{t("nav.backToMail")}</a> : null}
    </div>
  );
}
