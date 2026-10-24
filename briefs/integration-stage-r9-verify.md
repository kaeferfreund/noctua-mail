# Integration round 9: independent verification

- Worktree: `/home/monkey/code/noctua-mail/wt-integration-dryrun`, branch `integration/stage`
- HEAD verified: `e70c30bf316cde3f3e266806b34687e311c74088` (as expected). The worktree was clean before and after. No tracked file was changed and nothing was committed or pushed.
- Scratch: `.tmp/verify-r9/` (removed at the end). Evidence copies: `/home/monkey/code/noctua-mail/briefs/integration-stage-r9-verify-evidence/`
- Environment:
  - Every `bun test`, build and Playwright run had `CLAUDECODE`, `AGENT` and `REPL_ID` unset. The exceptions are the deliberate `CLAUDECODE=1` and `AGENT=1` runs in check 2.
  - Commands ran under `nice -n 15` with `TMPDIR` pointing into the worktree's `.tmp`.
  - Playwright ran with `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64`.
  - Only port 3799 was used. 3798 and 3799 were free at the end. Host load was 4–7.

**Verdict: PASS.** I found no P1 or P2 issues, only four P3 observations.

## 1. 97dd982: stable API error resolver

### Code review

`useApiErrorMessage` sets `tnRef = useRef(tn)` and updates it in `useEffect(() => { tnRef.current = tn }, [tn])`. The `useCallback` dependencies are now only three `useState` setters (MailClient.tsx:398, 420, 421). So the resolver's identity no longer depends on the locale. I checked the windows where a stale translator could be used:

- **First render:** the ref is initialised with the current `tn`, so the first render is never stale.
- **Concurrent rendering:** the ref is written only in a committed effect. A render that React throws away (the switch runs in a transition via `LanguageSelector` → `router.refresh()`) cannot leak a translator into the ref.
- **Same tick as the switch:** the translator is read only after `await res.json()`. A `folder_account_mismatch` that resolves after the transition commits but before passive effects are flushed would show the previous language once. I could not reproduce this. The probe resolves a mismatch from a `useLayoutEffect` in the switching commit, and it came back in the new language for both switches. → **P3-1** (cosmetic, theoretical).

### Other locale-bound dependencies in the bootstrap/sync chain

I ran a static AST probe (`locale-deps.ts`) over MailClient.tsx and all hooks under `app/components/mailclient`. It follows `useTranslations`/`useLocale` results through `useCallback`/`useMemo` dependency arrays and derived constants.

- **useAccountController:** `loadInitialData` depends on `apiFetch` (`[clientId]`), `readErrorMessage` (now stable), `reportError` (`[pushNotice]`, and `pushNotice` uses `[]`) and setters. No locale-bound input remains, so the mount effect at :436 does not re-run.
- **useStartupSync, useEmptyFolderRepair, useReminderNotifications, useInAppNotices:** no locale-bound names.
- **useSyncController:** its own `tn` only feeds `handleSyncLaunchError`. That and `refreshFolders` are called from plain per-render functions. No effect depends on them.
- **MailClient:** `refreshFolders` (`useCallback` at :532 with `tn` in its deps) still changes identity when the language changes. It is passed to useAccountController (passthrough only) and useSyncController (call sites only). Three effects re-run on a language switch:
  - :5137 and :5168 re-subscribe their storage listeners (via `refreshFolders`).
  - :3985 re-binds the keyboard listener (via `selectionActions` → `addTopicToMessages` → `tn`).

  None of them resets the bootstrap, the selection or the composer. → **P3-2** (latent: the same pattern that caused D1).
- **Server push:** `onMailboxesChanged` → `loadInitialData` fires only on membership changes (lib/userEvents.ts). The preferences route does not emit it.
- **Outside the chain:** CopyToAccountDialog:65 (refetches folders only while the dialog is open) and HtmlMessage:485 (rebuilds `srcdoc`, and a ref keeps the quote state). Neither file is in the round-9 delta.

