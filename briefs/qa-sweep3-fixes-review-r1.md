# Review round 1: `fix/qa-sweep3-r1` at `443198f`

This is one combined review (correctness and UI regression) of `e70c30b..443198f`, 6 commits. Worktree `wt-qa-fixes`, production build, synthetic fixture data, port 3875. No tracked file was changed and nothing was committed.

## Verdict: **FIX**

One P2 is in scope. QA-201 is fixed for new mail and for HTML replies, but not for **forwards** (HTML and Text) or for **Text-format replies**. QA-203, QA-204, QA-212 and QA-210 are fine; their remaining items are P3 and go to the backlog.

## Findings

### P2

**R1-1 · QA-201 is still reproducible on forwards and Text replies (`useComposeController.ts:65-87`, `lib/signatureTemplates.ts:82`).**

Steps: forward a message with the signed identity "QA Team". Switch From to "QA Ohne Signatur", then switch back. Nothing was typed.

- **Expected:** the signature comes back once, at the start, with no prompt.
- **Actual:** the prompt "Die bearbeitete Signatur behalten und die neue Signatur hinzufügen?" appears.
  - **Cancel:** no signature is added, and nothing tells the user.
  - **OK:** the signature lands in the wrong place.
    - HTML forward: below the "-------- Forwarded message --------" line, at index 37 instead of 0.
    - Text forward: after the whole quoted original, at index 613.
- **Text replies:** these are replies to plain-text mail; the default is the mailbox identity. Adding the signed identity prompts the same way. On OK, the signature goes below the quote.

Measured on the build at 1440 light. The data is in `review-QA-201-reply-forward.json` and `review-QA-201-accept.json`; the screenshots are `QA-201-review-accept-{html-forward,text-forward,text-reply}-1440-light.png`.

**Cause:** in these modes the editable body is not blank once the signature is removed. It still holds the forward header (HTML), or the header and quote (Text). With no tracked previous signature, `replaceSignatureBlock` therefore keeps reporting `conflict: true`. The new `isBlankComposeBody` check only covers an empty body.

**Minimal fix suggestion, in `applySignatureToCompose` (`useComposeController.ts:60-90`):**

1. Remember the body that remains when a tracked signature is removed without a conflict. That is the case `previous && !next && !replacement.conflict`: store `{ tab, body: value }` in a ref, and clear the ref where `composeSignatureRef` is reset (l. 156/187) and on any other body edit.
2. When `!previous && next`, and the current body still equals that remembered body, prepend `next` without a prompt.
   - For HTML, compare visible text (`extractVisibleHtmlText`), because Lexical re-serializes the HTML.
   - Prepending matches the initial insert in `composeInitState.ts:515-518`: `[block.text, body].join("\n\n")` for Text and Markdown, `block.html + body` for HTML.
3. Add one DOM case for HTML forward and one for Text reply or forward.

Note: `feat/i18n-slice3` changes 3 lines in the same file, so check `merge-tree` after the change.

Under AGENTS rule 2 this could also be read as a new edge case (P3). I kept it at P2 for two reasons: the task explicitly lists reply and forward as acceptance flows, and the symptom is exactly the reported defect.

### P3 (backlog, no fix round)

- **QA-201, reopened draft with a signature:** the draft's signature is untracked. Switching From away and back to a signed identity prompts every time; OK would add a second signature. Opening the draft does not insert anything (1 signature before and after reopening), so this is the existing design for untracked drafts. A reopened **blank** draft gets the signature once, with no prompt (correct). Data: `review-QA-201-reopened.json`, screenshot `QA-201-reopened-draft-1440-light.png`.
- **QA-210, phones:** on phones the search field uses a larger font. At 320 px, „Posteingang durchsuchen“ needs 189 px but the field has 176 px, so the end is cut („…durchsuche“). At 390 px it is 189/246 and fits. The old text was longer, so this is still an improvement. Screenshot: `QA-210-review-phone-de-320-light.png`.
- **QA-210, desktop:** de is 173/178 px and en 88/171 px at 1440 and 1280, light and dark. Values sampled at 0, 150, 500 and 1500 ms after a resize are stable. Only 5 px are left in de; longer custom folder names will be cut (as stated in the implementation report).
- **QA-210 spec flake:** in the first branch run, `qa-sweep3-search.spec.ts` measured an available width of 99 px for de at 1280 dark and failed. The rerun and my timing probe both measured 178 px. The spec measures right after `setViewportSize` and does not wait for the layout to settle.
- **Admin users tab on phones (outside QA-203):** the 6-column users table scrolls sideways inside its container, so there is no page overflow. Its row buttons ("Deaktivieren", "Sitzungen widerrufen", …) are 28 px tall, not 44. The header rows wrap correctly. Screenshot: `QA-203-review-users-390-light.png`.

