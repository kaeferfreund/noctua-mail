# German spelling variants in search (fix/fts-german-folding, QA-208)

Worktree `/home/monkey/code/noctua-mail/wt-fix-fts-german-folding`, branch
`fix/fts-german-folding`. Base `5c5b605` (`perf/fts-search-driven` `e29b64f`
merged with `origin/integration/stage` `e70c30b`, round 9). Implementation
commit `b3eed2d`; this brief is outside the worktree. Review by the owners
before merge, per task.

## Finding

QA-208 (P3, `qa-ui-sweep-98b4301.md`): "strasse" does not find "Straße",
"grusse" does not find "Grüße". `message_fts_v3` uses FTS5's default
`unicode61` tokenizer: case and diacritics fold (ü → u, ë → e, so "Noël" =
"noel" already worked), but ß is kept as ß and the transliterations
ae/oe/ue are indexed as written. Index token for "Grüße" is `gruße`, for
"Gruesse" `gruesse`, for "Strasse" `strasse`.

## Design: query-side expansion, no shard-format change

Constraint 1 held: an index-side change is not needed for correct results,
so no schema, tokenizer, migration or rebuild. Each free-text token is
expanded into the spellings the index can hold. The spellings are ORed
inside that token's group, and tokens stay ANDed:

- **FTS:** `buildScopedFtsTokenQueries` (`lib/db/messages/query.ts:482`)
  passes every spelling through the unchanged `buildFtsTokenQuery`, so R1
  keyword quoting and the `"…"*` form for non-bareword tokens still apply,
  and prefix `*` is kept per spelling. A token with one spelling emits the
  **byte-identical** previous text (`(fromAddr:needle* OR … OR body:needle*)`,
  `subject:"NOT"*`, pinned by a test). A token with variants emits one FTS5
  column filter over the OR: `{fromAddr toAddr ccAddr bccAddr subject body}
  : (strasse* OR straße*)`. This matches the same rows as one `col:spelling`
  term per pair (asserted on the fixture for 4 column sets × 4 spelling
  sets) and costs FTS5 a quarter to a sixth as much (bench below).
- **Attachment filename LIKE:** each token's term list is now
  `string[][]`: the lower-case token, then its spellings. All three
  consumers use one helper pair, `attachmentFilenameLikeSql` / `…Args`
  (`query.ts:870`): the legacy `EXISTS`, the driven attachment fetch and
  the oversized-token probe. One spelling gives the previous SQL text;
  several give `(lower(COALESCE(…)) LIKE ? OR …)`.
- **Not expanded:** the Message-ID/threadId/local-id substring `LIKE` over
  the whole raw query (ids are not German text), and the `from:`/`to:`/
  `with:`/`in:`/`thread:`/`topic:`/`invite:` operator filters (no
  non-search path changes).
- **Legacy ≡ driven by construction:** both paths consume the same
  `ftsTokenQueries` / `attachmentFilenameTerms` from `parseSearchInput`.
  Candidate caps, the oversized-token probe, the combined single MATCH,
  `fts_error` fallback and logging are untouched; the log line still
  carries no query text. Variants do not change `tokenCount`.

### Variant rules (`lib/db/messages/searchSpellingVariants.ts`)

The token is NFC-normalized and lower-cased (`ẞ` → `ß`), then scanned left
to right without overlap. Each "site" has two forms:

| Site | Alternative | Why |
|---|---|---|
| `ß` | `ss` | finds "Strasse", "Fussweg" |
| `ss` (each pair once; "schlossstrasse" has 2 sites) | `ß` | finds "Straße", "Maß" |
| `ä` / `ö` / `ü` | `ae` / `oe` / `ue` | finds transliterated text; the umlaut itself already matches a/o/u through the index fold |
| `ae` / `oe` / `ue`, only when a **letter follows** and **no vowel** (a e i o u y ä ö ü) precedes; for `ue` also no `q` | `ä` / `ö` / `ü` | finds umlaut text through the fold, and umlauts in attachment names (`LIKE` does not fold) |

The two guards on the digraph rule keep common non-umlaut digraphs from
widening into a much broader prefix: diphthong + e ("neue", "neuen" would
become `neun*`, "Bauer", "Steuer", "Frauen"), "qu" ("Quelle", "Frequenz"),
and word-final digraphs ("Joe" would become `jo*`, "Sue" `su*`, "blue",
"true", "Menue").

A plain a/o/u is never read as a transliteration. So "ubermass" finds
"Übermaß" and "Übermass" but not text written "Uebermass", and "grusse"
finds "Grüße"/"Grüsse" but not "Gruesse". Expanding every u to u|ue would
double the spellings for most words and swamp recall. The reverse
direction works: "gruesse" and "Grüße" find all three spellings.

### Cap: 8 spellings per token (including the token as typed)

