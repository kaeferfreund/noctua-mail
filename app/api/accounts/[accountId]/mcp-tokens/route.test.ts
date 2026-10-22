import {test,expect} from "bun:test";
import {GET,POST} from "./route";
test("MCP token endpoints stay unavailable until generation-bound activation", async()=>{
 for(const handler of [GET,POST]) {
  const response=await handler(new Request("http://localhost/api/accounts/synthetic/mcp-tokens"));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ok:false,code:"auth_integration_pending"});
 }
});
