# i18n plan: German UI for the Noctua fork (Codex gpt-6.1-sol research, 2026-10-22, read-only; baseline wt-ui-shell @ ba9d34a)

Recommendation: **next-intl without locale routing**, German as the fallback language, English retained. Start the migration after `feat/collab-ui` and the replacement login/password screens have landed. Paths are relative to the worktree.

## 1. Inventory

Static scan: **2,368 probable user-facing string occurrences** (1,635 distinct normalized texts) across 588 production TS/TSX files, plus three English notification templates in `public/sw.js`. Plan for ~2,400 application-owned string sites; refresh after the pending branches merge.

| Area | Occurrences | Principal locations |
|---|---:|---|
| Shell | 57 | `app/components/shell/**` |
| Generated UI primitives | 10 | `app/components/ui/{dialog,sheet,sidebar,command}.tsx` |
| Existing authentication | 18 | `app/components/auth/LoginOverlay.tsx` |
| List and reader | 400 | `app/components/mailclient/{messagelist,message}/**` |
| Compose and Lexical | 194 | `ComposeEditor.tsx`, `lexical/**`, `mailclient/composition/**` |
| Settings | 349 | `AccountSettingsModal.tsx`, `account-settings/**` |
| Calendar UI | 183 | `app/components/calendar/**` |
| Other components/controllers/notices/utilities | 416 | `MailClient.tsx`, other `mailclient/**`, attachments, recipients |
| Detached windows and calendar import | 30 | `app/{compose,message,calendar}/window/**`, `app/calendar/import/page.tsx` |
| API messages | 296 | `app/api/**` |
| Shared/server helpers | 408 | `lib/**` (dates, errors, calendar, notifications) |
| Other metadata | 7 | `app/layout.tsx`, `app/manifest.ts` |
| **Total** | **2,368** | |

Classification: 472 JSX text nodes; 126 literals in JSX expressions; 340 attribute/prop candidates (77 aria-label, 92 title, 72 tooltip, 27 placeholder, 72 other); 494 display-property/default literals; 370 message/error-call arguments; 566 other prose/templates.

Largest files: MailClient.tsx 71, ThreadMessageCard.tsx 57, TopicsTabContent.tsx 49, AdminTabContent.tsx 45, AccountTabContent.tsx 41, DeleteConfirmDialog.tsx 40, lib/calendarEventDiffFormat.ts 40, McpTabContent.tsx 36, MessageMenu.tsx 36, ComposeMessageField.tsx 35, MessageListHeader.tsx 35, CategorizationTabContent.tsx 33, PreferencesTabContent.tsx 32, ProcessStatusPopover.tsx 31, CalendarTabContent.tsx 26.

Other inventory findings:
- Formatting: 31 `Intl`/`toLocale*` calls in 10 files (14 in `lib/dateFormatting.ts`; also lib/calendar.ts, lib/calendarEventDiffFormat.ts, lib/calendarTimezones.ts, lib/mail/imap/sync.ts, lib/buildVersion.ts, CalendarConflictDialog.tsx, ExceptionStatusPopover.tsx, TranslationTabContent.tsx). DeepL counters use `toLocaleString()` without locale; `lib/ui/byteSize.ts` uses `toFixed()` (decimal point).
- PWA: `app/layout.tsx` and `app/manifest.ts` repeat "Modern webmail client prototype"; `lang="en"`; manifest has no `lang`.
- Notifications: foreground in `mailclient/syncNotificationFilter.ts`, reminders in `utils/reminderNotificationHelpers.ts`, background reminders build English text in `public/sw.js:144–155`.
- Generated correspondence: `lib/calendarReply.ts` (RSVP subjects/bodies), `composition/composeInitState.ts` (reply headers, forward metadata). ICS/calendar prose in `lib/{composeInvite,calendarReply,calendarEventDiffFormat,calendarInviteScope,calendarParticipation}.ts`, `lib/caldav/{icsSerializer,emailEventImporter}.ts`.
- Keyboard help: `mailclient/message/MessageViewPane.tsx:41`; sidebar shortcut in `ui/sidebar.tsx`; editor command tooltips.
- CSS: no English prose in `content:` declarations.
- Tests: 8 DOM test files / 36 cases; 47 Testing-Library queries on English copy in 5 files (AttachmentsList 4, shell/Shell 4, shell/ShellSearch 13, shell/MobileFrames 9, composition/sendMailRace 17); 15 English assertions in CalendarEventEmailSnapshot.test.tsx and EventDetailView.test.tsx; helper/route tests assert English messages too. Collaboration/admin/login strings not yet counted.