- Up to three sites: every per-site combination is kept (2, 4 or 8
  spellings). Mixed spellings from the 1996 reform are covered this way:
  "Schlossstraße" (ss + ß in one word) and the old "Schloßstraße" are both
  generated for any input spelling.
- More than three sites: only the consistent spellings are kept. Every
  sharp-s site is ß or every one is ss, times every umlaut site as umlaut
  or every one as digraph, plus the token as typed: at most 5 spellings.
  Mixed spellings inside one long compound ("Fußgaengerübergänge") are
  missed; consistent ones ("Fussgaengeruebergaenge", "Fußgängerübergänge",
  Swiss "Fussgängerübergänge") are found.
- Why 8 is enough: on `/usr/share/dict/american-english` (73,445 words, the
  only word list on the box; no German list is installed), 3,646 words
  expand: 3,492 get 2 spellings, 153 get 4, 1 gets 8. German single words
  have ≤ 3 sites ("Größenänderung" is a 3-site worst case). Cost scales
  with spellings: 8 spellings cost +0.33 ms per list call in the bench.
  The bound protects against pathological input ("ßßßßßßßß", unit-tested
  ≤ 8).

## Recall vs precision

Acceptable per constraint 3; observed in tests and on the word list:

- **ß ⇄ ss collisions (German):** "masse" (mass) also finds "Maße"
  (dimensions); "Mass" finds "Maß", "Mass", "Maße", "Masse" (prefix);
  "Busse" (buses) would find "Buße" (penance). ß rarely appears in
  non-German text, so English "ss" words (2,911 in the word list) gain
  practically no extra hits.
- **Digraph → umlaut → base vowel (index fold):** a typed digraph that is
  not an umlaut collapses onto the base vowel. Tested: **"noel" also finds
  "Nolte"** (`nöl*` = `nol*`; "Noël" does not, so "Noël" and "noel" are no
  longer the same set), and **"Poet" finds "Potsdam"** (`pöt*` = `pot*`).
  On the English word list, 760 words (1.0 %) get such a variant and 111
  collapse onto another English word, for example does→dos, guest→gust,
  coed→cod, bluer→blur, daemon→damon, heroes→heros, duelled→dulled. Many
  of those are plural variants (cargoes/cargos), where the extra hit
  helps. Because of prefix search the effective widening is "words
  starting with the collapsed form": "guest" also finds "Gustav". Other
  examples: "Michael" → `michal*`, "Aero" → `aro*` ("Aroma"), "Duell" →
  `dull*`.
- **Not widened (guards):** "neue", "neuen", "Bauer", "Steuer", "Quelle",
  "Joe", "Sue", "blue", "Menue" (unit-tested). The cost of the guards:
  "Menue" no longer finds "Menü" (a word-final umlaut is rare).
- **Unchanged quirks (both modes, before and after):** a typed `*` is a
  literal in the attachment `LIKE` ("stra*" misses "Straßenplan.pdf",
  "stra" finds it); `LIKE` does not fold diacritics or non-ASCII case, so
  "grusse" does not find an attachment "Grüße.pdf" and "übermass" does not
  find "ÜBERMASS.pdf". A prefix that splits "ss" ("stras") does not reach
  "Straße".

## Tests

`lib/db/messages/searchSpellingVariants.test.ts` (10 tests): ß ⇄ ss
(including `ẞ` and the two-site "Schlossstrasse"), umlaut ⇄ digraph, the
plain-vowel asymmetry, the guards, no variants for tokens without a site,
`Noël`, FTS5 keywords, NFD input, typed token first and not repeated, the
3-site full product (8), the >3-site corners, and the cap on
pathological tokens.

`lib/db/messages/query.ftsSearchDriven.test.ts`, new describe "German
spelling variants in search (QA-208)" (64 tests; the file now has 165).
It uses its own shared-shard fixture: 21 synthetic German messages with
neutral ids `q208-NN`. Readable ids such as `de-uebermass` would themselves
substring-match "mass" through the id `LIKE`. Account b has a "Straße"
message with a colliding local id.

- **58 differential cases** (`listThreads` + `listMessages`, pages 1–2,
  pageSize 3, at the default cap **and** at cap 3 for the probe/fallback
  paths; full payload `JSON.stringify` legacy = driven; zero `fts_error`):
  Straße/strasse/STRASSE/straße/strass/Strassen/stra/stra*/straße-plan,
  Grüße/grüße/grusse/gruesse/GRÜSSE/GRUESSE, Übermaß/uebermass/ubermass/
  Uebermass, Noël/noel, Fuß/fuss, Mass/Maß/masse/Maße, Köln/koeln,
  Größenänderung/groessenaenderung (8 spellings),
  Fußgängerübergänge/fussgaengeruebergaenge (corners), Schlossstrasse,
  Poet, ẞ; two German tokens, German + plain token, two variant tokens,
  quoted input; `from:`, `with:`, `in:`, `thread:` + German token; fields
  subject, body, body with two tokens (combined MATCH), subject+body,
  sender, attachments; attachment + FTS mixed; folder scope inbox/archive;
  unread badge; grouped by sender/folder/week.
