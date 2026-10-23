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
import { GET as getPrefs, PUT as putPrefs } from "../../app/api/accounts/[accountId]/prefs/route";
import { legacyUnkeyedSenders, senderPermissionLookupCases } from "../../lib/testFixtures/senderPermissions";
import { ingestedSenderCases, ingestSenderPermissionMessage } from "../../lib/testFixtures/ingestedSenders";
import { seedLegacySourceCollision } from "../../lib/testFixtures/sourceOwnership";
import { sanitizeSyncedMessage } from "../../lib/mail/syncMessageSanitizer";
import { getMessageSource } from "../../lib/storage";
import { resolveMessageAddresses } from "../../lib/mail/imap/parser";

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

test("reader and standalone enforce sender permissions, send no Referer and never request remote CSS", async () => {
  const scratch = await mkdtemp(path.join(process.cwd(), ".tmp/html-privacy-"));
  const requests: { path: string; referer: string | null }[] = [];
  const tracker = createServer((request, response) => {
    requests.push({ path: new URL(request.url!, "http://127.0.0.1:3799").pathname, referer: request.headers.referer ?? null });
    response.writeHead(200, { "Content-Type": "image/gif", "Cache-Control": "no-store" });
    response.end(Buffer.from("R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=", "base64"));
  });
  let app: Server | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    await listen(tracker, 3799);
    const remote = "http://127.0.0.1:3799";
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
    const senderMessages = await fixture.seed(...senderPermissionLookupCases.map(({ from }) =>
      fixture.message(`<${crypto.randomUUID()}@example.test>`, { ...resolveMessageAddresses(undefined, new Map([["from", [from]]]), fixture.account.email), htmlBody: html })));
    // Start these regressions with ImapFlow's envelope parser and the production
    // sync ingestion function, then read the persisted rows in both renderers.
    for (const entry of ingestedSenderCases) {
      const ingested = await ingestSenderPermissionMessage(fixture.account, entry, html);
      await fixture.seed(ingested);
      const stored = await fixture.api.getMessageById(fixture.accountId, ingested.id);
      expect(stored).toBeTruthy();
      expect(stored!.senderKey, entry.name).toBe(entry.key);
      expect(stored!.senderKey, entry.name).not.toBe("trusted@example.test");
      senderMessages.push(stored!);
    }
    const legacyStart = senderMessages.length;
    senderMessages.push(...await fixture.seed(...legacyUnkeyedSenders.map(from =>
      fixture.message(`<${crypto.randomUUID()}@example.test>`, { from, senderKey: null, htmlBody: html }))));
    const collision = await seedLegacySourceCollision(fixture, html);
    await fixture.api.upsertMessages(fixture.accountId, null, [await sanitizeSyncedMessage(collision.copy, fixture.accountId)]);
    expect(await getMessageSource(fixture.accountId, collision.base.id, { exact: true })).toBe(collision.baseSource);
    expect((await fixture.api.getMessageById(fixture.accountId, collision.base.id))?.senderKey).toBeNull();
    senderMessages.push(collision.base);
    const selectMessage = (url: URL) => url.searchParams.has("case") ? senderMessages[Number(url.searchParams.get("case"))] : message;
    const standalone = async (url: URL) => GET(new Request(`http://localhost:3000/html${url.search}`, { headers: user.jar.headers() }), {
      params: Promise.resolve({ accountId: fixture.accountId, messageId: selectMessage(url).id })
    });
    const prefsParams = { params: Promise.resolve({ accountId: fixture.accountId }) };
    // The loopback HTTP fixture authenticates synthetic requests using the real
    // session harness. Preference validation and persistence run in the routes.
    const savePrefs = (body: string) => putPrefs(new Request(`http://localhost:3000/api/accounts/${fixture.accountId}/prefs`, {
      method: "PUT", headers: user.jar.headers({ origin: "http://localhost:3000", "content-type": "application/json" }), body
    }), prefsParams);
    await promisify(execFile)(process.execPath, ["build", "tests/browser/htmlPrivacyFixture.tsx", "--outdir", scratch,
      "--target", "browser", "--define", 'process.env.NODE_ENV="production"'], { timeout: 30_000 });
    const script = await readFile(path.join(scratch, "htmlPrivacyFixture.js"));
    const respond = async (url: URL, method?: string, body?: string) => {
      if (url.pathname === "/fixture.json") {
        const selected = (await fixture.api.getMessageById(fixture.accountId, selectMessage(url).id))!;
        return Response.json({ html: selected.htmlBody, accountId: fixture.accountId, senderKey: selected.senderKey, messageId: selected.id });
      }
      if (url.pathname === `/api/accounts/${fixture.accountId}/prefs`) {
        return method === "PUT" ? savePrefs(body!) : getPrefs(new Request(`http://localhost:3000${url.pathname}`, { headers: user.jar.headers() }), prefsParams);
      }
      if (url.pathname === "/standalone") return standalone(url);
      if (url.pathname === "/htmlPrivacyFixture.js") return new Response(script, { headers: { "Content-Type": "text/javascript" } });
      if (url.pathname !== "/") return new Response("", { status: 404 });
      return new Response('<!doctype html><div id="root"></div><script type="module" src="/htmlPrivacyFixture.js"></script>', { headers: { "Content-Type": "text/html" } });
    };
    app = createServer(async (request, response) => {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const result = await respond(new URL(request.url!, "http://127.0.0.1:3798"), request.method, Buffer.concat(chunks).toString());
        response.statusCode = result.status;
        result.headers.forEach((value, key) => response.setHeader(key, value));
        response.end(Buffer.from(await result.arrayBuffer()));
      } catch (error) {
        response.writeHead(500);
        response.end(String(error));
      }
    });
    await listen(app, 3798);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const waitForReaderImages = () => page.waitForFunction(() => {
      const frame = document.querySelector<HTMLIFrameElement>('iframe[title="HTML message"]');
      const images = Array.from(frame?.contentDocument?.images ?? []);
      return images.length === 2 && images.every(img => img.complete && img.naturalWidth > 0 && img.currentSrc.startsWith("http://127.0.0.1:3799/"));
    });
    // All browser traffic is synthetic and local, including dependency mistakes.
    await page.route("**/*", route => {
      const url = new URL(route.request().url());
      return url.hostname === "127.0.0.1" && ["3798", "3799"].includes(url.port) ? route.continue() : route.abort();
    });
    await page.goto("http://127.0.0.1:3798/");
    await page.getByRole("button", { name: "Load once" }).waitFor();
    await page.waitForLoadState("networkidle");
    expect(requests).toEqual([]);
    await page.getByRole("button", { name: "Load once" }).click();
    await page.frameLocator('iframe[title="HTML message"]').locator("img").first().waitFor();
    await page.waitForLoadState("networkidle");
    expect(requests.map(request => request.path).sort()).toEqual(["/picture", "/pixel"]);
    expect(requests.every(request => request.referer === null)).toBe(true);

    expect((await savePrefs(JSON.stringify({ remoteContent: { allowedSenders: { "trusted@example.test": true, "second@example.test": true } } }))).status).toBe(200);
    for (let index = 0; index < senderMessages.length; index++) {
      requests.length = 0;
      await page.goto(`http://127.0.0.1:3798/?case=${index}`);
      await page.getByRole("button", { name: "Load once" }).waitFor();
      await page.waitForLoadState("networkidle");
      expect(requests, `reader sender case ${index}`).toEqual([]);
      if (index >= legacyStart) {
        expect(await page.getByRole("button", { name: "Always load from this sender" }).isDisabled()).toBe(true);
        await page.getByText("Sender unknown until the original message is available or resynced.").waitFor();
        await page.getByRole("button", { name: "Load once" }).click();
        await waitForReaderImages();
        expect(requests.map(request => request.path).sort()).toEqual(["/picture", "/pixel"]);
        requests.length = 0;
      }
      await page.goto(`http://127.0.0.1:3798/standalone?case=${index}`);
      await page.waitForLoadState("networkidle");
      expect(requests, `standalone sender case ${index}`).toEqual([]);
    }

    for (const name of ["quoted local part containing whitespace", "quoted local part containing an angle-bracket address", "unicode IDN", "A-label IDN", "SMTPUTF8 local", "SMTPUTF8 with IDN"]) {
      const index = senderPermissionLookupCases.findIndex(entry => entry.name === name);
      const { key } = senderPermissionLookupCases[index];
      expect((await savePrefs(JSON.stringify({ remoteContent: null }))).status).toBe(200);
      expect((await savePrefs(JSON.stringify({ remoteContent: { allowedSenders: { "trusted@example.test": true } } }))).status).toBe(200);
      requests.length = 0;
      await page.goto(`http://127.0.0.1:3798/?case=${index}`);
      await page.getByRole("button", { name: "Always load from this sender" }).waitFor();
      await page.waitForLoadState("networkidle");
      expect(requests, name).toEqual([]);
      await page.goto(`http://127.0.0.1:3798/standalone?case=${index}`);
      await page.waitForLoadState("networkidle");
      expect(requests, name).toEqual([]);
      await page.goto(`http://127.0.0.1:3798/?case=${index}`);
      await page.getByRole("button", { name: "Always load from this sender" }).click();
      await page.getByRole("button", { name: "Always load from this sender" }).waitFor({ state: "hidden" });
      await waitForReaderImages();
      expect(requests.map(request => request.path).sort(), name).toEqual(["/picture", "/pixel"]);
      expect(requests.every(request => request.referer === null), name).toBe(true);
      const saved = await getPrefs(new Request(`http://localhost:3000/api/accounts/${fixture.accountId}/prefs`, { headers: user.jar.headers() }), prefsParams);
      expect((await saved.json()).prefs.remoteContent.allowedSenders, name).toEqual({ "trusted@example.test": true, [key]: true });
      requests.length = 0;
      await page.reload();
      await waitForReaderImages();
      expect(requests.map(request => request.path).sort(), name).toEqual(["/picture", "/pixel"]);
      requests.length = 0;
      await page.goto(`http://127.0.0.1:3798/standalone?case=${index}`);
      await page.waitForLoadState("networkidle");
      expect(requests.map(request => request.path).sort(), name).toEqual(["/picture", "/pixel"]);
      expect(requests.every(request => request.referer === null), name).toBe(true);
    }
    requests.length = 0;
    await page.goto("http://127.0.0.1:3798/standalone");
    await page.waitForLoadState("networkidle");
    expect(requests).toEqual([]);
    await page.goto("http://127.0.0.1:3798/standalone?remoteContent=allow");
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
