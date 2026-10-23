import type { Message } from "@/lib/data";
import { expect, it, mock } from "bun:test";
import { resolveDeepLinkMessage } from "./resolveMessage";
import { messageDeepLink } from "./deepLinks";

it("distinguishes auth, denied, deleted and temporary failures on the authorized account path", async () => {
  for (const [code, status] of [[401, "unauthenticated"], [403, "forbidden"], [404, "missing"], [503, "failed"]] as const) {
    const fetcher = mock(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("", { status: code }));
    const signal = new AbortController().signal;
    expect(await resolveDeepLinkMessage(fetcher, "account/a", "imap-id", signal)).toEqual({ status });
    expect(fetcher.mock.calls).toEqual([["/api/accounts/account%2Fa/messages/imap-id", { cache: "no-store", signal }]]);
  }
});
it("accepts a resolved local identity only in its requested mailbox, including legacy-id resolution", async () => {
  const message = { id: "imap-stable", accountId: "a", folderId: "a:INBOX" } as Message;
  expect(await resolveDeepLinkMessage(async () => Response.json({ message }), "a", "<legacy@example.test>", new AbortController().signal)).toEqual({ status: "ready", message });
  expect(await resolveDeepLinkMessage(async () => Response.json({ message }), "b", "imap-stable", new AbortController().signal)).toEqual({ status: "failed" });
  const copied = new URL(messageDeepLink(message, "http://localhost:4000"));
  expect(copied.searchParams.get("accountId")).toBe("a"); expect(copied.searchParams.get("openMessageId")).toBe("imap-stable");
  expect(copied.searchParams.get("folderId")).toBe("a:INBOX");
});
it("keeps network failures separate from absence and passes cancellation through", async () => {
  const signal = new AbortController().signal;
  await expect(resolveDeepLinkMessage(async () => { throw new TypeError("offline"); }, "a", "imap-id", signal)).rejects.toThrow("offline");
});
