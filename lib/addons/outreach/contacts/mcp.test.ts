import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import "@/lib/testDbHarness";
import { registerOutreachContactTools } from "../mcp/contacts";

test("MCP exposes seven contact tools with usable schemas and resolves the mailbox role on writes", async () => {
  const server = new McpServer({ name: "Synthetic outreach", version: "1" });
  const accountId = crypto.randomUUID();
  const roles: unknown[] = [];
  const resolveAccount = async (_accountId: string | undefined, minRole?: "viewer" | "editor" | "manager") => {
    roles.push(minRole);
    return { accountId, role: "editor" as const, userId: "user-1", tokenId: "token-1", tokenLabel: "Synthetic", tokenSuffix: "a1b2" };
  };
  registerOutreachContactTools({
    server, resolveAccount, outreachAccount: resolveAccount,
    resolveMessage: async () => { throw new Error("Unused in contact tools"); },
    result: (summary, structuredContent) => ({ content: [{ type: "text", text: summary }], structuredContent }),
    appUrl: () => "https://mail.example.test"
  });
  const client = new Client({ name: "Synthetic client", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const { tools } = await client.listTools();
    expect(tools.map(tool => tool.name).sort()).toEqual([
      "get_contact", "list_contact_lists", "save_contact_list", "search_contacts", "subscribe_contact", "unsubscribe_contact", "upsert_contact"
    ]);
    expect(tools.find(tool => tool.name === "save_contact_list")?.inputSchema.properties).toHaveProperty("name");
    const saved = await client.callTool({ name: "save_contact_list", arguments: { name: "Synthetic list" } });
    expect(saved.structuredContent).toMatchObject({ ok: true, list: { accountId, name: "Synthetic list" } });
    const created = await client.callTool({ name: "upsert_contact", arguments: { email: "MCP@EXAMPLE.TEST", properties: { tier: "test" } } });
    expect(created.structuredContent).toMatchObject({ ok: true, created: true, contact: { email: "mcp@example.test" } });
    const query = await client.callTool({ name: "search_contacts", arguments: { q: "mcp" } });
    expect(query.structuredContent).toMatchObject({ ok: true, page: 1, pageSize: 25, total: 1 });
    expect(roles).toEqual(["editor", "editor", undefined]);
  } finally {
    await client.close();
    await server.close();
  }
});
