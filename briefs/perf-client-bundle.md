# Client bundle performance brief

## Summary

Studied **chore/deps-update, 0beb9a6**, in `/home/monkey/code/noctua-mail/wt-deps`, 2026-10-22. Existing Next **16.2.4** Turbopack production output; React **19.2.5** actually installed, Bun **1.4.4**. No source/config changes, Next rebuild, app server, mailbox access, or remote sync. Sizes below use **decimal KB (1,000 bytes)**; gzip is level 6, separately compressed per HTTP asset. Proposed implementation savings are estimates unless explicitly marked measured.

The main route currently requires **2,413.5 KB raw / 722.1 KB gzip JS** in 23 chunks, plus **935.4 / 125.4 KB CSS**. Its one full Inter font adds **352.2 KB** (351.8 KB gzip). Thus JS + CSS + font alone is **3,701.1 KB raw / 1,199.3 KB gzip**, before HTML/RSC, APIs, icons, headers, and runtime config. This is a cold-cache asset budget, not measured LCP, CPU time, or a HAR.

Top five worthwhile changes, with implementation details and overlap tags below:

1. **Subset Inter with Unicode-range fallbacks:** scratch-generated Latin font **105.5 KB**, down from **352.2 KB**; **246.7 KB fewer font bytes** on Latin-only initial content (**246.2 KB gzip difference**). Preserve other scripts and both variable axes. No protected-area overlap.
2. **Defer Markdown conversion and the Markdown viewer together:** estimated **65–105 KB gzip JS** from an observed **109.5 KB gzip** three-chunk candidate pool. The existing editor dynamic import already works; synchronous compose conversion and the message viewer keep the parser stack eager. Medium risk; core changes can avoid the protected message directories.
3. **Load settings only when opened:** estimated **15–20 KB gzip JS**, grounded by **16.8 KB gzip / 75.2 KB minified** for its own 16 modules with imports externalized. Preserve the existing conditional mount. Small MailClient overlap.
4. **Use an existing Lucide attachment file icon plus extension label:** estimated **8–10 KB gzip JS**. An isolated production bundle of react-file-icon + its dependencies measures **10.1 KB gzip / 27.2 KB raw**. Shared AttachmentsList is outside the protected message directories.
5. **Reuse the accounts already returned by /auth/me and stop repeated bootstrap:** source predicts **four requests avoided (six → two)** on initial account selection, including **one sequential /accounts stage**. Illustrative **80–150 ms** for the removed stage if that is its measured latency; no runtime timing was taken. Fix in useAccountController, outside the protected areas.

Do not add these numbers as a guaranteed combined improvement: new lazy boundaries can change chunk allocation, compression, and sharing. Expected JS reduction for items 2–4 together is roughly **88–135 KB gzip**, subject to a follow-up build. Font gains depend on which Unicode ranges the initial content needs.

## Measurements

### Route first load

| Route | JS chunks | JS raw KB | JS gzip KB | CSS raw KB | CSS gzip KB |
|---|---:|---:|---:|---:|---:|
| `/` | 23 | 2413.5 | 722.1 | 935.4 | 125.4 |
| `/compose/window` | 17 | 1613.8 | 491.1 | 902.6 | 120.4 |
| `/message/window` | 18 | 1552.9 | 469.0 | 893.0 | 118.0 |
| `/calendar/window` | 16 | 1201.4 | 360.6 | 880.8 | 115.3 |
| `/login` | — | — | — | — | — |

**There is no /login page.** LoginOverlay is statically reachable from MailClient on `/`, so unauthenticated visitors still download the same main-route JS. `/api/auth/login` is an API, not a UI route. The not-found shell is **587.6 / 173.7 KB JS**; this also equals the eight chunks common to every measured page. Existing build diagnostic raw totals exactly match the sums calculated here.

The legacy polyfill asset `03~yq9q893hmn.js` is **112.6 / 40.0 KB**, listed separately as polyfillFiles, not in route firstLoadChunkPaths. It is excluded from the modern-browser totals. HTML/RSC response bytes and additional interaction-triggered chunks are also excluded. Build chunk presence measures download/parse budget; it does not prove every function executes during startup.

### Largest eager mail-route chunks

| Chunk under .next/static/chunks | Raw KB | Gzip KB | Dominant contents |
|---|---:|---:|---|
| `01ul507.~l5op.js` | 513.9 | 141.5 | Main application aggregate: MailClient, shell, settings tabs, controllers/dialogs; not a single vendor package |
| `16dc82ir_5-fh.js` | 323.1 | 97.6 | HTML display stack: sanitize-html/htmlparser2/entities, parse5 8, Node-style buffer/CSS-parser helpers |
| `0ldsqb0408gaj.js` | 182.6 | 59.2 | Markdown raw-HTML pipeline: parse5 7, hast-util-raw/from-parse5/to-html; separate from display parser |
| `0~ylq_3mir9oe.js` | 153.6 | 44.1 | unified/remark/GFM/micromark/mdast/property-information shared Markdown core |
| `0r2rbjqeed35a.js` | 120.0 | 39.0 | Message/calendar presentation, cn, selected Lucide icons |
| `168bzixo8dntj.js` | 112.2 | 34.3 | Application/compose utilities, Turndown and shared controllers |
| `0pof3pnal_d1r.js` | 95.5 | 30.2 | Radix menu primitives, AttachmentsList + react-file-icon/colord, selected icons |
| `0f2a.v.30~1z7.js` | 74.8 | 23.2 | Radix Select/ScrollArea and scroll-lock utilities |
| `0-2~3usm75doz.js` | 57.2 | 17.0 | rrule 2.8.1 plus small recurrence glue |

