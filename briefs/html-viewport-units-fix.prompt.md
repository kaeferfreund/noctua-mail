# Fix: HTML mails with viewport-height units render in a 150 px frame

## Where to work
- Worktree: `/home/monkey/code/noctua-mail/wt-html-viewport` (branch `fix/html-viewport-units`, based on `team-inbox` 20be988; deps already installed with `bun install --frozen-lockfile`).
- Work ONLY in this worktree. Do not touch any other checkout under `/home/monkey/code/noctua-mail/` (other agents are working there), except reading `/home/monkey/code/noctua-mail/briefs/html-viewport-units-repro.mjs` and using `playwright-core` from `/home/monkey/code/noctua-mail/wt-review-auth/node_modules/playwright-core` (import by absolute path; do NOT add Playwright or any other dependency to this worktree).
- You may commit on `fix/html-viewport-units`. Do NOT push, merge into other branches, open PRs, deploy, change credentials, or run destructive git (reset --hard, force, branch deletes, bare `git stash`).
- No dev server is needed. If you start one anyway, use ports 3790/3791 only and stop it when done.

## Symptom
An Auth0 "Verify your email" mail (React Email template) shows in the reading pane as a ~150 px high strip: logo + top of the icon are visible, the rest is clipped. The rest of the pane stays empty.

The relevant part of that mail (synthetic equivalent, do not use real addresses/tickets in fixtures):
```html
<!DOCTYPE html><html dir="ltr" lang="en"><head>
<style>@media(min-width:640px){.sm_table-cell{display:table-cell !important}.sm_w-1_5{width:20% !important}}</style>
</head>
<div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Verify your account</div>
<body style="margin-left:auto;margin-right:auto;margin-top:auto;margin-bottom:auto;height:100vh;background-color:rgb(245,245,245);padding-left:1rem;padding-right:1rem;padding-bottom:2.5rem;padding-top:1rem;font-family:ui-sans-serif, system-ui, sans-serif">
  <table align="center" width="100%" role="presentation" style="border-radius:1rem;background-color:rgb(255,255,255);padding:2rem;max-width:37.5em"> … ~600 px of content … </table>
</body></html>
```

## Root cause (already confirmed in headless Chromium)
`app/components/HtmlMessage.tsx` renders the mail in an auto-height iframe (`scrolling="no"`, height set from `body.scrollHeight/offsetHeight` in `scheduleHeightUpdate`). `buildPreviewDocument` copies the mail's `<body>` style/class/id onto `<div class="noctua-email-content">`, which sits inside `.noctua-email-viewport` (`overflow-x: auto` ⇒ `overflow-y` computes to `auto`, i.e. a clipping scroll container; introduced by d4b6af4 "Let fixed-width emails scroll horizontally").

Inside an iframe, `vh` resolves against the iframe's own height, which we derive from the content height — circular:
1. `height:100vh` on the body → wrapper = iframe height = 150 px (the default iframe height) → `body.scrollHeight` = 150 → frame stays 150 px forever; the ~690 px of content is clipped inside the wrapper.
2. `min-height:100vh` plus any extra outer box (e.g. the 8 px `.noctua-email-viewport--default-margin` padding when `shouldShowHtmlViewerFrame` is true) → runaway growth: each update adds the padding, the frame grows without bound (measured: 2142 px after 1.5 s, 90 updates, still growing).

Repro numbers from `/home/monkey/code/noctua-mail/briefs/html-viewport-units-repro.mjs` (run with `bun <file>`):
- body `height:100vh` → iframe 150 px, wrapper scrollHeight 686
- same without `height` → iframe 726 px (correct)
- `min-height:100vh` + 8 px wrapper padding → 2142 px and growing

