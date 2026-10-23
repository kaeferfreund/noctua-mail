# React Hooks 7.1.1 cleanup ledger

Research date: 2026-10-23. Owner: `umbau-thread`. Temporary policy expiry: **2026-11-15**.

Read-only application analysis at `/home/monkey/code/noctua-mail/wt-next-spike`, branch `spike/next-16-4`, commit `6fa896e49f464a978f1a6683a1b43e7519abe3b4` (Next 16.4.2, React 19.3.1, hooks 7.1.1; Bun 1.4.4). Only this requested brief is a durable output. No tracked source/config/package files were changed; no commit, stash, server, or access to another worktree was used. Git object metadata was read through this checkout to identify i18n ownership overlaps.

## Implemented round-8 refresh (2026-10-23)

Worktree `/home/monkey/code/noctua-mail/wt-deps-next16`, branch `chore/deps-next-16-4`, exact base `11dc3c5f50826aec73f7547990e3b89def1dd08b`. R5 was fixed in `6976e0a`; the pre-existing calendar-conflicts error and its cleanup-ref warning were fixed in `81f5cc5`. The inventory in section 2 now uses current source positions. Research counts and command results explicitly labeled as spike observations below remain historical evidence.

Final implemented ESLint JSON: **0 errors / 181 warnings**, exit **0**. There are **156 outstanding scoped hooks findings**: refs 57, preserve-manual-memoization 52, set-state-in-effect 40, purity 4, immutability 2, use-memo 1. Other warnings: exhaustive-deps 22, no-img-element 2, obsolete OverflowTabsList disable 1. Delta from 183: R5 removes one purity diagnostic; the calendar-conflicts ref cleanup removes one existing exhaustive-deps warning. Its former error is fixed, not waived. The policy has **29 exact files / 37 rule-file pairs**. Reminder purity remains at error. No correctness/dependency rule was weakened.

**Ownership retained:** MailClient refs cluster = **Umbau cleanup after i18n 2b/3 + sender slice 3**. Keep MailClient / ComposeOrchestrator and every WAIT marker below reserved until that handoff. Owner `umbau-thread`, expiry **2026-11-15**, remain unchanged.

## 1. Method, baseline subtraction, and counts (historical spike)

The exact inventory command, from the spike checkout:

```sh
nice -n 10 bunx eslint . --format json > .tmp/hooks-cleanup/lint.json
```

It exited **1**, reproducing **158 errors / 26 warnings**. `bun run lint` runs the same repository ESLint gate; JSON was used here to retain separate diagnostics at identical positions.

Baseline provenance: [deps-next-16-4-spike.md](deps-next-16-4-spike.md), section “Lint delta and recommended policy”, records an independently rerun baseline at `9424150f5aa0a446ed9bc03ed199e6825129467d`: **1 error / 25 warnings**. Its subtraction method matches a **multiset** of diagnostic signatures `(relative file, ruleId, severity, position, message)`, removing one baseline occurrence for each matching target occurrence. Normalize the checkout prefix in paths (including source locations embedded in compiler messages) before comparing. Retain line/column and endLine/endColumn when present. Do not deduplicate diagnostics just because file/rule/line is equal.

For reproducibility, the signature/subtraction algorithm is:

```python
# records() flattens ESLint's per-file messages; normalize() replaces the
# checkout prefix with a stable marker in filePath and embedded message paths.
from collections import Counter

def signature(d):
    return (d["file"], d.get("ruleId"), d["severity"],
            d.get("line"), d.get("column"),
            d.get("endLine"), d.get("endColumn"), d["message"])

remaining = Counter(signature(normalize(d)) for d in records(baseline_json))
delta = []
for d in records(target_json):
    key = signature(normalize(d))
    if remaining[key]:
        remaining[key] -= 1
    else:
        delta.append(d)
```

This follow-up did **not** reinstall old dependencies or independently rerun the old baseline: the spike removed its earlier scratch JSON. The full installed-target inventory was rerun. Its single documented baseline error is `app/components/calendar/useCalendarConflicts.ts:58:5`, `react-hooks/set-state-in-effect`; subtracting that exact known location/rule from the 158 current errors yields the 157 rows below and exactly reproduces the spike's per-rule/per-file delta. The retained 25 baseline warnings are 23 `exhaustive-deps` and two `@next/next/no-img-element` warnings. The one new warning is the unused `react-hooks/set-state-in-effect` disable in `app/components/account-settings/OverflowTabsList.tsx:51:5`. It is outside the 157-error table. Thus the baseline provenance is documented rather than presented as a new exact-message comparison against unavailable JSON.

| New rule | Findings |
| --- | ---: |
| `react-hooks/refs` | 57 |
| `react-hooks/preserve-manual-memoization` | 52 |
| `react-hooks/set-state-in-effect` | 40 |
| `react-hooks/purity` | 5 |
| `react-hooks/immutability` | 2 |
| `react-hooks/use-memo` | 1 |
| **Total new errors** | **157** |

Compiler and cache flags stay off. “Memoization hint” is a compiler bailout, not proof of a runtime bug. “Style / false positive” includes valid effect-loading/reset patterns that cause an extra commit; it does not certify the entire surrounding feature bug-free. “Real bug” includes concrete concurrency hazards (shared ref writes from abandoned renders, render output derived from nonreactive refs) even if the current test suite has not reproduced an incident. Such ref findings need focused correctness work; the requested temporary warnings defer those larger owner-coordinated changes.

## 2. Complete diagnostic inventory, grouped by file

All paths and positions below refer to the implemented round-8 upgrade tree (base `11dc3c5`, calendar fixes `6976e0a` / `81f5cc5`); 156 outstanding scoped warnings. R5 is resolved and removed from the active inventory. Each row is one emitted diagnostic. Columns and occurrence numbers disambiguate multiple findings at the same line; repeated same-position diagnostics are intentionally retained.

**Ownership holds:** MailClient and ComposeOrchestrator are explicitly reserved by the other team. Local Git commit metadata identifies i18n surface work in `b2cddb5cdfb9ec8d37da478fab277be486461bf3` (2026-10-23 04:19 UTC), plus infrastructure `1d0e187` for Preferences and useAccountController. Those overlapping files are marked **WAIT** below: no cleanup patch there until owner handoff. This is a snapshot of known touched files, not a claim to inspect another team's uncommitted work. Expand the hold if owners announce further i18n files; the broader future-slice scope in [i18n-plan.md](i18n-plan.md) is not evidence that every such file is currently being edited.

### `app/components/MailClient.tsx` — 54 findings

