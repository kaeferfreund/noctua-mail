# Email Categorization

This document describes how message categories are detected and how category confidence is calculated in the current codebase.

## Categories

Current categories are:

- `newsletter`
- `notification`
- `transactional`

Primary implementation files:

- `lib/mail/categorization/classifier.ts`
- `lib/mail/categorization/config.ts`
- `lib/mail/imap/sync.ts`
- `lib/db.ts`

## Runtime Flow

1. IMAP sync fetches message source and parses it in `parseImapMessage(...)` (`lib/mail/imap/sync.ts`).
2. `classifyCategoryFromMetadata(input, {config, linearModel, context})` is called for each parsed message (`lib/mail/categorization/classifier.ts`).
3. Classification result is stored on the message object:
   - `message.category = classification.category`
   - `message.categoryScore = classification.confidence`
4. `upsertMessages(...)` persists both values into SQLite `messages.category` and `messages.categoryScore` (`lib/db.ts`).
5. Search badge filters use `m.category = ?` in SQL (`lib/db/messages/query.ts`, `applyBadgeFilters(...)`).

## Configuration

Categorization is controlled by `getCategorizationConfig()` in `lib/mail/categorization/config.ts`.

- Global toggle: `CATEGORIZATION_ENABLED` (currently `true`)
- Minimum confidence threshold: `minConfidence` (currently `0.7`)
- Per-category enable switches:
  - `categories.newsletter`
  - `categories.notification`
  - `categories.transactional`

If globally disabled, classifier always returns `category: null` and `confidence: 0`.

## Detection And Scoring

The classifier is linear-model only. `extractLinearFeatures` and `applyLinearModel`
are in `lib/mail/categorization/linearModel.ts`; the old additive heuristic phases,
body scanning and event/transactional tie-break rules no longer run.

### Inputs and model

Features come from headers, sender address/domain, subject and attachment filenames:

- List headers, one-click unsubscribe and a strong list bundle (`List-ID` plus
  unsubscribe plus List-Post/Archive/URL).
- Reply/thread headers, Auto-Submitted and X-Auto-Response-Suppress.
- Sender local part, full domain and root domain.
- Subject keyword families, thread markers and long numeric IDs.
- PDF attachments and transactional keywords in attachment filenames.

Message body text is not a classifier input. Each category score is its model bias
plus the sum of feature values times category weights. Sync/recompute load the
mailbox model from `category_model_state`; new/missing/invalid stored models use
`createSeededLinearModel()`. The classifier's direct no-model fallback is the empty
`createDefaultLinearModel()`, which has zero biases and weights.

### Suppression and final selection

1. Disabled categorization returns no category, confidence 0 and no signals.
2. Sent, Trash, Junk/Spam special-use folders and matching mailbox-path segments
   return no category with `skip:folder-suppressed`. Mail from an own address
   (including configured identities) returns `skip:sender-is-account`.
3. Reply/reference headers multiply every score by `0.2`, unless the strong list
   bundle is present. Signals record whether suppression applied.
4. Disabled categories are excluded before selection. The highest remaining
   score wins; stable category order resolves exact ties. No enabled category
   returns confidence 0.
5. Below `minConfidence` (default `0.7`), return no category and the nonnegative
   winning score. Otherwise clamp the winning score to `[0,1]` as confidence.

Signals include `classifier:linear-only`, the model example count, meaningful
linear adjustments and any suppression/below-threshold reason. Scores are linear
confidence values, not calibrated probabilities.

## What `categoryScore` Means

- `categoryScore` stores classifier confidence (a 0-1-ish score after safeguards, clamped to 1.0 when categorized).
- A message can have:
  - `category = null` and `categoryScore > 0` (for example below threshold)
  - `category = null` and `categoryScore = 0` (or `NULL` depending on write path)
- `categorySignals` stores the triggered classifier signals (string array), including when `category = null`.

Current write-path detail:

- Sync path stores `categoryScore` as-is (`message.categoryScore ?? null` in `upsertMessages(...)`).
- Sync path also stores `categorySignals` as JSON.
- Recompute path uses `classification.confidence || null`, so exact `0` is written as `NULL`.
- Recompute path stores `categorySignals` from each recomputed classification.

