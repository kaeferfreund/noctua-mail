PIN+fix

Pin `abf1b9ec6c845d9f6fa534efc3d51723c993f9bc` for integration round 9. Merge with the resolutions below. A bounded mobile layout follow-up is required before preview: long sender metadata can still collapse the message editor. Localization is complete. No P1 or other new merge-blocking defect was found in this narrow review.

**Scope and evidence.** Reviewed only the round-2 P2-E/P3-F follow-ups and new merge surface. The detached `ROOT/wt-review-collab` checkout was clean before and after; no reset was necessary. Read the prior report and abandoned round-3 artifacts, then independently repeated verification. Every tracked file in the preserved scratch source matched the checkout byte-for-byte before gates. Fresh logs and probes are under [sender-identities-slice3-regressions-r3](/home/monkey/code/noctua-mail/briefs/sender-identities-slice3-regressions-r3/repro-rerun.md). No production source was edited.

**P2-E — partially closed.** The original horizontal header overflow is fixed by `ComposeModal.tsx:119–125` and `Compose.module.css:42–63,476`. Independently checked 320/360/390 × light/dark × enabled/unavailable with “Synthetic Long Display Name NNNNNNNNNNNN” and 47×“a” followed by `@example.test`. Close and Cancel satisfy viewport bounds, center hit testing and ≥44×44 targets in **12/12 cases per locale**. Close right edges are **296/336/366 px**, width/height **44/44**. The From trigger, including its arrow hit area, stays inside the viewport. Full sender information remains in exposed subtitle text and its title; no hidden/aria-hidden ancestor removes it.

The first independent production matrix used German. After my successful build, I restarted standalone on 3895 and repeated the complete matrix in English. The 1024×844 desktop control retains its previous header height (**67 px**) and action positions when compared with the previous CSS defaults applied temporarily in the page; only the subtitle's allocated blank width changes.

**P2-G — editor collapses under long sender metadata; fix before preview.** [Compose.module.css:58](/home/monkey/code/noctua-mail/wt-review-collab/app/components/mailclient/composition/Compose.module.css:58), `Compose.module.css:66–83`; coverage gap in `tests/browser/compose/qa-compose.spec.ts:340–359`.

Repro: select the original long identity as personal default, open New mail at **320×844**, enter a subject and wait for autosave. The wrapped subtitle makes the header **155 px** high; the From trigger is **140 px** high. The HTML editable element becomes **0 px high** in both themes, enabled or unavailable. Scrolling and `scrollIntoView()` do not restore its height. With the short mailbox-default sender, the same autosaved composer has a **95 px** header and **111 px** editable area.

Fresh English build, editor heights at 320/360/390: enabled **0/63/177 px**; unavailable **0/15/129 px**. German unavailable heights are **0/0/129 px**, because the translated unavailable option wraps further at 360. Thus the requested “header does not push the body” condition remains open even though dismissal is fixed.

Adversarial enabled probes repeated all widths/themes: an **80-character unbroken name** and a valid **120-character address** also yield a **0 px editor at 320**, in both locales. Mixed Arabic/Hebrew/emoji preserves full text, in-bounds controls and a nonzero editor. All **18 adversarial cases per locale** retain reachable Close/Cancel and an unclipped From trigger.

Fix: bound the mobile subtitle's visual height while retaining full accessible sender text, and reserve usable editor space by bounding sender-field expansion or making the metadata region scroll. Extend the browser regression beyond dismissal/From geometry to assert a visible, hittable editable area after autosave and when reopening an unavailable-identity draft. Keep the desktop geometry. This is a localized layout follow-up, so PIN+fix remains appropriate.

**P3-F — closed.** Manually reviewed all **71 German sender concepts** against English and the i18n guidance. Copy uses natural du-form, correct grammar and capitalization, and **Verwalter** consistently; no conflicting Leser/Bearbeiter, Erledigt or Gemeinsame Postfächer terminology was introduced. Both catalogs contain **89 leaves**, including the 71 concepts and 11 mapped shared labels. Inventory mapping matches runtime IDs. Parameter sets match exactly; the actual parameter IDs here are `{sender}` and `{email}`, and names/addresses remain literal values.

`lib/i18n/format.test.ts:41–76` covers complete de/en key parity, every mapped sender ID in both catalogs, parameter substitution and all four ICU-quoted literal tokens. The independent locale-switch/save probe passes **2/2**, preserving authored template bodies, names, addresses and `{{user.name}}`, `{{user.email}}`, `{{identity.displayName}}`, `{{identity.email}}`. Existing integration DOM coverage also proves retained API errors translate without losing input.

Scanned the component diff from `9424150..abf1b9e` and the round-3 diff. No remaining English literal belongs to the new sender controls. Candidates are user-content expressions/types or existing generic composer fallbacks and the legacy “Default signature” selector; retain stage's translation of that selector during merge. `useSenderMessages.ts:9–13` resolves catalog IDs at rendering. `senderErrors.ts:1–24` maps stable server codes to IDs; `senderSettingsError` preserves structured `AdminApiError` until display. `SignatureTemplateError.code = "signature_template_invalid"` remains untranslated. Provider details do not become sender UI copy.

