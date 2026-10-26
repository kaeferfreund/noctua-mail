import { createRateLimiter } from "./rateLimit";
import { mcpToolScope } from "./mcpPermissions";

/** One process-wide budget per token, shared across requests, tools and covered mailboxes. */
export function createMcpRateLimiter() {
  const calls = createRateLimiter({ max: 60 });
  const writes = createRateLimiter({ max: 10 });
  return (tokenId: string, tool: string) => {
    const write = mcpToolScope(tool) !== "read" || tool === "check_new_mail";
    return calls.isLimited(tokenId) || (write && writes.isLimited(tokenId));
  };
}

export const isMcpToolRateLimited = createMcpRateLimiter();