Package descriptions are estimates at the module-factory level, validated against source imports, retained strings, and installed dependency versions. Turbopack combines many source modules into one factory: assigning that factory's entire size to the package with the most matching strings would overstate its package share. In particular the 323.1 KB chunk is a **mixed HTML stack**, not 323 KB of parse5. Duplicate-looking parser chunks on detached routes have the same 323,137-byte length but different module IDs/compression: compose **97.1 KB**, message **96.8 KB**, calendar **97.3 KB gzip**. Opening those windows incurs route-specific bytes beyond cached shared chunks.

The compose window also has a **153.6 / 43.8 KB** Markdown-core chunk (`00szjw5sl3fhr.js`); the message window's **120.0 / 39.1 KB** `09jhc_8ihhsbp.js` is message/calendar presentation. Calendar's remaining route-specific chunks contain its browser/detail UI; the actual FullCalendar implementation is async.

### Eight globally shared JS chunks

| Chunk | Raw KB | Gzip KB | Dominant contents |
|---|---:|---:|---|
| `030lje4w49skv.js` | 226.5 | 71.6 | React DOM production renderer + Next client infrastructure |
| `0l3.ucd0pn_42.js` | 143.2 | 39.0 | Next App Router/RSC/runtime support |
| `0q3lky3fy0.w..js` | 59.5 | 21.0 | Radix Themes/primitives + Floating UI positioning |
| `12lp94j-.c_mt.js` | 58.0 | 13.9 | Next layout/router/error boundaries |
| `010dttxrcgqi5.js` | 52.2 | 10.8 | Next/React server-component support |
| `0_gd_jv2h5p51.js` | 23.9 | 8.0 | Next client utilities |
| `06_26ih5kpcin.js` | 13.7 | 5.3 | Theme/next-themes/Next Script glue |
| `turbopack-09p7q1ry7n-u2.js` | 10.6 | 4.2 | Turbopack runtime |
| **Total** | **587.6** | **173.7** | Shared framework/theme baseline |

### Existing lazy chunks

| Trigger / chunk | Raw KB | Gzip KB | Root first-load list? |
|---|---:|---:|---|
| Markdown compose editor, `0p2q-2c2p5pqq.js` | 875.9 | 305.4 | No |
| HTML compose editor, `09vw8b6_9nutc.js` | 411.5 | 126.7 | No |
| Calendar grid, `0ppyefdteyhz8.js` | 264.8 | 77.9 | No |

These are whole async groups: UIW includes preview/rehype/Prism grammars and editor internals; Lexical includes core, @lexical packages, editor UI and custom nodes; FullCalendar includes core/react/plugins/Preact. They are not package-exclusive measurements. Their loadable manifests also reference CSS of respectively **34.1 / 6.0 KB**, **15.0 / 3.3 KB**, **4.6 / 1.2 KB**. The 15.0 KB Lexical-linked stylesheet is already in the root eager CSS set, so it is not an additional cold download there. Some compose/editor CSS is present eagerly, as discussed below.

### CSS

Global `02s-7fs-sm1-h.css`: **804,065 bytes raw / 101,957 gzip**. Its `@layer radix` alone is **685,403 / 82,013 bytes**: **85.2% of global CSS raw bytes**, approximately **73.3% of all root-route CSS raw bytes**. Layer gzip values are independently compressed attribution estimates, not additive portions of the actual gzip stream.

| Global CSS category | Raw KB | Standalone gzip KB |
|---|---:|---:|
| Radix Themes layer | 685.4 | 82.0 |
| Tailwind utilities, including emitted animation utilities | 85.9 | 12.7 |
| Tailwind theme + properties + scoped base | 5.4 | 1.7 |
| Application legacy layer | 17.9 | 4.2 |
| Unlayered tokens/font/properties/keyframes and remaining rules | 9.5 | 1.7 |

There are **131.3 KB raw / 23.4 KB gzip** of additional eager root-route CSS chunks. CSS modules and editor vendor styles are mixed: `07w2n~7ra7c-u.css` is **42.4 / 7.4 KB**, containing UIW editor/preview CSS plus compose and list modules; other module chunks are **30.1/4.3**, **29.0/5.1**, **15.0/3.3**, **12.2/2.7**, **2.7/0.7 KB**. Consequently **131 KB is not all CSS modules**. The Lexical JS boundary works even though ComposeEditor and QuotedMessageNode module selectors appear in an eager stylesheet.