## Recompute Existing Messages

Recompute API endpoints:

- `POST /api/accounts/:accountId/categories/recompute` (`app/api/accounts/[accountId]/categories/recompute/route.ts`)
- `GET /api/accounts/:accountId/categories/recompute/status?jobId=...` (`app/api/accounts/[accountId]/categories/recompute/status/route.ts`)

Worker flow:

1. API starts a Bun worker (`lib/categoryRecomputeJobs.ts`) running `scripts/recomputeCategories.ts`.
2. Worker calls `recomputeCategoriesForAccount(accountId)` (`lib/db.ts`).
3. DB selects source-backed and metadata-only messages, optionally restricted to one folder,
   excluding messages whose `categoryManualState` is `cleared`.
4. Available sources are reparsed in chunks of four; missing/unreadable sources use stored
   subject, sender, thread headers and attachment filenames. Both paths use the same classifier
   and update category, score and signals.

## Search And UI Usage

- Category search badges are defined in `lib/ui/searchFilters.ts`.
- SQL filtering is done via `m.category = ?` in `applyBadgeFilters(...)` (`lib/db.ts`).
- Message/thread badges render category badges in:
  - `app/components/mailclient/CategoryBadge.tsx`
  - `lib/ui/messageView.ts`
- Message action menu includes a `Category` submenu to set/clear categories manually (`app/components/mailclient/message/MessageMenu.tsx`).

## Linear Learning From Feedback

The classifier now supports a lightweight per-account linear calibration model:

- Feature extraction + linear model utilities: `lib/mail/categorization/linearModel.ts`
- Model inference is applied inside `classifyCategoryFromMetadata(...)`; it is the only classifier.
- Sync path loads account model and applies it during parsing/classification (`lib/mail/imap/sync.ts`).
- Recompute path also applies the account model (`recomputeCategoriesForAccount(...)` in `lib/db.ts`).

Manual category actions update both message state and model:

- API endpoint: `POST /api/accounts/:accountId/messages/:messageId/category` (`app/api/accounts/[accountId]/messages/[messageId]/category/route.ts`)
- Backend feedback + online update: `applyCategoryFeedback(...)` (`lib/db.ts`)
- Persistence tables:
  - `category_model_state` (per-account model JSON)
  - `category_feedback_events` (feedback audit trail)

Manual category changes immediately update message `category`, set `categoryScore = 1` when assigned, and store `categorySignals` with manual feedback markers.

### How Learning Data Is Generated

Current behavior:

- Learning/training data is generated by **manual category feedback actions** (`POST /api/accounts/:accountId/messages/:messageId/category`).
- Each manual action writes one row into `category_feedback_events`.
- The per-account model in `category_model_state` is updated online during that action.

Update semantics:

- Set category (`null -> newsletter|notification|transactional`): positive update for selected category.
- Change category (`A -> B`): positive update for new category `B` (current implementation does not also apply an explicit negative update for `A`).
- Clear category (`A -> null`): negative update for previous category `A`.

Important distinction:

- Category recompute (`POST /api/accounts/:accountId/categories/recompute`) **does not create learning labels/events**.
- Recompute only reapplies classifier + current model to existing messages and rewrites `messages.category`, `messages.categoryScore`, and `messages.categorySignals`.
- In short: recompute is inference, manual category actions are training.

### Debug / Inspection

- API: `GET /api/accounts/:accountId/categories/debug?limit=...` (`app/api/accounts/[accountId]/categories/debug/route.ts`)
- UI: Account settings modal, `Categorization` tab (`app/components/AccountSettingsModal.tsx`)
- Backing DB snapshot query: `getCategoryLearningDebugSnapshot(...)` (`lib/db.ts`)

Notes:

- UI behavior in `TopBar` makes category badge selection effectively single-choice among the three categories.
- `categoryScore` is persisted and returned from DB, but currently category filtering is based on `category` (not score threshold in SQL).