## Required fix (recommended design — deviate only with a stated reason)
1. **Viewport-height units must not depend on the frame.** In the preview document, rewrite CSS lengths whose unit resolves against the viewport height/block axis — `vh svh lvh dvh vb svb lvb dvb` and `vmin/vmax` (+ `s/l/d` variants) — inside inline `style="…"` attribute values AND inside `<style>` blocks only (never in text content or other attributes). Map `N<unit>` → `calc(N * var(--noctua-vh))`; `vmin` → `calc(N * min(var(--noctua-vh), 1vw))`, `vmax` → `max(...)`. Define `--noctua-vh` on `:root` in `buildPreviewDocument` as a fixed px value = 1 % of the host window's `innerHeight` captured when the document is built (pass it in as a parameter; sensible fallback when unavailable). Width units (`vw`, `vi`) stay untouched — the frame width does not depend on content. Must handle decimals, `.5vh`, negative values, uppercase units, values inside `calc()`, `!important`; must not match inside identifiers/URLs (e.g. `url(a100vh.png)`, class names).
   Put the pure rewrite in `lib/html/` (new module, re-exported via `lib/html/index.ts` like the others) with unit tests.
2. **The frame's own boxes never take a height from the mail.** In a real browser `<body>` height never clips content (body overflow is visible and propagates to the viewport), but our wrapper clips. So:
   - strip `height`, `min-height`, `max-height` declarations from the copied body style (`bodyAttrs.style`) before building `contentMarkup` (handles inline `!important`);
   - add high-specificity `!important` rules so `html`, `body` and `.noctua-email-content` stay `height:auto; min-height:0; max-height:none` even when the mail's `<style>` blocks target `body`/`html` or put a height class (e.g. Tailwind `.h-screen{height:100vh}`) on the body, which we copy onto the wrapper. Note email CSS like MailChimp's `body,#bodyTable{height:100% !important}` — your selector must win over a plain `body` selector with `!important`.
   - This also removes the existing "ratchet" risk where `html,body{height:100%}` pins `body.offsetHeight` to the frame height so the frame never shrinks after the pane widens.
3. Leave the measurement strategy in `scheduleHeightUpdate` as is unless the browser verification proves a remaining loop; if you change it, explain why.
4. Out of scope (mention in the report, do not implement): height/orientation/aspect-ratio media queries in mail CSS, which also evaluate against the frame.

Match the surrounding code style: short comments that explain *why* (see existing comments in `buildPreviewDocument`), no new dependencies.

## Tests / verification (all must pass, report the numbers)
- Unit tests for the rewrite helper (bun test) and for `buildPreviewDocument` output (export it or move the pure builder to a testable module; keep `HtmlMessage` behaviour otherwise unchanged): body height stripped, style-block and inline `vh` rewritten, `--noctua-vh` defined, text content containing "100vh" untouched.
- Real-browser verification with `playwright-core` (absolute import path above, headless Chromium is installed in `~/.cache/ms-playwright`). Keep the script outside the repo (e.g. `/tmp/noctua-html-viewport-verify/`) and copy it to `/home/monkey/code/noctua-mail/briefs/html-viewport-units-verify.mjs` at the end. Feed the REAL `buildPreviewDocument` output (bun can import the TS) into an iframe in a host page that reproduces `scheduleHeightUpdate`'s sizing loop (ResizeObserver on iframe/body/documentElement, rAF, same formula), and report the settled iframe height + number of updates over ≥1.5 s for synthetic fixtures:
  a) Auth0-like body `height:100vh` (frame must reach full content height, wrapper not clipping: `clientHeight === scrollHeight` on `.noctua-email-viewport`);
  b) body `min-height:100vh` with the framed viewer (`showViewerFrame` true → 8 px padding) — must settle, no runaway;
  c) style-block `.h-screen{height:100vh}` class on `<body>`;
  d) `html,body{height:100%}` in a `<style>` block — frame must shrink when the host iframe is widened (e.g. 500 px → 1000 px width);
  e) a control mail without viewport units — height identical before/after the change (run the same fixture against `git stash`-free baseline by building with the original function from `team-inbox`, e.g. via `git show team-inbox:app/components/HtmlMessage.tsx` into a temp file, or by comparing to the known natural height).
- `bun check` (type check), `bunx eslint` on the changed files, `bun run test:ci`, `bun run build`.

## Deliverable
Commit(s) on `fix/html-viewport-units` (conventional style used in this repo, e.g. `fix(html): …`). Final report: what changed (files + one line each), test/lint/build results with counts, the browser verification table (before/after heights, update counts), commit SHA(s), and any residual risks or open questions.
