import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import McpTabContent from "./tabs/McpTabContent";
import type { mintMcpToken } from "@/lib/mcpAuth";
import { mcpTokenListItem } from "@/lib/mcpPermissions";

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
      return response({ ok: true, tokens: writes.length ? [mcpTokenListItem(minted.tokenRecord, new Set(["synthetic-mailbox"]))] : [] });
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
    expect(writes).toEqual([{ label: minted.tokenRecord.label, ttlSeconds: days * 86400, accountIds: ["synthetic-mailbox"], mode: "drafts" }]);
    await waitFor(() => expect(reads).toBe(2));
    expect(page.queryByText("Failed to create MCP token.")).toBeNull();
    page.rerender(<Theme><McpTabContent {...props} isActive={false} /></Theme>);
    page.rerender(<Theme><McpTabContent {...props} /></Theme>);
    await waitFor(() => expect(page.queryByText(minted.token, { exact: true })).toBeNull());
    expect(page.getByText(minted.tokenRecord.label, { exact: true })).toBeTruthy();
  });
});


it("selects own/shared mailboxes and a mode, displays both on token rows", async () => {
  const writes: unknown[] = [];
  const mailboxes = [{ id: "synthetic-mailbox", name: "Synthetic own", email: "own@example.test" },
    { id: "synthetic-shared", name: "Synthetic shared", email: "shared@example.test" }];
  const apiFetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") { writes.push(JSON.parse(String(init.body))); return response({ ok: true, ...minted }, 201); }
    return response({ ok: true, mailboxes, tokens: [mcpTokenListItem({ ...minted.tokenRecord, accountIds: mailboxes.map(item => item.id), scopes: ["read"] }, new Set(mailboxes.map(item => item.id)))] });
  };
  const page = render(<Theme><McpTabContent accountId="synthetic-mailbox" isActive isExistingAccount apiFetch={apiFetch} onClose={() => {}} /></Theme>);
  const shared = await page.findByRole("checkbox", { name: "Synthetic shared (shared@example.test)" });
  expect((page.getByRole("checkbox", { name: "Synthetic own (own@example.test)" }) as HTMLButtonElement).disabled).toBe(true);
  expect((page.getByRole("radio", { name: "Read and create drafts (no sending)" }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(shared);
  fireEvent.click(page.getByRole("radio", { name: "Read only" }));
  fireEvent.change(page.getByPlaceholderText("My MCP client"), { target: { value: "Synthetic selected" } });
  fireEvent.click(page.getByRole("button", { name: "Create token" }));
  await waitFor(() => expect(writes).toEqual([{ label: "Synthetic selected", ttlSeconds: 180 * 86400,
    accountIds: ["synthetic-mailbox", "synthetic-shared"], mode: "read" }]));
  expect(page.getByText("Mailboxes: Synthetic own (own@example.test), Synthetic shared (shared@example.test)")).toBeTruthy();
  expect(page.getAllByText("Read only").length).toBe(2);
});

it("names the full endpoint URL and marks mailbox names as user text inside their labels", async () => {
  const mailboxes = [{ id: "synthetic-mailbox", name: "Synthetic own", email: "own@example.test" }];
  const page = render(<Theme><McpTabContent accountId="synthetic-mailbox" isActive isExistingAccount apiFetch={async () => response({ ok: true, mailboxes, tokens: [] })} onClose={() => {}} /></Theme>);
  const label = (await page.findByRole("checkbox", { name: "Synthetic own (own@example.test)" })).closest("label")!;
  expect(label.querySelector("[data-user-text]")?.textContent).toBe("Synthetic own (own@example.test)");
  expect(label.style.overflowWrap).toBe("");
  const url = `${window.location.origin}/api/mcp`;
  expect(page.getByText(url).getAttribute("title")).toBe(url);
});

it("shows only accessible mailbox names plus a count, warns before revoking other mailboxes, labels invalid scopes", async () => {
  const mailboxes = [{ id: "synthetic-mailbox", name: "Synthetic own", email: "own@example.test" },
    { id: "synthetic-shared", name: "Synthetic shared", email: "shared@example.test" }];
  const base = mcpTokenListItem(minted.tokenRecord, new Set());
  const tokens = [{ ...base, id: "synthetic-multi", label: "Synthetic multi", accountIds: mailboxes.map(item => item.id), hiddenMailboxCount: 2, scopes: [] },
    { ...base, id: "synthetic-single", label: "Synthetic single", accountIds: ["synthetic-mailbox"], hiddenMailboxCount: 0, scopes: ["read", "drafts"] }];
  const deletes: string[] = [];
  const apiFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "DELETE") { deletes.push(String(input)); return response({ ok: true }); }
    return response({ ok: true, mailboxes, tokens });
  };
  const prompts: string[] = [];
  const originalConfirm = window.confirm;
  window.confirm = (message?: string) => { prompts.push(String(message)); return false; };
  try {
    const page = render(<Theme><McpTabContent accountId="synthetic-mailbox" isActive isExistingAccount apiFetch={apiFetch} onClose={() => {}} /></Theme>);
    expect(await page.findByText("Mailboxes: Synthetic own (own@example.test), Synthetic shared (shared@example.test), +2 more mailboxes")).toBeTruthy();
    expect(page.getByText("Invalid (no access)")).toBeTruthy();
    expect(page.getByText("Read and create drafts (no sending)", { selector: "span:not(label)" })).toBeTruthy();
    const [multiDelete, singleDelete] = page.getAllByRole("button", { name: "Delete" });
    fireEvent.click(multiDelete);
    fireEvent.click(singleDelete);
    expect(prompts).toEqual(["Delete this MCP token? It is revoked for every covered mailbox, including: Synthetic shared (shared@example.test), +2 more mailboxes",
      "Delete this MCP token?"]);
    expect(deletes).toEqual([]);
  } finally { window.confirm = originalConfirm; }
});
