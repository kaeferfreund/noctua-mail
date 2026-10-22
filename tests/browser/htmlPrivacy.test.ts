// Run explicitly (excluded from test:ci):
// TMPDIR="$PWD/.tmp" PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64 bun test --config=bunfig.browser.toml --timeout 120000 ./tests/browser/htmlPrivacy.test.ts
import { expect, test } from "bun:test";
import { chromium } from "@playwright/test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { createAuthenticatedTestSession } from "../../lib/testAuthHarness";
import { createCollabFixture } from "../../lib/testThreadCollabHarness";
import { GET } from "../../app/api/accounts/[accountId]/messages/[messageId]/html/route";

async function listen(server: Server, port: number) {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
}

async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

test("reader opt-in and standalone HTML send no Referer and never request remote CSS", async () => {
  const scratch = await mkdtemp(path.join(process.cwd(), ".tmp/html-privacy-"));
  const requests: { path: string; referer: string | null }[] = [];
  const tracker = createServer((request, response) => {
    requests.push({ path: new URL(request.url!, "http://127.0.0.1:3825").pathname, referer: request.headers.referer ?? null });
    response.writeHead(200, { "Content-Type": "image/gif", "Cache-Control": "no-store" });
    response.end(Buffer.from("R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=", "base64"));
  });
  let app: Server | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    await listen(tracker, 3825);
    const remote = "http://127.0.0.1:3825";
    const html = `<html><head>
      <link rel="stylesheet" href="${remote}/stylesheet">
      <style>@import url("${remote}/import");
      @font-face{font-family:Sender;src:url("${remote}/font")}
      .styled{font-family:Sender;background-image:url("${remote}/background");width:100px;height:100px}
      </style></head><body>
      <p class="styled" style="background-image:url('${remote}/inline-background')">Synthetic mail</p>
      <img src="${remote}/pixel" referrerpolicy="unsafe-url">
      <picture><source srcset="${remote}/picture 1x"><img src="${remote}/fallback" referrerpolicy="origin"></picture>
      </body></html>`;
    const fixture = await createCollabFixture();
    const user = await createAuthenticatedTestSession(fixture.accountId);
    const [message] = await fixture.seed(fixture.message("<privacy-browser@example.test>", { htmlBody: html }));
    const standalone = async (query: string) => GET(new Request(`http://localhost:3000/html${query}`, { headers: user.jar.headers() }), {
      params: Promise.resolve({ accountId: fixture.accountId, messageId: message.id })
    });
    await promisify(execFile)(process.execPath, ["build", "tests/browser/htmlPrivacyFixture.tsx", "--outdir", scratch,
      "--target", "browser", "--define", 'process.env.NODE_ENV="production"'], { timeout: 30_000 });
    const script = await readFile(path.join(scratch, "htmlPrivacyFixture.js"));
    const respond = async (url: URL) => {
      if (url.pathname === "/fixture.html") return new Response(html);
      if (url.pathname === "/standalone") return standalone(url.search);
      if (url.pathname === "/htmlPrivacyFixture.js") return new Response(script, { headers: { "Content-Type": "text/javascript" } });
      if (url.pathname !== "/") return new Response("", { status: 404 });
      return new Response('<!doctype html><div id="root"></div><script type="module" src="/htmlPrivacyFixture.js"></script>', { headers: { "Content-Type": "text/html" } });
    };
    app = createServer(async (request, response) => {
      try {
        const result = await respond(new URL(request.url!, "http://127.0.0.1:3824"));
        response.statusCode = result.status;
        result.headers.forEach((value, key) => response.setHeader(key, value));
        response.end(Buffer.from(await result.arrayBuffer()));
      } catch (error) {
        response.writeHead(500);
        response.end(String(error));
      }
    });
    await listen(app, 3824);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    // All browser traffic is synthetic and local, including dependency mistakes.
    await page.route("**/*", route => {
      const url = new URL(route.request().url());
      return url.hostname === "127.0.0.1" && ["3824", "3825"].includes(url.port) ? route.continue() : route.abort();
    });
    await page.goto("http://127.0.0.1:3824/");
    await page.getByRole("button", { name: "Load once" }).waitFor();
    await page.waitForLoadState("networkidle");
    expect(requests).toEqual([]);
    await page.getByRole("button", { name: "Load once" }).click();
    await page.frameLocator('iframe[title="HTML message"]').locator("img").first().waitFor();
    await page.waitForLoadState("networkidle");
    expect(requests.map(request => request.path).sort()).toEqual(["/picture", "/pixel"]);
    expect(requests.every(request => request.referer === null)).toBe(true);
    requests.length = 0;
    await page.goto("http://127.0.0.1:3824/standalone");
    await page.waitForLoadState("networkidle");
    expect(requests).toEqual([]);
    await page.goto("http://127.0.0.1:3824/standalone?remoteContent=allow");
    await page.waitForLoadState("networkidle");
    expect(requests.map(request => request.path).sort()).toEqual(["/picture", "/pixel"]);
    expect(requests.every(request => request.referer === null)).toBe(true);
  } finally {
    await browser?.close();
    if (app?.listening) await close(app);
    if (tracker.listening) await close(tracker);
    await rm(scratch, { recursive: true, force: true });
  }
}, 120_000);
