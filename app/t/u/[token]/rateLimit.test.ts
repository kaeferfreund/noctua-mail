import { afterAll, beforeAll, expect, test } from "bun:test";
import "@/lib/testDbHarness";
import { newOutreachToken } from "@/lib/addons/outreach/ids";
import { getRequestIp } from "@/lib/rateLimit";
import { GET, POST } from "./route";

const previous = process.env.NOCTUA_ADDON_OUTREACH;
beforeAll(() => { process.env.NOCTUA_ADDON_OUTREACH = "1"; });
afterAll(() => {
  if (previous === undefined) delete process.env.NOCTUA_ADDON_OUTREACH; else process.env.NOCTUA_ADDON_OUTREACH = previous;
});

const token = newOutreachToken();
const url = `https://links.example.test/t/u/${token}`;
const params = { params: Promise.resolve({ token }) };
const view = (ip: string) => GET(new Request(url, { headers: { "x-forwarded-for": ip } }), params);
const submit = (ip: string) => POST(new Request(url, {
  method: "POST", headers: { "x-forwarded-for": ip, "accept-language": "de" }, body: new URLSearchParams({ "List-Unsubscribe": "One-Click" })
}), params);

test("AN: viewing and submitting have separate budgets; a campaign's one-click unsubscribes from one address all pass", async () => {
  expect(getRequestIp(new Request(url, { headers: { "x-forwarded-for": "198.51.100.7" } }))).toBe("198.51.100.7");
  // Page views from a provider's link scanner use up the view budget ...
  const views: number[] = [];
  for (let i = 0; i < 130; i++) views.push((await view("198.51.100.7")).status);
  expect(views.at(-1)).toBe(429);
  // ... and do not touch the submit budget: 500 one-click POSTs from the same address are all accepted.
  for (let i = 0; i < 500; i++) expect((await submit("198.51.100.7")).status).toBe(200);
});

test("AN: a refused submit says so and never shows the confirmation", async () => {
  let refused: Response | null = null;
  for (let i = 0; i < 5_000 && !refused; i++) {
    const response = await submit("198.51.100.8");
    if (response.status === 429) refused = response;
  }
  expect(refused).not.toBeNull();
  expect(refused!.headers.get("retry-after")).toBe("60");
  const html = await refused!.text();
  expect(html).toContain("nicht möglich");
  expect(html).not.toContain("abgemeldet");
  expect(html).toContain("<form method=\"post\">");
});
