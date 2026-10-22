"use client";

import type { ReactNode } from "react";
import { Button } from "@/app/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/app/components/ui/dialog";

export default function AdminConfirmDialog({ title, description, children, busy, error, disabled, onCancel, onConfirm }: {
  title: string; description: string; children?: ReactNode; busy: boolean; error?: string; disabled?: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  return <Dialog open onOpenChange={open => { if (!open && !busy) onCancel(); }}>
    <DialogContent showCloseButton={!busy}>
      <DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription>
      {children}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={onCancel}>Cancel</Button>
        <Button variant="destructive" disabled={busy || disabled} onClick={onConfirm}>{busy ? "Working…" : "Confirm"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