- **Spot checks** (exact id sets): the five ß/ss spellings give the same 4
  messages, including the attachment-only "Straßenplan-2026.pdf"; the five
  Grüße spellings give the same 3; Übermaß = uebermass = Uebermass (3),
  ubermass (2); Köln = koeln; Größenänderung = groessenaenderung;
  Fußgängerübergänge = fussgaengeruebergaenge; `from:mueller grüße`;
  sender field "müller" finds `mueller@example.test`; `in:archive
  strasse`; attachments-only "strasse"; plus the precision cases above
  (noel → Nolte, Poet → Potsdam, masse → Maße).
- **Isolation:** account b's "strasse" search returns only b's message,
  even though a and b share the local id `q208-01` on one shard.
- **Shape:** column filter = per-pair OR (raw MATCH on the fixture); MATCH
  text pins (`needle` unchanged, `{subject} : (strasse* OR straße*)`,
  combined `{body} : (…) AND body:aus*`, `subject:"NOT"*`).
- **Mutation:** with `germanSpellingVariants` forced to `[]`, and also
  with the test file run against the base `5c5b605` `query.ts`: 5 tests
  fail (3 spot checks, MATCH pins, and the "grouped by folder"
  differential, see the pre-existing issue below). All other tests pass
  because legacy and driven share the builders.
- **Fuzz:** the R1 tokenizer fuzz
  (`briefs/perf-fts-search-driven/keyword-fuzz.test.ts`, run as a temporary
  copy, not committed) with German pieces added (`ss ae oe ue Ä ö ẞ strasse
  Grüße`): 4,355 queries × 4 field sets × legacy/driven × list
  messages/threads. **0 errors, 0 `fts_error` lines.**

### Pre-existing issue found (not fixed, for the owners)

`getGroupCounts` for `groupBy` `folder` (also `sender` and `domain`) sorts
`ORDER BY count DESC` without a tiebreak (`query.ts` "folder" branch). On
the base, "strasse" grouped by folder (1 inbox + 1 archive hit) returns the
two groups in a different order in legacy and in driven mode. The plans
differ (index walk vs PK probes + temp b-tree), so the order of equal
counts differs too. With the fix, the hit counts are 3 + 1 and the case
passes, but any search with tied group counts can show it. A fix would be
`ORDER BY count DESC, key` in the three branches. That also changes
non-search list ordering, so it is left to the owners: not in this branch.

## Gates (HEAD `b3eed2d`)

All commands in the worktree, `nice -n 10`, `TMPDIR=$PWD/.tmp/tmp` (stray
`/tmp/mywebmail-test-db-*` dirs from my first runs were identified by
fixture content and removed).

- `bun run typecheck`: 0 errors, 1,246 files.
- `bun run lint`: **0 errors / 181 warnings**, the same as the stated
  baseline and the merge commit `5c5b605`. `eslint` on the four touched
  files: 0 findings.
- `bun test lib/db/messages/query.ftsSearchDriven.test.ts
  lib/db/messages/searchSpellingVariants.test.ts`: 175 pass / 0 fail.
- `bun test lib/db`: **469 pass / 0 fail** (45 files, 65.5 s, load ~15).
- `bun run test:ci` (load 11.2 at start, 9.2 at end; started once the
  1-min load dropped below 12): **3,090 unit pass / 0 fail** (317 files,
  504.9 s) + **564 DOM pass / 0 fail** (73 files, 85.1 s), exit 0, wall
  9 min 59 s.
- `git merge-tree --write-tree HEAD origin/integration/stage` (`e70c30b`):
  **clean**, tree `97ff5c032ff1`. `e70c30b` is already an ancestor of HEAD.
- Diff vs `5c5b605`: 4 files: `query.ts` (+44/−24), the new module (126
  lines) + its test (76), and the differential file (+285). No schema,
  connection, writer or non-search file touched.

## Bench (11k synthetic shard, before vs after)

Harness `briefs/fts-german-folding/bench.ts` (results
`bench-results.json`). It is the `perf-fts-search-driven/bench.ts` shard
(11,000 messages, 3,667 threads, 3,900-char bodies, `needle` every 400th
subject, an attachment every 500th) plus German subject words: Straße
every 397th, Strasse every 401st, Übermaß every 409th, uebermass every
419th. Every body ends in "Viele Grüße", an unselective German token.
The base `query.ts` (`5c5b605`, temporary copy, deleted afterwards) and
the new one run on the same connection: one warmup each, then 9
interleaved paired reps (order alternates), median [min–max] in ms.
Driven mode unless noted, `listThreads` pageSize 300. Bun 1.4.4 / SQLite
3.53.4. **Load 16.0 → 15.6** (shared box); the pairs ran under the same
load, and the `needle` control bounds the noise at about ±0.5 ms.