### No findings

- **QA-201, new mail:** inline 1440 dark, modal 1440 light, and phone 390 light and dark. Over 3 rounds: 0 prompts, exactly 1 signature, at the start, and the body is `"\n"` while no signature is selected.
- **QA-201, HTML reply:** 0 prompts and 1 signature above the quote in every round.
- **QA-201, authored text:** still asks exactly once (branch spec and DOM test).
- **QA-203:** at 390, 360 and 320 px, light and dark, de and en (branch spec), all 9 buttons are ≥ 44 px, inside the viewport and not truncated, and `scrollWidth` is at most the viewport width. On desktop (1440, light and dark), the Users and Mailboxes tabs are unchanged: buttons 28–32 px, no overflow. The code only adds `flex-wrap` and a `max-md` touch height.
- **QA-204:** the menu is the field width, between 280 and 560 px, on desktop, and `100vw - 32px` on phones (branch spec passes).
- **QA-212:** the options are exactly „Nicht zugewiesen“, „Ich (Synthetic Alex)“, „Synthetic Jo“ (and the same in en). A disabled current user is not listed.

## Gates

| Gate | Result |
|---|---|
| `bun check` | 0 errors in 1,252 files (0.6 s) |
| ESLint on the 14 touched ts/tsx files | 0 errors, 2 warnings, both already present at the base (`react-hooks/set-state-in-effect` in `AdminMailboxes.tsx` 90→91 and `AdminPanel.tsx` 56→57; each moved down one line by the new import). No new warnings |
| Unit tests (`signatureTemplates`, `lib/html`, `i18n/catalogs`, `composeInitState`) | 224 pass / 0 fail, 9 files |
| DOM tests (`senderComposeReview`, `signatureHtmlTracking`, `Collaboration`, `ShellSearch*`, `admin/*`) | 58 pass / 0 fail, 7 files |
| `bun run build` | exit 0 |
| Playwright `playwright.qa-sweep3.config.ts` on the build | first run 7/8: QA-210 de failed with the measurement flake above. Rerun of `qa-sweep3-search` 2/2 pass |
| Review probes on the build (`qa-sweep3-fixes-review-r1/specs/`, not part of the branch) | final runs 9/9 pass. These are measurement specs; the P2 shows up in their JSON, not as a test failure. The first attempts failed on my own spec (sidebar off-screen, reply identity), not on the app |
| `git merge-tree --write-tree origin/integration/stage 443198f` | the stage head is now **`45060d0`** (newer than `a6e16d6`): clean, exit 0, tree `81977837`. Against `a6e16d6`: clean, exit 0 |

All tests ran with `env -u CLAUDECODE -u AGENT -u REPL_ID`, `nice -n 15`, `TMPDIR=<worktree>/.tmp` and `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64`.

## Evidence

All files are in `briefs/qa-sweep3-fixes-review-r1/`.

- **QA-201:**
  - `QA-201-new-{modal-1440-light,inline-1440-dark,phone-390-light,phone-390-dark}.png`
  - `QA-201-reply-{html,text}-1440-light.png`, `QA-201-review-accept-*-1440-light.png`, `QA-201-reopened-draft-1440-light.png`
  - `review-QA-201-*.json`
- **QA-203:**
  - `QA-203-{de,en}-{390,360,320}-{light,dark}.png` (branch spec)
  - `QA-203-review-{users,mailboxes}-{1440,390,320}-*.png`, `review-QA-203.json`
- **QA-204, QA-210, QA-212:**
  - branch-spec screenshots and JSON
  - `QA-210-review-*.png`, `review-QA-210-*.json`
- **Review specs:** `specs/`

## Cleanup

- I started and stopped only the harness processes. Ports 3875–3879 are free.
- `.tmp` was removed. The worktree is clean at `443198f`.
- No other worktree, data directory, service or port 3790 was touched.
