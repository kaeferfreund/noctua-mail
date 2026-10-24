"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/app/components/ui/button";
import { formatAdminError } from "@/lib/i18n/adminMessages";
import { AdminApiError, adminRequest, type AdminFetch } from "@/app/hooks/useAdminApi";
import { notifyDomainIconsChanged } from "@/app/hooks/useDomainIconVersions";
import { adminActionRow } from "./adminLayout";

type DomainIconEntry = { domain: string; mailboxes: number; version: string | null; updatedAt: number | null };
type Notice = { kind: "uploaded" | "resetDone"; domain: string };

/** Same cap as the server (lib/domainIconImage.ts); checked here only to answer at once. */
const MAX_BYTES = 512 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon,.png,.jpg,.jpeg,.webp,.ico";
const ERROR_CODES = ["too_large", "unsupported_format", "invalid_image", "empty_upload", "unknown_domain", "invalid_domain", "upload_timeout"] as const;

function iconUrl(domain: string) {
  return `/api/admin/domain-icons/${encodeURIComponent(domain)}`;
}

/** The domain's current icon (upload or favicon); an empty frame when it has none. */
function DomainIconPreview({ entry, alt }: { entry: DomainIconEntry; alt: string }) {
  const src = `${iconUrl(entry.domain)}?v=${entry.version ?? "favicon"}`;
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
      {failed === src ? null : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} width={32} height={32} className="size-8 object-contain" onError={() => setFailed(src)} />
      )}
    </span>
  );
}

/** Admin-uploaded images that replace the favicon of a sidebar domain group. */
export default function AdminDomainIcons({ apiFetch = fetch }: { apiFetch?: AdminFetch }) {
  const t = useTranslations("Admin");
  const locale = useLocale();
  const [entries, setEntries] = useState<DomainIconEntry[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);

  const fetchEntries = useCallback(async () =>
    (await adminRequest<{ domains: DomainIconEntry[] }>(apiFetch, "/api/admin/domain-icons")).domains, [apiFetch]);
  useEffect(() => {
    let active = true;
    fetchEntries().then(result => { if (active) setEntries(result); })
      .catch(reason => { if (active) setError(reason); });
    return () => { active = false; };
  }, [fetchEntries]);

  const run = async (domain: string, action: () => Promise<unknown>, done: Notice["kind"]) => {
    setBusy(domain); setError(null); setNotice(null);
    try {
      await action();
      setEntries(await fetchEntries());
      notifyDomainIconsChanged();
      setNotice({ kind: done, domain });
    } catch (reason) { setError(reason); }
    finally { setBusy(null); }
  };

  const upload = (domain: string, file: File) => {
    if (file.size > MAX_BYTES) { setNotice(null); setError(new AdminApiError(413, "too_large", "")); return; }
    void run(domain, () => adminRequest(apiFetch, iconUrl(domain), {
      method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: file
    }), "uploaded");
  };
  const reset = (domain: string) => void run(domain, () => adminRequest(apiFetch, iconUrl(domain), { method: "DELETE" }), "resetDone");

  const errorText = (reason: unknown) => {
    const code = reason instanceof AdminApiError ? ERROR_CODES.find(value => value === reason.code) : undefined;
    return code ? t(`domainIcons.errors.${code}`) : formatAdminError(reason, t, locale);
  };

  return <section className="space-y-4" aria-label={t("tabs.domains")}>
    <h3 className="font-medium">{t("domainIcons.heading")}</h3>
    <p className="max-w-2xl text-sm text-muted-foreground">{t("domainIcons.help")}</p>
    {Boolean(error) && <p role="alert" className="text-destructive">{errorText(error)}</p>}
    {notice && <p role="status" className="text-sm">{t(`domainIcons.${notice.kind}`, { domain: notice.domain })}</p>}
    <input ref={fileInput} type="file" accept={ACCEPT} hidden tabIndex={-1} aria-hidden="true" data-testid="domain-icon-file"
      onChange={event => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file && target.current) upload(target.current, file);
      }} />
    {entries && !entries.length && <p className="text-sm text-muted-foreground">{t("domainIcons.empty")}</p>}
    {entries && entries.length > 0 && <ul className="m-0 max-w-2xl list-none divide-y divide-border border-y border-border p-0">
      {entries.map(entry => <li key={entry.domain} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2" data-domain={entry.domain}>
        <DomainIconPreview entry={entry} alt={t("domainIcons.iconAlt", { domain: entry.domain })} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{entry.domain}</p>
          <p className="text-xs text-muted-foreground">
            {entry.version ? t("domainIcons.custom") : t("domainIcons.favicon")} · {t("domainIcons.mailboxes", { count: entry.mailboxes })}
          </p>
        </div>
        <div className={`${adminActionRow} max-md:w-full`}>
          <Button size="sm" variant="outline" disabled={busy !== null || entry.mailboxes === 0} aria-label={t("domainIcons.uploadFor", { domain: entry.domain })}
            onClick={() => { target.current = entry.domain; fileInput.current?.click(); }}>
            {t("domainIcons.upload")}
          </Button>
          <Button size="sm" variant="outline" disabled={busy !== null || !entry.version} aria-label={t("domainIcons.resetFor", { domain: entry.domain })}
            onClick={() => reset(entry.domain)}>
            {t("domainIcons.reset")}
          </Button>
        </div>
      </li>)}
    </ul>}
  </section>;
}
