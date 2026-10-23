import { test, expect } from "bun:test";
import "@/lib/testDbHarness";
import { GET, POST } from "./route";
test("MCP management requires an authenticated editor", async () => {
  for (const handler of [GET, POST]) {
    const response = await handler(new Request("http://localhost:3000/api/accounts/synthetic/mcp-tokens"), { params: Promise.resolve({ accountId: "synthetic" }) });
    expect(response.status).toBe(401);
  }
});
