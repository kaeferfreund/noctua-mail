"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/app/components/ui/button";
import type { RemoteContentState } from "@/app/hooks/useRemoteContent";

/** The reader's "remote content blocked" bar (HTML and Markdown message views). */
export default function RemoteContentBanner({ remote }: { remote: RemoteContentState }) {
  const t = useTranslations("Reader");
  return (
    // Phones get one row: the text wraps beside short button labels (full accessible names).
    <div role="status" className="flex flex-wrap items-center gap-2 border-b border-border bg-muted px-3 py-2 text-sm text-muted-foreground max-md:gap-1 max-md:px-2 max-md:py-1 max-md:text-xs">
      <span className="max-md:min-w-0 max-md:flex-1">{t("remoteBlocked")}</span>
      <Button variant="outline" size="sm" aria-label={t("loadOnce")} onClick={remote.loadOnce}>
        <span className="md:hidden">{t("loadOnceShort")}</span><span className="hidden md:inline">{t("loadOnce")}</span>
      </Button>
      <Button variant="ghost" size="sm" aria-label={t("alwaysLoadSender")} disabled={!remote.canAlwaysAllow || remote.saving} onClick={() => void remote.alwaysAllow()}>
        <span className="md:hidden">{t("alwaysLoadSenderShort")}</span><span className="hidden md:inline">{t("alwaysLoadSender")}</span>
      </Button>
      {!remote.canAlwaysAllow && <span className="max-md:basis-full">{t("unknownSender")}</span>}
      {remote.error && <span role="alert" className="max-md:basis-full">{remote.error}</span>}
    </div>
  );
}
