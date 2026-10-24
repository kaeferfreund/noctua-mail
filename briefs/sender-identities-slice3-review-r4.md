FIX

Do not advance the round-9 pin from `abf1b9e` to `e63a3062eee2c866718211be50127766e77c1f86`. The original 844 px-high P2-G reproduction is fixed, but the requested keyboard-height case remains broken and regresses P2-E’s From reachability.

**P2 — 320×500 collapses metadata and clips the editor.** [Compose.module.css:522](/home/monkey/code/noctua-mail/wt-review-auth/app/components/mailclient/composition/Compose.module.css:522), especially the grid’s `min-height: 0`, the message field’s `min-height: min-content` at line 527, and the body’s `overflow: hidden` at line 74.

Repro: set “Synthetic Long Display Name NNNNNNNNNNNN” with 47×`a` + `@example.test` as personal default; open New mail at 320×844, type a subject, wait for autosave, focus/type in the editor, then resize to 320×500. Also repeat after disabling that identity and reopening its draft. In **8/8 cases** (de/en × light/dark × enabled/unavailable):

- Metadata scroll viewport is **0 px**, with **124/204/188 px** content for enabled/de-unavailable/en-unavailable. From, To and Subject cannot be hit or reached by metadata scrolling.
- Editable layout height remains **120 px**, but visible height is **0 px**, including immediately after resizing with the editor focused. Actual wheel input does not reveal it. Representative editor bounds are **y409–529**, while the clipping body ends at **y351**; body height is **244 px**.
- Programmatic `scrollIntoView()` can expose the editor and permit typing, but leaves metadata inaccessible. Close and Cancel remain hittable and at least **44×44 px**.
- The `abf1b9e` production control retains a hittable From in **8/8 cases**, with metadata heights **228 px enabled / 308 px de-unavailable / 292 px en-unavailable**. Thus From reachability regresses.

Fix: preserve reachable metadata and allow the shared composer body to scroll at short heights while retaining usable editor space. Add a 320×500 regression asserting actual pointer/wheel access to From, To, Subject and the editor, including scrolling back. The focused regression records **24 failed assertions across all eight new-build cases**. [Probe and reproduction](/home/monkey/code/noctua-mail/briefs/sender-identities-slice3-regressions-r4/review.spec.ts:121), [measurements](/home/monkey/code/noctua-mail/briefs/sender-identities-slice3-regressions-r4/extra-measurements.json), [failure log](/home/monkey/code/noctua-mail/briefs/sender-identities-slice3-regressions-r4/logs/keyboard-detail.log).

**P2-G at full height — closed.** Repeated the original personal-default/New mail/subject/autosave reproduction in both locales and themes. At 320/360/390×844, editor heights are:

- Enabled original, 80-character unbroken name, and 120-character address: **135/135/229 px**.
- Unavailable and reopened unavailable draft: **120/120/165 px (de)**; **120/120/181 px (en)**.
- RTL/emoji name: **135/135/229 px**, both locales/themes.

The packaged matrix passes visible editor, center hit-testing and actual typing in **60/60 cases**; the additional RTL/emoji matrix passes **12/12**. Header height is **95 px**, From height **36 px**, and Close right edges **296/336/366 px**. Close/Cancel retain their targets and From’s arrow is unclipped. Full sender text remains in subtitle/trigger text and titles, with no hidden or aria-hidden ancestor. Dropdowns open within viewport bounds.

**Scrolling at 844 px — passes.** Unavailable metadata has a **139 px** scroll viewport. Real wheel scrolling reaches **65 px (de)** and **49 px (en)**, then returns to **0**. Subject and To are hittable/editable in both themes. The scroll trap occurs at 500 px height.

**Desktop — unchanged.** Compared the preserved `abf1b9e` production build against the fresh `e63a306` build at 1024/1440×844, de/en, light/dark, short/long senders: **32 header/From screenshot pairs, 0 changed pixels**. Header remains **67 px**; subtitle and From bounds match. [Screenshot diff results](/home/monkey/code/noctua-mail/briefs/sender-identities-slice3-regressions-r4/desktop-diff.json).

**Rerun gates — Bun 1.4.4; nice 10.**

- Typecheck: **exit 0**, **1,193 files**, zero errors.
- ComposeHeader DOM ×3: **48 pass / 0 fail**, **180 assertions**.
- `timeout 1800 bun run test:ci`: **exit 0**; server **2,797/0**, **11,851 assertions**, **342.21 s**; DOM **482/0**, **2,841 assertions**, **74.02 s**.
- `timeout 1200 bun run build`: **exit 0**, compile **23.1 s**, TypeScript **44 s**, **31/31 pages**.
- `qa-compose.spec.ts` on 3886: **8 pass / 0 fail**, **4.6 min**. Only the probe copy’s hardcoded fixture mailbox literal was adapted to `mailbox@example.test`.
- Additional browser checks: **3 pass**; focused keyboard regression: **1 failed test**, **24 assertion failures**, reproducing the finding above.

Initial probe setup failures were corrected: Turbopack rejected an external dependency symlink; an early retry preceded dependency-copy completion; Bun could not load Playwright’s ESM config. Final build used local dependency copies and Playwright used Node. The first focused keyboard probe also needed an explicit wait for asynchronous draft reopening; the completed rerun covers all cases.

`git merge-tree --write-tree origin/integration/stage e63a306` against **11dc3c5** reports the same four conflict files as `abf1b9e`, with no additions:

- `app/components/account-settings/tabs/PreferencesTabContent.tsx`
- `lib/mail/resyncMessage.senderKey.test.ts`
- `messages/de.json`
- `messages/en.json`

Load average: **start 8.70 / 9.44 / 8.03; end 4.43 / 4.74 / 6.31**. Detached checkout remains clean at `e63a306`; production files were tested from permitted probe copies. Owned servers on 3886/3887/3888/3889 were stopped by exact PID; those ports are clear. No other worktree changes or push.
