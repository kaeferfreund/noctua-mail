import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import McpTabContent from "./tabs/McpTabContent";
import type { mintMcpToken } from "@/lib/mcpAuth";

afterEach(cleanup);
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const minted: Awaited<ReturnType<typeof mintMcpToken>> = {
  token: "mcp_synthetic-one-time-secret",
  tokenRecord: { id: "synthetic-token", accountId: "synthetic-mailbox", createdByUserId: "synthetic-user", label: "Synthetic QA token", tokenSuffix: "secret", createdAt: Date.now(), expiresAt: Date.now() + 180 * 86400000, lastUsedAt: null }
};
describe("QA-003 MCP token client contract", () => {
  for (const days of [180, 30]) it(`uses ttlSeconds for ${days} days and renders the secret plus refreshed metadata`, async () => {
    const writes: unknown[] = [];
    let reads = 0;
    const apiFetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") { writes.push(JSON.parse(String(init.body))); return response({ ok: true, ...minted }, 201); }
      reads++;
      return response({ ok: true, tokens: writes.length ? [minted.tokenRecord] : [] });
    };
    const props = { accountId: "synthetic-mailbox", isActive: true, isExistingAccount: true, apiFetch, onClose: () => {} };
    const page = render(<Theme><McpTabContent {...props} /></Theme>);
    await page.findByText("No MCP tokens created for this account.");
    fireEvent.change(page.getByPlaceholderText("My MCP client"), { target: { value: minted.tokenRecord.label } });
    if (days === 30) {
      fireEvent.click(page.getByRole("combobox"));
      fireEvent.click(await page.findByRole("option", { name: "30 days" }));
    }
    fireEvent.click(page.getByRole("button", { name: "Create token" }));
    await page.findByText(minted.token, { exact: true });
    await page.findByText(minted.tokenRecord.label, { exact: true });
    expect(writes).toEqual([{ label: minted.tokenRecord.label, ttlSeconds: days * 86400 }]);
    await waitFor(() => expect(reads).toBe(2));
    expect(page.queryByText("Failed to create MCP token.")).toBeNull();
    page.rerender(<Theme><McpTabContent {...props} isActive={false} /></Theme>);
    page.rerender(<Theme><McpTabContent {...props} /></Theme>);
    await waitFor(() => expect(page.queryByText(minted.token, { exact: true })).toBeNull());
    expect(page.getByText(minted.tokenRecord.label, { exact: true })).toBeTruthy();
  });
});
