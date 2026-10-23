"use client";

import { useTranslations } from "next-intl";
import { Spinner, Theme } from "@radix-ui/themes";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";

export default function LazyDialogLoading({ kind = "admin", mailboxDialog = false }: {
  kind?: "admin" | "settings";
  /** Legacy callers pass a label; the semantic kind/mailboxDialog now selects copy. */
  label?: string;
  mailboxDialog?: boolean;
}) {
  const t = useTranslations("Shell");
  const label = mailboxDialog ? t("loading.mailbox") : t(kind);

  if (mailboxDialog) return (
    <Dialog open>
      <DialogContent className="sm:max-w-3xl" aria-describedby={undefined} showCloseButton={false}>
        <DialogTitle>{label}</DialogTitle>
        <Theme asChild>
          <div
            className="grid h-[75dvh] max-h-[75dvh] place-items-center"
            role="status"
            aria-label={label}
            aria-busy="true"
          >
            <Spinner size="3" />
          </div>
        </Theme>
      </DialogContent>
    </Dialog>
  );
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40"
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <Spinner size="3" />
    </div>
  );
}
