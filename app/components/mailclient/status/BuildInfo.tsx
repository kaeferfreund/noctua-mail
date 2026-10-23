"use client";

import { useLocale, useTranslations } from "next-intl";
import type { BuildIdentity } from "@/lib/buildVersion";
import type { UiLocale } from "@/lib/i18n/config";
import { formatDate, formatTime } from "@/lib/i18n/format";

type BuildInfoProps = {
  info: BuildIdentity | null;
  className?: string;
};

/** Commit and build time of the running server, in the display zone. Renders nothing without a build. */
export default function BuildInfo({ info, className }: BuildInfoProps) {
  const t = useTranslations("Shell.status");
  const locale = useLocale() as UiLocale;
  if (!info) return null;
  const builtAt = info.builtAt ? new Date(info.builtAt) : null;
  const label = builtAt
    ? t("build", { hash: info.shortHash, date: formatDate(builtAt, locale), time: formatTime(builtAt, locale) })
    : t("buildUndated", { hash: info.shortHash });
  const title = info.builtAt
    ? t("buildTitle", { hash: info.hash, time: info.builtAt })
    : t("buildCommit", { hash: info.hash });
  return (
    <span className={className} title={title}>
      {label}
    </span>
  );
}
