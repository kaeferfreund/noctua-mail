import { chromium } from "/home/monkey/code/noctua-mail/wt-review-auth/node_modules/playwright-core/index.mjs";
const content = `<table style="border-radius:1rem;background:#fff;padding:2rem;max-width:37.5em;width:100%"><tr><td>
<div style="height:600px;background:#eee">tall auth0 card</div></td></tr></table>`;
const doc = (bodyStyle) => `<!doctype html><html><head><style>
body{margin:0;width:100%} .html-scale{width:100%}
.noctua-email-viewport{width:100%;overflow-x:auto;box-sizing:border-box}
.email-body{width:100%;box-sizing:border-box}</style></head><body>
<div class="html-scale"><div class="noctua-email-viewport">
<div class="noctua-email-content email-body" style="${bodyStyle}">${content}</div></div></div></body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [label, style] of [
  ["auth0 body style (height:100vh)", "height:100vh;background-color:rgb(245,245,245);padding:1rem 1rem 2.5rem"],
  ["same without height", "background-color:rgb(245,245,245);padding:1rem 1rem 2.5rem"],
  ["min-height:100vh + 8px wrapper padding", "min-height:100vh;padding:1rem"]
]) {
  const padded = label.includes("wrapper padding");
  const srcdoc = doc(style).replace('class="noctua-email-viewport"', padded ? 'class="noctua-email-viewport" style="padding:8px"' : 'class="noctua-email-viewport"');
  await page.setContent(`<iframe id=f scrolling=no style="width:700px;border:0;display:block"></iframe>`);
  const result = await page.evaluate(async (srcdoc) => {
    const f = document.getElementById("f");
    f.srcdoc = srcdoc;
    await new Promise((r) => f.addEventListener("load", r, { once: true }));
    const d = f.contentDocument; let updates = 0;
    const upd = () => requestAnimationFrame(() => { updates++; f.style.height = Math.max(1, Math.ceil(Math.max(d.body.scrollHeight, d.body.offsetHeight))) + "px"; });
    const ro = new ResizeObserver(upd); ro.observe(f); ro.observe(d.body); ro.observe(d.documentElement); upd();
    await new Promise((r) => setTimeout(r, 1500));
    const vp = d.querySelector(".noctua-email-viewport");
    return { iframeHeight: f.style.height, updates, wrapperClientHeight: vp.clientHeight, wrapperScrollHeight: vp.scrollHeight };
  }, srcdoc);
  console.log(label, JSON.stringify(result));
}
await browser.close();
