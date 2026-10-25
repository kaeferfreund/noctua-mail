import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import McpTabContent from "./tabs/McpTabContent";
import type { mintMcpToken } from "@/lib/mcpAuth";
import { mcpTokenListItem } from "@/lib/mcpPermissions";
import type { NoctuaAuthClient, ProofInput } from "@/lib/authClient";

afterEach(cleanup);
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const minted: Awaited<ReturnType<typeof mintMcpToken>> = {
  token: "mcp_synthetic-one-time-secret",
  tokenRecord: { id: "synthetic-token", accountId: "synthetic-mailbox", createdByUserId: "synthetic-user", label: "Synthetic QA token", tokenSuffix: "secret", createdAt: Date.now(), expiresAt: Date.now() + 180 * 86400000, lastUsedAt: null }
};
/** Records proof requests; every proof yields a single synthetic grant for the requested purpose. */
function proofClient() {
  const proofs: ProofInput[] = [];
  const client = { reauth: async (input: ProofInput) => { proofs.push(input); return { ok: true as const, grant: "synthetic-grant", purpose: input.purpose, expiresAt: Date.now() + 300000 }; } };
  return { proofs, client: client as unknown as NoctuaAuthClient };
}
type Page = ReturnType<typeof render>;
async function verify(page: Page) {
  fireEvent.change(await page.findByLabelText("Current password"), { target: { value: "synthetic-password" } });
  fireEvent.change(page.getByLabelText("Authenticator code"), { target: { value: "123456" } });
  fireEvent.click(page.getByRole("button", { name: "Verify and continue" }));
}

describe("QA-003 MCP token client contract", () => {
  for (const days of [180, 30]) it(`uses ttlSeconds for ${days} days and renders the secret plus refreshed metadata`, async () => {
    const writes: unknown[] = [], grants: unknown[] = [];
    let reads = 0;
    const { proofs, client } = proofClient();
    const apiFetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") { writes.push(JSON.parse(String(init.body))); grants.push(new Headers(init.headers).get("x-noctua-reauth")); return response({ ok: true, ...minted }, 201); }
      reads++;
      return response({ ok: true, tokens: writes.length ? [mcpTokenListItem(minted.tokenRecord, new Set(["synthetic-mailbox"]))] : [] });
    };
    const props = { accountId: "synthetic-mailbox", isActive: true, isExistingAccount: true, apiFetch, authClient: client, onClose: () => {} };
    const page = render(<Theme><McpTabContent {...props} /></Theme>);
    await page.findByText("No MCP tokens created for this account.");
    fireEvent.change(page.getByPlaceholderText("My MCP client"), { target: { value: minted.tokenRecord.label } });
    if (days === 30) {
      fireEvent.click(page.getByRole("combobox"));
      fireEvent.click(await page.findByRole("option", { name: "30 days" }));
    }
    fireEvent.click(page.getByRole("button", { name: "Create token" }));
    // Creation waits for a fresh factor proof; nothing is sent before it.
    await page.findByText("Verify your identity");
    expect(writes).toEqual([]);
    await verify(page);
    await page.findByText(minted.token, { exact: true });
    expect(proofs).toEqual([{ purpose: "mcp.create", currentPassword: "synthetic-password", totpCode: "123456" }]);
    expect(grants).toEqual(["synthetic-grant"]);
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
  const page = render(<Theme><McpTabContent accountId="synthetic-mailbox" isActive isExistingAccount apiFetch={apiFetch} authClient={proofClient().client} onClose={() => {}} /></Theme>);
  const shared = await page.findByRole("checkbox", { name: "Synthetic shared (shared@example.test)" });
  expect((page.getByRole("checkbox", { name: "Synthetic own (own@example.test)" }) as HTMLButtonElement).disabled).toBe(true);
  expect((page.getByRole("radio", { name: "Read and create drafts (no sending)" }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(shared);
  fireEvent.click(page.getByRole("radio", { name: "Read only" }));
  fireEvent.change(page.getByPlaceholderText("My MCP client"), { target: { value: "Synthetic selected" } });
  fireEvent.click(page.getByRole("button", { name: "Create token" }));
  await verify(page);
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

it("cancelling the identity check creates no token and leaves the form editable", async () => {
  const writes: unknown[] = [];
  const { proofs, client } = proofClient();
  const apiFetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") { writes.push(init.body); return response({ ok: true, ...minted }, 201); }
    return response({ ok: true, tokens: [] });
  };
  const page = render(<Theme><McpTabContent accountId="synthetic-mailbox" isActive isExistingAccount apiFetch={apiFetch} authClient={client} onClose={() => {}} /></Theme>);
  fireEvent.change(await page.findByPlaceholderText("My MCP client"), { target: { value: "Synthetic cancelled" } });
  fireEvent.click(page.getByRole("button", { name: "Create token" }));
  await page.findByText("Verify your identity");
  fireEvent.click(page.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(page.queryByText("Verify your identity")).toBeNull());
  expect(writes).toEqual([]); expect(proofs).toEqual([]);
  expect((page.getByRole("button", { name: "Create token" }) as HTMLButtonElement).disabled).toBe(false);
});