## 2. Approach comparison

| Criterion | next-intl | Minimal typed t() + context | Lingui | i18next |
|---|---|---|---|---|
| Client bundle | ICU runtime + selected messages | smallest runtime | compiled messages | core + bindings + extras |
| SSR/hydration | built-in App Router config + client provider | safe if server resolves locale | RSC ok, request-scoped instances needed | request-scoped instances |
| Plural/ICU | built in | must implement | ICU + compile tooling | plural suffixes, ICU extra |
| Typed keys | dictionary type augmentation | key union, arg typing extra | typed IDs | resource typing |
| Extraction | keyed catalogs (+ experimental auto) | custom | strong | CLI |
| Bun/test impact | real provider in tests; pure core for helpers | simple provider, many formatter tests | macro compilation in Bun tests | init handling |
| Effort | moderate, predictable | low setup, highest maintenance | more build/test integration | moderate-high |

Real needs found: plurals (selections, deleted messages, attachments, recurrence), relative times (`${seconds}s ago`), recurrence labels ("Monthly on the third Tuesday"), confirmations with counts/subjects/folders, word-order changes. Therefore: **next-intl with explicit semantic keys**; namespaces Shell, Search, Reader, Compose, Settings, Calendar, Auth, Collaboration, Admin, Errors, Notifications, Pwa. `messages/de.json` and `messages/en.json` structurally identical; types from the German catalog; complete messages with named parameters; rich messages when markup moves. Keep ThemeProvider, Radix Theme, portal wrappers, CSS layers. Resolve locale on the server and pass the same locale/messages/time zone to the client provider; never initialize from navigator.language/localStorage after mount. Bundle deltas to be measured in slice 1.

## 3. Locale selection and persistence

Design issue: §6.4 defines per-user **per-mailbox** prefs; an app-wide language needs an additive nullable `users.uiLocale` (values "de" | "en" | null = automatic), returned by `GET /api/auth/me`, updated via a narrow authenticated endpoint (e.g. `PUT /api/auth/preferences`); a validated locale cookie for anonymous/login screens; selector (Deutsch / English / automatisch) on login screens and in Preferences or the user menu. Extension to feat/team-auth after its ownership ends. Resolution order: user preference → device cookie → Accept-Language (quality weights, regional variants) → **German fallback**. No locale in URL paths.

Apply the resolved locale to `<html lang>`, metadata/manifest, detached-window titles, date/time/number/relative-time/list formatting, notifications incl. service worker. Formatting: `de-DE`; English as `en-GB` (24h); `Europe/Berlin` explicit; locale + zone in formatter-cache keys; preserve explicit date-format overrides. German defaults: `22.10.2026`, `14:30`, `5,5 MB`. Calendar: preserve TZID/UTC/all-day/floating semantics; keep canonical `en-CA` date keys; compute Today/grouping/relative days in the display zone; never localize native date-input values, ISO timestamps or ICS. Typography: „…“, umlauts/ß, non-breaking spaces before units, one form of address. Never touch mail bodies, signatures, comments, subjects, user-created names.

## 4. Slices (after collab-ui + login screens; keep test:ci green)

Before: agree conventions now for new code — semantic message IDs, complete sentences, stable enum/action codes, numeric reminder durations, labels separated from identifiers. No broad extraction across owned files yet.