### DOM probe (`.tmp/verify-r9/localeSwitch.probe.dom.test.tsx`, run with `--config=bunfig.dom.toml`)

**Setup:**
- It mounts the real `useApiErrorMessage`, `useAccountController` and `useStartupSync` under a stateful `I18nTestProvider`. The locale switch runs through `startTransition`.
- A MailClient-shaped `refreshFolders` with `tn` in its deps is passed in.
- An inline-reply component with local state sits below the `ready` gate.
- The probe types into subject and body, then switches de → en → de.

**Results:**
- With HEAD: **1 pass / 0 fail / 13 `expect()`**. Calls stay exactly `["/api/auth/me", "/api/accounts/account-b/folders"]`, the startup sync runs once, `setInitialDataReady(false)` is called only by the initial load, the composer mounts once, and its subject and body survive.
- Negative control with the 98b4301 resolver (`PROBE_VARIANT=prefix`): **0 pass / 1 fail**. The composer state is lost after the first switch.

### Existing tests

- **Regression suite:** useAccountController + useSyncController (×2) + useEmptyFolderRepair DOM give **30 pass / 0 fail / 120 `expect()`**.
- **Regression test copy:** a `.tmp` copy of `useAccountController.dom.test.tsx` against the pre-fix resolver gives **12 pass / 1 fail** (the new case fails). Against the fixed resolver it gives **13 / 0**. This matches the commit claim.
- **Production build on HEAD:** `bun run build` rc 0 (Next.js 16.4.2 Turbopack).
- **Browser scenario:** `tests/browser/auth/shell.spec.ts:229` alone (`AUTH_BROWSER_USE_BUILD=1 AUTH_BROWSER_PORT=3799`) gives **1 passed (9.0 s)**, rc 0.

## 2. fc8aab3: resync child pass marker from a JUnit report

| Run | unset | `CLAUDECODE=1` |
|---|---|---|
| In-tree file | 2 pass / 0 fail | 2 pass / 0 fail |
| `.tmp` copy, unchanged | 2 / 0 | 2 / 0 |
| `.tmp` copy, one real-IMAP assertion broken (`senderKey` expected `deliberately-wrong@example.test`) | **parent fails** (1 pass / 1 fail, rc 1) | **parent fails** (rc 1) |
| `.tmp` copy + case named ``special <tag> & "double" 'single' [x] (y) $z ^a* +b? {c} \|d \e`` | passes | passes |
| `.tmp` copy + deliberately failing special-char case | fails | fails |

The in-tree file also passes with `AGENT=1` (2/0).

**XML escaping:**
- Bun writes the name as `special &lt;tag&gt; &amp; &quot;double&quot; &apos;single&apos; …` in a self-closing `<testcase/>`. The commit's `escapeXml` + `escapeRegExp` matches it.
- The same regex does **not** match the failing case (`<testcase …>` with a child).
- Filtered-out cases are written as `<testcase …><skipped/></testcase>`, which the regex does not match either.

So the JUnit assertion discriminates on its own, apart from the child's exit code and the `0 fail` check. Copies ran from cwd `.tmp/verify-r9/resync` with a local `bunfig.toml`, because the root `bunfig.toml` ignores `.tmp/**`.

## 3. Test-only commits after 98b4301

- **2bb472f** (shell.spec.ts:264): `Account settings` → `Postfacheinstellungen`.
  - `Settings.accountTitle` was introduced by 79283b2 (absent in round 8 `11dc3c5`). de = "Postfacheinstellungen", en = "Account settings".
  - The step runs while the UI is German.
  - Assertions are unchanged (`aria-current`, the subject value, body visibility).
