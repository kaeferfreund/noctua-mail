import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AccountRole, Message } from "@/lib/data";
import { isOutreachEnabledForAccount } from "../settings";
import { registerOutreachContactTools } from "./contacts";
import { registerOutreachMediaTools } from "./media";
import { registerOutreachSendingTools } from "./sending";
import { registerOutreachTrackingTools } from "./tracking";

/** `tokenLabel` / `tokenSuffix`: the calling MCP token as it is now, recorded with scheduled work (`../via.ts`). */
export type OutreachMcpAccount = { accountId: string; role: AccountRole; userId: string; tokenId: string; tokenLabel: string; tokenSuffix: string };

/** What the core MCP server hands to the addon; the addon never reaches into lib/mcpServer.ts. */
export type OutreachMcpCore = {
  server: McpServer;
  /** Live token and mailbox-role check, exactly as every core tool does it. Omitted accountId = the token's own mailbox. */
  resolveAccount(accountId: string | undefined, minRole?: AccountRole): Promise<OutreachMcpAccount>;
  /** A mailbox message by row id or by a pasted Noctua link. */
  resolveMessage(args: { accountId?: string; messageId?: string; url?: string }): Promise<{ accountId: string; message: Message }>;
  result(summary: string, structuredContent: Record<string, unknown>): { content: Array<{ type: "text"; text: string }>; structuredContent: Record<string, unknown> };
  /** Absolute link that opens the mailbox in Noctua Mail. */
  appUrl(accountId: string): string;
};

export type OutreachMcpHost = OutreachMcpCore & {
  /** `resolveAccount` plus: the addon is activated for that mailbox. Use this in every tool. */
  outreachAccount(accountId: string | undefined, minRole?: AccountRole): Promise<OutreachMcpAccount>;
};

/**
 * Registers the addon's tools on the core MCP server. Called only when the addon flag is on.
 * Every tool name must be classified in ../mcpScopes.ts; tools/list fails otherwise.
 */
export function registerOutreachMcpTools(core: OutreachMcpCore) {
  const host: OutreachMcpHost = {
    ...core,
    outreachAccount: async (accountId, minRole) => {
      const account = await core.resolveAccount(accountId, minRole);
      if (!(await isOutreachEnabledForAccount(account.accountId))) throw new Error("The newsletter addon is not activated for this mailbox.");
      return account;
    }
  };
  registerOutreachTrackingTools(host);
  registerOutreachContactTools(host);
  registerOutreachSendingTools(host);
  registerOutreachMediaTools(host);
}