1. **Infrastructure, catalogs, language selection** — package.json, next.config.ts (wrap without losing worker tracing / external packages), app/layout.tsx, new `i18n/request.ts`, `lib/i18n/{config,resolveLocale,translator}.ts`, `messages/{de,en}.json`, type augmentation, shared test-render helpers; extend merged lib/db/{schema,users}.ts, lib/data.ts, /api/auth/me, preference endpoint; selector in auth + preferences/user menu. Import catalogs explicitly (standalone tracing). English test providers keep existing tests on their original copy while production defaults to German. Acceptance: deterministic resolution, state survives language switch, standalone build loads both catalogs.
2. **Shell, navigation, collaboration, list, reader** — shell/**, ui/{dialog,sheet,sidebar,command}.tsx, MailClient.tsx, mailclient/{folder,messagelist,message}/**, lib/ui/{searchFilters,messageView,byteSize}.ts, grouping helpers, merged collab/** and admin/**. First replace text-based behaviour (group identities stable, notice action kinds instead of recognizing "Undo").
3. **Compose, settings, calendar, generated correspondence** — ComposeEditor.tsx, ComposeMarkdownEditor.tsx, lexical/ImageNode.tsx, composition/**, AccountSettingsModal.tsx, account-settings/**, calendar/**, detached/import pages, lib/{dateFormatting,calendar,calendarEventDiffFormat,composeInvite,calendarReply,appBranding}.ts, reminder helpers. FullCalendar locale on both instances; structured recurrence summaries instead of English prose post-processing; capture locale when generated text is inserted into a draft.
4. **Server-originated messages, jobs, notifications, PWA** — app/api/_helpers/{response,message/errorFormatting,smtpUpstreamError}.ts, API routes, lib/{auth,deepl,drafts,syncJobs,syncOperation,workerJobRegistry}.ts, mail-error adapters, calendar import helpers, MailClient error handling, notice/notification hooks, public/sw.js, app/manifest.ts, metadata. Additive structured errors `{ ok:false, code, params, message }`; branch on codes/status/reauthRequired; translate known codes at presentation boundaries; never translate upstream SMTP/IMAP text; job progress via codes/params; same localized representation for foreground and background reminders; locale-aware metadata/manifest without cross-locale caching.
5. **Coverage enforcement and QA** — lib/i18n/*.test.ts, source-scanning test or local ESLint rule, pseudo-locale (ICU literal text expanded 30–50% with delimiters), affected DOM/SSR tests, scripts. Enforce identical key sets, valid ICU, missing translations fail, no new hardcoded JSX prose/display attributes (reviewed exceptions). Check desktop/mobile, light/dark, portals, login states, empty/error states, editor modes, calendar views, detached windows, background reminders, Berlin midnight/DST.

## 5. Risks

| Risk | Evidence | Handling |
|---|---|---|
| Translated text changes behaviour | `useInAppNotices.ts` recognizes `actionLabel === "undo"` | action kind + translated label |
| English labels are identifiers | `lib/messageGrouping.ts` "Today"/"Yesterday"/"All"; `utils/messageHelpers.ts` `label: key` | keep keys, translate labels |
| English errors drive auth behaviour | `MailClient.tsx:440` "unauthorized"; `utils/clientHelpers.ts` re-login patterns | structured codes first |
| Concatenation → wrong German | relativeTimeGroups.ts, delete confirmations, notification builders, recurrence helpers | complete ICU messages |
| Persisted English labels survive a switch | reminder leadLabel, synthetic fallbacks, job messages | derive from numeric/code data |
| Recurrence stays English | `lib/calendar.ts:607` RRule.toText() | structured summaries |
| Translation damages mail parsing | forward marker in composeInitState.ts; `lib/html/quoteBoundary.ts` | recognize English and German markers |
| German overflows controls | shell, tabs, mobile sheets, tooltips | pseudo-locale + real viewport checks |
| Host-dependent formatting | `Intl(undefined)`, `.toLocaleString()`, local Date getters | explicit locale/zone |

Third parties: Radix/shadcn (labels are app-owned: Close, sidebar descriptions, command dialog), Lexical (toolbar/placeholder app-owned), FullCalendar (`@fullcalendar/core/locales/de.js`, set on both instances; custom "New event" button separately), `@uiw/react-md-editor` (localized `commands` + `extraCommands`), rrule (structured summaries preferred). Keep protocol identifiers stable (collab status codes, roles, IMAP keywords, search operators, ICS names, PARTSTAT, MIME headers, TZID, subject prefixes). Keep shortcut bindings; translate descriptions (e.g. "Entf").
