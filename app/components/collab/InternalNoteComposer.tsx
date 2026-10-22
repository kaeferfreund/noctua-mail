"use client";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/textarea";
export default function InternalNoteComposer({
  onSubmit,
  disabled,
}: {
  onSubmit: (body: string) => Promise<boolean>;
  disabled?: boolean;
}) {
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="flex min-w-0 flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!body.trim() || pending) return;
        setPending(true);
        setError("");
        try {
          if (await onSubmit(body.trim())) setBody("");
          else setError("Could not add note. Your text has been kept.");
        } catch {
          setError("Could not add note. Your text has been kept.");
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="text-sm font-medium" htmlFor="internal-note">
        Internal note · Markdown supported
      </label>
      <Textarea
        id="internal-note"
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={20000}
        disabled={disabled || pending}
        rows={3}
        placeholder="Only mailbox members can see this note."
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        type="submit"
        size="sm"
        className="self-start"
        disabled={disabled || pending || !body.trim()}
      >
        {pending ? "Adding note…" : "Add note"}
      </Button>
    </form>
  );
}
