import type { Message } from "@/lib/data";
import { buildAccountMessagePath } from "@/lib/accountApiPaths";
export type MessageResolution = { status: "ready"; message: Message } | { status: "unauthenticated" | "forbidden" | "missing" | "failed" };
/** Local IDs and legacy RFC Message-IDs share the existing membership-authorized route. */
export async function resolveDeepLinkMessage(
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  accountId: string, messageId: string, signal: AbortSignal
): Promise<MessageResolution> {
  const response = await fetcher(buildAccountMessagePath(accountId, messageId), { signal, cache: "no-store" });
  if (response.status === 401) return { status: "unauthenticated" };
  if (response.status === 403) return { status: "forbidden" };
  if (response.status === 404) return { status: "missing" };
  if (!response.ok) return { status: "failed" };
  const data = await response.json() as { message?: Message };
  return data.message?.accountId === accountId ? { status: "ready", message: data.message } : { status: "failed" };
}
