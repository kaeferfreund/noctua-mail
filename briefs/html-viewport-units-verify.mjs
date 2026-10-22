import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "/home/monkey/code/noctua-mail/wt-review-auth/node_modules/playwright-core/index.mjs";

// Run with bun. All fixtures and asset URLs are synthetic; no server is used.
const repo = "/home/monkey/code/noctua-mail/wt-html-viewport";
const { buildPreviewDocument } = await import(`${repo}/app/components/HtmlMessage.tsx`);
const { sanitizeHtmlForDisplay } = await import(`${repo}/lib/html/index.ts`);
const baselineSource = execFileSync("git", ["show", "team-inbox:app/components/HtmlMessage.tsx"], { cwd: repo, encoding: "utf8" });
const baselineModule = `
import { extractBodyContent, stripConditionalComments } from "${repo}/lib/html/index.ts";
import { extractTrustedFontStylesheetImportsFromHtml, isTrustedFontStylesheetUrl, stripPromotedFontImports } from "${repo}/app/components/emailFontRegistry.ts";
import { APP_FONT_FACE_CSS, APP_FONT_STACK } from "${repo}/lib/ui/fonts.ts";
${baselineSource.slice(baselineSource.indexOf('const NOCTUA_EMAIL_CONTENT_CLASS'), baselineSource.indexOf('function getClosestAnchor'))}
export ${baselineSource.slice(baselineSource.indexOf('function buildPreviewDocument'), baselineSource.indexOf('\nfunction HtmlMessage('))}
`;
const temp = await mkdtemp(join(tmpdir(), "noctua-preview-baseline-"));
const baselinePath = join(temp, "baseline.ts");
await writeFile(baselinePath, baselineModule);
const { buildPreviewDocument: baselineBuilder } = await import(baselinePath);
const card = `<table align="center" width="100%" role="presentation" style="border-radius:1rem;background:#fff;padding:2rem;max-width:37.5em"><tr><td><div style="height:600px;background:#eee">Synthetic account verification card</div></td></tr></table>`;
const fixture = (style, content = card, css = "", attrs = "") => `<!doctype html><html><head><style>${css}</style></head><body ${attrs} style="${style}">${content}</body></html>`;
const baseStyle = "background:#f5f5f5;padding:1rem 1rem 2.5rem;margin:0;font-family:Arial,sans-serif";
const cases = [
  { label: "a: Auth0-like height:100vh", html: fixture(`height:100vh;${baseStyle}`) },
  { label: "b: framed min-height:100vh", html: fixture(`min-height:100vh;${baseStyle}`), framed: true },
  { label: "c: body h-screen class", html: fixture(baseStyle, card, ".h-screen{height:100vh!important}", 'class="h-screen"') },
  { label: "d: html/body 100%, widen", html: fixture("margin:0;font-family:Arial,sans-serif", `<div style="font-size:16px;line-height:24px">${"Synthetic wrapping paragraph for pane resize. ".repeat(150)}</div>`, "html,body{height:100% !important}"), widen: true },
  { label: "e: control, no viewport units", html: fixture(baseStyle) },
  { label: "f: MailChimp bodyTable ID", html: fixture(baseStyle, card, "body,#bodyTable{height:100% !important;min-height:100vh!important;max-height:150px!important}", 'id="bodyTable"') },
  { label: "g: nested viewport-length card", html: fixture(baseStyle, '<div style="min-height:50dvh;padding:2vmin">Nested synthetic card</div>') }
];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
// Keep verification independent of network/fonts, including baseline assets.
await page.route("**/*", (route) => route.abort());
const results = [];
try {
  for (const testCase of cases) {
    const row = { fixture: testCase.label };
    for (const [version, builder] of [["before", baselineBuilder], ["after", buildPreviewDocument]]) {
      const html = testCase.html;
      const srcdoc = builder({ html, safeHtml: sanitizeHtmlForDisplay(html), darkMode: false,
        fontScale: 1, zoom: 1, showViewerFrame: !!testCase.framed, hostViewportHeight: 900, token: "verify" });
      await page.setContent('<iframe id="f" scrolling="no" style="width:500px;border:0;display:block"></iframe>');
      row[version] = await page.evaluate(async ({ srcdoc, widen }) => {
        const f = document.getElementById("f");
        await new Promise((resolve) => {
          f.addEventListener("load", resolve, { once: true });
          f.srcdoc = srcdoc;
        });
        const d = f.contentDocument;
        let updates = 0;
        let rafId = null;
        const scheduleHeightUpdate = () => {
          if (rafId !== null) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
            rafId = null;
            updates++;
            const body = d.body;
            const root = d.documentElement;
            const nextHeight = body ? Math.max(body.scrollHeight, body.offsetHeight)
              : Math.max(root?.scrollHeight ?? 0, root?.offsetHeight ?? 0);
            f.style.height = `${Math.max(1, Math.ceil(nextHeight))}px`;
          });
        };
        const frameObserver = new ResizeObserver(scheduleHeightUpdate);
        const documentObserver = new ResizeObserver(scheduleHeightUpdate);
        frameObserver.observe(f);
        documentObserver.observe(d.body);
        documentObserver.observe(d.documentElement);
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const sample = () => {
          const vp = d.querySelector(".noctua-email-viewport");
          return { height: parseInt(f.style.height, 10), updates, clientHeight: vp.clientHeight, scrollHeight: vp.scrollHeight };
        };
        scheduleHeightUpdate();
        await sleep(1600);
        const initial = sample();
        await sleep(300);
        const settled = sample();
        let wide = null;
        if (widen) {
          f.style.width = "1000px";
          await sleep(1600);
          wide = sample();
          await sleep(300);
          wide.stable = wide.height === sample().height && wide.updates === sample().updates;
        }
        frameObserver.disconnect();
        documentObserver.disconnect();
        if (rafId !== null) cancelAnimationFrame(rafId);
        return { ...settled, stable: settled.height === initial.height && settled.updates === initial.updates, wide };
      }, { srcdoc, widen: !!testCase.widen });
    }
    results.push(row);
    console.log(JSON.stringify(row));
    assert.equal(row.after.stable, true, `${row.fixture} should settle`);
    assert.equal(row.after.clientHeight, row.after.scrollHeight, `${row.fixture} must not clip`);
    if (testCase.widen) {
      assert.ok(row.after.wide.height < row.after.height, "frame should shrink on widening");
      assert.equal(row.after.wide.stable, true);
    }
    if (testCase.label.startsWith("e:")) assert.equal(row.after.height, row.before.height, "control height must stay unchanged");
  }
  await writeFile(join(temp, "results.json"), JSON.stringify(results, null, 2));
  console.log(`PASS ${results.length} synthetic fixtures; results: ${join(temp, "results.json")}`);
} finally {
  await browser.close();
}
