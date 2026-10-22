import type { Message } from "../../data";
export function hydrateIdentityMetadata(row: { deliveredTo?: string | null; originalTo?: string | null; senderIdentityId?: string | null }): Pick<Message, "deliveredTo" | "originalTo" | "senderIdentityId"> {
  const array = (value?: string | null): string[] | undefined => {
    if (value == null) return undefined;
    try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 32) : undefined; }
    catch { return undefined; }
  };
  return { deliveredTo: array(row.deliveredTo), originalTo: array(row.originalTo), senderIdentityId: row.senderIdentityId ?? undefined };
}
