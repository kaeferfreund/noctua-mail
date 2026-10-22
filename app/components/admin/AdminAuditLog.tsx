"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminAuditEntry } from "@/lib/data";
import { Button } from "@/app/components/ui/button";
import { adminRequest, errorMessage, type AdminFetch } from "@/app/hooks/useAdminApi";

export default function AdminAuditLog({ apiFetch = fetch }: { apiFetch?: AdminFetch }) {
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async (before?: string) => {
    setBusy(true); setError("");
    try {
      const data = await adminRequest<{ entries: AdminAuditEntry[]; nextCursor: string | null }>(apiFetch, `/api/admin/audit?limit=50${before === undefined ? "" : `&before=${encodeURIComponent(before)}`}`);
      setEntries(previous => before === undefined ? data.entries : [...previous, ...data.entries.filter(entry => !previous.some(old => old.id === entry.id))]);
      setNextCursor(data.nextCursor);
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }, [apiFetch]);
  useEffect(() => { void load(); }, [load]);
  return <section className="space-y-4" aria-label="Audit log"><div className="flex items-center justify-between"><h3 className="font-medium">Audit log</h3><Button variant="outline" disabled={busy} onClick={() => void load()}>Refresh audit</Button></div>
    {error && <p role="alert">{error}</p>}
    <table className="w-full text-left text-sm"><thead><tr><th>Time</th><th>Action</th><th>Actor</th><th>Target user / mailbox</th></tr></thead>
      <tbody>{entries.map(entry => <tr key={entry.id} className="border-b"><td className="py-2">{new Date(entry.createdAt).toLocaleString()}</td><td>{entry.action}</td><td>{entry.actorUserId}</td><td>{entry.targetUserId ?? "—"} / {entry.targetAccountId ?? "—"}</td></tr>)}</tbody></table>
    {!busy && !entries.length && <p>No audit entries.</p>}
    <Button variant="outline" disabled={busy || !nextCursor || !entries.length} onClick={() => void load(nextCursor ?? undefined)}>{busy ? "Loading…" : "Load older entries"}</Button>
  </section>;
}