| Case | Before ms | After ms | Δ | Hits before → after |
|---|---:|---:|---:|---:|
| `needle` (control, no site, identical SQL) | 40.96 [40.48–42.81] | 41.45 [40.71–43.31] | +0.49 (+1.2 %) | 28 → 28 |
| `strasse` (2 spellings) | 41.32 [40.55–42.76] | 43.75 [43.39–48.39] | +2.43 (+5.9 %) | 27 → 54 |
| `Straße` (2 spellings) | 41.26 [40.75–42.00] | 43.54 [43.17–47.47] | +2.28 (+5.5 %) | 27 → 54 |
| `uebermass` (4 spellings) | 41.05 [39.87–42.22] | 43.74 [41.99–45.26] | +2.69 (+6.5 %) | 26 → 52 |
| `Größenänderung` (8 spellings, 0 hits) | 13.05 [12.90–13.51] | 13.38 [13.31–14.95] | +0.33 (+2.5 %) | 0 → 0 |
| `Fußgängerübergänge` (4 corner spellings, 0 hits) | 13.09 [12.88–13.22] | 13.17 [13.02–13.29] | +0.08 (+0.6 %) | 0 → 0 |
| `strasse needle` (two tokens, 0 hits) | 13.77 [13.60–14.91] | 13.79 [13.68–14.53] | +0.02 | 0 → 0 |
| `grüße` (11k hits → cap fallback, legacy clause) | 281.32 [279.56–288.78] | 272.21 [269.15–282.87] | −9.11 (−3.2 %) | 11000 → 11000 |
| `listMessages` `strasse` | 22.84 [22.48–25.31] | 23.20 [22.66–24.47] | +0.36 (+1.6 %) | 27 → 54 |
| `strasse`, legacy clause (kill switch) | 93.70 [93.24–94.83] | 97.20 [96.05–99.84] | +3.50 (+3.7 %) | 27 → 54 |

How to read this: the variant cost itself is what the 0-hit rows show,
+0.02 to +0.33 ms. Most of the +2.3 to +2.7 ms on hit-returning searches
comes from the search now finding **twice the hits**: 54 instead of 27
messages, so more threads to project and count. The unselective `grüße`
fallback got slightly cheaper. The likely reason is that its legacy
clause now evaluates one column-filter MATCH instead of six per-column
terms (not profiled further).

Raw resolution MATCH (`SELECT messageId FROM message_fts_v3 WHERE … MATCH ?
AND accountId = ? LIMIT 2001`, 6 default columns, median of 15):

| Spellings | Per-pair `(col:s* OR …)` | Column filter `{cols} : (s* OR …)` (shipped) | Rows |
|---|---:|---:|---:|
| 1 | 0.228 | 0.086 | 27 |
| 2 | 0.460 | 0.165 | 54 |
| 4 | 0.755 | 0.215 | 52 |
| 8 | 3.143 | 0.534 | 0 |

The first run used the per-pair shape for variant tokens. It cost +3.05
ms for the 8-spelling case (+22.9 %), which is why the shipped shape is the
column filter. Follow-up for the owners: the 1-spelling row shows the
column filter is also about 2.6× cheaper for **ordinary** tokens (0.23 →
0.09 ms per token MATCH). Switching every token to it would change the
MATCH text of every search. That is out of scope here, and the absolute
gain is small next to a ~41 ms list call.

## Risks and open questions

1. **Precision.** The digraph rule is the main risk, mostly for English
   words and names: noel→Nolte, Poet→Potsdam, guest→Gustav, does→Dose.
   Dropping the digraph → umlaut direction entirely would remove these, but
   then "koeln" would miss "Köln", "uebermass" would miss "Übermaß" (the
   QA case), and attachment "Grüße.pdf" could not be found by "gruesse".
   Kept, with guards; owners may prefer a narrower rule.
2. **Asymmetry.** "grusse" / "ubermass" do not find text written with
   ue (a plain vowel is never expanded). Documented and tested.
3. **Long compounds** with mixed spellings beyond three sites are missed
   (corners only).
4. **Attachment LIKE** still has no diacritic folding or non-ASCII case
   folding (pre-existing). Variants only add the explicit ß/ss/umlaut/
   digraph forms.
5. **The `groupBy` tie order** differs between legacy and driven mode
   (pre-existing, see above).
6. **No index-side change**, so nothing to migrate or roll back. Rollback =
   revert `b3eed2d`; shards are untouched.
