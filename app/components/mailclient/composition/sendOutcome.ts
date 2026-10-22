export type SendOutcome = {
  sentCopy?: "appended" | "failed" | "no-sent-folder";
  sentCopyWarning?: string | null;
  postSendWarning?: string | null;
};
export function getSendWarnings(
  outcome: SendOutcome | null | undefined,
): string[] {
  const warnings = [outcome?.sentCopyWarning, outcome?.postSendWarning].filter(
    (value): value is string =>
      typeof value === "string" && Boolean(value.trim()),
  );
  if (
    !outcome?.sentCopyWarning &&
    outcome?.sentCopy &&
    outcome.sentCopy !== "appended"
  )
    warnings.unshift(
      "Email sent, but the Sent copy could not be saved. Do not send it again.",
    );
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
) {
  pushNotice({
    type: "success",
    title: "Draft sent.",
    description: subject.trim().slice(0, 180) || undefined,
  });
  getSendWarnings(outcome).forEach((description) =>
    pushNotice({
      type: "warning",
      title: "Draft sent with a warning",
      description,
    }),
  );
  return { canCreateSentRow: outcome?.sentCopy === "appended" };
}
