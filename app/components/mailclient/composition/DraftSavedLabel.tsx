import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/** Keep the second-by-second draft clock out of the mail workspace. */
export default function DraftSavedLabel({ savedAt, formatRelativeTime }: {
  savedAt: number;
  formatRelativeTime: (timestamp: number | null) => string;
}) {
  const t = useTranslations("Compose");
  const [, tick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => tick(value => value + 1), 1000);
    return () => clearInterval(interval);
  }, [savedAt]);
  return t("draft.savedAgo", { time: formatRelativeTime(savedAt) });
}
