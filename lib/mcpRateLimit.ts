import { createRateLimiter } from "./rateLimit";
import { mcpToolScope } from "./mcpPermissions";

/** One process-wide budget per token, shared across requests, tools and covered mailboxes. */
export function createMcpRateLimiter() {
  const calls = createRateLimiter({ max: 60 });
  const writes = createRateLimiter({ max: 30 });
  return (tokenId: string, tool: string) => {
    const write = mcpToolScope(tool) !== "read" || tool === "check_new_mail";
    return calls.isLimited(tokenId) || (write && writes.isLimited(tokenId));
  };
}

export const isMcpToolRateLimited = createMcpRateLimiter();

/** Most JSON-RPC messages one MCP HTTP request (a batch) may carry. */
export const MCP_MAX_BATCH_ITEMS = 32;
/** Every JSON-RPC message counts here (including protocol messages and invalid ones), before any work. */
export const MCP_MESSAGES_PER_MINUTE = 300;

export function createMcpMessageRateLimiter() {
  const messages = createRateLimiter({ max: MCP_MESSAGES_PER_MINUTE });
  return (tokenId: string) => messages.isLimited(tokenId);
}

export const isMcpMessageRateLimited = createMcpMessageRateLimiter();