Installed Radix source styles.css is **812.7 / 87.9 KB** at gzip level 6, versus the earlier architecture brief's 88.2 KB with different compression. Its public partial files are tokens.css **177.4 / 35.8 KB**, components.css **431.9 / 32.1 KB**, utilities.css **252.4 / 20.6 KB**. These overlap/deduplicate during processing and are not additive.

[Radix documents](https://www.radix-ui.com/themes/docs/overview/styling) importing tokens.css, components.css, and utilities.css separately for cascade control. Keeping all three provides **no intrinsic unused-component elimination**. An isolated PostCSS/Tailwind run on the same globals.css measured:

| Scratch-only processing experiment | Raw KB | Gzip KB | Versus its control |
|---|---:|---:|---|
| Original full styles import | 803.1 | 101.8 | Control |
| All three documented partial imports | 803.4 | 102.4 | **+0.55 KB gzip** |
| Without tw-animate-css | 796.7 | 101.0 | **−0.88 KB gzip** |

The isolated control differs from the built global asset by 0.9 KB raw; use within-experiment deltas, not as a rebuilt route prediction. Dropping utilities.css is unsafe: remaining Flex/Text/etc. use responsive rt-r-* spacing/alignment utilities. Dropping components.css breaks retained Themes controls. The documented layout-only split does not style retained Button/Dialog/etc. Package exports do permit tokens/base.css and tokens/colors/*.css, but **all 26 TOPIC_COLORS** are valid persisted user choices, not just literal color props found by grep. Broad color pruning would break them. Granular component source CSS under src/ is not a documented stable public import surface. Keep Themes for this phase; the architecture plan's removal is separate.

### Fonts, images, and icons

| Asset / mechanism | Current bytes / behavior |
|---|---|
| `public/fonts/InterVariable.woff2` | **352,240 bytes**; 2,937 glyphs / 2,852 mapped Unicode code points; full upright Inter 4.1, unmodified upstream binary |
| Scratch Latin subset | **105,528 bytes**; preserves wght 100–900 and opsz 14–32, all layout features |
| Font loading | CSS @font-face, font-display:swap, no unicode-range; no next/font or font preload; next-font-manifest has no entries |
| Message iframe font | lib/ui/fonts.ts injects the same URL; browser caching can reuse its download |
| Shell logo | `/icons/logo.svg` generated from public/icons/base.svg (**7,447 bytes**, plus optional environment ribbon); normal img at 28×28 |
| Favicons/PWA | app/icon.tsx and app/apple-icon.tsx generate metadata icons; PWA manifest points to /icons/badged/{192,512,32}. Fetch timing depends on browser/install state |
| Public PNG examples | favicon/icon-32 **3,697 B**; icon-180 **23,357 B**; icon-192 **24,804 B**; icon-512 **71,204 B**; not all are first-paint downloads |
| Other startup assets | public/sw.js **9,442 B**; /runtime-config.js loaded beforeInteractive, generated by start script, absent in current public/ output before start |

All application UI icons are inline SVG React components, not individual image downloads. There are **121 distinct non-type Lucide import names** in production source versus **2,171 installed icon modules**. AST inspection finds **94 actual Lucide icon-data objects** on the main route (**20.0 KB raw / 5.5 KB gzip** of data only, excluding wrappers/shared runtime). Compose/message/calendar routes have **18/61/25** respectively. Thus Lucide is being tree-shaken; the entire icon library is not shipped. No next/image imports were found, so images.formats/cache/size tuning cannot improve these first-paint assets.

## Per-package findings

- **Lexical + @lexical/**: dynamic site is ComposeMessageField → ComposeEditor, with ssr:false. The only other ComposeEditor import is type-only. No runtime Lexical edge exists in the root static source graph. The **126.7 KB gzip** group is absent from every first-load route list. Keep this boundary; do not claim a new 127 KB win by adding it again.
- **FullCalendar**: CalendarEventBrowser itself is imported statically from CalendarSidebarPanel/CalendarPopover, but dynamically imports CalendarView with ssr:false. Only CalendarView runtime-imports @fullcalendar/react/daygrid/timegrid/interaction/rrule. CalendarEventBrowser's FullCalendar ref import is type-only. The **77.9 KB gzip** group is deferred, including on /calendar/window until its client view mounts. **rrule is still eager (17.0 KB gzip)** through lib/calendar, reminderRecurrence, calendarOccurrences, messageGrouping, upcoming reminders, and invite displays. It is functional mail-client behavior, not evidence the grid boundary failed. serverExternalPackages:['rrule',…] affects the server, not this browser chunk.
- **@uiw/react-md-editor**: ComposeMarkdownEditor dynamically imports the package with ssr:false; the **305.4 KB gzip** editor/Prism group stays out of initial JS. But ComposeMessageField statically imports ComposeMarkdownEditor, which imports editor CSS and remark-breaks. Defer that wrapper's CSS with the Markdown surface if editing this area; savings only around **5–6 KB gzip vendor CSS**, not the full mixed 7.4 KB stylesheet. Its secondary async CSS may duplicate some rules already eager.
- **react-markdown/remark/rehype/Turndown**: eager for two separate reasons. MailClient → RenderHelpers → MarkdownPanel imports ReactMarkdown, remark-gfm, remark-breaks. Also MailClient → ComposeOrchestrator → ComposeMessageField → composeTabSwitch → lib/markdownConvert imports unified, remark-parse/gfm/rehype, rehype-raw/stringify, Turndown. composeContentBuilder independently imports htmlToMarkdown from that same module, including through compose initialization and draft/send payload preparation. Its top-level unified processor is constructed when the module evaluates, even with no Markdown tab open. Fixing one edge leaves the other. **parse5 8.0.1** is app HTML normalization, while **parse5 7.3.0** is required by hast-util-raw/from-html. They are different major versions; do not force-dedupe them via an override.
- **HTML display stack**: HtmlMessage and calendar description/email snapshots use sanitizeHtmlForDisplay → normalizeHtmlStructure → parse5; sanitize-html also requires htmlparser2/entities and related helpers. This explains the **323.1 / 97.6 KB** eager group. Security-sensitive behavior and malformed-email recovery are intentional; removing a parser or sanitizer is outside a low-risk bundle pass. A later coordinated viewer-boundary experiment could defer it, but there are several call sites and no saving is included in the top five.
- **react-file-icon**: AttachmentsList imports both FileIcon and defaultStyles and indexes defaultStyles dynamically. That keeps its extension style/icon data and colord/prop-types reachable in the browser. An isolated production package bundle is **10.1 KB gzip**; the observed **33.2 / 12.2 KB** mixed module factory also includes application rendering, so it is only an upper bound. Reuse the existing Lucide system for a generic file/extension treatment if visual fidelity is acceptable.
- **lucide-react**: normal named barrel imports throughout; no namespace/dynamic-icon loader found. Next 16.2.4's config.js already inserts lucide-react into optimizePackageImports. Existing tree shaking is visible in the emitted icon-data counts. Deep-import rewrites or adding lucide-react to next.config.ts should not deliver a meaningful runtime win.
- **Themes and tw-animate-css**: Themes JS is tree-shaken into retained components/primitives; CSS is global and dominates CSS bytes. The animation package is Tailwind v4 utility definitions, not a huge unconditional runtime payload. Removing it saves only **0.88 KB gzip** in the isolated experiment and breaks shadcn transitions. Retain it.

## Startup waterfall

This is a **source-derived request graph**, not a browser timing trace. No authenticated browser session or mailbox data was used. First list render depends on local API responses, not completion of IMAP/CalDAV network sync.

1. HTML loads the layout CSS and beforeInteractive **/runtime-config.js**. Framework/route JS hydrates MailClient; CSS discovers the full Inter font. The shell can display while authState is loading.
2. useAccountController.loadInitialData **awaits GET /api/auth/me**, then its JSON, sets auth/user/session TTL and preferred account ID. **The handler also returns accounts: sanitizeAccountsForClient(accounts), but AuthMeResponse in the hook does not declare or use that field.**
3. It **awaits GET /api/accounts**, then JSON, chooses a permitted account and sets activeAccountId/accounts.
4. It **awaits GET /api/accounts/{id}/folders**, then JSON; publishes folders and initialDataReady. A MailClient effect selects the first/appropriate folder.
5. useMessageData can now fetch **GET /api/accounts/{id}/threads?page=1&pageSize=300&groupBy=date&threadDateSource=…&folderId=…** for the default threads-on, folder-scope state. It sets messages after JSON parsing. Alternative modes use /messages, /search or /related. Everywhere mode requests 600; invite-deck mode requests 200.

In parallel with the bootstrap:

| Start condition | Requests/work | Blocks first list? |
|---|---|---|
| Mount | GET /api/version; service-worker /sw.js registration | No |
| activeAccountId published, before folders necessarily finish | GET /topics, GET /topics/stats, GET /recipient-aliases, GET /calendar/events?startMs=…&endMs=… | No; each separate hook/effect |
| activeAccountId published | GET /reminders through fetchCalendarReminders | No; cache/in-flight dedupe exists; queued reminder mutations are flushed first if present |
| Auth OK + account + INBOX metadata | EventSource /imap/stream?activeFolderId=…; /imap/poll fallback if stream unavailable | No |
| initialDataReady + active folder | Startup /sync/new-candidates, POST /sync, GET /sync/status polling, folder/list refreshes according to sync policy | No; original cached-DB list can render independently |
| initialDataReady + configured CalDAV URL | POST /calendar/sync | No |
| Unauthenticated/desktop branch | LoginOverlay; desktop GET /api/desktop/needs-setup only when isDesktop() | No authenticated list exists yet |
| A message/thread selected | /thread/related, content/source/html/attachment requests as needed | After list/selection, not a pre-list prerequisite |

**Avoidable dependencies:** the /api/auth/me handler already fetches and returns the same sanitized account array as GET /api/accounts. Consume meData.accounts in loadInitialData and remove its follow-up GET /api/accounts entirely on the normal auth-check path. This saves **T_accounts**, a whole sequential request/parse stage, and duplicate account response bytes. Retain the dedicated accounts read for skipAuthCheck/explicit refresh paths that lack an auth payload. A weaker fallback would run the two reads concurrently, but reusing the supplied data is simpler and cheaper. Account selection genuinely needs account access data and preferred-account state; a normal folder-scope list genuinely needs the selected folder ID. Do not speculate an arbitrary folder request or parallelize account switching across its session mutation.

**Repeated bootstrap:** loadInitialData's useCallback dependencies include activeAccountId; the mount effect depends on loadInitialData. Publishing the first nonempty activeAccountId changes the callback and triggers the effect again. Source therefore predicts a second **/auth/me → /accounts → /folders** sequence, possibly overlapping the first folders response, resetting readiness flags. Together with the redundant accounts read, the predicted cold bootstrap has **six requests** (two copies of each endpoint); a stable bootstrap using the auth payload needs **two** (/auth/me then /folders), saving **four**. This count is source-derived and should be confirmed in a production trace. The callback issue is independent of React Strict Mode and exists in production. Stabilize initialization and explicit reload actions while reading the current selection through a suitable current-value mechanism; verify cold load plus account switch before changing it. Do not hide it by disabling Strict Mode.

**Payload size and cap:** threads route clamps requested thread count to **600**, default **300**, and removes empty body/attachments/invite states plus categoryScore/categorySignals. It does **not** cap returned message rows: listThreads selects the page's thread IDs, then loads *all messages* for those threads. The usual first folder page can therefore return well above 300 items. References, topic suggestions, preview lengths, and invite metadata further vary payload bytes. No finite maximum byte budget follows from the thread cap.

To quantify scale without personal data, a scratch synthetic fixture uses the actual extracted slimThreadListItem function and the current response shape. Unique SHA-256 strings give the IDs/previews realistic nonconstant entropy. These are **serialized fixture bytes, not observed mailbox/API payloads**:

| Threads on page | Messages/thread | Returned rows | JSON raw KB | Gzip KB |
|---:|---:|---:|---:|---:|
| 0 | — | 0 | 0.064 | 0.075 |
| 300 | 1 | 300 | 288.6 | 36.6 |
| 600 | 1 | 600 | 577.5 | 72.6 |
| 300 | 5 | 1,500 | 1,445.2 | 175.8 |
| 600 | 5 | 3,000 | 2,894.2 | 351.9 |

Auth/accounts/folders/topics/reminders payload sizes are **unmeasured and data-dependent**; reporting fixture values for them as network measurements would be misleading. Follow-up verification should record decodedBodySize/encodedBodySize and actual list item/thread counts in the authorized synthetic browser scenario. No CPU timing, request timing, or endpoint latency is claimed here.

## Ranked recommendations

Ranks weigh expected first-load saving, implementation risk, and coordination cost. Estimates should be accepted only after comparing a production build and exercising the feature that moved behind a boundary.

| Rank | Change / saving | Files touched | Protected-area overlap | Risk | Verification |
|---:|---|---|---|---|---|
| 1 | Unicode-range font subsets: **246.7 KB font bytes** on Latin-only initial paint; roughly **197 ms of transfer at 10 Mbit/s** if bandwidth-bound | public/fonts/README.md, new subset font files, app/globals.css, lib/ui/fonts.ts; existing globals font assertions | **No** | Low–medium: retain full Unicode coverage and variable axes; avoid loading both full and subset faces for the same range | Reproduce subset bytes; inspect every original cmap code point has a fallback; Latin/German/Greek/Cyrillic fixture text; shell + iframe show same weight, one required subset request |
| 2 | Lazy Markdown viewer **and** separate/warm conversion modules on compose interaction: **65–105 KB gzip JS** estimate, within **109.5 KB observed candidate chunks** | app/components/mailclient/RenderHelpers.tsx, composition/composeTabSwitch.ts, composeContentBuilder.ts, composeInitState.ts/useComposeController/useDraftManager as required; lib/markdownConvert.ts split helpers; message/window/page.tsx for detached parity; optionally ComposeMarkdownEditor.tsx CSS wrapper | **No for the listed core implementation** (RenderHelpers, composition, lib, and detached page are outside the protected areas). **Yes only if** implementation additionally edits message/MarkdownPanel.tsx or another protected message caller; coordinate that optional scope | Medium: synchronous conversion contracts, autosave/send, format-switch races; do not lazy-load the entire imperative ComposeOrchestrator as a shortcut | Root chunk lists lose conversion/raw-HTML parser group; initial no-compose/no-Markdown network has no new chunks; then reply/forward/edit, Markdown ↔ HTML ↔ text, autosave, send, detached compose/message and embedded HTML fixtures |
| 3 | Conditional next/dynamic settings boundary: **15–20 KB gzip JS**, possibly a small extra CSS gain | app/components/MailClient.tsx import + existing conditional render; AccountSettingsModal.tsx only if its export needs adjustment | **Yes: MailClient.tsx**; no shell file edit required | Low: preserve props, loading state, type-only ManageTab imports, mount semantics | Settings bytes absent from root eager chunk; unopened settings issues no settings-tab API calls; open each tab/admin/nonadmin; save/cancel; narrow viewport |
| 4 | Replace decorative react-file-icon with existing Lucide File/FileText + extension: **8–10 KB gzip JS** | app/components/AttachmentsList.tsx and its presentation/test; dependency entries only after confirming no other uses | **No**, shared file is outside mailclient/message/**; do not edit message callers | Low–medium: visual change, preserve filename/extension/accessibility and actions | Root and detached routes contain no react-file-icon/colord/prop-types-only module path; attachment list DOM tests; common and unknown extensions, inline files, download/delete/loading |
| 5 | Reuse accounts from /auth/me + stabilize bootstrap: **4 requests avoided (6 → 2)** plus **one sequential /accounts stage** saved, e.g. **80–150 ms** only if that is measured endpoint latency | app/components/mailclient/useAccountController.ts and focused hook/request-order verification | **No**; API handlers, auth and DB stay unchanged | Low–medium: account-switch/401 handling and fresh-state selection; preserve accounts read for skipAuthCheck and explicit reload paths | Production-mode cold-load trace exactly one /auth/me → /folders sequence and no redundant /accounts; sanitized account data matches current behavior; no folders for unauthorized account; repeated login/logout/switch and skipAuthCheck; list renders before background sync finishes |
| 6 | Defer ComposeMarkdownEditor wrapper/CSS when Markdown tab opens: **about 5–6 KB gzip CSS** upper estimate, not the whole 7.4 KB mixed chunk | composition/ComposeMessageField.tsx, ComposeMarkdownEditor.tsx | **No** | Low; small first-open style-loading delay | CSS absent before Markdown tab; correct editor/preview on first open; no flash/missing styles; avoid double-counting any CSS moved by rank 2 |
| 7 | Gate secondary account requests behind first-list readiness/idle where appropriate: **0 KB JS**, shifts **up to 3 noncritical requests** (topics/stats/aliases) out of initial network contention | useRecipientAliases.ts; useTopics.ts if topic UI can tolerate delayed stats; possibly MailClient.tsx to pass readiness | **Conditional: MailClient.tsx if changed** | Medium; aliases need to be ready before immediate compose; keep reminder delivery timely | Request trace before/after; immediate compose recipient alias resolution; topics/badges remain correct. No numerical ms saving asserted |

Rank 2's 109.5 KB candidate pool is 0ldsqb0408gaj.js + 0~ylq_3mir9oe.js + 08ih_2h5v8qbi.js; core utilities retained elsewhere can prevent recovering its full size. Rank 3's minification experiment externalized imports and compressed modules together; it estimates source contribution, not an actual changed route. Rank 4's package bundle is an independent estimate, not a Next rebuild. These limitations are deliberate.

## Studied and not worth doing

| Item | Existing setting / verified behavior | Decision |
|---|---|---|
| optimizePackageImports for lucide-react | Not explicitly configured; **already automatically included** by installed next/dist/server/config.js | No runtime win from adding it or rewriting 121 named imports to deep paths. [Next docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports) confirm automatic coverage |
| Add @radix-ui/themes, @radix-ui/react-icons or radix-ui to optimizePackageImports | Not on the installed automatic list; experimental option exists and has schema/type support; existing emitted code is already selected components | Optional isolated build experiment later, **0 KB proven saving**. Could speed compilation; do not promise browser reduction or call an experimental barrel transform a safe production quick win |
| modularizeImports | Not set; installed config/SWC types support it; current defaults include package-specific transforms for @mui/icons-material/lodash | Do not hand-map Themes compound component exports or add a duplicate Lucide transform. No measured gain; fragile export paths |
| reactStrictMode | Not set (null default), **App Router enables it** via define-env.js | Keep default. Production startup duplicate above has a different cause. [Docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/reactStrictMode) agree |
| compress | Not set, **true by default** in config-shared.js | Already gzip-compressed under next start; explicit true adds zero. A proxy may choose Brotli independently; actual Content-Encoding must be measured. [Docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/compress) |
| productionBrowserSourceMaps | Not set, default **false**; no browser .js.map files emitted | Keep off for this report; server maps were sufficient for fingerprint estimates. Turning it on is an analysis choice, not a performance win. [Docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/productionBrowserSourceMaps) |
| images | **qualities:[75,85]** already set; installed image defaults WebP, minimumCacheTTL 14,400 sec, no remotePatterns | No first-paint next/image user here. Enabling AVIF, altering quality/cache/size lists or broad remotePatterns has **0 KB demonstrated benefit** for logo/font/inline SVG |
| Turbopack | **turbopack.root = projectDir**; default Next 16 build bundler; emitted runtime confirms it | Keep. No webpack splitChunks rule applies to this build; no bundler switch. No verified production chunk-splitting config knob is proposed. Filesystem build caches affect build time, not browser startup. [Turbopack docs](https://nextjs.org/docs/app/api-reference/turbopack) |
| Other next.config.ts settings | **output:standalone**, outputFileTracingRoot, outputFileTracingIncludes, **typedRoutes:false**, serverExternalPackages:rrule/imapflow/mailparser/nodemailer/html-to-text/sanitize-html | Keep: tracing/externalization serves worker deployment, not client bundle elimination |
| Remove/diet rrule | Eager **17.0 KB gzip**, actually used in mail/reminder/invite functionality | No blanket dynamic replacement; a change needs coordinated recurrence correctness work |
| Trim tw-animate-css | Only **0.88 KB gzip** delta in scratch CSS experiment | Retain animations |
| Radix public partial CSS swap | **+0.55 KB gzip** in scratch experiment with all parts retained | Not a size win; do not remove Themes or break its utility/token contract |
| Force one parse5 major | 7.3.0 required by rehype/hast vs 8.0.1 used by app HTML normalization | Unsafe version override; move optional consumer boundaries instead |
| Another analyzer Next build / running server | Existing diagnostics, manifests, source graph, and emitted files answered the asset questions | **Zero additional Next builds; no dev/start process**. Browser execution timings remain unmeasured |

Pinned installed **16.2.4 source is authoritative** for configuration statements; live Next docs currently identify a later 16.x release and are corroboration only. No unverified version-specific option is recommended.

## Methodology

All work commands used cwd `/home/monkey/code/noctua-mail/wt-deps`; all scratch outputs are under `/tmp/perf-bundle/`. No environment secrets were printed or mailbox/database rows read. No package installation modified this project's dependency tree. FontTools/Brotli were provisioned only into uv's scratch cache/environment.

Exact principal commands (scripts retained in scratch for reproduction):

```sh
# Identity and constraints
cat AGENTS.md
git branch --show-current
git log -1 --oneline
git status --short
bun --version
node --version

# Existing build and import evidence
cat next.config.ts
cat package.json
cat .next/build-manifest.json
cat .next/diagnostics/route-bundle-stats.json
cat .next/server/app/page/react-loadable-manifest.json
cat .next/server/next-font-manifest.json
rg -n 'next/dynamic|@lexical|@fullcalendar|react-md-editor|react-markdown|remark-|rehype-|react-file-icon|lucide-react|rrule' app lib --glob '!*.test.*'
bun pm why parse5

# No Next builds: read files, parse module factories, fingerprint retained
# strings against server map sourcesContent + installed vendor sources,
# and gzip each emitted asset at level 6.
nice -n 10 bun /tmp/perf-bundle/measure.cjs > /tmp/perf-bundle/measurements-summary.json
nice -n 10 bun /tmp/perf-bundle/inspect.cjs > /tmp/perf-bundle/chunk-details.txt
nice -n 10 bun /tmp/perf-bundle/graph.cjs > /tmp/perf-bundle/graph-summary.json
nice -n 10 bun /tmp/perf-bundle/css.cjs
nice -n 10 bun /tmp/perf-bundle/experiments.cjs
nice -n 10 bun /tmp/perf-bundle/minify.cjs
nice -n 10 bun /tmp/perf-bundle/package-size.cjs
nice -n 10 bun /tmp/perf-bundle/payload.cjs
nice -n 10 bun /tmp/perf-bundle/icons.cjs
nice -n 10 bun /tmp/perf-bundle/more.cjs

# Final required check: expected empty output
git -C /home/monkey/code/noctua-mail/wt-deps status --short
```

The raw/gzip calculation is `fs.readFileSync(path).length` and `zlib.gzipSync(bytes,{level:6}).length`, summed over each diagnostic route's unique firstLoadChunkPaths; CSS comes from entryCSSFiles in the route's page_client-reference-manifest.js, deduplicated by path. No global recompression of concatenated route files was used for route totals. Import graph uses TypeScript's parser and excludes import type / type-only named members, including default-plus-type mixed import declarations. Factory labels use Acorn AST/string matching; manually interpreted coalesced groups above take precedence over their automated dominant-package labels.

The exact font command was:

```sh
nice -n 10 uv run --cache-dir /tmp/perf-bundle/uv-cache --with 'fonttools[woff]' python -c 'from fontTools.ttLib import TTFont; from fontTools import subset; import json; f=TTFont("public/fonts/InterVariable.woff2"); cmap=f.getBestCmap(); print(json.dumps({"glyphs":len(f.getGlyphOrder()),"codepoints":len(cmap),"axes":[(a.axisTag,a.minValue,a.maxValue) for a in f["fvar"].axes]})); opts=subset.Options(); opts.flavor="woff2"; opts.layout_features=["*"]; s=subset.Subsetter(options=opts); s.populate(unicodes=list(range(0x100))+[0x131,0x152,0x153,0x2bb,0x2bc,0x2c6,0x2da,0x2dc,0x304,0x308,0x329]+list(range(0x2000,0x2070))+[0x20ac,0x2122,0x2191,0x2193,0x2212,0x2215,0xfeff,0xfffd]); s.subset(f); f.save("/tmp/perf-bundle/InterVariable-latin.woff2"); import os; print("latin_subset_bytes",os.path.getsize("/tmp/perf-bundle/InterVariable-latin.woff2"))' > /tmp/perf-bundle/font.txt
```

Font experiment emits only a proof-of-size Latin asset. It does not implement or validate the complete complementary fallback set, Unicode-range CSS, layout/kerning across ranges, or production caching; those are implementation verification work. The scratch scripts' small Bun.build calls and PostCSS runs are isolated package/module/CSS size experiments, **not bun run build / next build**.

## Files inspected

- Repository instruction file AGENTS.md; package.json, bun.lock via bun pm why; next.config.ts; external architecture context `/home/monkey/code/noctua-mail/briefs/arch-tech-debt.md` §3.
- Build evidence: .next/diagnostics/{route-bundle-stats,build-diagnostics}.json, .next/build-manifest.json, .next/app-path-routes-manifest.json, .next/server/app/{page,compose/window/page,message/window/page,calendar/window/page}_client-reference-manifest.js, corresponding page/react-loadable-manifest.json, .next/server/next-font-manifest.json, .next/static/chunks/*.js and *.css; sourcesContent in .next/server/chunks/ssr/*.js.map.
- Entrypoints and assets: app/page.tsx, app/layout.tsx, app/globals.css, app/{compose,message,calendar}/window/page.tsx, app/message/window/loading.tsx, app/icon.tsx, app/apple-icon.tsx, app/manifest.ts, app/icons/logo.svg/route.ts; public/fonts/{README.md,InterVariable.woff2}, public/icons/base.svg and PNG byte sizes, public/favicon.png, public/sw.js; build-scripts/generateRuntimeConfig.ts.
- Main startup/source graph: app/components/MailClient.tsx; mailclient/useAccountController.ts, useMessageData.ts, useTopics.ts, useRecipientAliases.ts, useReminderNotifications.ts, useSyncController.ts, messageListQueryUrl.ts, utils/calendarReminders.ts, RenderHelpers.tsx; auth/LoginOverlay.tsx; shell/AppShell.tsx, ShellSidebar.tsx, ShellHeader.tsx, ShellUserMenu.tsx; lib/accountApiPaths.ts, lib/data.ts, lib/ui/fonts.ts, lib/ui/messageView.ts.
- Optional surfaces: ComposeEditor.tsx, ComposeMarkdownEditor.tsx, AttachmentsList.tsx, AccountSettingsModal.tsx and its account-settings tabs; mailclient/composition/{ComposeOrchestrator,ComposeMessageField,DetachedComposeWindowClient}.tsx, {composeTabSwitch,composeContentBuilder,composeInitState,buildSendPayload,useComposeController,useComposeDraftAutoSave,useDraftManager}.ts; message/{MarkdownPanel,ThreadMessageCard,ThreadView,MessageViewOrchestrator}.tsx; calendar/{CalendarEventBrowser,CalendarView,CalendarSidebarPanel,CalendarPopover,CalendarEventEmailSnapshot,EventDetailDescription,EventDetailBadges,EventDetailActions}.tsx. Other app/lib transitive source files were parsed by graph.cjs.
- Shared libraries/API: lib/markdownConvert.ts, lib/html/{index,sanitize,normalize,extract,strip}.ts, lib/calendar.ts, lib/reminderRecurrence.ts, lib/calendarOccurrences.ts, lib/inviteDeckEventBounds.ts, lib/messageGrouping.ts; app/api/auth/me/route.ts, app/api/accounts/route.ts, app/api/accounts/[accountId]/threads/route.ts, app/api/messages/listMessagesHandler.ts, lib/db/messages/query.ts, lib/db/threads.ts (read only).
- Installed verification: next/dist/server/{config,config-shared,config-schema}.js and config-shared.d.ts, next/dist/build/{define-env,webpack-config}.js, next/dist/build/swc/options.js, next/dist/shared/lib/image-config.js; @radix-ui/themes/package.json, {styles,tokens,components,utilities,layout}.css and layout/*.css, src/styles/index.css, src/styles/tokens/index.css, src/styles/utilities/index.css, src/components/index.css; react-file-icon/package.json and dist/react-file-icon.esm.js; lucide-react/dist/esm/icons/*.mjs; tw-animate-css/package.json; installed Lexical/UIW/FullCalendar sources for retained-string fingerprints.

Final `git -C /home/monkey/code/noctua-mail/wt-deps status --short` was verified empty; next.config.ts has no diff. The sole requested deliverable is outside wt-deps at `/home/monkey/code/noctua-mail/briefs/perf-client-bundle.md`.