**WAIT — heavy edit (explicit owner reservation); also i18n b2cddb5.**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 1 | `app/components/MailClient.tsx:390:48` | `react-hooks/immutability` | **style / false positive** — Callback captures stable setViewMessage; it executes after declaration/commit, not while constructing the closure. |
| 2 | `app/components/MailClient.tsx:434:48` | `react-hooks/purity` | **style / false positive** — Fallback Date.now creates a persisted transport ID only on missing storage; no ID is rendered. See individual verdict. |
| 3 | `app/components/MailClient.tsx:434:62` | `react-hooks/purity` | **style / false positive** — Fallback Math.random creates a persisted transport ID only on missing storage; no ID is rendered. See individual verdict. |
| 4 | `app/components/MailClient.tsx:536:72` | `react-hooks/immutability` | **style / false positive** — Async response callback captures stable setAuthState declared later; invoked after render and after an await. |
| 5 | `app/components/MailClient.tsx:894:25` | `react-hooks/refs` | **real bug** — Sync hook consumes previous-render search refs before lines 961–962 update them; a scope-only change can leave reconciliation stale. |
| 6 | `app/components/MailClient.tsx:897:28` | `react-hooks/refs` | **real bug** — Sync hook consumes previous-render search refs before lines 961–962 update them; a scope-only change can leave reconciliation stale. |
| 7 | `app/components/MailClient.tsx:898:18` | `react-hooks/refs` | **real bug** — Sync hook consumes previous-render search refs before lines 961–962 update them; a scope-only change can leave reconciliation stale. |
| 8 | `app/components/MailClient.tsx:964:3` | `react-hooks/refs` | **real bug** — Search-scope mirror is written after the sync hook reads it; speculative render also leaks uncommitted scope. |
| 9 | `app/components/MailClient.tsx:965:3` | `react-hooks/refs` | **real bug** — Search-scope mirror is written after the sync hook reads it; speculative render also leaks uncommitted scope. |
| 10 | `app/components/MailClient.tsx:1012:3` | `react-hooks/refs` | **real bug** — Render writes currentKeyRef.current; an abandoned render can publish uncommitted callback/scope state to async consumers. |
| 11 | `app/components/MailClient.tsx:1078:5` | `react-hooks/set-state-in-effect` | **style / false positive** — Normalizes unavailable event grouping after commit; derive the effective group or normalize in the initiating action. |
| 12 | `app/components/MailClient.tsx:1308:7` | `react-hooks/use-memo` | **style / false positive** — Computed dependency fingerprint covers the consumed folder IDs/specialUse fields; analyzer requires a simple dependency expression. |
| 13 | `app/components/MailClient.tsx:1379:3` | `react-hooks/refs` | **real bug** — Render writes refreshMailboxDataRef.current; an abandoned render can publish uncommitted callback/scope state to async consumers. |
| 14 | `app/components/MailClient.tsx:1380:3` | `react-hooks/refs` | **real bug** — Render writes setMessagesRef.current; an abandoned render can publish uncommitted callback/scope state to async consumers. |
| 15 | `app/components/MailClient.tsx:1394:11` | `react-hooks/refs` | **style / false positive** — Render-only duplicate-log deduplication fingerprint; affects diagnostics, not mailbox data/output. Move logging to an effect. |
| 16 | `app/components/MailClient.tsx:1395:9` | `react-hooks/refs` | **style / false positive** — Render-only duplicate-log deduplication fingerprint; affects diagnostics, not mailbox data/output. Move logging to an effect. |
| 17 | `app/components/MailClient.tsx:1402:16` | `react-hooks/refs` | **style / false positive** — Render-only duplicate-log deduplication fingerprint; affects diagnostics, not mailbox data/output. Move logging to an effect. |
| 18 | `app/components/MailClient.tsx:1403:7` | `react-hooks/refs` | **style / false positive** — Render-only duplicate-log deduplication fingerprint; affects diagnostics, not mailbox data/output. Move logging to an effect. |
| 19 | `app/components/MailClient.tsx:1445:23` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer cannot retain this useMemo/useCallback identity; existing runtime memoization still applies with compiler off. |
| 20 | `app/components/MailClient.tsx:1535:61` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats }, [activeAccountId, activeTopicSuggestionRankedMessages, messageById]); as mutable; existing manual memoization is retained with compiler off. |
| 21 | `app/components/MailClient.tsx:1580:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer cannot retain this useMemo/useCallback identity; existing runtime memoization still applies with compiler off. |
| 22 | `app/components/MailClient.tsx:1620:7` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats messageById as mutable; existing manual memoization is retained with compiler off. |
| 23 | `app/components/MailClient.tsx:1629:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer cannot retain this useMemo/useCallback identity; existing runtime memoization still applies with compiler off. |
| 24 | `app/components/MailClient.tsx:1721:7` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats messageById as mutable; existing manual memoization is retained with compiler off. |
| 25 | `app/components/MailClient.tsx:2080:5` | `react-hooks/set-state-in-effect` | **style / false positive** — Rebuilds topic lookup state from inputs in an effect; extra commit, no demonstrated correctness failure. |
| 26 | `app/components/MailClient.tsx:2311:53` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer cannot retain this useMemo/useCallback identity; existing runtime memoization still applies with compiler off. |
| 27 | `app/components/MailClient.tsx:2331:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats refreshMailboxData as mutable; existing manual memoization is retained with compiler off. |
| 28 | `app/components/MailClient.tsx:2337:7` | `react-hooks/set-state-in-effect` | **style / false positive** — Clears topic suggestions when scope is invalid; keep scope-keyed data instead of effect reset. |
| 29 | `app/components/MailClient.tsx:2382:7` | `react-hooks/set-state-in-effect` | **style / false positive** — Clears topic suggestions before refresh; preserve scope isolation while removing the extra commit. |
| 30 | `app/components/MailClient.tsx:2591:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Inferred dependency differs from the manual list; compiler bailout alone does not prove a stale closure. |
| 31 | `app/components/MailClient.tsx:2600:6` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats [evictMessageCaches, setMessages, viewMessage?.id] as mutable; existing manual memoization is retained with compiler off. |
| 32 | `app/components/MailClient.tsx:2885:21` | `react-hooks/set-state-in-effect` | **style / false positive** — Purges collaboration cache on user change; required isolation intent, extra commit is the flagged issue. |
| 33 | `app/components/MailClient.tsx:2886:21` | `react-hooks/set-state-in-effect` | **style / false positive** — Invalidates collaboration state through a synchronous helper; intentional refresh, extra commit. |
| 34 | `app/components/MailClient.tsx:2913:3` | `react-hooks/refs` | **real bug** — Render writes activeMessageRef.current; an abandoned render can publish uncommitted callback/scope state to async consumers. |
| 35 | `app/components/MailClient.tsx:3165:3` | `react-hooks/refs` | **real bug** — Render writes updateMessagesRef.current; an abandoned render can publish uncommitted callback/scope state to async consumers. |
| 36 | `app/components/MailClient.tsx:3546:6` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats [messageById, threadScopeMessageById] as mutable; existing manual memoization is retained with compiler off. |
| 37 | `app/components/MailClient.tsx:3788:3` | `react-hooks/refs` | **real bug** — Render writes updateFlagStateRef.current; an abandoned render can publish uncommitted callback/scope state to async consumers. |
| 38 | `app/components/MailClient.tsx:3791:3` | `react-hooks/refs` | **real bug** — Render writes toggleTodoFlagRef.current; an abandoned render can publish uncommitted callback/scope state to async consumers. |
| 39 | `app/components/MailClient.tsx:3794:3` | `react-hooks/refs` | **real bug** — Render writes clearTodoFlagRef.current; an abandoned render can publish uncommitted callback/scope state to async consumers. |
| 40 | `app/components/MailClient.tsx:3905:28` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer cannot retain this useMemo/useCallback identity; existing runtime memoization still applies with compiler off. |
| 41 | `app/components/MailClient.tsx:4029:28` | `react-hooks/refs` | **style / false positive** — bindSelectionActions only creates event handlers; getTargets and ref-backed actions execute on selection, not during binding. |
| 42 | `app/components/MailClient.tsx:4032:32` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats [bulkContextMenuSelection, getSelectionActionTargets, selectionActions] as mutable; existing manual memoization is retained with compiler off. |
| 43 | `app/components/MailClient.tsx:4032:59` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats [bulkContextMenuSelection, getSelectionActionTargets, selectionActions] as mutable; existing manual memoization is retained with compiler off. |
| 44 | `app/components/MailClient.tsx:4037:28` | `react-hooks/refs` | **style / false positive** — bindSelectionActions only creates event handlers; getTargets and ref-backed actions execute on selection, not during binding. |
| 45 | `app/components/MailClient.tsx:4037:46` | `react-hooks/refs` | **style / false positive** — bindSelectionActions only creates event handlers; getTargets and ref-backed actions execute on selection, not during binding. |
| 46 | `app/components/MailClient.tsx:4040:6` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats [getSelectionActionTargets, selectionActions, selectionStore] as mutable; existing manual memoization is retained with compiler off. |
| 47 | `app/components/MailClient.tsx:4040:33` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats [getSelectionActionTargets, selectionActions, selectionStore] as mutable; existing manual memoization is retained with compiler off. |
| 48 | `app/components/MailClient.tsx:4148:7` | `react-hooks/set-state-in-effect` | **style / false positive** — Clears related-message context when inputs disappear; derive or key the context. |
| 49 | `app/components/MailClient.tsx:4226:7` | `react-hooks/set-state-in-effect` | **style / false positive** — Seeds search from URL after commit; external URL synchronization, not a proven render loop. |
| 50 | `app/components/MailClient.tsx:4934:9` | `react-hooks/set-state-in-effect` | **style / false positive** — Normalizes folder selection for special view; combine with the navigation transition. |
| 51 | `app/components/MailClient.tsx:4967:9` | `react-hooks/set-state-in-effect` | **style / false positive** — Normalizes thread mode for view eligibility; derive effective mode or update at navigation. |
| 52 | `app/components/MailClient.tsx:4979:5` | `react-hooks/set-state-in-effect` | **style / false positive** — Clears selected message on scope change; keep the reset atomic with scope selection. |
| 53 | `app/components/MailClient.tsx:5107:3` | `react-hooks/refs` | **real bug** — Render writes resolveMessageByExternalMessageIdRef.current; an abandoned render can publish uncommitted callback/scope state to async consumers. |
| 54 | `app/components/MailClient.tsx:5164:5` | `react-hooks/set-state-in-effect` | **style / false positive** — Opens calendar status panel in response to reminder state; intentional UI reaction, extra commit. |

