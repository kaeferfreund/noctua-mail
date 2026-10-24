"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { formatAdminError } from "@/lib/i18n/adminMessages";
import { adminRequest, jsonMutation, type AdminFetch } from "@/app/hooks/useAdminApi";
import { adminActionRow } from "./adminLayout";

type SpamAdminResponse = {
  settings: { enabled?: boolean; model?: string; threshold?: number };
  effective: { enabled: boolean; provider: string; model: string; threshold: number; modelUnavailable: "missing-key" | "unsupported-provider" | null };
};

/** Global spam detection switch, model and threshold (doc/SPAM-DETECTION.md). */
export default function AdminSpamSettings({ apiFetch = fetch }: { apiFetch?: AdminFetch }) {
  const t = useTranslations("Admin");
  const locale = useLocale();
  const [data, setData] = useState<SpamAdminResponse | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [model, setModel] = useState("");
  const [threshold, setThreshold] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const apply = (result: SpamAdminResponse) => {
    setData(result);
    setEnabled(result.effective.enabled);
    setModel(result.settings.model ?? "");
    setThreshold(String(result.effective.threshold));
  };
  useEffect(() => {
    let active = true;
    adminRequest<SpamAdminResponse>(apiFetch, "/api/admin/spam-settings").then((result) => { if (active) apply(result); })
      .catch((reason) => { if (active) setError(reason); });
    return () => { active = false; };
  }, [apiFetch]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setSaved(false); setError(null);
    try {
      const value = Number(threshold.trim().replace(",", "."));
      apply(await adminRequest<SpamAdminResponse>(apiFetch, "/api/admin/spam-settings", jsonMutation("PUT", { enabled, model: model.trim() || null, threshold: value })));
      setSaved(true);
    } catch (reason) { setError(reason); }
    finally { setBusy(false); }
  };

  return <section className="space-y-4" aria-label={t("tabs.spam")}>
    <h3 className="font-medium">{t("spam.heading")}</h3>
    <p className="max-w-2xl text-sm text-muted-foreground">{t("spam.help")}</p>
    {Boolean(error) && <p role="alert" className="text-destructive">{formatAdminError(error, t, locale)}</p>}
    {data && <form onSubmit={(event) => void save(event)} className="grid max-w-lg gap-3">
      <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />{t("spam.enabled")}</label>
      <p className="text-sm text-muted-foreground">{t("spam.provider", { provider: data.effective.provider })}</p>
      {data.effective.modelUnavailable && <p className="text-sm font-medium" role="status">{t("spam.unavailable", { reason: t(`spam.unavailableReasons.${data.effective.modelUnavailable}`) })}</p>}
      <label className="grid gap-1">{t("spam.model")}<Input value={model} placeholder={data.effective.model} onChange={(event) => setModel(event.target.value)} /></label>
      <label className="grid gap-1">{t("spam.threshold")}<Input inputMode="decimal" value={threshold} onChange={(event) => setThreshold(event.target.value)} />
        <span className="text-sm text-muted-foreground">{t("spam.thresholdHelp")}</span></label>
      <div className={adminActionRow}><Button disabled={busy}>{t("spam.save")}</Button>{saved && <span role="status" className="text-sm">{t("spam.saved")}</span>}</div>
    </form>}
  </section>;
}
