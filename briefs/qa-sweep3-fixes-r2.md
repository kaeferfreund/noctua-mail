# Fix round (single allowed): `fix/qa-sweep3-r1` → `d7213a8c`

Fixes review finding R1-1 (P2, QA-201 on forwards and Text replies) from `qa-sweep3-fixes-review-r1.md`. Worktree `wt-qa-fixes`, base `443198f`. This continues a task that stopped at a usage limit. The uncommitted state it left was reviewed and kept unchanged. Every gate below was rerun on the final code.

## Change

`app/components/mailclient/composition/useComposeController.ts`:
- A new ref, `unsignedBodyRef`, stores the body of an untouched message that has no signature. It is set in two cases:
  - **Removal:** a tracked signature at the start was removed without a conflict, so the remaining body (forward header or quote) is stored.
  - **Open:** the composer opened without a signature (`unsignedBody` from the initializer).
- In `applySignatureToCompose`, when there is no tracked previous signature, a new one is being added, and `replaceSignatureBlock` reports a conflict, the current body is compared with the stored one:
  - **Text and Markdown:** exact string comparison.
  - **HTML:** `extractVisibleHtmlText` plus `hasRenderableHtmlMedia`, because Lexical re-serializes the HTML.
- If the body is unchanged, the signature is prepended without a prompt, like the initial insert:
  - after a removal, `block + remaining body` (the removal leaves the original separator in place);
  - for a body opened without a signature, `[block, body].join("\n\n")` for Text and Markdown, `block.html + body` for HTML.
- Any other signature change clears the ref, and every `openCompose` resets it.

`app/components/mailclient/composition/composeInitState.ts`: `computeComposeInitState` returns `unsignedBody` when the resolved identity has no signature. Reopened drafts and `skipSignature` return early and get no `unsignedBody`.

What still holds:
- **Real edits still prompt:** any change to the visible text or media gives a different body, so the prompt appears as before.
- **Reopened drafts:** no `unsignedBody` is set, so nothing is added automatically and adding a signature still prompts.
- **No duplicate signature:** after a prompt-free insert the signature is tracked again, so the next removal works.
- **New mail and HTML replies:** unchanged; their bodies are blank or have no conflict, so the new branch does not run.

Tests:
- `senderComposeReview.dom.test.tsx` gets 6 new cases:
  - switch-back for HTML forward, Text forward and Text reply (3 rounds each), each with an "authored text still prompts" tail;
  - a Text reply that opens unsigned gets the signature at the start;
  - a reopened draft never gets a signature without a prompt;
  - text written above the signature still prompts.
- `tests/browser/ui/qa-sweep3-compose.spec.ts` gets one Playwright case: HTML forward at 1440 and 390, Text forward and Text reply, 3 rounds each.

## Gates (final code, `env -u CLAUDECODE -u AGENT -u REPL_ID`, `nice -n 15`, TMPDIR in `.tmp`)

| Gate | Result |
|---|---|
| `bun check` | 0 errors, 1,252 files |
| ESLint on the 4 touched files | 0 errors, 0 warnings |
| DOM tests, all of `composition/` (includes `senderComposeReview`, `signatureHtmlTracking`) | 296 pass / 0 fail, 22 files |
| Focused: `senderComposeReview` + `signatureHtmlTracking` | 22 pass / 0 fail (9 QA-201 cases) |
| Negative check: new tests against the `443198f` controller | the 4 switch-back/unsigned-open cases fail; both guard cases pass |
| Unit: `lib/signatureTemplates`, `composeInitState`, `composeSenderInit`, `resetComposeSession` | 73 pass / 0 fail |
| `bun run build` | exit 0 |
| Playwright `playwright.qa-sweep3.config.ts` on the build (port 3875, `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64`) | 9/9 pass; QA-201 forward/reply: 0 prompts, signature index 0 in every round |
| Playwright qa-compose (`playwright.compose.config.ts`, r9 harness, port 3875) | 8/8 pass |

## Merge check

`git merge-tree --write-tree origin/integration/stage HEAD` with the stage at **`7425f757`** (newer than `6968b37`): **one conflict**, exit 1, in `useComposeController.ts` at the import line only:

```
<<<<<<< origin/integration/stage
import { useMemo } from "react";
import { useLocale } from "next-intl";
=======
import { useMemo, useRef } from "react";
>>>>>>> HEAD
```

The conflict comes from the stage's i18n slice 3 (`572a8abd`), which adds `useLocale` from next-intl. Resolution:

```ts
import { useMemo, useRef } from "react";
import { useLocale } from "next-intl";
```

This resolution was checked in a scratch export of the merge tree, with the stage's locked deps installed (`bun install --frozen-lockfile`):
- `bun check`: 0 errors, 1,300 files.
- `senderComposeReview` + `signatureHtmlTracking`: 23 pass / 0 fail.
- `signatureTemplates` + `composeInitState`: 63 pass / 0 fail.

The other three files merged automatically.

## Evidence (`briefs/qa-sweep3-fixes-r2/`, all from the final Playwright run)

- `QA-201-html-forward-switch-back-1440-light.png` and `QA-201-html-forward-switch-back-390-light.png`: the signature is at the start, above "-------- Forwarded message --------".
- `QA-201-forward-reply.json`: per-round signature index and body start for the HTML forward (1440, 390), the Text forward and the Text reply.
- `QA-201.json` and `QA-201-signature-restored-1440-light.png`: the new-mail case is unchanged (0 prompts while untouched, 1 after authored text).
- `QA-204*`: rerun output of the same suite; it overwrote older copies from the earlier attempt.

## Cleanup

- Only my own harness processes were started; they stopped themselves. Ports 3875–3879 are free.
- `.tmp` was removed. Nothing was pushed, deployed or restarted.