### `app/components/account-settings/tabs/CategorizationTabContent.tsx` — 1 findings

**Available for cleanup first — no current heavy-edit overlap identified in the supplied scope/local i18n metadata..**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 55 | `app/components/account-settings/tabs/CategorizationTabContent.tsx:139:10` | `react-hooks/set-state-in-effect` | **style / false positive** — Starts external debug-data load whose helper sets loading state before await; effect fetch is appropriate. |

### `app/components/account-settings/tabs/McpTabContent.tsx` — 1 findings

**Available for cleanup first — no current heavy-edit overlap identified in the supplied scope/local i18n metadata..**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 56 | `app/components/account-settings/tabs/McpTabContent.tsx:125:12` | `react-hooks/set-state-in-effect` | **style / false positive** — Starts token fetch with synchronous loading state; external synchronization, not a demonstrated loop. |

### `app/components/account-settings/tabs/MembersTabContent.tsx` — 1 findings

**WAIT — i18n b2cddb5.**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 57 | `app/components/account-settings/tabs/MembersTabContent.tsx:73:5` | `react-hooks/set-state-in-effect` | **style / false positive** — Sets directory loading before asynchronous member fetch; external lifecycle state. |

### `app/components/account-settings/tabs/PreferencesTabContent.tsx` — 1 findings

**WAIT — i18n b2cddb5 and infrastructure 1d0e187.**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 58 | `app/components/account-settings/tabs/PreferencesTabContent.tsx:45:5` | `react-hooks/set-state-in-effect` | **style / false positive** — Resets loading/error/draft flags before preference fetch; explicit scoped load lifecycle. |

### `app/components/account-settings/tabs/TopicsTabContent.tsx` — 1 findings

**Available for cleanup first — no current heavy-edit overlap identified in the supplied scope/local i18n metadata..**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 59 | `app/components/account-settings/tabs/TopicsTabContent.tsx:125:40` | `react-hooks/set-state-in-effect` | **style / false positive** — Starts topic fetch when the tab becomes active; helper sets loading before await. |

### `app/components/admin/AdminAuditLog.tsx` — 1 findings

**WAIT — i18n b2cddb5.**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 60 | `app/components/admin/AdminAuditLog.tsx:29:26` | `react-hooks/set-state-in-effect` | **style / false positive** — Starts audit-log load; synchronous loading flag in async helper is flagged. |

### `app/components/admin/AdminMailboxes.tsx` — 1 findings

**WAIT — i18n b2cddb5.**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 61 | `app/components/admin/AdminMailboxes.tsx:70:26` | `react-hooks/set-state-in-effect` | **style / false positive** — Starts mailbox load; synchronous loading flag in async helper is flagged. |

### `app/components/admin/AdminPanel.tsx` — 1 findings

**WAIT — i18n b2cddb5.**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 62 | `app/components/admin/AdminPanel.tsx:56:26` | `react-hooks/set-state-in-effect` | **style / false positive** — Starts admin data load; synchronous loading flag in async helper is flagged. |

### `app/components/calendar/EventDialog.tsx` — 1 findings

**Available for cleanup first — no current heavy-edit overlap identified in the supplied scope/local i18n metadata..**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 63 | `app/components/calendar/EventDialog.tsx:64:5` | `react-hooks/set-state-in-effect` | **style / false positive** — Copies event fields into editable form on event/open transition; prefer a keyed form initializer. |

### `app/components/calendar/useEventReminderState.ts` — 1 finding

**Available for cleanup first — no current heavy-edit overlap identified in the supplied scope/local i18n metadata..**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 64 | `app/components/calendar/useEventReminderState.ts:129:26` | `react-hooks/set-state-in-effect` | **style / false positive** — Async reminder discovery updates state only after await fetchCalendarReminders; analyzer propagates setter usage to the effect call. |

### `app/components/calendar/useEventResponseState.ts` — 2 findings

**Available for cleanup first — no current heavy-edit overlap identified in the supplied scope/local i18n metadata..**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 65 | `app/components/calendar/useEventResponseState.ts:98:5` | `react-hooks/set-state-in-effect` | **style / false positive** — Mirrors saved RSVP/occurrence props into local state; keyed response state avoids a stale intermediate commit. |
| 66 | `app/components/calendar/useEventResponseState.ts:104:5` | `react-hooks/set-state-in-effect` | **style / false positive** — Mirrors reply-requested prop to dialog draft state; initialize when opening the dialog. |

### `app/components/mailclient/AccountReloginDialog.tsx` — 1 findings

**Available for cleanup first — no current heavy-edit overlap identified in the supplied scope/local i18n metadata..**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 67 | `app/components/mailclient/AccountReloginDialog.tsx:41:5` | `react-hooks/set-state-in-effect` | **style / false positive** — Seeds credential form from the selected account; keyed account form removes effect reset. |

### `app/components/mailclient/RecipientAliasManager.tsx` — 1 findings

**Available for cleanup first — no current heavy-edit overlap identified in the supplied scope/local i18n metadata..**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 68 | `app/components/mailclient/RecipientAliasManager.tsx:53:9` | `react-hooks/set-state-in-effect` | **style / false positive** — Seeds alias edit mode from selected alias after commit; initialize with the edit action. |

### `app/components/mailclient/TopicPickerDialog.tsx` — 1 findings

**Available for cleanup first — no current heavy-edit overlap identified in the supplied scope/local i18n metadata..**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 69 | `app/components/mailclient/TopicPickerDialog.tsx:61:7` | `react-hooks/set-state-in-effect` | **style / false positive** — Seeds selected topics when opening; initialize selection with dialog identity/open action. |

### `app/components/mailclient/composition/ComposeFields.tsx` — 1 findings

**Available for cleanup first — no current heavy-edit overlap identified in the supplied scope/local i18n metadata..**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 70 | `app/components/mailclient/composition/ComposeFields.tsx:216:7` | `react-hooks/set-state-in-effect` | **style / false positive** — Clears recipient suggestions for invalid/empty input; derive visible options or key results to token. |

### `app/components/mailclient/composition/ComposeOrchestrator.tsx` — 43 findings