- **34a5263** (qa-unread-count): two selectors changed.
  - `[title^="INBOX ("]` → `[title^="Inbox ("]`: `folderPathLabel` now uses `getFolderDisplayPath` (79283b2/8273d15), and `Folders.inbox` en = "Inbox".
  - `Watcher: idling` → `Watcher: Listening for new mail`: ShellSidebar now passes `watcherStates.<state>` (79283b2). en `idling` = "Listening for new mail", and that label is unique among the six states, so the check still pins the `idling` state.
  - Count expectations, polls and timeouts are unchanged.
- **6e4bbcb** (qa-compose): four labels now come from the catalog: `Shell.sidebar.toggle`, `Shell.compose.new`, `Folders.drafts`, `Reader.editDraft`.
  - The en values equal the previous literals ("Toggle sidebar", "New mail", "Drafts", "Edit draft").
  - de = "Seitenleiste umschalten", "Neue E-Mail", "Entwürfe", "Entwurf bearbeiten".
  - `openCompose` gets a default parameter equal to the old literal.
  - No assertion, matrix size or timeout changed. `new RegExp(chrome.drafts)` builds an unescaped regex from catalog text → **P3-4** (trivial).

None of these changes removes or weakens a check.

## 4. Record numbers vs gates.jsonl and logs

- **Gate entries:** all 46 gate JSON lines in the `e70c30b` body are identical to `evidence/logs/gates.jsonl`: same order and names, same command, `exit_code`, `duration_seconds` and `env_*`. The verbatim block equals `gates-verbatim.txt` except for one trailing newline.
- **Result excerpts checked against logs:**
  - ci-r9-final: 2915/0/18271 across 315 files [419.72 s]; DOM 564/0/3200 across 73 files [79.08 s].
  - ci (98b4301): 2915/0 and 563/0/3191.
  - ci-claudecode-env: 2913/2/18269.
  - stress: 8745/0/54813.
  - lint: 181 (0 errors), pre-fix 182 (1 error).
  - typecheck: 1,244 files.
  - auth-browser-r9-final: 20 passed, :229 in 7.1 s. auth-browser-r9-fix: 19 passed / 1 failed at :229.
  - qa-compose: r9 6 passed / 2 failed; r9d 2 passed; r9e 8 passed.
  - r4-probe: 4 passed.
  - qa-specs-r9c: 1, 1 and 3 passed.
  - resync-alone: 0/2. resync-alone-claudecode-final: 2/0.
  - migration: v2→v3 and v0→v3 with 81 guards, both master gates PASS; suites 50/0/513.
  - shutdown: 37 ms and 110 ms, not forced.
  - bundle JSON: 26/2207028/664843, 24/2141750/658194 and 24/2141813/658204.
  - All `.rc` files are 0.
- **Production delta:** `git diff 98b4301..HEAD` touches only one production file (`useApiErrorMessage.ts`, +6/-2). The other five files are tests.

## Findings (P3 only)

- **P3-1, stale-translator window:** `tnRef` is updated in a passive effect, after commit. A `folder_account_mismatch` that resolves between the transition commit and the passive-effect flush would show the previous language once. Not reproduced. Optional mitigation: update the ref in `useLayoutEffect`.
- **P3-2, `refreshFolders` still locale-bound:** MailClient.tsx:532 has `tn` in its `useCallback` deps and is passed into useAccountController and useSyncController. Today nothing memoized or effect-bound there depends on it, so there is no reset. A future dependency on it in a mount effect would bring D1 back. Suggestion: the same ref pattern, or adopt this probe's composer-survival case as a permanent DOM test (the in-tree regression covers only the resolver).
- **P3-3, regression test scope:** the in-tree regression test rerenders synchronously. It covers neither the transition path nor composer state. The browser scenario :229 and this probe do.
- **P3-4, regex from catalog text:** `new RegExp(chrome.drafts)` in qa-compose.spec.ts is unescaped. It is harmless for the current values.

## Not rerun here

- stress after 97dd982
- migration, shutdown and locale gates
- smoke, security and privacy
- the full test:ci, auth, QA and r4 suites

I verified those results from their logs (check 4), and 97dd982 is client-hook only.
