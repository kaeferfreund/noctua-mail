"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Account, AutoMarkReadMode } from "@/lib/data";
import { DEFAULT_AUTO_MARK_READ_MODE } from "@/lib/autoMarkRead";
import { formatAdminError } from "@/lib/i18n/adminMessages";
import { adminRequest, jsonMutation, type AdminFetch } from "@/app/hooks/useAdminApi";
import { notifySenderSettingsChanged } from "@/lib/ui/senderSettings";
import { Button } from "@/app/components/ui/button";
import AutoMarkReadControl from "../AutoMarkReadControl";

export default function MailboxReadingPreference({ account, apiFetch }: { account: Account; apiFetch: AdminFetch }) {
  const t = useTranslations("Settings");
  const adminT = useTranslations("Admin");
  const locale = useLocale();
  const [saved, setSaved] = useState(account.settings?.reading?.autoMarkRead ?? DEFAULT_AUTO_MARK_READ_MODE);
  const [value, setValue] = useState<AutoMarkReadMode>(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const save = async () => {
    setBusy(true); setError(null);
    try {
      await adminRequest(apiFetch, `/api/accounts/${encodeURIComponent(account.id)}/settings`, jsonMutation("PUT", {
        teamDefaults: true, settings: { reading: { autoMarkRead: value } }
      }));
      setSaved(value);
      notifySenderSettingsChanged(account.id);
    } catch (error) { setError(error); }
    finally { setBusy(false); }
  };
  return <fieldset disabled={busy} className="m-0 grid min-w-0 gap-3 rounded-md border p-3">
    <legend className="px-1 text-sm font-medium">{t("preferences.fields.autoMarkRead")}</legend>
    <AutoMarkReadControl label={t("preferences.mailboxDefault")} value={value}
      onChange={next => { if (next !== "inherit") setValue(next); }} />
    <p className="m-0 text-xs text-muted-foreground">{t("preferences.fieldHelp.autoMarkRead")}</p>
    {Boolean(error) && <p role="alert" className="text-sm text-destructive">{formatAdminError(error, adminT, locale)}</p>}
    <Button className="justify-self-end" disabled={busy || value === saved} onClick={() => void save()}>{busy ? t("common.saving") : t("preferences.saveMailboxDefault")}</Button>
  </fieldset>;
}