**WAIT — heavy edit (explicit owner reservation).**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 71 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:328:3` | `react-hooks/refs` | **real bug** — Render publishes uncommitted compose scope/state through a shared ref to async draft/send consumers. |
| 72 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:437:3` | `react-hooks/refs` | **real bug** — Render publishes uncommitted compose scope/state through a shared ref to async draft/send consumers. |
| 73 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:551:7` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats composeIncludeInvite as mutable; existing manual memoization is retained with compiler off. |
| 74 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:552:7` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats composeInviteAllDay as mutable; existing manual memoization is retained with compiler off. |
| 75 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:553:7` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats composeInviteEnd as mutable; existing manual memoization is retained with compiler off. |
| 76 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:554:7` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats composeInviteLocation as mutable; existing manual memoization is retained with compiler off. |
| 77 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:555:7` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats composeInviteRecurrenceRule as mutable; existing manual memoization is retained with compiler off. |
| 78 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:556:7` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats composeInviteStart as mutable; existing manual memoization is retained with compiler off. |
| 79 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:685:43` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer cannot retain this useMemo/useCallback identity; existing runtime memoization still applies with compiler off. |
| 80 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:694:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats composeSessionVersionRef as mutable; existing manual memoization is retained with compiler off. |
| 81 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:695:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats draftSaveTimerRef as mutable; existing manual memoization is retained with compiler off. |
| 82 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:696:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats pendingDraftSaveRef as mutable; existing manual memoization is retained with compiler off. |
| 83 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:697:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats setDraftSaving as mutable; existing manual memoization is retained with compiler off. |
| 84 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:733:46` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer cannot retain this useMemo/useCallback identity; existing runtime memoization still applies with compiler off. |
| 85 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:815:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats attachmentLoadState as mutable; existing manual memoization is retained with compiler off. |
| 86 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:817:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats composeDraftIdRef as mutable; existing manual memoization is retained with compiler off. |
| 87 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:818:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats composeMode as mutable; existing manual memoization is retained with compiler off. |
| 88 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:819:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats composeReplyMessage as mutable; existing manual memoization is retained with compiler off. |
| 89 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:820:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats composeSubject as mutable; existing manual memoization is retained with compiler off. |
| 90 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:825:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats sendingMailRef as mutable; existing manual memoization is retained with compiler off. |
| 91 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:826:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats setComposeOpen as mutable; existing manual memoization is retained with compiler off. |
| 92 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:827:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats setComposeView as mutable; existing manual memoization is retained with compiler off. |
| 93 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:830:44` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer cannot retain this useMemo/useCallback identity; existing runtime memoization still applies with compiler off. |
| 94 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:860:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats attachmentLoadState as mutable; existing manual memoization is retained with compiler off. |
| 95 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:866:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats sendingMailRef as mutable; existing manual memoization is retained with compiler off. |
| 96 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:869:38` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer cannot retain this useMemo/useCallback identity; existing runtime memoization still applies with compiler off. |
| 97 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:879:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats composeBaselineHashRef as mutable; existing manual memoization is retained with compiler off. |
| 98 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:881:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats currentDraftHashRef as mutable; existing manual memoization is retained with compiler off. |
| 99 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:882:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats lastDraftHashRef as mutable; existing manual memoization is retained with compiler off. |
| 100 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:883:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats setComposeAttachments as mutable; existing manual memoization is retained with compiler off. |
| 101 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:884:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats setComposeDraftId as mutable; existing manual memoization is retained with compiler off. |
| 102 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:885:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats setComposeOpen as mutable; existing manual memoization is retained with compiler off. |
| 103 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:886:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats setComposeView as mutable; existing manual memoization is retained with compiler off. |
| 104 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:1249:49` | `react-hooks/refs` | **real bug** — Render chooses draft payload format from mutable last-edit ref; ref-only edits do not schedule a reactive update. |
| 105 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:1253:22` (occurrence 1/2) | `react-hooks/refs` | **real bug** — Save availability is computed from mutable saved-hash ref outside a reactive snapshot; can render stale button state. |
| 106 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:1253:22` (occurrence 2/2) | `react-hooks/refs` | **real bug** — Save availability is computed from mutable saved-hash ref outside a reactive snapshot; can render stale button state. |
| 107 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:1271:5` (occurrence 1/3) | `react-hooks/refs` | **real bug** — Unsaved-change/close-protection output reads a ref that markComposeDirty changes without scheduling state. |
| 108 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:1271:5` (occurrence 2/3) | `react-hooks/refs` | **real bug** — Unsaved-change/close-protection output reads a ref that markComposeDirty changes without scheduling state. |
| 109 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:1271:5` (occurrence 3/3) | `react-hooks/refs` | **real bug** — Unsaved-change/close-protection output reads a ref that markComposeDirty changes without scheduling state. |
| 110 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:1303:40` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer cannot retain this useMemo/useCallback identity; existing runtime memoization still applies with compiler off. |
| 111 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:1305:7` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats }, [composeDirtyRef]); as mutable; existing manual memoization is retained with compiler off. |
| 112 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:1317:5` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer cannot retain this useMemo/useCallback identity; existing runtime memoization still applies with compiler off. |
| 113 | `app/components/mailclient/composition/ComposeOrchestrator.tsx:1321:21` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Analyzer treats [jumpToMessage, setComposeView] as mutable; existing manual memoization is retained with compiler off. |

### `app/components/mailclient/composition/DetachedComposeWindowClient.tsx` — 6 findings

**Available for cleanup first — no current heavy-edit overlap identified in the supplied scope/local i18n metadata..**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 114 | `app/components/mailclient/composition/DetachedComposeWindowClient.tsx:104:54` | `react-hooks/purity` | **style / false positive** — Fallback Date.now creates a persisted transport ID only on missing storage; no ID is rendered. See individual verdict. |
| 115 | `app/components/mailclient/composition/DetachedComposeWindowClient.tsx:104:68` | `react-hooks/purity` | **style / false positive** — Fallback Math.random creates a persisted transport ID only on missing storage; no ID is rendered. See individual verdict. |
| 116 | `app/components/mailclient/composition/DetachedComposeWindowClient.tsx:489:13` (occurrence 1/4) | `react-hooks/refs` | **style / false positive** — Imperative renderInlineCard only returns InlineComposeSlot with stable setters; live draft context/portal stays in its owning render tree. |
| 117 | `app/components/mailclient/composition/DetachedComposeWindowClient.tsx:489:13` (occurrence 2/4) | `react-hooks/refs` | **style / false positive** — Imperative renderInlineCard only returns InlineComposeSlot with stable setters; live draft context/portal stays in its owning render tree. |
| 118 | `app/components/mailclient/composition/DetachedComposeWindowClient.tsx:489:13` (occurrence 3/4) | `react-hooks/refs` | **style / false positive** — Imperative renderInlineCard only returns InlineComposeSlot with stable setters; live draft context/portal stays in its owning render tree. |
| 119 | `app/components/mailclient/composition/DetachedComposeWindowClient.tsx:489:13` (occurrence 4/4) | `react-hooks/refs` | **style / false positive** — Imperative renderInlineCard only returns InlineComposeSlot with stable setters; live draft context/portal stays in its owning render tree. |

### `app/components/mailclient/composition/useComposeTranslation.ts` — 2 findings

**Available for cleanup first — no current heavy-edit overlap identified in the supplied scope/local i18n metadata..**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 120 | `app/components/mailclient/composition/useComposeTranslation.ts:117:3` | `react-hooks/refs` | **real bug** — Render updates composeTabRef.current; async/event consumers can observe values from an abandoned render. |
| 121 | `app/components/mailclient/composition/useComposeTranslation.ts:119:3` | `react-hooks/refs` | **real bug** — Render updates stateRef.current; async/event consumers can observe values from an abandoned render. |

### `app/components/mailclient/composition/useDraftManager.ts` — 4 findings

**Available for cleanup first — no current heavy-edit overlap identified in the supplied scope/local i18n metadata..**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 122 | `app/components/mailclient/composition/useDraftManager.ts:138:7` | `react-hooks/refs` | **real bug** — Render changes account scope/version refs; an abandoned account switch can invalidate a still-current draft save. |
| 123 | `app/components/mailclient/composition/useDraftManager.ts:139:5` | `react-hooks/refs` | **real bug** — Render changes account scope/version refs; an abandoned account switch can invalidate a still-current draft save. |
| 124 | `app/components/mailclient/composition/useDraftManager.ts:140:5` (occurrence 1/2) | `react-hooks/refs` | **real bug** — Render changes account scope/version refs; an abandoned account switch can invalidate a still-current draft save. |
| 125 | `app/components/mailclient/composition/useDraftManager.ts:140:5` (occurrence 2/2) | `react-hooks/refs` | **real bug** — Render changes account scope/version refs; an abandoned account switch can invalidate a still-current draft save. |

### `app/components/mailclient/message/CalendarEventPreview.tsx` — 2 findings

**Available for cleanup first — no current heavy-edit overlap identified in the supplied scope/local i18n metadata..**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 126 | `app/components/mailclient/message/CalendarEventPreview.tsx:173:5` | `react-hooks/set-state-in-effect` | **style / false positive** — Resets invite-state overrides on new preview inputs; key overrides by message/event. |
| 127 | `app/components/mailclient/message/CalendarEventPreview.tsx:273:10` | `react-hooks/set-state-in-effect` | **style / false positive** — Starts stored-event fetch and sets loading synchronously; external fetch lifecycle. |

### `app/components/mailclient/message/MessageViewOrchestrator.tsx` — 8 findings

**Available for cleanup first — no current heavy-edit overlap identified in the supplied scope/local i18n metadata..**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 128 | `app/components/mailclient/message/MessageViewOrchestrator.tsx:247:21` | `react-hooks/set-state-in-effect` | **style / false positive** — Closes notes when thread/account changes; keyed pane avoids the extra commit. |
| 129 | `app/components/mailclient/message/MessageViewOrchestrator.tsx:264:3` | `react-hooks/refs` | **real bug** — Render updates messageTranslationsRef.current; async/event consumers can observe values from an abandoned render. |
| 130 | `app/components/mailclient/message/MessageViewOrchestrator.tsx:273:3` | `react-hooks/refs` | **real bug** — Render updates messageTabsRef.current; async/event consumers can observe values from an abandoned render. |
| 131 | `app/components/mailclient/message/MessageViewOrchestrator.tsx:278:3` | `react-hooks/refs` | **real bug** — Render updates collapsedMessagesRef.current; async/event consumers can observe values from an abandoned render. |
| 132 | `app/components/mailclient/message/MessageViewOrchestrator.tsx:579:5` | `react-hooks/set-state-in-effect` | **style / false positive** — Closes explanation on scope change; key dialog state to the selected suggestion. |
| 133 | `app/components/mailclient/message/MessageViewOrchestrator.tsx:589:5` | `react-hooks/set-state-in-effect` | **style / false positive** — Clears stale suggestion explanation on scope change; scope-keyed results preserve isolation. |
| 134 | `app/components/mailclient/message/MessageViewOrchestrator.tsx:617:5` | `react-hooks/set-state-in-effect` | **style / false positive** — Synchronizes collapsed-thread defaults; use an explicit keyed/default expansion model. |
| 135 | `app/components/mailclient/message/MessageViewOrchestrator.tsx:755:17` | `react-hooks/refs` | **style / false positive** — Imperative renderInlineCard only returns InlineComposeSlot with stable setters; live draft context/portal stays in its owning render tree. |

### `app/components/mailclient/messagelist/MessageListHeader.tsx` — 4 findings

**Available for cleanup first — no current heavy-edit overlap identified in the supplied scope/local i18n metadata..**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 136 | `app/components/mailclient/messagelist/MessageListHeader.tsx:187:5` | `react-hooks/set-state-in-effect` | **style / false positive** — Mirrors parent message-view prop into delayed local control state; preserve pending edits when refactoring. |
| 137 | `app/components/mailclient/messagelist/MessageListHeader.tsx:191:5` | `react-hooks/set-state-in-effect` | **style / false positive** — Mirrors group-by prop into delayed local control state; intentional optimistic control, extra commit. |
| 138 | `app/components/mailclient/messagelist/MessageListHeader.tsx:195:5` | `react-hooks/set-state-in-effect` | **style / false positive** — Mirrors sort prop into delayed local control state; retain delayed commit semantics. |
| 139 | `app/components/mailclient/messagelist/MessageListHeader.tsx:199:5` | `react-hooks/set-state-in-effect` | **style / false positive** — Mirrors thread-date-source prop into delayed local control state; retain delayed commit semantics. |

### `app/components/mailclient/useAccountController.ts` — 1 findings

**WAIT — i18n infrastructure 1d0e187 (locale publication).**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 140 | `app/components/mailclient/useAccountController.ts:428:5` | `react-hooks/set-state-in-effect` | **style / false positive** — Bootstraps account data in an effect; readiness/loading flags are set before the asynchronous fetch. |

### `app/components/mailclient/useMessageData.ts` — 1 findings

**Available for cleanup first — no current heavy-edit overlap identified in the supplied scope/local i18n metadata..**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 141 | `app/components/mailclient/useMessageData.ts:108:5` | `react-hooks/set-state-in-effect` | **style / false positive** — Resets paginated message state on scope change; key the result state to scope rather than flash old data. |

### `app/components/mailclient/useMessageMutations.ts` — 1 findings

**Available for cleanup first — no current heavy-edit overlap identified in the supplied scope/local i18n metadata..**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 142 | `app/components/mailclient/useMessageMutations.ts:572:41` | `react-hooks/preserve-manual-memoization` | **memoization hint (compiler cannot preserve)** — Only viewMessage.id is used; analyzer infers the entire object, so the narrower dependency is intentional. |

### `app/components/mailclient/useSyncController.ts` — 4 findings

**Available for cleanup first — no current heavy-edit overlap identified in the supplied scope/local i18n metadata..**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 143 | `app/components/mailclient/useSyncController.ts:496:3` | `react-hooks/refs` | **real bug** — Render updates currentViewIncludesFolderRef.current; async/event consumers can observe values from an abandoned render. |
| 144 | `app/components/mailclient/useSyncController.ts:535:3` | `react-hooks/refs` | **real bug** — Render updates syncFolderWithBackgroundRef.current; async/event consumers can observe values from an abandoned render. |
| 145 | `app/components/mailclient/useSyncController.ts:750:3` | `react-hooks/refs` | **real bug** — Render updates syncAccountRef.current; async/event consumers can observe values from an abandoned render. |
| 146 | `app/components/mailclient/useSyncController.ts:887:3` | `react-hooks/refs` | **real bug** — Render updates recomputeThreadsRef.current; async/event consumers can observe values from an abandoned render. |

### `app/hooks/useMailboxSummaries.ts` — 1 findings

**Available for cleanup first — no current heavy-edit overlap identified in the supplied scope/local i18n metadata..**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 147 | `app/hooks/useMailboxSummaries.ts:25:3` | `react-hooks/refs` | **real bug** — Render updates callbacks.current; async/event consumers can observe values from an abandoned render. |

### `app/hooks/useThreadCollab.ts` — 9 findings

**Available for cleanup first — no current heavy-edit overlap identified in the supplied scope/local i18n metadata..**

| # | File:line:column | Rule | Classification and reason |
| ---: | --- | --- | --- |
| 148 | `app/hooks/useThreadCollab.ts:90:3` | `react-hooks/refs` | **real bug** — Render updates onCommit.current; async/event consumers can observe values from an abandoned render. |
| 149 | `app/hooks/useThreadCollab.ts:93:3` | `react-hooks/refs` | **real bug** — Render updates onReadDenied.current; async/event consumers can observe values from an abandoned render. |
| 150 | `app/hooks/useThreadCollab.ts:95:3` | `react-hooks/refs` | **real bug** — Render updates sessionRef.current; async/event consumers can observe values from an abandoned render. |
| 151 | `app/hooks/useThreadCollab.ts:99:3` | `react-hooks/refs` | **real bug** — Render updates onUpdate.current; async/event consumers can observe values from an abandoned render. |
| 152 | `app/hooks/useThreadCollab.ts:105:3` | `react-hooks/refs` | **real bug** — Render updates currentKey.current; async/event consumers can observe values from an abandoned render. |
| 153 | `app/hooks/useThreadCollab.ts:301:75` (occurrence 1/2) | `react-hooks/refs` | **real bug** — Visible collaboration data/members come from a mutable cache without a subscribed render snapshot; can tear or miss updates. |
| 154 | `app/hooks/useThreadCollab.ts:301:75` (occurrence 2/2) | `react-hooks/refs` | **real bug** — Visible collaboration data/members come from a mutable cache without a subscribed render snapshot; can tear or miss updates. |
| 155 | `app/hooks/useThreadCollab.ts:310:12` (occurrence 1/2) | `react-hooks/refs` | **real bug** — Visible collaboration data/members come from a mutable cache without a subscribed render snapshot; can tear or miss updates. |
| 156 | `app/hooks/useThreadCollab.ts:310:12` (occurrence 2/2) | `react-hooks/refs` | **real bug** — Visible collaboration data/members come from a mutable cache without a subscribed render snapshot; can tear or miss updates. |


## 3. Individual assessment of all five purity and two immutability findings

Verdicts: **one real purity bug requiring a source fix before release; six benign findings eligible for temporary warning** (four purity diagnostics for two persisted IDs, two declaration-order diagnostics). These are seven diagnostics, not seven independent code sites.

The spike summary's shorthand “immutability = callback captures later setViewMessage” describes only the first immutability diagnostic. The second actually captures **setAuthState**; both are assessed below.

### R1 — MailClient.tsx:431:48, `react-hooks/purity` (Date.now)

Source, lines 426–435:

```tsx
const clientId = useMemo(() => {
  if (typeof window === "undefined") return "";
  const key = "noctuaClientId";
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    window.localStorage.setItem(key, id);
  }
  return id;
}, []);
```

The rule analyzes the memo callback as render work and flags the fallback clock call. `useMemo([])` is **not** a lazy `useState` initializer and is not a lifetime/once-only guarantee. Nevertheless, this particular ID is immediately persisted and subsequent recomputation reads the same stored value. The server returns an empty string, but `clientId` is not interpolated into JSX, text, DOM IDs or keys: it is used for `X-Noctua-Client`, reminder-notification coordination, and a detached-message handoff initiated later by an action. Therefore the server/client ID difference does not itself change hydration markup. The fallback is also short-circuited when crypto.randomUUID succeeds; that fact alone would not excuse a render-changing random value.

**Verdict: benign → warn with reason.** This is a persistent transport/coordination identifier, not a newly changing render ID. The localStorage write is still a render side effect, so “benign” is a bounded runtime assessment, not a claim that the implementation is pure. Later extract a shared client-ID facility initialized outside render with deterministic SSR state; preserve the header on first requests. Do not merely swap to lazy state and assume SSR/client differences are solved. MailClient cleanup waits for owner handoff.

### R2 — MailClient.tsx:431:62, `react-hooks/purity` (Math.random)

The exact flagged expression in R1 is:

```tsx
id = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
```

The rule separately reports `Math.random()` in the same fallback. It is evaluated only if there is no stored ID and randomUUID is unavailable/nullish, then persisted under the same key. Re-rendering does not generate a new ID while that key is retained. It does not drive rendered output.

**Verdict: benign → warn with reason.** Same persistent-ID rationale as R1, assessed separately for the random call. Do not generalize this exception to random JSX keys/IDs, or to render-time values regenerated on every render. If the ID later becomes rendered state, reconsider this verdict immediately.

### R3 — DetachedComposeWindowClient.tsx:104:54, `react-hooks/purity` (Date.now)

Source, lines 99–107:

```tsx
const clientId = useMemo(() => {
  if (typeof window === "undefined") return "";
  const key = "noctuaClientId";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  window.localStorage.setItem(key, next);
  return next;
}, []);
```

The rule flags Date.now in the render-time memo callback. Here the only `clientId` consumer is `apiFetch`, which adds `X-Noctua-Client` to requests. No rendered markup uses it. Existing storage is returned before generation, and the newly generated value is persisted before returning. Discarding a memo does not by itself regenerate the ID because storage is checked again.

**Verdict: benign → warn with reason.** This clock call seeds a stored request identifier rather than clock-dependent UI. The same render-side-effect caveat applies; consolidate this duplicate initialization with R1 during later cleanup. Do not conflate it with the separate `makeNoticeId()` event-handler helper or `formatRelativeTime()`; neither is one of these seven diagnostics.

### R4 — DetachedComposeWindowClient.tsx:104:68, `react-hooks/purity` (Math.random)

The exact flagged expression in R3 is:

```tsx
const next = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
```

The random fallback is a separate emitted diagnostic. Its result is persisted and used only for request headers; it is not a React key, DOM ID, or visible string and does not regenerate during ordinary rerenders.

**Verdict: benign → warn with reason.** Safe to defer under the same narrow stored-ID assumptions as R3. Storage deletion/replacement by another context is an external change, not evidence that the present render recomputes random output on each render. Storage failures and simultaneous-tab ID initialization are separate existing robustness questions, not newly demonstrated hydration bugs in this finding.

### R5 — resolved in `6976e0a` (historical useEventReminderState.ts:84:19), `react-hooks/purity` (Date.now)

Source, lines 82–96:

```tsx
const canScheduleReminder = (() => {
  if (typeof canonicalStartMs !== "number" || !Number.isFinite(canonicalStartMs)) return false;
  const nowMs = Date.now();
  if (!recurrenceRule?.trim()) return canonicalStartMs > nowMs;
  const next = resolveNextReminderOccurrence({
    eventStartAtMs: canonicalStartMs,
    eventEndAtMs: eventEndAtMs,
    leadMinutes: 0,
    recurrenceRule,
    recurrenceDates,
    excludedDates
  }, nowMs);
  return Boolean(next && next.eventStartAtMs > nowMs);
})();
```

The clock is read on **every render** and changes `canScheduleReminder`, which drives `EventDetailActions.tsx:119`'s `disabled` attribute and line 120's tooltip. The same props/state can produce different output on opposite sides of an event boundary; SSR and hydration can disagree if they straddle it. The existing comment about staying fresh is also insufficient: time passing does not itself schedule a render, so the button may remain enabled after the event starts while the page is idle.

**Verdict: real bug → fix now in the real upgrade branch. Do not ship a warning-only treatment.** Minimal proposed patch: keep time in explicit state with deterministic server/initial-client `null`, initialize from an asynchronous timer callback, and update every second while mounted. Effects clean up both timers, including StrictMode cleanup. The button starts conservatively disabled until the first client tick; it then updates with at most one-second normal timer granularity (background tabs may throttle timers). Calendar persistence remains responsible for rechecking actual scheduling validity at action time. A shared clock store can replace per-instance timers later if measured mount counts warrant it.

The patch below was a proposal during research and is now applied in `6976e0a`, with four focused DOM tests covering clock boundaries, recurrence, hydration/StrictMode cleanup and click-time occurrence resolution. `nice -n 10 git apply --check .tmp/hooks-cleanup/reminder.patch` passed against the spike. A targeted stdin lint check of the patched source is recorded in section 4. Runtime boundary/hydration tests remain for the real implementation branch.

```diff
--- a/app/components/calendar/useEventReminderState.ts
+++ b/app/components/calendar/useEventReminderState.ts
@@ -74,14 +74,20 @@
   const [savingReminder, setSavingReminder] = useState(false);
   const [deletingReminder, setDeletingReminder] = useState(false);
 