**Round-9 merge resolutions.** `git fetch origin` succeeded. Compared actual fetched `origin/integration/stage=11dc3c5` and `origin/feat/sender-identities-2=d5ae17b` with `abf1b9e` using `git merge-tree --write-tree`. Objects were written in permitted scratch storage; no index/worktree merge was performed.

Stage has exactly **four conflict files, two hunks each**:

- `app/components/account-settings/tabs/PreferencesTabContent.tsx`, import hunk: retain stage's `useLocale/useTranslations`, add branch's `type ReactNode`. Preserve localized error rendering and the injected optional `senderPreferences?: ReactNode` prop.
- Same file, signature-selector hunk: combine `!senderPreferences &&` with stage's `t("preferences.signature")`; retain the matching closing brace and `{senderPreferences}` below the fieldset. Preserve localized inherit/no-signature/unavailable options, sparse PUT patches and null/inherit semantics.
- `lib/mail/resyncMessage.senderKey.test.ts`, helper/first-case hunk: take branch's `realResyncTest` and `NOCTUA_REAL_RESYNC_SENDER_KEY`, escaped anchored names, named pass marker plus zero-failure check, and unchanged **20,000 ms** budgets. Remove stage's competing `runIsolated/NOCTUA_RESYNC_TEST_CHILD`; do not nest wrappers.
- Same file, second-case hunk: use `realResyncTest` for the collision-variant case too. Both case bodies compare byte-identical after removing wrapper/guard differences. Preserve all stage FTS changes.
- `messages/de.json` and `messages/en.json`, Settings hunk: retain every stage Settings subtree, particularly complete members/preferences/roles. Add branch's entire **Settings.sender (38)** and **Settings.edit**. Retain stage's shared `Settings.members.enabled`, `Settings.preferences.saving`, `Settings.preferences.noSignature`.
- Both catalogs, root-namespace hunk: retain every stage namespace. Add branch's **Compose.sender (10)**, **Errors.sender (23)**, **Compose.from**, **Compose.closeComposer**, **Compose.fromValue**. Deep-merge Admin; retain stage's complete Admin tree, including shared `Admin.users.enable/disable`, `Admin.email`, `Admin.cancel`.

The catalogs have **no duplicate JSON keys or semantic collisions**. Stage contributes all **868 leaves**; branch contributes precisely the **75 missing leaves** listed above, producing **943 per locale**. Existing language/Pwa values stay with stage. The only unequal shared scalar is German `Settings.language.saving`: retain stage's **“Sprache wird gespeichert …”**; branch carries the unchanged older infra value without the space. Independent exact key lists and resolved catalog probes are retained.

The implementer's `integrationMerge` notes are correct; their historical `42310d8` reference has identical relevant merge surfaces to fetched stage. Slice 2 conflicts only in the same resync test, with the same two resolutions.

**da54af1 verified.** MailClient auto-merges with both stage's `tn = useTranslations("Notifications")` and the sender-copy hook beside unchanged mailbox state. The merged `useMessageMutations.ts` is **byte-identical to stage**, retaining notification localization and folder-refresh changes. The prior hook overlap is gone. Rerun combined gates after integration resolves conflicts.

**Independently rerun gates — Bun 1.4.4, nice 10.**

- `bun run typecheck`: **exit 0**, zero errors, **1,194 files**.
- `ComposeHeader.dom.test.tsx --rerun-each=3`: **36 pass / 0 fail**, **108 assertions**.
- `senderComposeReview.dom.test.tsx --rerun-each=3`: **36 pass / 0 fail**, **249 assertions**.
- Catalog/format tests: **5 pass / 0 fail**, **383 assertions**.
- `timeout 1800 bun run test:ci`: **exit 0**; server **2,797/0**, **305 files**, **11,851 assertions**, **339.94 s**; DOM **478/0**, **57 files**, **2,820 assertions**, **74.50 s**.
- `timeout 600 bun run lint`: **exit 1 at baseline**, **1 error / 25 warnings**; existing `useCalendarConflicts.ts:58` error.
- `timeout 1200 bun run build`: **exit 0**, compile **25.0 s**, TypeScript **45 s**, **31/31 pages**, standalone generated.
- Independent literal-content probe: **2 pass / 0 fail**, **20 assertions**. Its initial invocation from the probe root failed on the relative preload; corrected source-directory invocation passed.
- Production browser: **24 original-label cases** across de/en, plus **36 adversarial cases**. Dismissal/From/accessibility checks pass; editor-space failures are recorded above. Fresh-build English results are in `browser-rerun-fresh-build.json`.
- `git diff --check 8be2130 abf1b9e` and `git diff --check 9424150 abf1b9e`: **exit 0**. Checkout remains clean.

Load average **start 3.07 / 4.13 / 4.83**, **end 3.75 / 5.46 / 5.35**. Owned standalone/fixture servers used **3895/3897/3898** and were stopped by exact PID; prior orphaned probe servers were also stopped by exact PID. No other worktree edits, push or deployment.
