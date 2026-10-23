import type { UiLocale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/translator";

export type SendOutcome = {
  sentCopy?: "appended" | "failed" | "no-sent-folder";
  sentCopyWarning?: string | null;
  postSendWarning?: string | null;
};

// Server warnings are opaque text; only the sentCopy code becomes client copy.
// The calendar RSVP caller (calendar/**, owned by a parallel branch) does not
// pass the UI locale yet and keeps the previous English copy until it does.
export function getSendWarnings(
  outcome: SendOutcome | null | undefined,
  locale: UiLocale = "en",
): string[] {
  const t = getTranslator(locale);
  const warnings = [outcome?.sentCopyWarning, outcome?.postSendWarning].filter(
    (value): value is string =>
      typeof value === "string" && Boolean(value.trim()),
  );
  if (
    !outcome?.sentCopyWarning &&
    outcome?.sentCopy &&
    outcome.sentCopy !== "appended"
  )
    warnings.unshift(t("Compose.warnings.sentCopyNotSaved"));
  if (outcome?.sentCopy === "failed")
    warnings.push(t("Compose.warnings.checkSentFolder"));
  if (outcome?.sentCopy === "no-sent-folder")
    warnings.push(t("Compose.warnings.configureSentFolder"));
  return warnings;
}

export function presentDraftSendOutcome(
  outcome: SendOutcome | null,
  subject: string,
  pushNotice: (notice: {
    type: "success" | "warning";
    title: string;
    description?: string;
  }) => void,
  locale: UiLocale,
) {
  const t = getTranslator(locale);
  pushNotice({
    type: "success",
    title: t("Compose.notices.draftSent"),
    description: subject.trim().slice(0, 180) || undefined,
  });
  getSendWarnings(outcome, locale).forEach((description) =>
    pushNotice({
      type: "warning",
      title: t("Compose.notices.draftSentWithWarning"),
      description,
    }),
  );
  return { canCreateSentRow: outcome?.sentCopy === "appended" };
}