-  // Evaluated on every render rather than memoized. `Date.now()` has to
-  // stay fresh so the Schedule button doesn't sit enabled after the
-  // event has already started; memoizing would pin the timestamp for
-  // as long as the other deps don't change. The recurrence resolver is
-  // cheap enough that per-render evaluation is a non-issue.
+  // Start with the same value on the server and the first client render.
+  const [nowMs, setNowMs] = useState<number | null>(null);
+  useEffect(() => {
+    const updateNow = () => setNowMs(Date.now());
+    const firstTick = window.setTimeout(updateNow, 0);
+    const timer = window.setInterval(updateNow, 1000);
+    return () => {
+      window.clearTimeout(firstTick);
+      window.clearInterval(timer);
+    };
+  }, []);
+
   const canScheduleReminder = (() => {
-    if (typeof canonicalStartMs !== "number" || !Number.isFinite(canonicalStartMs)) return false;
-    const nowMs = Date.now();
+    if (nowMs === null || typeof canonicalStartMs !== "number" || !Number.isFinite(canonicalStartMs)) return false;
     if (!recurrenceRule?.trim()) return canonicalStartMs > nowMs;
     const next = resolveNextReminderOccurrence({
       eventStartAtMs: canonicalStartMs,
```

### R6 — MailClient.tsx:387:48, `react-hooks/immutability` (setViewMessage)

Source, lines 386–388:

```tsx
const isMobile = useIsMobile();
const clearMobileMessage = useCallback(() => setViewMessage(null), []);
const [viewMessage, setViewMessage] = useState<Message | null>(null);
```

The compiler diagnostic is “Cannot access variable before it is declared”; this is not a state-object mutation. JavaScript creates a closure at the useCallback call; it does **not** evaluate that closure's body then. The setter is initialized on the next line and the callback is passed to `Shell` as `mobileNavigation.clearMessage` at line 5485, for later navigation handling. React state setters are stable, so the empty dependency list does not freeze a changing setter.

**Verdict: benign → warn with reason.** No temporal-dead-zone read occurs on this execution path, and no mutable React state is assigned directly. After the owner's handoff, place the existing `useState` declaration immediately before the `useCallback` declaration to make the analyzer happy. That optional ordering tidy-up is not a release correctness fix and must not be performed concurrently with MailClient's heavy edits.

### R7 — MailClient.tsx:533:72, `react-hooks/immutability` (setAuthState)

Relevant source, lines 487, 513–514, 532–533 and 656 (unrelated intervening lines omitted):

```tsx
const readErrorMessage = useCallback(async (res: Response) => {
  // ...
  try {
    const data = (await res.json()) as {
      // response fields ...
    };
    // ...
    // Personal auth 401 is logout. Form proof/permission failures use 403.
    if (res.status === 401 && !responsePath?.startsWith("/api/ba/")) setAuthState("unauth");
    // ...
  }
  // ...
}, []);
// ...
const [authState, setAuthState] = useState<"loading" | "ok" | "unauth">("loading");
```

The quoted fragment is an excerpt, not a complete replacement function. The rule flags a later lexical declaration captured by the response-reading callback. The callback executes on response handling after render; additionally its use of the setter follows `await res.json()`, so it is not a synchronous read while constructing the callback. `setAuthState` is the stable React setter, not an ordinary mutable local.

**Verdict: benign → warn with reason.** No demonstrated declaration-order runtime bug. Once MailClient is handed off, move the existing auth state declaration above readErrorMessage as a small ordering cleanup; preserve its initialization and every error/401 branch. Do not create duplicate auth state or bypass logout handling to silence this diagnostic.

## 4. Exact temporary overrides and verification

Implemented below: **29 per-file blocks / 37 exact rule/file pairs**. Originally the spike proposal had 38 pairs. Append these blocks after `routeNoRoute` in the existing `defineConfig([ ... ])` array (add a comma after `routeNoRoute`). They retain all unrelated flat-config rules. There are no directory globs and no changes to `rules-of-hooks`, `exhaustive-deps`, or the baseline calendar-conflicts file. Each block carries the required ownership comment.

**Release condition:** the full owner-approved allowlist below reproduces the spike's scope; it is not sufficient to ship by itself. R5's real clock bug must be fixed in the same real upgrade change. After applying R5, remove `"react-hooks/purity": "warn"` from the `useEventReminderState.ts` block: that exception is then unnecessary, leaving **37 pairs** and preserving error-level enforcement against a render-clock regression. The measured full-list warning count is 183 on the untouched spike; the source fix removes one finding. Six benign R1–R4/R6–R7 diagnostics remain eligible for deferral. The refs correctness hazards are explicitly owned follow-up work, rather than described as compiler-only noise.

```js
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/MailClient.tsx"],
    rules: {
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/use-memo": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/account-settings/tabs/CategorizationTabContent.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/account-settings/tabs/McpTabContent.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/account-settings/tabs/MembersTabContent.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/account-settings/tabs/PreferencesTabContent.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/account-settings/tabs/TopicsTabContent.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/admin/AdminAuditLog.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/admin/AdminMailboxes.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/admin/AdminPanel.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/calendar/EventDialog.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/calendar/useEventReminderState.ts"],
    rules: {
      "react-hooks/set-state-in-effect": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/calendar/useEventResponseState.ts"],
    rules: {
      "react-hooks/set-state-in-effect": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/mailclient/AccountReloginDialog.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/mailclient/RecipientAliasManager.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/mailclient/TopicPickerDialog.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/mailclient/composition/ComposeFields.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/mailclient/composition/ComposeOrchestrator.tsx"],
    rules: {
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/refs": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/mailclient/composition/DetachedComposeWindowClient.tsx"],
    rules: {
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/mailclient/composition/useComposeTranslation.ts"],
    rules: {
      "react-hooks/refs": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/mailclient/composition/useDraftManager.ts"],
    rules: {
      "react-hooks/refs": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/mailclient/message/CalendarEventPreview.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/mailclient/message/MessageViewOrchestrator.tsx"],
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/mailclient/messagelist/MessageListHeader.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/mailclient/useAccountController.ts"],
    rules: {
      "react-hooks/set-state-in-effect": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/mailclient/useMessageData.ts"],
    rules: {
      "react-hooks/set-state-in-effect": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/mailclient/useMessageMutations.ts"],
    rules: {
      "react-hooks/preserve-manual-memoization": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/components/mailclient/useSyncController.ts"],
    rules: {
      "react-hooks/refs": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/hooks/useMailboxSummaries.ts"],
    rules: {
      "react-hooks/refs": "warn"
    }
  },
  // owner: umbau-thread, expires: 2026-11-15, tracked in briefs/lint-react-hooks-cleanup.md
  {
    files: ["app/hooks/useThreadCollab.ts"],
    rules: {
      "react-hooks/refs": "warn"
    }
  }
```

The verification scratch config imported `../../eslint.config.mjs` and exported `[...base, ...theExactBlocksAbove]`. ESLint with an alternate `--config` resolves the file patterns from this invocation's working directory, the spike root. The tracked config was never edited. The original config's `.tmp/` ignore kept scratch scripts/configs out of the inventory.

Historical spike verification (before the implementation refresh above): exactly one full-tree verification run used the scratch config:

```sh
nice -n 10 bunx eslint . --format json \
  --config .tmp/hooks-cleanup/eslint.config.mjs \
  > .tmp/hooks-cleanup/overridden.json
```

**Observed: exit 1, 1 error / 183 warnings. Baseline-subtracted: 0 new errors / 158 new warnings** (157 reclassified errors plus the one obsolete-disable warning). The remaining error is exclusively the pre-existing `app/components/calendar/useCalendarConflicts.ts:58:5`, `react-hooks/set-state-in-effect`.

A literal full-tree **0 errors** result cannot be achieved on this unchanged spike with only the authorized new rule/file overrides: it would also require fixing or suppressing that baseline error. This analysis did neither. Treat the gate as **zero new errors**, not as a clean raw ESLint exit; no successful exit is claimed. The release owners must separately reconcile that baseline if they require an absolute zero-error gate.

Warning breakdown after the scratch overrides:

| Rule/category | Warnings |
| --- | ---: |
| `react-hooks/refs` | 57 |
| `react-hooks/preserve-manual-memoization` | 52 |
| `react-hooks/set-state-in-effect` (new scoped findings only) | 40 |
| `react-hooks/purity` | 5 |
| `react-hooks/immutability` | 2 |
| `react-hooks/use-memo` | 1 |
| Existing `react-hooks/exhaustive-deps` | 23 |
| Existing `@next/next/no-img-element` | 2 |
| New unused-disable directive | 1 |
| **Total** | **183** |

R5's patch was also checked by passing the proposed source through stdin under its real filename, with purity explicitly restored to **error** so a warning override could not hide failure:

```sh
nice -n 10 bunx eslint --stdin \
  --stdin-filename app/components/calendar/useEventReminderState.ts \
  --format json --config .tmp/hooks-cleanup/eslint.config.mjs \
  --rule 'react-hooks/purity:error' \
  < .tmp/hooks-cleanup/reminder-proposed.ts \
  > .tmp/hooks-cleanup/reminder-verified.json
```

**Observed targeted result: exit 0, 0 errors / 1 warning** (`set-state-in-effect` at shifted line 129, the pre-existing reminder-discovery effect). The timer effect introduced no new lint diagnostic. This verifies syntax/rule handling, not behavior or hydration in a browser. Arithmetic expectation after applying R5 plus the scoped config on the real branch: **1 baseline error / 182 warnings**. Removing the obsolete OverflowTabsList disable as a separate owner-coordinated tidy-up would leave **1 / 181**. Neither projected full-tree result is represented as an additional full-tree run.

All scratch artifacts were worktree-local under `.tmp/hooks-cleanup/` and were deleted after the checks and this evidence were incorporated into the brief.

## 5. Cleanup plan and ordering

The active table contains **45 “real bug” diagnostics** (overlapping refs concurrency/reactivity hazards), **52 memoization hints**, and **59 style / false-positive diagnostics**, totaling **156**. R5 was the 46th real-bug diagnostic and is now fixed. Diagnostic count is not the number of distinct fixes: repeated source ranges and propagated compiler reports often share one root cause. The seven detailed verdicts above are **1 real / 6 benign**.

Estimates are engineering time including focused checks, excluding ownership waits and full release-gate runtime. They overlap; fixing ref/data flow often removes dependent memoization reports.

| Rule | Recommended real fix pattern | Estimated effort | Ordering / acceptance |
| --- | --- | --- | --- |
| `purity` (4 outstanding; R5 fixed) | Apply R5's explicit, hydration-consistent clock state/timer. Move client-ID creation into a shared non-render lifecycle/request facility later; keep stable persisted IDs and first-request coordination. Do not “fix” a changing render value with useMemo([]). | R5: 0.5–1 day including time/hydration checks; two ID sites together: 0.5 day after handoff. | **First**, R5 in the non-reserved calendar hook. Remove its purity exception immediately after the source fix. Detached ID extraction can precede MailClient's adoption if the shared interface is agreed; MailClient waits. |
| `refs` (57) | Render-visible values need state or a subscribed, cached `useSyncExternalStore` snapshot. Publish async callback/session mirrors only after commit, using an appropriate effect/layout effect or effect-event boundary with verified ordering. Make search scope an explicit input instead of reading the previous-render ref before updating it. Keep async scope/version validation; never delete guards to silence lint. Extract a declarative InlineComposeSlot for the bounded renderInlineCard exceptions; move duplicate-log fingerprint work into an effect. | 4–7 days across nine files; draft/account/session changes need most care. | Non-reserved useDraftManager, useThreadCollab, useMailboxSummaries, useSyncController and useComposeTranslation first. After handoff, coordinate MailClient and ComposeOrchestrator search/draft/dirty-state changes. Use canceled-render/account-switch/late-response cases; the existing collaboration and send-race suites must retain their ordering guarantees. |
| `set-state-in-effect` (40 new) | Derive noneditable state from props; initialize form state in a keyed form or explicit open/edit action; model fetched data as scope-keyed `{key, status, data}`. Keep fetching/subscribing in effects and set state from actual async completion/event callbacks. A targeted explained exception is reasonable for intentional loading flags; do not insert artificial promises/timers merely to evade the rule. | 2–4 days; usually 15–60 minutes per small surface, longer for message/search scope. | Start with non-reserved calendar/event forms, relogin/alias/topic dialogs, ComposeFields, message previews and list header. Preserve optimistic/debounced header controls, unsent form edits and account isolation. Members/Preferences/admin/useAccountController/MailClient wait for i18n/heavy-edit handoff. Baseline useCalendarConflicts is a separate existing item, not added to this new-error waiver. |
| `immutability` (2) | Reorder the existing setter declarations before their callback definitions; retain hook initialization and callback behavior. These two diagnostics are benign captures, not invitations to mutate state or add duplicate state. | 15–30 minutes plus focused navigation/logout checks. | MailClient only: **wait** for handoff, then fix alongside its nearby ordering cleanup. No release bug patch required for these two. |
| `use-memo` (1) | Prefer `[folders]` if the identity contract permits. Otherwise compute an explicit stable folder-structure input using a safe canonical representation, then memoize from that source; avoid hidden dependency omissions or disabling exhaustive-deps. | 0.25 day including identity-sensitive list checks. | MailClient **waits**. Preserve the excluded-folder-set stability needed by useMessageListDerivedState; do not change it casually during owner edits. |
| `preserve-manual-memoization` (52) | Fix mutable/ref data flow first; then align dependencies with the values actually read, or extract primitives when the analyzer infers a whole object. Keep existing useMemo/useCallback identity contracts unless measured/proven unnecessary. Do not remove memoization just to clear a compiler bailout. In useMessageMutations the callback consumes only viewMessage.id, so extracting that primitive can make the intent explicit. | 1–3 days after ref fixes; not 52 independent rewrites. | Non-reserved useMessageMutations first. Most findings are MailClient (16) and ComposeOrchestrator (35), so finish those **after owner handoff and ref fixes**. Recheck counts before editing: many may disappear together. |

Suggested sequence:

1. **Real upgrade owner — completed:** R5 and the baseline calendar-conflicts error are fixed; the reviewed exact-file policy is applied with reminder purity at error. Compiler/cache flags remain off. Raw lint now exits 0 with 181 warnings; historical spike runs below remain labeled separately.
2. **Free files first:** repair draft/account-version and collaboration/cache/ref correctness paths; then smaller effect/form cleanup and useMessageMutations's dependency extraction. Keep changes focused so they can be reviewed without the reserved files. Treat IDs/slots/logging as bounded exceptions with the reasons recorded here.
3. **After i18n owner handoff:** re-inventory Members, Preferences, AdminAuditLog, AdminMailboxes, AdminPanel and useAccountController. Work from their new source/line positions and keep translated data/state codes intact. No blind application of spike line numbers.
4. **After umbau ownership handoff:** repair MailClient and ComposeOrchestrator together where scope/dirty-state contracts cross the seam. Ensure abandoned renders cannot publish a different account/session to active requests. Then tidy setter order and memo dependency representation. Related future i18n work must reserve additional files explicitly.
5. For each completed rule/file pair, remove that exception and lint the affected files with the rule at **error**, then run the repository's baseline-subtracted full lint gate. Remove all temporary blocks by **2026-11-15**; if any remain, the named owner must make an explicit follow-up decision with remaining diagnostics, rather than silently extending the expiry. Do not enable React Compiler as part of this cleanup by default.

Implementation validation to perform in the real branch: fake-clock tests for before/after event start, recurring occurrences, timer cleanup/StrictMode, initial server/client output agreement, and scheduling checks on click; existing draft-send/account-switch/collaboration tests for ref changes; focused form/selection/navigation tests for effects and memo identity. This research ran no application server or behavior suite, and applied no proposed source fix to the spike.
