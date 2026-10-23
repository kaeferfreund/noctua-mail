"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/textarea";
export default function InternalNoteComposer({
  onSubmit,
  disabled,
  body,
  onBodyChange,
  onSaved,
}: {
  onSubmit: (body: string) => Promise<boolean>;
  disabled?: boolean;
  body: string;
  onBodyChange: (body: string) => void;
  onSaved: (submittedBody: string) => void;
}) {
  const t = useTranslations("Collaboration");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  return (
    <form
      className="flex min-w-0 flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!body.trim() || pending) return;
        setPending(true);
        setError(false);
        try {
          if (await onSubmit(body.trim())) onSaved(body);
          else setError(true);
        } catch {
          setError(true);
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="text-sm font-medium" htmlFor="internal-note">
        {t("note.label")}</label>
      <Textarea
        id="internal-note"
        autoFocus
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
        style={{ maxHeight: "min(10rem, 25dvh)", overflowY: "auto" }}
        maxLength={20000}
        disabled={disabled || pending}
        rows={3}
        placeholder={t("note.placeholder")}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t("note.saveFailed")}
        </p>
      )}
      <Button
        type="submit"
        size="sm"
        className="self-start"
        disabled={disabled || pending || !body.trim()}
      >
        {pending ? t("note.adding") : t("note.add")}
      </Button>
    </form>
  );
}
