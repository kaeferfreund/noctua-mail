# CPU Profile

| Duration | Samples | Interval | Functions |
|----------|---------|----------|----------|
| 18.17s | 13697 | 1.0ms | 2105 |

**Top 10:** `all` 25.9%, `get` 8.8%, `prepare` 8.0%, `run` 7.5%, `(anonymous)` 4.5%, `(anonymous)` 3.2%, `(anonymous)` 3.2%, `(anonymous)` 2.5%, `json` 2.4%, `forEach` 1.9%

## Hot Functions (Self Time)

| Self% | Self | Total% | Total | Function | Location |
|------:|-----:|-------:|------:|----------|----------|
| 25.9% | 4.71s | 25.9% | 4.71s | `all` | `[native code]` |
| 8.8% | 1.60s | 8.8% | 1.60s | `get` | `[native code]` |
| 8.0% | 1.45s | 8.0% | 1.45s | `prepare` | `[native code]` |
| 7.5% | 1.37s | 7.5% | 1.37s | `run` | `[native code]` |
| 4.5% | 820.1ms | 4.5% | 820.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:655` |
| 3.2% | 589.2ms | 3.2% | 589.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:648` |
| 3.2% | 581.4ms | 3.2% | 581.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:659` |
| 2.5% | 469.3ms | 2.5% | 471.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:651` |
| 2.4% | 450.2ms | 2.4% | 450.2ms | `json` | `[native code]` |
| 1.9% | 363.2ms | 65.4% | 11.89s | `forEach` | `[native code]` |
| 1.8% | 341.2ms | 6.7% | 1.23s | `anonymous` | `[native code]` |
| 1.0% | 188.6ms | 1.0% | 189.7ms | `async executeTakeFirst` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/insert-query-builder.js:1114` |
| 0.9% | 170.8ms | 1.8% | 331.6ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/index.mjs:125` |
| 0.9% | 165.8ms | 0.9% | 165.8ms | `isUndefined` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/object-utils.js:12` |
| 0.9% | 163.9ms | 0.9% | 163.9ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs` |
| 0.8% | 160.8ms | 0.8% | 160.8ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-attributes.mjs:30` |
| 0.8% | 145.6ms | 1.0% | 183.3ms | `normalize` | `/tmp/spike-switch-server/sqlcounter.ts:36` |
| 0.7% | 141.6ms | 0.7% | 141.6ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:657` |
| 0.6% | 126.9ms | 0.6% | 126.9ms | `displayDayNumber` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/i18n/format.ts:43` |
| 0.6% | 111.0ms | 0.6% | 111.0ms | `importModule` | `[native code]` |
| 0.5% | 103.3ms | 5.9% | 1.08s | `map` | `[native code]` |
| 0.5% | 100.4ms | 0.5% | 100.4ms | `stringify` | `[native code]` |
| 0.4% | 90.4ms | 0.4% | 90.4ms | `URL` | `[native code]` |
| 0.4% | 85.7ms | 0.4% | 85.7ms | `Set` | `[native code]` |
| 0.4% | 77.6ms | 0.4% | 77.6ms | `Buffer` | `[native code]` |
| 0.3% | 67.7ms | 0.3% | 67.7ms | `entries` | `[native code]` |
| 0.3% | 64.7ms | 0.3% | 64.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:625` |
| 0.3% | 62.9ms | 0.3% | 62.9ms | `checkChar` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:989` |
| 0.3% | 59.7ms | 0.3% | 68.9ms | `json` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:92` |
| 0.3% | 59.6ms | 0.3% | 59.6ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js` |
| 0.3% | 59.5ms | 0.4% | 72.7ms | `from` | `[native code]` |
| 0.2% | 45.4ms | 0.2% | 45.4ms | `getTopicSuggestionWeight` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:68` |
| 0.2% | 44.3ms | 0.2% | 44.3ms | `cloneObject` | `[native code]` |
| 0.2% | 43.4ms | 0.2% | 43.4ms | `copyDataProperties` | `[native code]` |
| 0.2% | 42.3ms | 0.2% | 42.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2666` |
| 0.2% | 41.6ms | 0.2% | 43.8ms | `buildTimeGroupKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/messageGrouping.ts:42` |
| 0.2% | 41.1ms | 0.2% | 41.1ms | `freeze` | `[native code]` |
| 0.2% | 38.6ms | 0.2% | 38.6ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:583` |
| 0.2% | 37.7ms | 0.2% | 37.7ms | `/\s+/g` | `[native code]` |
| 0.1% | 36.3ms | 0.1% | 36.3ms | `parse` | `[native code]` |
| 0.1% | 35.6ms | 0.1% | 35.6ms | `shouldIgnoreTopicSuggestionSignal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:123` |
| 0.1% | 34.7ms | 0.6% | 123.9ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:14` |
| 0.1% | 32.5ms | 0.1% | 33.6ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:204` |
| 0.1% | 32.4ms | 0.1% | 33.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:685` |
| 0.1% | 31.6ms | 0.3% | 62.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2645` |
| 0.1% | 31.1ms | 0.5% | 107.4ms | `filter` | `[native code]` |
| 0.1% | 29.7ms | 0.1% | 29.7ms | `structuredClone` | `[native code]` |
| 0.1% | 29.6ms | 0.1% | 29.6ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:17` |
| 0.1% | 27.0ms | 0.1% | 27.0ms | `Cipher` | `[native code]` |
| 0.1% | 26.8ms | 0.1% | 26.8ms | `parseAddressEmails` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:25` |
| 0.1% | 26.6ms | 0.5% | 104.8ms | `addMs` | `/tmp/spike-switch-server/sqlcounter.ts:61` |
| 0.1% | 26.2ms | 0.1% | 26.2ms | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/esm/mimetypes.js:3` |
| 0.1% | 23.8ms | 0.1% | 23.8ms | `WeakMap` | `[native code]` |
| 0.1% | 23.2ms | 0.2% | 48.0ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:16` |
| 0.1% | 22.8ms | 1.0% | 198.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2671` |
| 0.1% | 22.3ms | 0.1% | 22.3ms | `displayDayNumber` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/i18n/format.ts:42` |
| 0.1% | 21.8ms | 0.1% | 21.8ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:9` |
| 0.1% | 21.4ms | 0.1% | 21.4ms | `bump` | `/tmp/spike-switch-server/sqlcounter.ts:52` |
| 0.1% | 21.2ms | 3.2% | 596.6ms | `flatIntoArrayWithCallback` | `[native code]` |
| 0.1% | 20.7ms | 0.1% | 33.9ms | `slimThreadListItem` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:32` |
| 0.1% | 20.5ms | 0.1% | 21.6ms | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:50` |
| 0.1% | 19.9ms | 0.1% | 19.9ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:12` |
| 0.1% | 18.9ms | 0.1% | 23.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:16` |
| 0.0% | 17.7ms | 0.1% | 20.1ms | `performIteration` | `[native code]` |
| 0.0% | 17.4ms | 0.0% | 17.4ms | `wrapStatement` | `/tmp/spike-switch-server/sqlcounter.ts:75` |
| 0.0% | 17.1ms | 0.0% | 17.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js` |
| 0.0% | 17.1ms | 0.0% | 17.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:29` |
| 0.0% | 16.7ms | 0.1% | 21.8ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:671` |
| 0.0% | 15.9ms | 0.0% | 15.9ms | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/add-constraint-node.js:6` |
| 0.0% | 14.8ms | 0.0% | 14.8ms | `verify` | `[native code]` |
| 0.0% | 14.8ms | 0.6% | 111.3ms | `(anonymous)` | `[native code]` |
| 0.0% | 13.9ms | 0.0% | 13.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:622` |
| 0.0% | 13.8ms | 0.0% | 13.8ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:25` |
| 0.0% | 13.2ms | 0.0% | 13.2ms | `importKey` | `[native code]` |
| 0.0% | 13.2ms | 0.0% | 13.2ms | `arrayFromFastWithoutMapFn` | `[native code]` |
| 0.0% | 13.2ms | 0.3% | 58.6ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:646` |
| 0.0% | 12.9ms | 0.0% | 12.9ms | `wrapStatement` | `/tmp/spike-switch-server/sqlcounter.ts:74` |
| 0.0% | 12.9ms | 0.0% | 12.9ms | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:52` |
| 0.0% | 12.3ms | 0.0% | 13.6ms | `LazyQueryId` | `[native code]` |
| 0.0% | 12.3ms | 0.0% | 12.3ms | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/esm/mimetypes.js:1034` |
| 0.0% | 12.3ms | 0.1% | 24.6ms | `text` | `[native code]` |
| 0.0% | 12.1ms | 0.0% | 12.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:62` |
| 0.0% | 12.0ms | 0.0% | 12.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadCollab.ts:8` |
| 0.0% | 11.9ms | 0.0% | 11.9ms | `async stageMessageFiles` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/storage.ts:234` |
| 0.0% | 11.9ms | 0.6% | 123.3ms | `executeQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:62` |
| 0.0% | 11.8ms | 0.0% | 11.8ms | `_collectAddressParts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:561` |
| 0.0% | 11.7ms | 0.0% | 11.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:639` |
| 0.0% | 11.7ms | 0.0% | 11.7ms | `update` | `[native code]` |
| 0.0% | 11.7ms | 0.0% | 11.7ms | `async enrichMessagesWithThreadCollab` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadCollab.ts:14` |
| 0.0% | 11.4ms | 0.0% | 11.4ms | `RegExp` | `[native code]` |
| 0.0% | 11.3ms | 0.0% | 11.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:233` |
| 0.0% | 11.2ms | 0.0% | 11.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/he/he.js` |
| 0.0% | 10.8ms | 0.0% | 10.8ms | `flush` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:223` |
| 0.0% | 10.7ms | 0.0% | 10.7ms | `rowToTopic` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:65` |
| 0.0% | 10.4ms | 0.0% | 10.4ms | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:110` |
| 0.0% | 10.4ms | 1.6% | 307.9ms | `flatMap` | `[native code]` |
| 0.0% | 10.1ms | 0.0% | 10.1ms | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:53` |
| 0.0% | 10.1ms | 0.1% | 30.8ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:159` |
| 0.0% | 10.0ms | 41.7% | 7.58s | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:82` |
| 0.0% | 10.0ms | 0.0% | 10.0ms | `transformJoinClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:296` |
| 0.0% | 9.9ms | 0.0% | 9.9ms | `DateTimeFormat` | `[native code]` |
| 0.0% | 9.6ms | 0.0% | 9.6ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts` |
| 0.0% | 9.4ms | 0.4% | 87.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:677` |
| 0.0% | 9.3ms | 0.3% | 60.1ms | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:54` |
| 0.0% | 9.3ms | 0.0% | 9.3ms | `Boolean` | `[native code]` |
| 0.0% | 9.2ms | 0.0% | 9.2ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:7` |
| 0.0% | 9.1ms | 0.0% | 9.1ms | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts` |
| 0.0% | 9.1ms | 0.0% | 9.1ms | `async createTopic` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts` |
| 0.0% | 9.1ms | 0.0% | 9.1ms | `createExpressionBuilder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:32` |
| 0.0% | 9.0ms | 14.9% | 2.72s | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:647` |
| 0.0% | 8.9ms | 0.0% | 8.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:206` |
| 0.0% | 8.9ms | 0.0% | 8.9ms | `init` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:51` |
| 0.0% | 8.9ms | 0.0% | 8.9ms | `_collapseAtSpacing` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:273` |
| 0.0% | 8.8ms | 0.0% | 8.8ms | `bump` | `/tmp/spike-switch-server/sqlcounter.ts:53` |
| 0.0% | 8.7ms | 0.0% | 8.7ms | `transformWhereClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` |
| 0.0% | 8.7ms | 0.0% | 8.7ms | `Map` | `[native code]` |
| 0.0% | 8.6ms | 0.1% | 30.9ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:84` |
| 0.0% | 8.5ms | 0.0% | 8.5ms | `Tokenizer` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 8.4ms | 1.8% | 337.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:182` |
| 0.0% | 8.4ms | 0.0% | 8.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2523` |
| 0.0% | 8.1ms | 0.0% | 8.1ms | `transformQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:16` |
| 0.0% | 7.9ms | 0.0% | 7.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:663` |
| 0.0% | 7.7ms | 0.0% | 8.7ms | `async findOne` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:504` |
| 0.0% | 7.7ms | 8.0% | 1.46s | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:96` |
| 0.0% | 7.6ms | 0.0% | 7.6ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2615` |
| 0.0% | 7.5ms | 0.0% | 7.5ms | `parseAddressEmails` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:42` |
| 0.0% | 7.5ms | 0.5% | 93.1ms | `_parseAddressList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1155` |
| 0.0% | 7.3ms | 0.0% | 7.3ms | `toString` | `[native code]` |
| 0.0% | 7.2ms | 0.0% | 7.2ms | `internal:shared` | `internal:shared:2` |
| 0.0% | 7.2ms | 0.0% | 7.2ms | `Date` | `[native code]` |
| 0.0% | 7.1ms | 0.0% | 7.1ms | `/^[\p{L}\p{M}\p{N}.-]+$/u` | `[native code]` |
| 0.0% | 7.0ms | 0.0% | 7.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:83` |
| 0.0% | 7.0ms | 0.0% | 11.5ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:209` |
| 0.0% | 7.0ms | 0.9% | 175.4ms | `addressparser` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1199` |
| 0.0% | 6.9ms | 0.0% | 6.9ms | `ensureSenderIdentityMessageRuntimeSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts` |
| 0.0% | 6.9ms | 0.0% | 6.9ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:743` |
| 0.0% | 6.9ms | 0.0% | 15.2ms | `getOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:55` |
| 0.0% | 6.9ms | 0.3% | 70.8ms | `tokenize` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:836` |
| 0.0% | 6.8ms | 0.0% | 6.8ms | `final` | `[native code]` |
| 0.0% | 6.8ms | 0.0% | 6.8ms | `getEnvVar` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/env-impl.mjs:41` |
| 0.0% | 6.8ms | 0.0% | 6.8ms | `bump` | `/tmp/spike-switch-server/sqlcounter.ts:54` |
| 0.0% | 6.7ms | 0.0% | 6.7ms | `query` | `bun:sqlite:384` |
| 0.0% | 6.7ms | 0.0% | 6.7ms | `trim` | `[native code]` |
| 0.0% | 6.6ms | 0.2% | 42.6ms | `(anonymous)` | `/tmp/spike-switch-server/anatomy.ts:75` |
| 0.0% | 6.6ms | 0.3% | 59.5ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:97` |
| 0.0% | 6.4ms | 0.0% | 6.4ms | `concat` | `[native code]` |
| 0.0% | 6.3ms | 0.0% | 12.0ms | `topicSuggestionSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:104` |
| 0.0% | 6.2ms | 0.0% | 6.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:161` |
| 0.0% | 6.1ms | 0.0% | 6.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:78` |
| 0.0% | 6.1ms | 0.0% | 6.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:573` |
| 0.0% | 6.0ms | 0.0% | 6.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadCollab.ts:9` |
| 0.0% | 6.0ms | 0.0% | 6.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:233` |
| 0.0% | 6.0ms | 0.0% | 7.1ms | `throwForMissingRequestStore` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/work-unit-async-storage.external.js:88` |
| 0.0% | 5.9ms | 0.0% | 5.9ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:17` |
| 0.0% | 5.8ms | 0.0% | 10.9ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:11` |
| 0.0% | 5.8ms | 0.0% | 5.8ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:653` |
| 0.0% | 5.8ms | 0.0% | 5.8ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:19` |
| 0.0% | 5.6ms | 0.0% | 12.8ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:10` |
| 0.0% | 5.5ms | 0.0% | 5.5ms | `topicSuggestionSignalKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:553` |
| 0.0% | 5.4ms | 0.0% | 5.4ms | `compare` | `[native code]` |
| 0.0% | 5.4ms | 0.0% | 6.4ms | `async releaseConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:67` |
| 0.0% | 5.4ms | 0.0% | 5.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:588` |
| 0.0% | 5.4ms | 0.0% | 5.4ms | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:35` |
| 0.0% | 5.4ms | 0.2% | 39.7ms | `normalize` | `/tmp/spike-switch-server/anatomy.ts:57` |
| 0.0% | 5.4ms | 0.0% | 6.6ms | `async GET` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:48` |
| 0.0% | 5.4ms | 0.0% | 5.4ms | `replace` | `[native code]` |
| 0.0% | 5.3ms | 0.0% | 5.3ms | `untpl` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:152` |
| 0.0% | 5.3ms | 0.4% | 73.7ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:94` |
| 0.0% | 5.3ms | 0.0% | 7.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:8` |
| 0.0% | 5.0ms | 0.0% | 5.0ms | ``/^[A-Za-z0-9.!#$%&'*+\/=?^_`{\|}~-]+$/`` | `[native code]` |
| 0.0% | 4.9ms | 0.0% | 4.9ms | `asyncFunctionDrive` | `[native code]` |
| 0.0% | 4.9ms | 0.0% | 4.9ms | `base32Decode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/tests/helpers/totp.ts` |
| 0.0% | 4.8ms | 0.0% | 4.8ms | `Request` | `[native code]` |
| 0.0% | 4.8ms | 0.0% | 4.8ms | `async runValidation` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/validator.mjs` |
| 0.0% | 4.8ms | 0.0% | 4.8ms | `reverse` | `[native code]` |
| 0.0% | 4.8ms | 0.0% | 4.8ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs` |
| 0.0% | 4.7ms | 0.1% | 27.0ms | `async getAccountOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/senderIdentities.ts:22` |
| 0.0% | 4.7ms | 0.4% | 81.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:46` |
| 0.0% | 4.7ms | 1.2% | 227.2ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2507` |
| 0.0% | 4.6ms | 0.0% | 4.6ms | `async findMany` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` |
| 0.0% | 4.6ms | 0.0% | 4.6ms | `encode` | `[native code]` |
| 0.0% | 4.6ms | 0.0% | 9.3ms | `getOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:56` |
| 0.0% | 4.6ms | 0.0% | 4.6ms | `__getBetterAuthGlobal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/global.mjs:17` |
| 0.0% | 4.6ms | 0.0% | 4.6ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:621` |
| 0.0% | 4.5ms | 0.0% | 7.0ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:6` |
| 0.0% | 4.5ms | 0.0% | 4.5ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:95` |
| 0.0% | 4.5ms | 0.0% | 4.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:198` |
| 0.0% | 4.5ms | 0.0% | 4.5ms | `async findOne` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:503` |
| 0.0% | 4.5ms | 0.0% | 4.5ms | `/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/` | `[native code]` |
| 0.0% | 4.5ms | 0.1% | 34.4ms | `bound visitFrom` | `[native code]` |
| 0.0% | 4.5ms | 0.0% | 4.5ms | `compileQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:29` |
| 0.0% | 4.5ms | 0.0% | 4.5ms | `subarray` | `[native code]` |
| 0.0% | 4.4ms | 0.0% | 4.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts` |
| 0.0% | 4.4ms | 0.0% | 4.4ms | `signUpEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/sign-up.mjs` |
| 0.0% | 4.4ms | 0.0% | 4.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs` |
| 0.0% | 4.4ms | 0.0% | 4.4ms | `init` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js` |
| 0.0% | 4.4ms | 0.0% | 12.5ms | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:369` |
| 0.0% | 4.3ms | 0.0% | 4.3ms | `async getDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:293` |
| 0.0% | 4.3ms | 0.7% | 131.8ms | `isOwnAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:61` |
| 0.0% | 4.3ms | 0.0% | 4.3ms | `roleAtLeast` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/accountRole.ts:5` |
| 0.0% | 4.3ms | 0.0% | 4.3ms | `async ensureCalendarEventRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:665` |
| 0.0% | 4.2ms | 0.0% | 5.5ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/api/index.mjs:59` |
| 0.0% | 4.2ms | 0.0% | 4.2ms | `bump` | `/tmp/spike-switch-server/sqlcounter.ts:48` |
| 0.0% | 4.1ms | 0.0% | 5.2ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:697` |
| 0.0% | 4.1ms | 0.0% | 4.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:627` |
| 0.0% | 4.0ms | 0.0% | 4.0ms | `toLowerCase` | `[native code]` |
| 0.0% | 4.0ms | 0.0% | 4.0ms | `async runAfterHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs` |
| 0.0% | 3.8ms | 0.0% | 3.8ms | `sanitizeIdentifier` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:1363` |
| 0.0% | 3.8ms | 0.0% | 3.8ms | `createFunctionModule` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/function-module.js:19` |
| 0.0% | 3.8ms | 0.0% | 3.8ms | `defaultThreadCollabState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts:54` |
| 0.0% | 3.8ms | 0.0% | 3.8ms | `closeAccountDbConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts` |
| 0.0% | 3.7ms | 0.0% | 3.7ms | `TokenList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 3.7ms | 0.0% | 3.7ms | `set` | `[native code]` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `createExpressionBuilder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:73` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/middleware.mjs` |
| 0.0% | 3.6ms | 0.1% | 20.6ms | `some` | `[native code]` |
| 0.0% | 3.6ms | 0.0% | 4.6ms | `_recoverAddrSpec` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:368` |
| 0.0% | 3.6ms | 0.1% | 24.6ms | `async transformOutput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:216` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `ResponseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/@edge-runtime/cookies/index.js:256` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:877` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `is` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/set-operation-node.js` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `join` | `[native code]` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `visitAlias` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js` |
| 0.0% | 3.5ms | 0.0% | 3.5ms | `keys` | `[native code]` |
| 0.0% | 3.5ms | 0.0% | 3.5ms | `async acquireAuthLifetimeLock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authLifetimeLock.ts` |
| 0.0% | 3.5ms | 0.0% | 3.5ms | `WeakSet` | `[native code]` |
| 0.0% | 3.5ms | 0.0% | 3.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts` |
| 0.0% | 3.5ms | 0.0% | 3.5ms | `async requireActiveUserSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts` |
| 0.0% | 3.5ms | 0.0% | 4.8ms | `async get` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:39` |
| 0.0% | 3.5ms | 0.0% | 3.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs:11` |
| 0.0% | 3.4ms | 0.0% | 3.4ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:15` |
| 0.0% | 3.4ms | 0.0% | 3.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:690` |
| 0.0% | 3.4ms | 0.0% | 3.4ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:81` |
| 0.0% | 3.4ms | 0.0% | 3.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:181` |
| 0.0% | 3.4ms | 0.0% | 3.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts` |
| 0.0% | 3.3ms | 0.0% | 4.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:620` |
| 0.0% | 3.3ms | 0.9% | 167.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:236` |
| 0.0% | 3.3ms | 0.0% | 3.3ms | `async (anonymous)` | `/tmp/spike-switch-server/anatomy.ts` |
| 0.0% | 3.3ms | 0.2% | 53.4ms | `init` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:65` |
| 0.0% | 3.3ms | 0.0% | 3.3ms | `shouldIgnoreTopicSuggestionSignalUncached` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:143` |
| 0.0% | 3.3ms | 0.0% | 3.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:257` |
| 0.0% | 3.3ms | 0.0% | 3.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:179` |
| 0.0% | 3.3ms | 0.0% | 3.3ms | `addMs` | `/tmp/spike-switch-server/sqlcounter.ts` |
| 0.0% | 3.3ms | 0.6% | 112.6ms | `async getMessageCalendarInviteDataByMessageId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:192` |
| 0.0% | 3.2ms | 0.0% | 3.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:584` |
| 0.0% | 3.2ms | 0.0% | 3.2ms | `install` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/storage.ts:258` |
| 0.0% | 3.2ms | 0.0% | 11.9ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs:193` |
| 0.0% | 3.2ms | 0.0% | 3.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:180` |
| 0.0% | 3.2ms | 0.0% | 3.2ms | `async createInternalContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:7` |
| 0.0% | 3.2ms | 0.0% | 3.2ms | `defineBound` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:771` |
| 0.0% | 3.1ms | 0.0% | 4.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs:9` |
| 0.0% | 3.1ms | 0.1% | 26.1ms | `normalizeAccountSettings` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/accountSettings.ts:5` |
| 0.0% | 3.1ms | 0.4% | 73.3ms | `buildMessageGroupKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/messageGrouping.ts:71` |
| 0.0% | 3.1ms | 0.0% | 3.1ms | `loadNextHeadersModule` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs` |
| 0.0% | 3.1ms | 0.0% | 3.1ms | `Headers` | `[native code]` |
| 0.0% | 3.1ms | 0.0% | 3.1ms | `getSharedDbHarnessState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testDbHarness.ts` |
| 0.0% | 3.0ms | 0.0% | 3.0ms | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:394` |
| 0.0% | 3.0ms | 0.5% | 107.4ms | `getThreadCollabStates` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts:76` |
| 0.0% | 3.0ms | 0.0% | 3.0ms | `getOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:52` |
| 0.0% | 3.0ms | 0.0% | 3.0ms | `shouldIgnoreTopicSuggestionSignalUncached` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:135` |
| 0.0% | 3.0ms | 0.0% | 3.9ms | `mapAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts:183` |
| 0.0% | 3.0ms | 0.0% | 3.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` |
| 0.0% | 3.0ms | 0.0% | 7.7ms | `meta` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:108` |
| 0.0% | 3.0ms | 0.0% | 3.0ms | `reallyExit` | `[native code]` |
| 0.0% | 2.9ms | 0.0% | 2.9ms | `createExpressionBuilder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:25` |
| 0.0% | 2.9ms | 0.5% | 90.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:581` |
| 0.0% | 2.7ms | 0.0% | 2.7ms | `split` | `[native code]` |
| 0.0% | 2.7ms | 0.0% | 2.7ms | `parseStringReference` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js:45` |
| 0.0% | 2.7ms | 0.0% | 2.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts` |
| 0.0% | 2.6ms | 0.1% | 19.8ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:102` |
| 0.0% | 2.6ms | 0.1% | 20.6ms | `async enrichMessagesWithThreadCollab` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadCollab.ts:8` |
| 0.0% | 2.6ms | 0.0% | 17.1ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:682` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `prepareAccountShardConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `sanitizeIdentifier` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:1364` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `[Symbol.toPrimitive]` | `[native code]` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `addMs` | `/tmp/spike-switch-server/sqlcounter.ts:60` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `columnNames` | `bun:sqlite:198` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `newResolvedPromise` | `[native code]` |
| 0.0% | 2.5ms | 0.0% | 5.4ms | `async lock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:81` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-field-name.mjs` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-model-name.mjs:20` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `includes` | `[native code]` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `shouldIgnoreTopicSuggestionSignal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:122` |
| 0.0% | 2.5ms | 0.2% | 37.9ms | `getTopicSuggestionSignalsForThreadsFromDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:210` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/index.mjs` |
| 0.0% | 2.5ms | 0.3% | 56.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:194` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `Number` | `[native code]` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `withSpan` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/tracer.mjs:34` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `fromBER` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `decryptPayload` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts:59` |
| 0.0% | 2.4ms | 0.0% | 10.8ms | `headers` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/headers.js:110` |
| 0.0% | 2.4ms | 0.2% | 48.5ms | `async enrichMessagesWithThreadCollab` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadCollab.ts:18` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `isFreeMailDomain` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/senderIdentity.ts:272` |
| 0.0% | 2.4ms | 0.0% | 4.8ms | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:28` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/well-known/index.js` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:147` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js` |
| 0.0% | 2.4ms | 0.0% | 13.6ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:765` |
| 0.0% | 2.4ms | 0.0% | 4.9ms | `fsyncSync` | `[native code]` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2626` |
| 0.0% | 2.4ms | 0.3% | 70.4ms | `compareSqliteText` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:558` |
| 0.0% | 2.4ms | 2.8% | 521.6ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:97` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `visitValue` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:318` |
| 0.0% | 2.4ms | 0.0% | 3.4ms | `create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/identifier-node.js:11` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `setAuthTag` | `[native code]` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountKeys.ts` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `/[\x00-\x1f\x7f]/` | `[native code]` |
| 0.0% | 2.4ms | 0.0% | 13.0ms | `compileUnwrappedIdentifier` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:305` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `__exportStar` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:203` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `#getNoArgs` | `bun:sqlite` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `buildSqlEndsWithAny` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:935` |
| 0.0% | 2.3ms | 0.0% | 3.5ms | `async withAuthResponse` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:51` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `executeQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `sanitizeIdentifier` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js` |
| 0.0% | 2.3ms | 0.0% | 4.9ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:155` |
| 0.0% | 2.3ms | 0.1% | 23.9ms | `async getSignedCookie` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:48` |
| 0.0% | 2.3ms | 5.8% | 1.05s | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2587` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `getKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts` |
| 0.0% | 2.3ms | 0.2% | 45.1ms | `async resolveAccountDbPath` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:338` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:678` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:34` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `#get` | `bun:sqlite` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `reset` | `/tmp/spike-switch-server/sqlcounter.ts:39` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `arrayIteratorNextHelper` | `[native code]` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `fireTriggers` | `/tmp/spike-switch-server/sqlcounter.ts` |
| 0.0% | 2.3ms | 0.0% | 10.9ms | `async internalHandler` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:52` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `topicSuggestionSignalsFromEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:75` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `async transformOutput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:145` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `async withAuthResponse` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `normalizeEmailAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/senderIdentity.ts:61` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `ensureCalendarReminderRuntimeSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts` |
| 0.0% | 2.3ms | 0.0% | 6.6ms | `async getDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:327` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `_defu` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/defu/dist/defu.mjs:19` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `catch` | `[native code]` |
| 0.0% | 2.2ms | 0.7% | 131.2ms | `async getMessageCalendarInviteDataByMessageId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:178` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:22` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:157` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:629` |
| 0.0% | 2.2ms | 0.0% | 10.7ms | `normalize` | `/tmp/spike-switch-server/anatomy.ts:56` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `parseAddressEmails` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:23` |
| 0.0% | 2.2ms | 0.0% | 4.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:533` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/parse5/dist/parser/index.js` |
| 0.0% | 2.2ms | 3.3% | 608.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/tracer.mjs:37` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:28` |
| 0.0% | 2.2ms | 0.0% | 4.6ms | `query` | `bun:sqlite:382` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:165` |
| 0.0% | 2.2ms | 0.4% | 78.4ms | `async ensureCalendarEventRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:675` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `get source` | `[native code]` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `install` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/storage.ts` |
| 0.0% | 2.2ms | 0.0% | 4.7ms | `parseAliasedTable` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/table-parser.js:29` |
| 0.0% | 2.2ms | 0.0% | 5.3ms | `topicSuggestionSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:106` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:665` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `freeze` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/object-utils.js:63` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `async executeQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:585` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `async acquireConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:346` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:875` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `defineProperty` | `[native code]` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testAuthHarness.ts:79` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `async sign` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/utils/dist/hmac.mjs` |
| 0.0% | 2.1ms | 0.1% | 19.4ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:660` |
| 0.0% | 2.1ms | 0.0% | 3.1ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2583` |
| 0.0% | 2.1ms | 1.2% | 223.7ms | `isOwnAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:62` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `value` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:76` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:185` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:699` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:370` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `isIsOperator` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/binary-operation-parser.js` |
| 0.0% | 2.1ms | 2.3% | 423.6ms | `async getAccountById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accounts.ts:82` |
| 0.0% | 2.1ms | 0.5% | 96.0ms | `listSenderIdentityRows` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/senderIdentities.ts:12` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:393` |
| 0.0% | 2.1ms | 4.9% | 897.6ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:39` |
| 0.0% | 2.1ms | 0.0% | 5.4ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:220` |
| 0.0% | 2.1ms | 0.0% | 9.0ms | `async time` | `/tmp/spike-switch-server/anatomy.ts:27` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `tryDecode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/utils.mjs:60` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:157` |
| 0.0% | 2.1ms | 0.0% | 9.1ms | `async requireAccountContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/accountContext.ts:64` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `_collapseAtSpacing` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:272` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:103` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `async #transformResult` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:167` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/schemable-identifier-node.js` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `Statement` | `bun:sqlite` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:1260` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_arx.js:49` |
| 0.0% | 2.0ms | 0.0% | 3.1ms | `expr` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:390` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `_collectAddressParts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:366` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `async waitOrAbort` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/abort.js:42` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:636` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:674` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `flatIntoArray` | `[native code]` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `slimThreadListItem` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:36` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `filterOutputFields` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs:7` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `async executeQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:35` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts` |
| 0.0% | 1.8ms | 0.0% | 3.0ms | `resolveDatabaseSchemaIndexes` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/database-index.mjs:145` |
| 0.0% | 1.8ms | 0.0% | 1.8ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2267` |
| 0.0% | 1.7ms | 0.0% | 1.7ms | `date` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js` |
| 0.0% | 1.7ms | 0.0% | 1.7ms | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/dom-serializer/node_modules/entities/lib/esm/generated/encode-html.js:9` |
| 0.0% | 1.7ms | 0.0% | 1.7ms | `sanitizeIdentifier` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:1368` |
| 0.0% | 1.6ms | 0.3% | 55.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:507` |
| 0.0% | 1.6ms | 0.0% | 1.6ms | `getInternalPlugins` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/helpers.mjs` |
| 0.0% | 1.6ms | 0.0% | 1.6ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:103` |
| 0.0% | 1.6ms | 0.0% | 1.6ms | `toPhysicalSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:198` |
| 0.0% | 1.5ms | 0.0% | 13.8ms | `upsertTopicLearningSignalsForThreadIds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:153` |
| 0.0% | 1.5ms | 0.0% | 1.5ms | `(anonymous)` | `/tmp/spike-switch-server/anatomy.ts:76` |
| 0.0% | 1.5ms | 0.0% | 13.7ms | `async runValidation` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/validator.mjs:44` |
| 0.0% | 1.4ms | 0.0% | 3.9ms | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:19` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/column-node.js` |
| 0.0% | 1.4ms | 1.0% | 190.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:355` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/mail/categorization/linearModel.ts:53` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `parseBinaryOperator` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/binary-operation-parser.js:56` |
| 0.0% | 1.4ms | 0.0% | 6.3ms | `header` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testAuthHarness.ts:79` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `async dispatchAuthEndpoint` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:192` |
| 0.0% | 1.4ms | 0.0% | 7.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:8` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/cookie-utils.mjs:158` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `getExistingEndpointContextStorage` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/endpoint-context.mjs:5` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `ensureMessageCalendarEventRuntimeSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async dispatchAuthEndpoint` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:191` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authPolicyHandler.ts:284` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `ensureMessageCalendarEventOptionalColumns` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `toISOString` | `[native code]` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/sign-in.mjs` |
| 0.0% | 1.3ms | 0.1% | 30.2ms | `async getUserById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/serverDb.ts:151` |
| 0.0% | 1.3ms | 0.1% | 18.3ms | `parseValueBinaryOperation` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/binary-operation-parser.js:25` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:49` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async enrichMessagesWithThreadCollab` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadCollab.ts` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/levels.js` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async getCurrentRequestState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:21` |
| 0.0% | 1.3ms | 0.1% | 22.4ms | `async internalHandler` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/middleware.mjs:29` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:844` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async getMigrations` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `getKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts:25` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `startsWith` | `[native code]` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async requireActiveUserSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:73` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `getAuth` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:262` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `TokenList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:25` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `parseStringReferenceWithTable` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js:88` |
| 0.0% | 1.3ms | 0.0% | 16.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:16` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `visitReference` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:289` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `parseSearchInput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:682` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv6.js:1460` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `applyAddressSearchFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:565` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:26` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:151` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:38` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `getHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:166` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `_addListener` | `node:events:201` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/api/index.mjs` |
| 0.0% | 1.3ms | 0.2% | 48.3ms | `compileQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:24` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `getStore` | `node:async_hooks` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `assign` | `[native code]` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/operation-node-visitor.js:70` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1296` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:245` |
| 0.0% | 1.3ms | 3.0% | 558.4ms | `flush` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:45` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `node:crypto` | `node:crypto:278` |
| 0.0% | 1.3ms | 0.0% | 17.3ms | `filterOutputFields` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs:8` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `ensureTopicRuntimeSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts` |
| 0.0% | 1.3ms | 0.2% | 41.8ms | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:29` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `buildSqlContainsAny` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:928` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `transformJoinClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:327` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/ip_converter.js:3` |
| 0.0% | 1.3ms | 0.0% | 4.2ms | `parseStringReference` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js:48` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:79` |
| 0.0% | 1.2ms | 0.3% | 69.3ms | `_parseAddressList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1181` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `push` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `BaseBlock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:917` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `buildSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-schema.mjs` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `parseAliasedExpression` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/expression-parser.js:16` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-android/build/cjs/nonstandard.js:4` |
| 0.0% | 1.2ms | 0.1% | 27.0ms | `every` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 5.5ms | `exit` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `onCompile` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `otp2fa` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/otp/index.mjs` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `mapAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts:151` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:696` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:56` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `visitReference` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:248` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:776` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async verifySignature` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `decorate` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js` |
| 0.0% | 1.2ms | 0.0% | 3.5ms | `async validateAccountFolders` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/folderAccount.ts:12` |
| 0.0% | 1.2ms | 0.0% | 5.9ms | `async runAfterHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:114` |
| 0.0% | 1.2ms | 1.0% | 198.2ms | `async getAccountById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accounts.ts:85` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:12` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/he/he.js:55` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/jose/dist/webapi/util/errors.js` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `Hash` | `[native code]` |
| 0.0% | 1.2ms | 0.2% | 42.9ms | `async (anonymous)` | `/tmp/spike-switch-server/anatomy.ts:65` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:70` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/senderIdentities.ts:13` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `parseTableExpression` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/table-parser.js:20` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `assertCredentialMode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts:8` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:160` |
| 0.0% | 1.2ms | 17.6% | 3.20s | `getTopicSuggestionsForThreadSignalBatch` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:635` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/messageGrouping.ts` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:94` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `getColorDepth` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs:60` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `fromBER` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:2348` |
| 0.0% | 1.2ms | 0.0% | 2.5ms | `openSync` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async withAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `node:_http_outgoing` | `node:_http_outgoing:706` |
| 0.0% | 1.2ms | 0.0% | 2.2ms | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:835` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/tracer.mjs:38` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `returningAll` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/update-query-builder.js` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:705` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/query-id.js` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:39` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `normalizeCalendarEventUidKeys` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/calendarEventUids.ts:29` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `bump` | `/tmp/spike-switch-server/sqlcounter.ts` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `groupsFromRows` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:990` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js` |
| 0.0% | 1.2ms | 0.0% | 2.2ms | `async getAccountOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/senderIdentities.ts:20` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `Response` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 2.3ms | `normalizeSearchFields` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:488` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `value` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:72` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `Statement` | `bun:sqlite:108` |
| 0.0% | 1.2ms | 0.0% | 7.0ms | `async requireAccountContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/accountContext.ts:53` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `isRequestLike` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/utils/url.mjs:129` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `Statement` | `bun:sqlite:109` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/cookie-utils.mjs:164` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `createQueryId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/query-id.js` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:47` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:859` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `getFields` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/schema.mjs:10` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:339` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `hasOwnProperty` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/encode.js:98` |
| 0.0% | 1.2ms | 0.0% | 3.5ms | `query` | `bun:sqlite:380` |
| 0.0% | 1.2ms | 0.1% | 18.6ms | `async getAccountById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/serverDb.ts:26` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts:23` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/error.mjs` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `decodeTrieDict` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/internal/decode-shared.js:175` |
| 0.0% | 1.2ms | 0.0% | 5.4ms | `_recoverAddrSpec` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:367` |
| 0.0% | 1.2ms | 0.0% | 2.1ms | `rememberTopicLearningForThread` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:47` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:36` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async ensureAsyncStorage` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/transaction.mjs:12` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async stageMessageFiles` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/storage.ts:235` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:557` |
| 0.0% | 1.2ms | 0.5% | 106.2ms | `async getUserById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/users.ts:73` |
| 0.0% | 1.2ms | 0.0% | 3.7ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:572` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `isFunction` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/object-utils.js` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `verifyPasskeyRegistration` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/passkey/dist/index.mjs` |
| 0.0% | 1.2ms | 1.5% | 283.4ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2608` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `anumber` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/utils.js` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:16` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/node_modules/jose/dist/webapi/lib/jws_algorithms.js:55` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `getStore` | `node:async_hooks:163` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:586` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `enrollmentState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:381` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async runBeforeHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:70` |
| 0.0% | 1.2ms | 5.1% | 934.7ms | `async getThreadGroupCounts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1398` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1295` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `node:tls` | `node:tls:549` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `findParentSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/schema.js:159` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `Internals` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `delete` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 6.8ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:371` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `find` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 10.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/certificate_choices.js:8` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts` |
| 0.0% | 1.2ms | 0.0% | 4.9ms | `parseStringReferenceWithTable` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js:89` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `internal:streams/duplexpair` | `internal:streams/duplexpair:11` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `applyAddressSearchFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts` |
| 0.0% | 1.2ms | 0.0% | 3.4ms | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1274` |
| 0.0% | 1.2ms | 2.4% | 452.8ms | `async provideConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/default-connection-provider.js:10` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/api/index.mjs:49` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `__exportStar` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/node_modules/tslib/tslib.js:153` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/utf8-to-jisx0212-table.js:10` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `__exportAll` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/_virtual/_rolldown/runtime.mjs` |
| 0.0% | 1.1ms | 0.1% | 25.0ms | `decryptPayload` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts:62` |
| 0.0% | 1.1ms | 15.3% | 2.79s | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:645` |
| 0.0% | 1.1ms | 1.2% | 227.9ms | `async time` | `/tmp/spike-switch-server/anatomy.ts:31` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `throwForMissingRequestStore` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/work-unit-async-storage.external.js` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `wrappedCipher` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/utils.js` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async sqliteGeneratedPrimaryKeyColumn` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:29` |
| 0.0% | 1.1ms | 0.0% | 4.4ms | `async getMessageCalendarInviteDataByMessageId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:164` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:409` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `makeBitMapDescriptor` | `internal:streams/writable` |
| 0.0% | 1.1ms | 0.3% | 60.5ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:80` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `decodeBase64` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/htmlparser2/node_modules/entities/dist/esm/internal/decode-shared.js:24` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:182` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:543` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `internal:stream` | `internal:stream:18` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:22` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `#all` | `bun:sqlite` |
| 0.0% | 1.1ms | 0.1% | 30.3ms | `where` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:38` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `SHA2_32B` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha2.js` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `NextResponse` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:41` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `initGetFieldAttributes` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-attributes.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `getTime` | `[native code]` |
| 0.0% | 1.1ms | 7.7% | 1.41s | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2465` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `array` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/identityMetadata.ts` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async getThreadGroupCounts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1371` |
| 0.0% | 1.1ms | 0.0% | 2.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:228` |
| 0.0% | 1.1ms | 0.0% | 4.3ms | `async runWithRequestState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:24` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async getMessageCalendarInviteDataByMessageId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:201` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs` |
| 0.0% | 1.1ms | 0.0% | 8.1ms | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:387` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `formatToParts` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 2.3ms | `hydrateIdentityMetadata` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/identityMetadata.ts:8` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async update` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async acquireConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:43` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2661` |
| 0.0% | 1.1ms | 0.0% | 2.0ms | `push` | `node:async_hooks:55` |
| 0.0% | 1.1ms | 0.0% | 2.4ms | `(anonymous)` | `/tmp/spike-switch-server/anatomy.ts:71` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `Error` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async assertAccountFolder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/folderAccountGuard.ts` |
| 0.0% | 1.1ms | 0.7% | 140.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:604` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `chachaCore` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:78` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `releaseLock` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async validateAccountFolders` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/folderAccount.ts:11` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `bump` | `/tmp/spike-switch-server/sqlcounter.ts:47` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:12` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `headers` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/headers.js:24` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:85` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `applySearchQueryFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:717` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:555` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/ua-parser-js/ua-parser.js` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async executeTakeFirst` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/insert-query-builder.js` |
| 0.0% | 1.1ms | 0.0% | 2.3ms | `async getThreadGroupCounts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1381` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `mergeModules` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/lib/helpers/merge-exports.js:8` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async tryCatch` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/utils.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `deriveSystemFlagState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `getDatabaseFieldIndexName` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/database-index.mjs:46` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `__decorate` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js` |
| 0.0% | 1.1ms | 0.0% | 8.0ms | `final` | `node:crypto:344` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testAuthHarness.ts` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/mimetypes.js:6` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `Promise` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:684` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `isFinalized` | `bun:sqlite:128` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `$constructor` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:112` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `getThreadCollabStates` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts:73` |
| 0.0% | 1.1ms | 3.5% | 646.4ms | `getTopicSuggestionsForThreadSignalBatch` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:619` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `Proxy` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `TextEncoder` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:890` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `parseReferenceExpression` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async ensureCalendarEventRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:663` |
| 0.0% | 1.1ms | 0.2% | 45.4ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:83` |
| 0.0% | 1.1ms | 0.0% | 2.5ms | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:51` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1305` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `decodeSecret` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:571` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/he/he.js:31` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `createWithSpan` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/tracer.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `selectFrom` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(unknown)` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:885` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `object` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `#getExecutor` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/raw-builder/raw-builder.js:49` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:677` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async rebuildAllThreadSignalsForAccount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts` |
| 0.0% | 1.1ms | 0.1% | 33.1ms | `insert` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/ftsIdentity.ts:88` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `topicSuggestionEntriesFromThreadSignalRows` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async runValidation` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/validator.mjs:8` |
| 0.0% | 1.1ms | 0.0% | 3.0ms | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:37` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:59` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async assertAccountFolder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/folderAccountGuard.ts:7` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `Uint8Array` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `applySearchQueryFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:713` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `_recoverAddrSpec` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 1.1ms | 0.2% | 50.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:506` |
| 0.0% | 1.1ms | 0.9% | 180.0ms | `async getThreadCollabStates` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/threadCollab.ts:44` |
| 0.0% | 1.1ms | 0.0% | 14.7ms | `async resolveAccountRole` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/accountAccess.ts:12` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:31` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `listUsers` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `resolve` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-model-name.mjs` |
| 0.0% | 1.1ms | 0.0% | 2.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:664` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:33` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `nullable` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/accountPrefs.ts` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs:41` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `ZodOptional` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:103` |
| 0.0% | 1.1ms | 0.0% | 5.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts:72` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async transformSingleOutput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:146` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async getDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async lock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2320` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2224` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `atob` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `tokenize` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `endsWith` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:589` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `getProvider` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js` |
| 0.0% | 1.1ms | 0.0% | 2.1ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2304` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `_isSpaceCode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `_parseAddressList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `run` | `node:async_hooks` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `shouldIgnoreTopicSuggestionSignal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:126` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/value-node.js` |
| 0.0% | 1.1ms | 0.0% | 2.4ms | `transformJoinClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:282` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `normalizeShardSql` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/ftsIdentity.ts` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async dispatchAuthEndpoint` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:534` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:185` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:70` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `parentNode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/operation-node-visitor.js:6` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `createFunctionModule` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/function-module.js:20` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@simplewebauthn/server/esm/services/metadataService.js` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2662` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:204` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:3` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `__spreadArray` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:648` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:810` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `getTopicSuggestionsForThreadSignalBatch` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:573` |
| 0.0% | 1.0ms | 0.0% | 2.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:166` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-attributes.mjs:28` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `transformJoinClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `rowToTopic` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:662` |
| 0.0% | 1.0ms | 0.5% | 103.8ms | `readUserById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/users.ts:32` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `resolve` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-model-name.mjs:17` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async stageMessageFiles` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/storage.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs` |
| 0.0% | 1.0ms | 0.0% | 2.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:41` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async time` | `/tmp/spike-switch-server/anatomy.ts:32` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2648` |
| 0.0% | 1.0ms | 0.0% | 4.8ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:182` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:334` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `runCipher` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_arx.js` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:638` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `buildMeaningfulAttachmentPredicateSql` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async dispatchAuthEndpoint` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:187` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/segment-config/ensure-static.js` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authPolicyHandler.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:869` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async getDatabaseColumnBounds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `getEnumValues` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js` |
| 0.0% | 1.0ms | 0.0% | 3.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:197` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async reconcileLifecycle` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/userLifecycle.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `isPromise` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/utils/is-promise.mjs` |
| 0.0% | 1.0ms | 0.4% | 84.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:57` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/endpoint-context.mjs` |
| 0.0% | 1.0ms | 0.0% | 14.8ms | `async execute` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:318` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `NextResponse` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:39` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async getThreadGroupCounts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1402` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `groupsFromRows` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async ensureCalendarEventRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `query` | `bun:sqlite` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `parseExpression` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/expression-parser.js:7` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async getTrustedOrigins` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/helpers.mjs` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:376` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `toASN` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js` |
| 0.0% | 1.0ms | 0.0% | 2.3ms | `deriveSystemFlagState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:320` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `Database` | `bun:sqlite` |
| 0.0% | 1.0ms | 0.1% | 21.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:706` |
| 0.0% | 1.0ms | 0.0% | 9.6ms | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:80` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:19` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2482` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:423` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/well-known/index.js:6` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2683` |
| 0.0% | 1.0ms | 4.2% | 776.4ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2476` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `addColumn` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/schema/create-table-builder.js:127` |
| 0.0% | 1.0ms | 0.5% | 91.8ms | `decodeSecret` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts:73` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `debugLog` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:39` |
| 0.0% | 1.0ms | 0.0% | 2.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:594` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js:12` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:348` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async runBeforeHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:67` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1021` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `getOwnPropertyDescriptor` | `[native code]` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `deepmergeFastUnsafeCustom` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/deepmerge-ts/dist/index.mjs` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs` |
| 0.0% | 1.0ms | 0.0% | 14.6ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:105` |
| 0.0% | 1.0ms | 0.0% | 5.0ms | `async getMessageCalendarInviteDataByMessageId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:189` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `#run` | `bun:sqlite` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `isAPIError` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/is-api-error.mjs` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs` |
| 0.0% | 1.0ms | 0.0% | 5.8ms | `(anonymous)` | `/tmp/spike-switch-server/anatomy.ts:73` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `fromString` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `assign` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs` |
| 0.0% | 1.0ms | 0.0% | 2.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:491` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/bags/pkcs8_shrouded_key_bag.js:2` |
| 0.0% | 1.0ms | 0.0% | 2.1ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2293` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `Address6` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv6.js` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `capSize` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/esm/charsets.js:213` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/key_usage.js:19` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `get` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:210` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `applyAddressSearchFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:570` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:372` |
| 0.0% | 1.0ms | 0.9% | 170.2ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2540` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async get` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `normalize` | `/tmp/spike-switch-server/anatomy.ts:51` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts:76` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async GET` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:55` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `isCorrect` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/common.js` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async getAccountById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/serverDb.ts:24` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `parseValueExpression` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/value-parser.js:14` |
| 0.0% | 1.0ms | 0.3% | 60.3ms | `mapAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts:153` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `normalize` | `/tmp/spike-switch-server/anatomy.ts:60` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async withAuthResponse` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:48` |
| 0.0% | 999us | 0.0% | 999us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-id-field.mjs:43` |
| 0.0% | 999us | 0.0% | 999us | `charAt` | `[native code]` |
| 0.0% | 998us | 0.2% | 41.1ms | `extractEmailAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:22` |
| 0.0% | 998us | 0.0% | 998us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:176` |
| 0.0% | 997us | 0.0% | 997us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:181` |
| 0.0% | 997us | 0.1% | 26.3ms | `safeParseJson` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts:22` |
| 0.0% | 996us | 0.0% | 996us | `compileList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:134` |
| 0.0% | 996us | 0.0% | 996us | `parseSearchInput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:601` |
| 0.0% | 996us | 1.6% | 300.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:248` |
| 0.0% | 996us | 0.0% | 996us | `initGetDefaultModelName` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-model-name.mjs` |
| 0.0% | 994us | 0.0% | 994us | `looksLikeJiraMessage` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:31` |
| 0.0% | 994us | 0.0% | 994us | `safeParseJson` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts` |
| 0.0% | 993us | 0.0% | 993us | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:101` |
| 0.0% | 992us | 0.0% | 2.2ms | `applyInviteUidQueryFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:786` |
| 0.0% | 990us | 0.0% | 990us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/raw-builder/raw-builder.js` |
| 0.0% | 990us | 0.0% | 990us | `setHeader` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:27` |
| 0.0% | 989us | 0.0% | 8.5ms | `visitWhere` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:144` |
| 0.0% | 987us | 0.0% | 987us | `IsSymbol` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js` |
| 0.0% | 987us | 0.0% | 987us | `async getAccountById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accounts.ts` |
| 0.0% | 987us | 1.3% | 246.8ms | `topicSuggestionEntriesFromThreadSignalRows` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:178` |
| 0.0% | 986us | 0.0% | 986us | `matcher` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:73` |
| 0.0% | 983us | 0.0% | 983us | `defaultThreadCollabState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts` |
| 0.0% | 983us | 0.0% | 983us | `async reconcileProvisioning` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/userProvisioning.ts` |
| 0.0% | 982us | 0.0% | 982us | `finalize` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_poly1305.js` |
| 0.0% | 981us | 0.0% | 2.2ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2227` |
| 0.0% | 980us | 0.0% | 980us | `ResponseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/@edge-runtime/cookies/index.js:261` |
| 0.0% | 979us | 0.0% | 979us | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:695` |
| 0.0% | 978us | 0.0% | 978us | `persistAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts` |
| 0.0% | 978us | 0.0% | 978us | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:834` |
| 0.0% | 977us | 0.0% | 977us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:637` |
| 0.0% | 975us | 0.0% | 975us | `/\s/` | `[native code]` |
| 0.0% | 974us | 0.0% | 974us | `add` | `[native code]` |
| 0.0% | 973us | 0.0% | 973us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/node.js:78` |
| 0.0% | 972us | 0.0% | 972us | `expr` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:382` |
| 0.0% | 971us | 0.0% | 971us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:77` |
| 0.0% | 970us | 0.0% | 4.6ms | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:69` |
| 0.0% | 969us | 0.0% | 969us | `async findUserByEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs` |
| 0.0% | 969us | 0.0% | 969us | `toUpperCase` | `[native code]` |
| 0.0% | 968us | 0.0% | 968us | `async runBeforeHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:83` |
| 0.0% | 967us | 0.0% | 967us | `getChunkedCookie` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/session-store.mjs:138` |
| 0.0% | 957us | 0.0% | 10.2ms | `async runBeforeHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:106` |
| 0.0% | 953us | 0.0% | 15.6ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:14` |
| 0.0% | 952us | 0.0% | 952us | `messageAuthorEmailSql` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/ownAddressSql.ts:11` |
| 0.0% | 951us | 0.0% | 951us | `decodeDelta` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/internal/decode-shared.js:92` |
| 0.0% | 949us | 0.0% | 949us | `$constructor` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:46` |
| 0.0% | 948us | 0.2% | 38.2ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2468` |
| 0.0% | 947us | 0.0% | 947us | `getAuth` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:263` |
| 0.0% | 947us | 0.0% | 947us | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:49` |
| 0.0% | 947us | 0.0% | 2.0ms | `sort` | `[native code]` |
| 0.0% | 946us | 0.0% | 3.4ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:152` |
| 0.0% | 946us | 0.0% | 2.0ms | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1360` |
| 0.0% | 944us | 0.0% | 944us | `async #transformResult` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js` |
| 0.0% | 943us | 0.0% | 943us | `async before` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authPolicyHandler.ts` |
| 0.0% | 943us | 0.0% | 1.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:1236` |
| 0.0% | 939us | 0.0% | 939us | `async runValidation` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/validator.mjs:6` |
| 0.0% | 937us | 0.0% | 937us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/attribute_certificate_info.js` |
| 0.0% | 934us | 0.0% | 934us | `decodeSecret` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts:68` |
| 0.0% | 934us | 0.0% | 934us | `writer` | `[native code]` |
| 0.0% | 931us | 0.0% | 931us | `ensureThreadRuntimeSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:382` |
| 0.0% | 929us | 0.0% | 929us | `async upsertMessages` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts` |
| 0.0% | 922us | 0.0% | 922us | `Frame` | `node:async_hooks` |

## Call Tree (Total Time)

| Total% | Total | Self% | Self | Function | Location |
|-------:|------:|------:|-----:|----------|----------|
| 65.4% | 11.89s | 1.9% | 363.2ms | `forEach` | `[native code]` |
| 41.7% | 7.58s | 0.0% | 10.0ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:82` |
| 30.2% | 5.49s | 0.0% | 0us | `async withAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:413` |
| 25.9% | 4.71s | 25.9% | 4.71s | `all` | `[native code]` |
| 17.6% | 3.20s | 0.0% | 1.2ms | `getTopicSuggestionsForThreadSignalBatch` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:635` |
| 15.3% | 2.79s | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:645` |
| 14.9% | 2.72s | 0.0% | 9.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:647` |
| 8.8% | 1.60s | 8.8% | 1.60s | `get` | `[native code]` |
| 8.0% | 1.46s | 0.0% | 7.7ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:96` |
| 8.0% | 1.46s | 0.0% | 0us | `prepare` | `bun:sqlite:366` |
| 8.0% | 1.45s | 8.0% | 1.45s | `prepare` | `[native code]` |
| 7.7% | 1.41s | 0.0% | 1.1ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2465` |
| 7.5% | 1.37s | 7.5% | 1.37s | `run` | `[native code]` |
| 6.7% | 1.23s | 1.8% | 341.2ms | `anonymous` | `[native code]` |
| 6.5% | 1.19s | 0.0% | 0us | `#run` | `bun:sqlite:195` |
| 5.9% | 1.08s | 0.5% | 103.3ms | `map` | `[native code]` |
| 5.8% | 1.05s | 0.0% | 2.3ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2587` |
| 5.8% | 1.05s | 0.0% | 0us | `bound require` | `[native code]` |
| 5.7% | 1.05s | 0.0% | 0us | `require` | `[native code]` |
| 5.5% | 999.3ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2684` |
| 5.1% | 934.7ms | 0.0% | 1.2ms | `async getThreadGroupCounts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1398` |
| 4.9% | 897.6ms | 0.0% | 2.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:39` |
| 4.5% | 820.1ms | 4.5% | 820.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:655` |
| 4.2% | 776.4ms | 0.0% | 1.0ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2476` |
| 3.9% | 721.5ms | 0.0% | 0us | `insertThreadSignalsFromMessageRows` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:50` |
| 3.9% | 721.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:54` |
| 3.9% | 713.2ms | 0.0% | 0us | `async create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:501` |
| 3.5% | 646.4ms | 0.0% | 1.1ms | `getTopicSuggestionsForThreadSignalBatch` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:619` |
| 3.5% | 642.8ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:707` |
| 3.3% | 608.7ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/tracer.mjs:37` |
| 3.2% | 596.6ms | 0.1% | 21.2ms | `flatIntoArrayWithCallback` | `[native code]` |
| 3.2% | 589.2ms | 3.2% | 589.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:648` |
| 3.2% | 581.4ms | 3.2% | 581.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:659` |
| 3.0% | 558.4ms | 0.0% | 1.3ms | `flush` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:45` |
| 3.0% | 555.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:46` |
| 2.8% | 521.6ms | 0.0% | 2.4ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:97` |
| 2.7% | 498.9ms | 0.0% | 0us | `async rebuildThreadSignalsForThreadIds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:114` |
| 2.6% | 475.5ms | 0.0% | 0us | `rebuildThreadSignalsForThreadIdsInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:105` |
| 2.5% | 471.7ms | 2.5% | 469.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:651` |
| 2.4% | 452.8ms | 0.0% | 1.2ms | `async provideConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/default-connection-provider.js:10` |
| 2.4% | 450.2ms | 2.4% | 450.2ms | `json` | `[native code]` |
| 2.4% | 450.2ms | 0.0% | 0us | `json` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:91` |
| 2.3% | 423.6ms | 0.0% | 2.1ms | `async getAccountById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accounts.ts:82` |
| 2.2% | 403.8ms | 0.0% | 0us | `getTopicSuggestionSignalsForThreadsFromDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:232` |
| 2.1% | 389.8ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:236` |
| 2.0% | 378.8ms | 0.0% | 0us | `flush` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:226` |
| 2.0% | 368.2ms | 0.0% | 0us | `transaction` | `bun:sqlite:447` |
| 2.0% | 366.2ms | 0.0% | 0us | `async findOne` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:598` |
| 1.9% | 357.6ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:450` |
| 1.9% | 354.7ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:720` |
| 1.8% | 337.7ms | 0.0% | 8.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:182` |
| 1.8% | 335.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:751` |
| 1.8% | 335.3ms | 0.0% | 0us | `upsertBatch` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:365` |
| 1.8% | 331.6ms | 0.9% | 170.8ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/index.mjs:125` |
| 1.7% | 321.8ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2614` |
| 1.7% | 313.2ms | 0.0% | 0us | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1359` |
| 1.6% | 307.9ms | 0.0% | 10.4ms | `flatMap` | `[native code]` |
| 1.6% | 300.1ms | 0.0% | 996us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:248` |
| 1.6% | 296.9ms | 0.0% | 0us | `rememberTopicLearningForThread` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:49` |
| 1.5% | 289.9ms | 0.0% | 0us | `shouldIgnoreTopicSuggestionSignal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:125` |
| 1.5% | 283.4ms | 0.0% | 1.2ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2608` |
| 1.5% | 279.3ms | 0.0% | 0us | `executeQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:60` |
| 1.4% | 257.8ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:664` |
| 1.4% | 255.3ms | 0.0% | 0us | `async rebuildAllThreadSignalsForAccount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:136` |
| 1.3% | 250.8ms | 0.0% | 0us | `rebuildAllThreadSignalsForAccountInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:131` |
| 1.3% | 246.8ms | 0.0% | 987us | `topicSuggestionEntriesFromThreadSignalRows` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:178` |
| 1.2% | 235.2ms | 0.0% | 0us | `parseAddressEmails` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:45` |
| 1.2% | 227.9ms | 0.0% | 1.1ms | `async time` | `/tmp/spike-switch-server/anatomy.ts:31` |
| 1.2% | 227.2ms | 0.0% | 4.7ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2507` |
| 1.2% | 223.7ms | 0.0% | 2.1ms | `isOwnAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:62` |
| 1.2% | 220.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:666` |
| 1.2% | 220.0ms | 0.0% | 0us | `upsertTopicLearningSignalsForThreadIds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:160` |
| 1.2% | 220.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:169` |
| 1.1% | 216.2ms | 0.0% | 0us | `async findOne` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:526` |
| 1.1% | 212.3ms | 0.0% | 0us | `visitNode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/operation-node-visitor.js:112` |
| 1.1% | 201.4ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:201` |
| 1.0% | 198.2ms | 0.0% | 1.2ms | `async getAccountById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accounts.ts:85` |
| 1.0% | 198.1ms | 0.1% | 22.8ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2671` |
| 1.0% | 193.3ms | 0.0% | 0us | `shouldIgnoreTopicSuggestionSignalUncached` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:140` |
| 1.0% | 191.0ms | 0.0% | 0us | `async withReturning` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:362` |
| 1.0% | 191.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:362` |
| 1.0% | 190.2ms | 0.0% | 1.4ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:355` |
| 1.0% | 189.7ms | 1.0% | 188.6ms | `async executeTakeFirst` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/insert-query-builder.js:1114` |
| 1.0% | 183.3ms | 0.8% | 145.6ms | `normalize` | `/tmp/spike-switch-server/sqlcounter.ts:36` |
| 0.9% | 180.0ms | 0.0% | 1.1ms | `async getThreadCollabStates` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/threadCollab.ts:44` |
| 0.9% | 175.4ms | 0.0% | 7.0ms | `addressparser` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1199` |
| 0.9% | 171.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:557` |
| 0.9% | 170.2ms | 0.0% | 1.0ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2540` |
| 0.9% | 167.9ms | 0.0% | 0us | `flush` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:43` |
| 0.9% | 167.3ms | 0.0% | 3.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:236` |
| 0.9% | 166.8ms | 0.0% | 0us | `values` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/insert-query-builder.js:200` |
| 0.9% | 165.8ms | 0.0% | 0us | `parseInsertColumnsAndValues` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/insert-values-parser.js:22` |
| 0.9% | 165.8ms | 0.0% | 0us | `parseRowValues` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/insert-values-parser.js:46` |
| 0.9% | 165.8ms | 0.9% | 165.8ms | `isUndefined` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/object-utils.js:12` |
| 0.9% | 163.9ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/sign-in.mjs:352` |
| 0.9% | 163.9ms | 0.9% | 163.9ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs` |
| 0.9% | 163.9ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:262` |
| 0.9% | 163.9ms | 0.0% | 0us | `async createSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:331` |
| 0.8% | 160.8ms | 0.8% | 160.8ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-attributes.mjs:30` |
| 0.8% | 152.6ms | 0.0% | 0us | `async getAccountById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accounts.ts:84` |
| 0.8% | 151.9ms | 0.0% | 0us | `collectTopicSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:73` |
| 0.8% | 145.7ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:578` |
| 0.7% | 144.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:200` |
| 0.7% | 141.6ms | 0.7% | 141.6ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:657` |
| 0.7% | 140.3ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:604` |
| 0.7% | 138.0ms | 0.0% | 0us | `getTopicSuggestionSignalsForThreadsFromDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:216` |
| 0.7% | 135.0ms | 0.0% | 0us | `async withDbWriteRetry` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/dbWriteRetry.ts:66` |
| 0.7% | 135.0ms | 0.0% | 0us | `async withDbWriteRetry` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/dbWriteRetry.ts:117` |
| 0.7% | 131.8ms | 0.0% | 4.3ms | `isOwnAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:61` |
| 0.7% | 131.2ms | 0.0% | 2.2ms | `async getMessageCalendarInviteDataByMessageId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:178` |
| 0.6% | 126.9ms | 0.6% | 126.9ms | `displayDayNumber` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/i18n/format.ts:43` |
| 0.6% | 123.9ms | 0.1% | 34.7ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:14` |
| 0.6% | 123.3ms | 0.0% | 11.9ms | `executeQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:62` |
| 0.6% | 119.7ms | 0.0% | 0us | `parseTableExpressionOrList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/table-parser.js:13` |
| 0.6% | 113.0ms | 0.0% | 0us | `#runNoArgs` | `bun:sqlite:163` |
| 0.6% | 112.6ms | 0.0% | 0us | `async findOne` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:505` |
| 0.6% | 112.6ms | 0.0% | 0us | `selectFrom` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-creator.js:135` |
| 0.6% | 112.6ms | 0.0% | 3.3ms | `async getMessageCalendarInviteDataByMessageId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:192` |
| 0.6% | 111.3ms | 0.0% | 14.8ms | `(anonymous)` | `[native code]` |
| 0.6% | 111.0ms | 0.6% | 111.0ms | `importModule` | `[native code]` |
| 0.5% | 107.4ms | 0.1% | 31.1ms | `filter` | `[native code]` |
| 0.5% | 107.4ms | 0.0% | 3.0ms | `getThreadCollabStates` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts:76` |
| 0.5% | 106.5ms | 0.0% | 0us | `parseAliasedExpression` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/expression-parser.js:20` |
| 0.5% | 106.2ms | 0.0% | 1.2ms | `async getUserById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/users.ts:73` |
| 0.5% | 105.1ms | 0.0% | 0us | `bump` | `/tmp/spike-switch-server/sqlcounter.ts:51` |
| 0.5% | 104.8ms | 0.1% | 26.6ms | `addMs` | `/tmp/spike-switch-server/sqlcounter.ts:61` |
| 0.5% | 103.8ms | 0.0% | 1.0ms | `readUserById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/users.ts:32` |
| 0.5% | 103.1ms | 0.0% | 0us | `getTopicSuggestionsForThreadSignalBatch` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:599` |
| 0.5% | 100.7ms | 0.0% | 0us | `async handleFallbackJoin` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:395` |
| 0.5% | 100.7ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:196` |
| 0.5% | 100.4ms | 0.5% | 100.4ms | `stringify` | `[native code]` |
| 0.5% | 100.1ms | 0.0% | 0us | `getTopicSuggestionsForThreadSignalBatch` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:620` |
| 0.5% | 98.8ms | 0.0% | 0us | `getTopicSuggestionsForThreadSignalBatch` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:577` |
| 0.5% | 96.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:315` |
| 0.5% | 96.4ms | 0.0% | 0us | `async getDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:313` |
| 0.5% | 96.0ms | 0.0% | 2.1ms | `listSenderIdentityRows` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/senderIdentities.ts:12` |
| 0.5% | 93.1ms | 0.0% | 7.5ms | `_parseAddressList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1155` |
| 0.5% | 91.8ms | 0.0% | 1.0ms | `decodeSecret` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts:73` |
| 0.5% | 90.9ms | 0.0% | 2.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:581` |
| 0.4% | 90.4ms | 0.4% | 90.4ms | `URL` | `[native code]` |
| 0.4% | 87.7ms | 0.0% | 0us | `getOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:57` |
| 0.4% | 87.5ms | 0.0% | 9.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:677` |
| 0.4% | 86.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js:2` |
| 0.4% | 86.8ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:88` |
| 0.4% | 85.7ms | 0.4% | 85.7ms | `Set` | `[native code]` |
| 0.4% | 85.4ms | 0.0% | 0us | `shouldIgnoreTopicSuggestionSignalUncached` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:151` |
| 0.4% | 84.1ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:57` |
| 0.4% | 83.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:246` |
| 0.4% | 81.6ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:367` |
| 0.4% | 81.4ms | 0.0% | 4.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:46` |
| 0.4% | 79.4ms | 0.0% | 0us | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:392` |
| 0.4% | 78.4ms | 0.0% | 2.2ms | `async ensureCalendarEventRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:675` |
| 0.4% | 77.6ms | 0.4% | 77.6ms | `Buffer` | `[native code]` |
| 0.4% | 76.1ms | 0.0% | 0us | `async ensureCalendarEventRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:660` |
| 0.4% | 75.9ms | 0.0% | 0us | `async execute` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:319` |
| 0.4% | 75.7ms | 0.0% | 0us | `async runWithEndpointContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/endpoint-context.mjs:45` |
| 0.4% | 74.1ms | 0.0% | 0us | `run` | `bun:sqlite:318` |
| 0.4% | 74.1ms | 0.0% | 0us | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:112` |
| 0.4% | 73.7ms | 0.0% | 5.3ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:94` |
| 0.4% | 73.3ms | 0.0% | 3.1ms | `buildMessageGroupKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/messageGrouping.ts:71` |
| 0.4% | 72.7ms | 0.3% | 59.5ms | `from` | `[native code]` |
| 0.3% | 72.0ms | 0.0% | 0us | `run` | `node:async_hooks:144` |
| 0.3% | 72.0ms | 0.0% | 0us | `bound visitSelectQuery` | `[native code]` |
| 0.3% | 70.8ms | 0.0% | 6.9ms | `tokenize` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:836` |
| 0.3% | 70.4ms | 0.0% | 2.4ms | `compareSqliteText` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:558` |
| 0.3% | 70.1ms | 0.0% | 0us | `async findOne` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:522` |
| 0.3% | 69.3ms | 0.0% | 1.2ms | `_parseAddressList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1181` |
| 0.3% | 68.9ms | 0.3% | 59.7ms | `json` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:92` |
| 0.3% | 68.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:682` |
| 0.3% | 67.7ms | 0.3% | 67.7ms | `entries` | `[native code]` |
| 0.3% | 65.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:655` |
| 0.3% | 64.7ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2499` |
| 0.3% | 64.7ms | 0.3% | 64.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:625` |
| 0.3% | 62.9ms | 0.3% | 62.9ms | `checkChar` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:989` |
| 0.3% | 62.4ms | 0.1% | 31.6ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2645` |
| 0.3% | 61.0ms | 0.0% | 0us | `async execute` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:317` |
| 0.3% | 60.5ms | 0.0% | 1.1ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:80` |
| 0.3% | 60.3ms | 0.0% | 1.0ms | `mapAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts:153` |
| 0.3% | 60.1ms | 0.0% | 9.3ms | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:54` |
| 0.3% | 59.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:54` |
| 0.3% | 59.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:68` |
| 0.3% | 59.6ms | 0.3% | 59.6ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js` |
| 0.3% | 59.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/index.js:4` |
| 0.3% | 59.5ms | 0.0% | 6.6ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:97` |
| 0.3% | 58.6ms | 0.0% | 13.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:646` |
| 0.3% | 57.2ms | 0.0% | 0us | `buildTimeGroupKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/messageGrouping.ts:44` |
| 0.3% | 57.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/utils.js:341` |
| 0.3% | 57.2ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/utils.js:341` |
| 0.3% | 56.3ms | 0.0% | 2.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:194` |
| 0.3% | 55.9ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2455` |
| 0.3% | 55.8ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:440` |
| 0.3% | 55.7ms | 0.0% | 1.6ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:507` |
| 0.3% | 55.2ms | 0.0% | 0us | `async getThreadGroupCounts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1383` |
| 0.2% | 54.1ms | 0.0% | 0us | `buildGroupKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:71` |
| 0.2% | 53.4ms | 0.0% | 3.3ms | `init` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:65` |
| 0.2% | 52.4ms | 0.0% | 0us | `mapAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts:177` |
| 0.2% | 51.4ms | 0.0% | 0us | `async transformSingleOutput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:180` |
| 0.2% | 50.6ms | 0.0% | 0us | `async (anonymous)` | `/tmp/spike-switch-server/anatomy.ts:72` |
| 0.2% | 50.0ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:506` |
| 0.2% | 49.8ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@zone-eu/mailsplit/lib/mime-node.js:3` |
| 0.2% | 49.8ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@zone-eu/mailsplit/index.js:3` |
| 0.2% | 49.8ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@zone-eu/mailsplit/lib/message-splitter.js:4` |
| 0.2% | 49.5ms | 0.0% | 0us | `async (anonymous)` | `/tmp/spike-switch-server/anatomy.ts:73` |
| 0.2% | 48.5ms | 0.0% | 2.4ms | `async enrichMessagesWithThreadCollab` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadCollab.ts:18` |
| 0.2% | 48.3ms | 0.0% | 1.3ms | `compileQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:24` |
| 0.2% | 48.0ms | 0.1% | 23.2ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:16` |
| 0.2% | 46.0ms | 0.0% | 0us | `async getAccountOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/senderIdentities.ts:21` |
| 0.2% | 45.4ms | 0.0% | 1.1ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:83` |
| 0.2% | 45.4ms | 0.2% | 45.4ms | `getTopicSuggestionWeight` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:68` |
| 0.2% | 45.1ms | 0.0% | 2.3ms | `async resolveAccountDbPath` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:338` |
| 0.2% | 44.3ms | 0.2% | 44.3ms | `cloneObject` | `[native code]` |
| 0.2% | 44.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@zone-eu/mailsplit/lib/headers.js:3` |
| 0.2% | 43.8ms | 0.2% | 41.6ms | `buildTimeGroupKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/messageGrouping.ts:42` |
| 0.2% | 43.7ms | 0.0% | 0us | `getThreadCollabStates` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts:75` |
| 0.2% | 43.4ms | 0.2% | 43.4ms | `copyDataProperties` | `[native code]` |
| 0.2% | 42.9ms | 0.0% | 1.2ms | `async (anonymous)` | `/tmp/spike-switch-server/anatomy.ts:65` |
| 0.2% | 42.6ms | 0.0% | 6.6ms | `(anonymous)` | `/tmp/spike-switch-server/anatomy.ts:75` |
| 0.2% | 42.3ms | 0.2% | 42.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2666` |
| 0.2% | 42.2ms | 0.0% | 0us | `executeQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:63` |
| 0.2% | 41.8ms | 0.0% | 1.3ms | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:29` |
| 0.2% | 41.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:75` |
| 0.2% | 41.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:87` |
| 0.2% | 41.1ms | 0.0% | 998us | `extractEmailAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:22` |
| 0.2% | 41.1ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:724` |
| 0.2% | 41.1ms | 0.2% | 41.1ms | `freeze` | `[native code]` |
| 0.2% | 40.8ms | 0.0% | 0us | `async (anonymous)` | `/tmp/spike-switch-server/anatomy.ts:70` |
| 0.2% | 40.5ms | 0.0% | 0us | `node:stream` | `node:stream:2` |
| 0.2% | 40.5ms | 0.0% | 0us | `filterOutputFields` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs:9` |
| 0.2% | 39.7ms | 0.0% | 5.4ms | `normalize` | `/tmp/spike-switch-server/anatomy.ts:57` |
| 0.2% | 39.1ms | 0.0% | 0us | `compileList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:136` |
| 0.2% | 39.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:48` |
| 0.2% | 38.6ms | 0.2% | 38.6ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:583` |
| 0.2% | 38.2ms | 0.0% | 948us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2468` |
| 0.2% | 38.1ms | 0.0% | 0us | `internal:stream` | `internal:stream:2` |
| 0.2% | 37.9ms | 0.0% | 2.5ms | `getTopicSuggestionSignalsForThreadsFromDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:210` |
| 0.2% | 37.7ms | 0.2% | 37.7ms | `/\s+/g` | `[native code]` |
| 0.2% | 37.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/libmime.js:44` |
| 0.2% | 37.4ms | 0.0% | 0us | `transaction` | `bun:sqlite:451` |
| 0.2% | 36.7ms | 0.0% | 0us | `buildTimeGroupKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/messageGrouping.ts:43` |
| 0.1% | 36.3ms | 0.1% | 36.3ms | `parse` | `[native code]` |
| 0.1% | 35.6ms | 0.1% | 35.6ms | `shouldIgnoreTopicSuggestionSignal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:123` |
| 0.1% | 35.6ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:565` |
| 0.1% | 35.4ms | 0.0% | 0us | `selectFrom` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:39` |
| 0.1% | 35.2ms | 0.0% | 0us | `async recomputeThreadsForAccountInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:318` |
| 0.1% | 34.4ms | 0.0% | 0us | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:72` |
| 0.1% | 34.4ms | 0.0% | 4.5ms | `bound visitFrom` | `[native code]` |
| 0.1% | 33.9ms | 0.1% | 20.7ms | `slimThreadListItem` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:32` |
| 0.1% | 33.6ms | 0.1% | 32.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:204` |
| 0.1% | 33.6ms | 0.0% | 0us | `getTopicSuggestionSignalsForThreadsFromDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:203` |
| 0.1% | 33.4ms | 0.1% | 32.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:685` |
| 0.1% | 33.1ms | 0.0% | 1.1ms | `insert` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/ftsIdentity.ts:88` |
| 0.1% | 32.7ms | 0.0% | 0us | `async isMfaEnrollmentComplete` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authPolicy.ts:21` |
| 0.1% | 32.7ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:211` |
| 0.1% | 32.4ms | 0.0% | 0us | `insert` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/ftsIdentity.ts:87` |
| 0.1% | 31.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:95` |
| 0.1% | 31.2ms | 0.0% | 0us | `loadServerDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/serverDb.ts:7` |
| 0.1% | 30.9ms | 0.0% | 8.6ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:84` |
| 0.1% | 30.8ms | 0.0% | 10.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:159` |
| 0.1% | 30.8ms | 0.0% | 0us | `upsertTopicLearningSignalsForThreadIds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:131` |
| 0.1% | 30.8ms | 0.0% | 0us | `getTopicSignalExclusionSet` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:27` |
| 0.1% | 30.7ms | 0.0% | 0us | `decryptPayload` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts:60` |
| 0.1% | 30.3ms | 0.0% | 1.1ms | `where` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:38` |
| 0.1% | 30.2ms | 0.0% | 1.3ms | `async getUserById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/serverDb.ts:151` |
| 0.1% | 29.9ms | 0.0% | 0us | `visitFrom` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:120` |
| 0.1% | 29.9ms | 0.0% | 0us | `bound visitAlias` | `[native code]` |
| 0.1% | 29.7ms | 0.1% | 29.7ms | `structuredClone` | `[native code]` |
| 0.1% | 29.6ms | 0.1% | 29.6ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:17` |
| 0.1% | 29.3ms | 0.0% | 0us | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1352` |
| 0.1% | 28.3ms | 0.0% | 0us | `create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/from-node.js:13` |
| 0.1% | 28.3ms | 0.0% | 0us | `createFrom` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/select-query-node.js:23` |
| 0.1% | 28.1ms | 0.0% | 0us | `listSenderIdentityRows` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/senderIdentities.ts:11` |
| 0.1% | 27.9ms | 0.0% | 0us | `async requireActiveUserSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:74` |
| 0.1% | 27.2ms | 0.0% | 0us | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:384` |
| 0.1% | 27.0ms | 0.0% | 4.7ms | `async getAccountOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/senderIdentities.ts:22` |
| 0.1% | 27.0ms | 0.0% | 1.2ms | `every` | `[native code]` |
| 0.1% | 27.0ms | 0.0% | 0us | `Decipheriv2` | `node:crypto:313` |
| 0.1% | 27.0ms | 0.1% | 27.0ms | `Cipher` | `[native code]` |
| 0.1% | 27.0ms | 0.0% | 0us | `createDecipheriv` | `node:crypto:362` |
| 0.1% | 26.8ms | 0.1% | 26.8ms | `parseAddressEmails` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:25` |
| 0.1% | 26.8ms | 0.0% | 0us | `async recomputeThreadsForAccountInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:356` |
| 0.1% | 26.4ms | 0.0% | 0us | `async getMessageCalendarInviteDataByMessageId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:165` |
| 0.1% | 26.3ms | 0.0% | 997us | `safeParseJson` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts:22` |
| 0.1% | 26.2ms | 0.1% | 26.2ms | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/esm/mimetypes.js:3` |
| 0.1% | 26.1ms | 0.0% | 3.1ms | `normalizeAccountSettings` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/accountSettings.ts:5` |
| 0.1% | 26.0ms | 0.0% | 0us | `(module)` | `/tmp/spike-switch-server/anatomy.ts:62` |
| 0.1% | 25.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:98` |
| 0.1% | 25.0ms | 0.0% | 1.1ms | `decryptPayload` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts:62` |
| 0.1% | 25.0ms | 0.0% | 0us | `visitAlias` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:282` |
| 0.1% | 24.9ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:234` |
| 0.1% | 24.7ms | 0.0% | 0us | `parseExpression` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/expression-parser.js:11` |
| 0.1% | 24.6ms | 0.0% | 3.6ms | `async transformOutput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:216` |
| 0.1% | 24.6ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:368` |
| 0.1% | 24.6ms | 0.0% | 12.3ms | `text` | `[native code]` |
| 0.1% | 24.3ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:593` |
| 0.1% | 24.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:74` |
| 0.1% | 23.9ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:40` |
| 0.1% | 23.9ms | 0.0% | 2.3ms | `async getSignedCookie` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:48` |
| 0.1% | 23.8ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:24` |
| 0.1% | 23.8ms | 0.1% | 23.8ms | `WeakMap` | `[native code]` |
| 0.1% | 23.5ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:703` |
| 0.1% | 23.5ms | 0.0% | 0us | `enrollmentState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:376` |
| 0.1% | 23.5ms | 0.1% | 18.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:16` |
| 0.1% | 22.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/charset.js:16` |
| 0.1% | 22.4ms | 0.0% | 1.3ms | `async internalHandler` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/middleware.mjs:29` |
| 0.1% | 22.3ms | 0.1% | 22.3ms | `displayDayNumber` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/i18n/format.ts:42` |
| 0.1% | 21.8ms | 0.1% | 21.8ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:9` |
| 0.1% | 21.8ms | 0.0% | 16.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:671` |
| 0.1% | 21.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:272` |
| 0.1% | 21.7ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:706` |
| 0.1% | 21.6ms | 0.0% | 0us | `async enrichMessagesWithThreadCollab` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadCollab.ts:9` |
| 0.1% | 21.6ms | 0.1% | 20.5ms | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:50` |
| 0.1% | 21.5ms | 0.0% | 0us | `initAccountSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:992` |
| 0.1% | 21.4ms | 0.1% | 21.4ms | `bump` | `/tmp/spike-switch-server/sqlcounter.ts:52` |
| 0.1% | 21.0ms | 0.0% | 0us | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:104` |
| 0.1% | 21.0ms | 0.0% | 0us | `mapAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts:185` |
| 0.1% | 20.8ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:704` |
| 0.1% | 20.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/index.js:1` |
| 0.1% | 20.6ms | 0.0% | 3.6ms | `some` | `[native code]` |
| 0.1% | 20.6ms | 0.0% | 2.6ms | `async enrichMessagesWithThreadCollab` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadCollab.ts:8` |
| 0.1% | 20.5ms | 0.0% | 0us | `configureDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:89` |
| 0.1% | 20.4ms | 0.0% | 0us | `async getCryptoKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:9` |
| 0.1% | 20.4ms | 0.0% | 0us | `async createInternalContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:97` |
| 0.1% | 20.1ms | 0.0% | 17.7ms | `performIteration` | `[native code]` |
| 0.1% | 19.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:32` |
| 0.1% | 19.9ms | 0.1% | 19.9ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:12` |
| 0.1% | 19.8ms | 0.0% | 2.6ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:102` |
| 0.1% | 19.6ms | 0.0% | 0us | `select` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:62` |
| 0.1% | 19.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/config.js:2` |
| 0.1% | 19.4ms | 0.0% | 2.1ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:660` |
| 0.1% | 19.3ms | 0.0% | 0us | `binary` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:27` |
| 0.1% | 19.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sanitize-html/index.js:1` |
| 0.1% | 18.6ms | 0.0% | 1.2ms | `async getAccountById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/serverDb.ts:26` |
| 0.1% | 18.6ms | 0.0% | 0us | `async findOne` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:521` |
| 0.1% | 18.3ms | 0.0% | 1.3ms | `parseValueBinaryOperation` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/binary-operation-parser.js:25` |
| 0.1% | 18.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sanitize-html/index.js:5` |
| 0.1% | 18.2ms | 0.0% | 0us | `webpackUniversalModuleDefinition` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:3` |
| 0.1% | 18.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:3800` |
| 0.1% | 18.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:9` |
| 0.0% | 18.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:89` |
| 0.0% | 17.5ms | 0.0% | 0us | `async assertAccountFolder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/folderAccountGuard.ts:8` |
| 0.0% | 17.4ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:367` |
| 0.0% | 17.4ms | 0.0% | 17.4ms | `wrapStatement` | `/tmp/spike-switch-server/sqlcounter.ts:75` |
| 0.0% | 17.4ms | 0.0% | 0us | `async getAccountById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/serverDb.ts:25` |
| 0.0% | 17.4ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/middleware.mjs:9` |
| 0.0% | 17.4ms | 0.0% | 0us | `cloneWithSelections` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/select-query-node.js:31` |
| 0.0% | 17.3ms | 0.0% | 1.3ms | `filterOutputFields` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs:8` |
| 0.0% | 17.3ms | 0.0% | 0us | `async verifySignature` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:18` |
| 0.0% | 17.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:250` |
| 0.0% | 17.1ms | 0.0% | 17.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js` |
| 0.0% | 17.1ms | 0.0% | 17.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:29` |
| 0.0% | 17.1ms | 0.0% | 2.6ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:682` |
| 0.0% | 16.9ms | 0.0% | 0us | `getTopicSuggestionSignalsForThreadsFromDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:198` |
| 0.0% | 16.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/index.js:5` |
| 0.0% | 16.7ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:584` |
| 0.0% | 16.6ms | 0.0% | 0us | `async requireActiveUserSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:76` |
| 0.0% | 16.2ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:16` |
| 0.0% | 16.1ms | 0.0% | 0us | `upsertTopicLearningSignalsForThreadIds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:134` |
| 0.0% | 16.0ms | 0.0% | 0us | `async provideConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/default-connection-provider.js:13` |
| 0.0% | 16.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:184` |
| 0.0% | 16.0ms | 0.0% | 0us | `internal:streams/lazy_transform` | `internal:streams/lazy_transform:2` |
| 0.0% | 16.0ms | 0.0% | 0us | `internal:streams/transform` | `internal:streams/transform:2` |
| 0.0% | 16.0ms | 0.0% | 0us | `node:crypto` | `node:crypto:2` |
| 0.0% | 15.9ms | 0.0% | 15.9ms | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/add-constraint-node.js:6` |
| 0.0% | 15.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:356` |
| 0.0% | 15.6ms | 0.0% | 953us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:14` |
| 0.0% | 15.2ms | 0.0% | 0us | `async ensureCalendarEventRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:662` |
| 0.0% | 15.2ms | 0.0% | 6.9ms | `getOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:55` |
| 0.0% | 14.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:69` |
| 0.0% | 14.9ms | 0.0% | 0us | `ownAddressList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:69` |
| 0.0% | 14.8ms | 0.0% | 14.8ms | `verify` | `[native code]` |
| 0.0% | 14.8ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:256` |
| 0.0% | 14.8ms | 0.0% | 1.0ms | `async execute` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:318` |
| 0.0% | 14.7ms | 0.0% | 1.1ms | `async resolveAccountRole` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/accountAccess.ts:12` |
| 0.0% | 14.7ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:10` |
| 0.0% | 14.6ms | 0.0% | 1.0ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:105` |
| 0.0% | 14.3ms | 0.0% | 0us | `bound visitReference` | `[native code]` |
| 0.0% | 14.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/index.js:4` |
| 0.0% | 14.2ms | 0.0% | 0us | `async stageMessageFiles` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/storage.ts:264` |
| 0.0% | 14.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:707` |
| 0.0% | 14.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/middleware.mjs:15` |
| 0.0% | 14.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:223` |
| 0.0% | 13.9ms | 0.0% | 13.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:622` |
| 0.0% | 13.8ms | 0.0% | 1.5ms | `upsertTopicLearningSignalsForThreadIds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:153` |
| 0.0% | 13.8ms | 0.0% | 0us | `async requireActiveUserSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:72` |
| 0.0% | 13.8ms | 0.0% | 0us | `transformJoinClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:288` |
| 0.0% | 13.8ms | 0.0% | 13.8ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:25` |
| 0.0% | 13.7ms | 0.0% | 0us | `upsertTopicLearningSignalsForThreadIds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:145` |
| 0.0% | 13.7ms | 0.0% | 1.5ms | `async runValidation` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/validator.mjs:44` |
| 0.0% | 13.6ms | 0.0% | 0us | `async requireActiveUserSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:84` |
| 0.0% | 13.6ms | 0.0% | 2.4ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:765` |
| 0.0% | 13.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/he/he.js:342` |
| 0.0% | 13.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:241` |
| 0.0% | 13.6ms | 0.0% | 12.3ms | `LazyQueryId` | `[native code]` |
| 0.0% | 13.6ms | 0.0% | 0us | `createQueryId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/query-id.js:4` |
| 0.0% | 13.5ms | 0.0% | 0us | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:375` |
| 0.0% | 13.5ms | 0.0% | 0us | `mapAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts:192` |
| 0.0% | 13.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:9` |
| 0.0% | 13.2ms | 0.0% | 13.2ms | `importKey` | `[native code]` |
| 0.0% | 13.2ms | 0.0% | 13.2ms | `arrayFromFastWithoutMapFn` | `[native code]` |
| 0.0% | 13.1ms | 0.0% | 0us | `node:http` | `node:http:2` |
| 0.0% | 13.0ms | 0.0% | 0us | `bound visitIdentifier` | `[native code]` |
| 0.0% | 13.0ms | 0.0% | 2.4ms | `compileUnwrappedIdentifier` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:305` |
| 0.0% | 13.0ms | 0.0% | 0us | `visitIdentifier` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:298` |
| 0.0% | 13.0ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/mailparser/dist/esm/mail-parser.js:40` |
| 0.0% | 13.0ms | 0.0% | 0us | `tlds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:607` |
| 0.0% | 12.9ms | 0.0% | 12.9ms | `wrapStatement` | `/tmp/spike-switch-server/sqlcounter.ts:74` |
| 0.0% | 12.9ms | 0.0% | 12.9ms | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:52` |
| 0.0% | 12.8ms | 0.0% | 5.6ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:10` |
| 0.0% | 12.6ms | 0.0% | 0us | `collectTopicSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:60` |
| 0.0% | 12.5ms | 0.0% | 0us | `async executeQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:99` |
| 0.0% | 12.5ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:16` |
| 0.0% | 12.5ms | 0.0% | 4.4ms | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:369` |
| 0.0% | 12.5ms | 0.0% | 0us | `rq` | `/tmp/spike-switch-server/anatomy.ts:24` |
| 0.0% | 12.3ms | 0.0% | 0us | `selectFrom` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:37` |
| 0.0% | 12.3ms | 0.0% | 12.3ms | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/esm/mimetypes.js:1034` |
| 0.0% | 12.1ms | 0.0% | 12.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:62` |
| 0.0% | 12.0ms | 0.0% | 6.3ms | `topicSuggestionSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:104` |
| 0.0% | 12.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:52` |
| 0.0% | 12.0ms | 0.0% | 12.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadCollab.ts:8` |
| 0.0% | 11.9ms | 0.0% | 11.9ms | `async stageMessageFiles` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/storage.ts:234` |
| 0.0% | 11.9ms | 0.0% | 3.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs:193` |
| 0.0% | 11.8ms | 0.0% | 11.8ms | `_collectAddressParts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:561` |
| 0.0% | 11.7ms | 0.0% | 11.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:639` |
| 0.0% | 11.7ms | 0.0% | 11.7ms | `update` | `[native code]` |
| 0.0% | 11.7ms | 0.0% | 0us | `getThreadCollabStates` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts:72` |
| 0.0% | 11.7ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:224` |
| 0.0% | 11.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:222` |
| 0.0% | 11.7ms | 0.0% | 11.7ms | `async enrichMessagesWithThreadCollab` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadCollab.ts:14` |
| 0.0% | 11.6ms | 0.0% | 0us | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:89` |
| 0.0% | 11.6ms | 0.0% | 0us | `(module)` | `/tmp/spike-switch-server/anatomy.ts:8` |
| 0.0% | 11.5ms | 0.0% | 7.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:209` |
| 0.0% | 11.4ms | 0.0% | 11.4ms | `RegExp` | `[native code]` |
| 0.0% | 11.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js:15` |
| 0.0% | 11.3ms | 0.0% | 11.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:233` |
| 0.0% | 11.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:603` |
| 0.0% | 11.2ms | 0.0% | 11.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/he/he.js` |
| 0.0% | 11.1ms | 0.0% | 0us | `displayDayNumber` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/i18n/format.ts:45` |
| 0.0% | 11.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/encoding-table.js:1` |
| 0.0% | 10.9ms | 0.0% | 0us | `configureAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:107` |
| 0.0% | 10.9ms | 0.0% | 2.3ms | `async internalHandler` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:52` |
| 0.0% | 10.9ms | 0.0% | 5.8ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:11` |
| 0.0% | 10.8ms | 0.0% | 2.4ms | `headers` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/headers.js:110` |
| 0.0% | 10.8ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/index.js:4` |
| 0.0% | 10.8ms | 0.0% | 10.8ms | `flush` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:223` |
| 0.0% | 10.7ms | 0.0% | 10.7ms | `rowToTopic` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:65` |
| 0.0% | 10.7ms | 0.0% | 2.2ms | `normalize` | `/tmp/spike-switch-server/anatomy.ts:56` |
| 0.0% | 10.7ms | 0.0% | 0us | `serialize` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js:16` |
| 0.0% | 10.5ms | 0.0% | 0us | `ensureAccountKeySchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountKeys.ts:230` |
| 0.0% | 10.5ms | 0.0% | 0us | `async hasRequestState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:16` |
| 0.0% | 10.5ms | 0.0% | 0us | `topicSuggestionSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:103` |
| 0.0% | 10.5ms | 0.0% | 0us | `rebuildThreadSignalsForThreadIdsInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:86` |
| 0.0% | 10.4ms | 0.0% | 10.4ms | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:110` |
| 0.0% | 10.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/proto.js:40` |
| 0.0% | 10.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/pino.js:8` |
| 0.0% | 10.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/connection.js:13` |
| 0.0% | 10.2ms | 0.0% | 0us | `internal:streams/duplex` | `internal:streams/duplex:2` |
| 0.0% | 10.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/index.js:6` |
| 0.0% | 10.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/certificate_choices.js:8` |
| 0.0% | 10.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:210` |
| 0.0% | 10.2ms | 0.0% | 957us | `async runBeforeHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:106` |
| 0.0% | 10.2ms | 0.0% | 0us | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:68` |
| 0.0% | 10.1ms | 0.0% | 0us | `selectAll` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:128` |
| 0.0% | 10.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/socks/build/index.js:17` |
| 0.0% | 10.1ms | 0.0% | 10.1ms | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:53` |
| 0.0% | 10.0ms | 0.0% | 0us | `(anonymous)` | `/tmp/spike-switch-server/anatomy.ts:74` |
| 0.0% | 10.0ms | 0.0% | 10.0ms | `transformJoinClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:296` |
| 0.0% | 9.9ms | 0.0% | 0us | `cached` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/i18n/format.ts:15` |
| 0.0% | 9.9ms | 0.0% | 0us | `displayDayNumberUncached` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/i18n/format.ts:53` |
| 0.0% | 9.9ms | 0.0% | 9.9ms | `DateTimeFormat` | `[native code]` |
| 0.0% | 9.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/i18n/format.ts:53` |
| 0.0% | 9.9ms | 0.0% | 0us | `(module)` | `/tmp/spike-switch-server/anatomy.ts:41` |
| 0.0% | 9.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs:44` |
| 0.0% | 9.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:652` |
| 0.0% | 9.7ms | 0.0% | 0us | `async requireAccountContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/accountContext.ts:59` |
| 0.0% | 9.6ms | 0.0% | 1.0ms | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:80` |
| 0.0% | 9.6ms | 0.0% | 9.6ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts` |
| 0.0% | 9.5ms | 0.0% | 0us | `async provideConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/default-connection-provider.js:8` |
| 0.0% | 9.5ms | 0.0% | 0us | `async executeQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:38` |
| 0.0% | 9.5ms | 0.0% | 0us | `async acquireConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:63` |
| 0.0% | 9.5ms | 0.0% | 0us | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1345` |
| 0.0% | 9.5ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2514` |
| 0.0% | 9.5ms | 0.0% | 0us | `async GET` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:58` |
| 0.0% | 9.4ms | 0.0% | 0us | `reduce` | `[native code]` |
| 0.0% | 9.4ms | 0.0% | 0us | `async requireActiveUserSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:85` |
| 0.0% | 9.4ms | 0.0% | 0us | `update` | `node:crypto:338` |
| 0.0% | 9.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/converters.js:7` |
| 0.0% | 9.3ms | 0.0% | 4.6ms | `getOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:56` |
| 0.0% | 9.3ms | 0.0% | 9.3ms | `Boolean` | `[native code]` |
| 0.0% | 9.3ms | 0.0% | 0us | `clone` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:334` |
| 0.0% | 9.2ms | 0.0% | 9.2ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:7` |
| 0.0% | 9.2ms | 0.0% | 0us | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:44` |
| 0.0% | 9.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:35` |
| 0.0% | 9.2ms | 0.0% | 0us | `bound visitSelection` | `[native code]` |
| 0.0% | 9.2ms | 0.0% | 0us | `visitSelection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:123` |
| 0.0% | 9.1ms | 0.0% | 9.1ms | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts` |
| 0.0% | 9.1ms | 0.0% | 2.1ms | `async requireAccountContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/accountContext.ts:64` |
| 0.0% | 9.1ms | 0.0% | 0us | `async createTopic` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:122` |
| 0.0% | 9.1ms | 0.0% | 0us | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:67` |
| 0.0% | 9.1ms | 0.0% | 9.1ms | `async createTopic` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts` |
| 0.0% | 9.1ms | 0.0% | 9.1ms | `createExpressionBuilder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:32` |
| 0.0% | 9.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/levels.js:12` |
| 0.0% | 9.0ms | 0.0% | 2.1ms | `async time` | `/tmp/spike-switch-server/anatomy.ts:27` |
| 0.0% | 8.9ms | 0.0% | 8.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:206` |
| 0.0% | 8.9ms | 0.0% | 8.9ms | `init` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:51` |
| 0.0% | 8.9ms | 0.0% | 0us | `installAuthControlPlane` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:308` |
| 0.0% | 8.9ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:275` |
| 0.0% | 8.9ms | 0.0% | 8.9ms | `_collapseAtSpacing` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:273` |
| 0.0% | 8.8ms | 0.0% | 8.8ms | `bump` | `/tmp/spike-switch-server/sqlcounter.ts:53` |
| 0.0% | 8.8ms | 0.0% | 0us | `visitSchemableIdentifier` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:384` |
| 0.0% | 8.8ms | 0.0% | 0us | `visitTable` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:377` |
| 0.0% | 8.8ms | 0.0% | 0us | `visitReference` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:288` |
| 0.0% | 8.8ms | 0.0% | 0us | `bound visitTable` | `[native code]` |
| 0.0% | 8.8ms | 0.0% | 0us | `bound visitSchemableIdentifier` | `[native code]` |
| 0.0% | 8.7ms | 0.0% | 7.7ms | `async findOne` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:504` |
| 0.0% | 8.7ms | 0.0% | 8.7ms | `transformWhereClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` |
| 0.0% | 8.7ms | 0.0% | 0us | `async acquireConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:53` |
| 0.0% | 8.7ms | 0.0% | 8.7ms | `Map` | `[native code]` |
| 0.0% | 8.6ms | 0.0% | 0us | `ZodEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` |
| 0.0% | 8.6ms | 0.0% | 0us | `_email` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/api.js:20` |
| 0.0% | 8.6ms | 0.0% | 0us | `(module)` | `/tmp/spike-switch-server/anatomy.ts:47` |
| 0.0% | 8.5ms | 0.0% | 0us | `bound visitWhere` | `[native code]` |
| 0.0% | 8.5ms | 0.0% | 989us | `visitWhere` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:144` |
| 0.0% | 8.5ms | 0.0% | 8.5ms | `Tokenizer` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 8.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/index.js:4` |
| 0.0% | 8.4ms | 0.0% | 8.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2523` |
| 0.0% | 8.3ms | 0.0% | 0us | `rebuildThreadSignalsForThreadIdsInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:101` |
| 0.0% | 8.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:237` |
| 0.0% | 8.2ms | 0.0% | 0us | `getThreadCollabStates` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts:71` |
| 0.0% | 8.1ms | 0.0% | 8.1ms | `transformQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:16` |
| 0.0% | 8.1ms | 0.0% | 0us | `compile` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:314` |
| 0.0% | 8.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:36` |
| 0.0% | 8.1ms | 0.0% | 1.1ms | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:387` |
| 0.0% | 8.1ms | 0.0% | 0us | `formatTransactionId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:865` |
| 0.0% | 8.0ms | 0.0% | 0us | `async (anonymous)` | `/tmp/spike-switch-server/anatomy.ts:69` |
| 0.0% | 8.0ms | 0.0% | 0us | `bound clone` | `[native code]` |
| 0.0% | 8.0ms | 0.0% | 0us | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:408` |
| 0.0% | 8.0ms | 0.0% | 0us | `async resolveAccountDbPath` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:365` |
| 0.0% | 8.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/at-rule.js:3` |
| 0.0% | 8.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/postcss.js:3` |
| 0.0% | 8.0ms | 0.0% | 0us | `async getTopicSuggestionsForThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:700` |
| 0.0% | 8.0ms | 0.0% | 1.1ms | `final` | `node:crypto:344` |
| 0.0% | 8.0ms | 0.0% | 0us | `LinkifyIt` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:341` |
| 0.0% | 8.0ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/mailparser/dist/esm/mail-parser.js:38` |
| 0.0% | 7.9ms | 0.0% | 0us | `enrollmentState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:379` |
| 0.0% | 7.9ms | 0.0% | 0us | `async findOne` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:515` |
| 0.0% | 7.9ms | 0.0% | 7.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:663` |
| 0.0% | 7.7ms | 0.0% | 3.0ms | `meta` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:108` |
| 0.0% | 7.7ms | 0.0% | 0us | `bound meta` | `[native code]` |
| 0.0% | 7.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/socks/build/common/helpers.js:11` |
| 0.0% | 7.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/socks/build/client/socksclient.js:17` |
| 0.0% | 7.6ms | 0.0% | 7.6ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2615` |
| 0.0% | 7.6ms | 0.0% | 0us | `async GET` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:104` |
| 0.0% | 7.6ms | 0.0% | 0us | `bound visitBinaryOperation` | `[native code]` |
| 0.0% | 7.5ms | 0.0% | 7.5ms | `parseAddressEmails` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:42` |
| 0.0% | 7.4ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:14` |
| 0.0% | 7.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/encoding-table.js:3` |
| 0.0% | 7.3ms | 0.0% | 7.3ms | `toString` | `[native code]` |
| 0.0% | 7.2ms | 0.0% | 5.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:8` |
| 0.0% | 7.2ms | 0.0% | 7.2ms | `internal:shared` | `internal:shared:2` |
| 0.0% | 7.2ms | 0.0% | 0us | `node:fs` | `node:fs:8` |
| 0.0% | 7.2ms | 0.0% | 0us | `internal:validators` | `internal:validators:2` |
| 0.0% | 7.2ms | 0.0% | 7.2ms | `Date` | `[native code]` |
| 0.0% | 7.2ms | 0.0% | 0us | `async withAuthResponse` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:57` |
| 0.0% | 7.2ms | 0.0% | 0us | `async withAuthResponse` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:50` |
| 0.0% | 7.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:104` |
| 0.0% | 7.1ms | 0.0% | 1.4ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:8` |
| 0.0% | 7.1ms | 0.0% | 6.0ms | `throwForMissingRequestStore` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/work-unit-async-storage.external.js:88` |
| 0.0% | 7.1ms | 0.0% | 7.1ms | `/^[\p{L}\p{M}\p{N}.-]+$/u` | `[native code]` |
| 0.0% | 7.1ms | 0.0% | 0us | `ZodString` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` |
| 0.0% | 7.0ms | 0.0% | 7.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:83` |
| 0.0% | 7.0ms | 0.0% | 1.2ms | `async requireAccountContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/accountContext.ts:53` |
| 0.0% | 7.0ms | 0.0% | 0us | `async GET` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:56` |
| 0.0% | 7.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/postcss.js:9` |
| 0.0% | 7.0ms | 0.0% | 4.5ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:6` |
| 0.0% | 6.9ms | 0.0% | 0us | `resolveAccountRoleRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountAccess.ts:5` |
| 0.0% | 6.9ms | 0.0% | 0us | `LinkifyIt` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:361` |
| 0.0% | 6.9ms | 0.0% | 6.9ms | `ensureSenderIdentityMessageRuntimeSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts` |
| 0.0% | 6.9ms | 0.0% | 0us | `compile` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:155` |
| 0.0% | 6.9ms | 0.0% | 6.9ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:743` |
| 0.0% | 6.9ms | 0.0% | 0us | `async requireActiveUserSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:75` |
| 0.0% | 6.9ms | 0.0% | 0us | `async time` | `/tmp/spike-switch-server/anatomy.ts:36` |
| 0.0% | 6.8ms | 0.0% | 6.8ms | `final` | `[native code]` |
| 0.0% | 6.8ms | 0.0% | 6.8ms | `getEnvVar` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/env-impl.mjs:41` |
| 0.0% | 6.8ms | 0.0% | 0us | `topicSuggestionSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:105` |
| 0.0% | 6.8ms | 0.0% | 0us | `create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/table-node.js:14` |
| 0.0% | 6.8ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:371` |
| 0.0% | 6.8ms | 0.0% | 6.8ms | `bump` | `/tmp/spike-switch-server/sqlcounter.ts:54` |
| 0.0% | 6.7ms | 0.0% | 0us | `async resolveAccountDbPath` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:335` |
| 0.0% | 6.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/index.js:9` |
| 0.0% | 6.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/container.js:3` |
| 0.0% | 6.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/comment.js:3` |
| 0.0% | 6.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pkcs9/build/cjs/index.js:9` |
| 0.0% | 6.7ms | 0.0% | 6.7ms | `query` | `bun:sqlite:384` |
| 0.0% | 6.7ms | 0.0% | 6.7ms | `trim` | `[native code]` |
| 0.0% | 6.7ms | 0.0% | 0us | `ensureInviteIssuerSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:127` |
| 0.0% | 6.7ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:866` |
| 0.0% | 6.7ms | 0.0% | 0us | `topicSuggestionSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:107` |
| 0.0% | 6.6ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:91` |
| 0.0% | 6.6ms | 0.0% | 2.3ms | `async getDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:327` |
| 0.0% | 6.6ms | 0.0% | 0us | `resolveAccountRoleRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountAccess.ts:11` |
| 0.0% | 6.6ms | 0.0% | 5.4ms | `async GET` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:48` |
| 0.0% | 6.5ms | 0.0% | 0us | `async acquireConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:35` |
| 0.0% | 6.5ms | 0.0% | 0us | `async acquireConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:34` |
| 0.0% | 6.4ms | 0.0% | 5.4ms | `async releaseConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:67` |
| 0.0% | 6.4ms | 0.0% | 6.4ms | `concat` | `[native code]` |
| 0.0% | 6.3ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2305` |
| 0.0% | 6.3ms | 0.0% | 1.4ms | `header` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testAuthHarness.ts:79` |
| 0.0% | 6.2ms | 0.0% | 0us | `validate` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:142` |
| 0.0% | 6.2ms | 0.0% | 0us | `async runValidation` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/validator.mjs:12` |
| 0.0% | 6.2ms | 0.0% | 0us | `createExpressionBuilder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:115` |
| 0.0% | 6.2ms | 0.0% | 0us | `async runAfterHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:135` |
| 0.0% | 6.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:245` |
| 0.0% | 6.2ms | 0.0% | 0us | `async getDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:300` |
| 0.0% | 6.2ms | 0.0% | 6.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:161` |
| 0.0% | 6.1ms | 0.0% | 6.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:78` |
| 0.0% | 6.1ms | 0.0% | 6.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:573` |
| 0.0% | 6.0ms | 0.0% | 6.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadCollab.ts:9` |
| 0.0% | 6.0ms | 0.0% | 6.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:233` |
| 0.0% | 6.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:339` |
| 0.0% | 5.9ms | 0.0% | 1.2ms | `async runAfterHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:114` |
| 0.0% | 5.9ms | 0.0% | 5.9ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:17` |
| 0.0% | 5.9ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts:72` |
| 0.0% | 5.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:182` |
| 0.0% | 5.8ms | 0.0% | 5.8ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:653` |
| 0.0% | 5.8ms | 0.0% | 1.0ms | `(anonymous)` | `/tmp/spike-switch-server/anatomy.ts:73` |
| 0.0% | 5.8ms | 0.0% | 5.8ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:19` |
| 0.0% | 5.8ms | 0.0% | 0us | `(anonymous)` | `/tmp/spike-switch-server/anatomy.ts:69` |
| 0.0% | 5.7ms | 0.0% | 0us | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:391` |
| 0.0% | 5.6ms | 0.0% | 0us | `lookup` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/ftsIdentity.ts:82` |
| 0.0% | 5.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:602` |
| 0.0% | 5.6ms | 0.0% | 0us | `async runBeforeHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:79` |
| 0.0% | 5.5ms | 0.0% | 0us | `async (anonymous)` | `/tmp/spike-switch-server/anatomy.ts:71` |
| 0.0% | 5.5ms | 0.0% | 0us | `cloneWithSelections` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/select-query-node.js:32` |
| 0.0% | 5.5ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:81` |
| 0.0% | 5.5ms | 0.0% | 0us | `async getTables` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:70` |
| 0.0% | 5.5ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:29` |
| 0.0% | 5.5ms | 0.0% | 4.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/api/index.mjs:59` |
| 0.0% | 5.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:156` |
| 0.0% | 5.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:697` |
| 0.0% | 5.5ms | 0.0% | 5.5ms | `topicSuggestionSignalKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:553` |
| 0.0% | 5.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-ecc/build/cjs/index.js:5` |
| 0.0% | 5.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-ecc/build/cjs/ec_parameters.js:6` |
| 0.0% | 5.5ms | 0.0% | 1.2ms | `exit` | `[native code]` |
| 0.0% | 5.5ms | 0.0% | 0us | `(module)` | `/tmp/spike-switch-server/anatomy.ts:81` |
| 0.0% | 5.4ms | 0.0% | 5.4ms | `compare` | `[native code]` |
| 0.0% | 5.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/converters.js:6` |
| 0.0% | 5.4ms | 0.0% | 5.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:588` |
| 0.0% | 5.4ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:588` |
| 0.0% | 5.4ms | 0.0% | 5.4ms | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:35` |
| 0.0% | 5.4ms | 0.0% | 1.2ms | `_recoverAddrSpec` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:367` |
| 0.0% | 5.4ms | 0.0% | 0us | `(anonymous)` | `/tmp/spike-switch-server/anatomy.ts:79` |
| 0.0% | 5.4ms | 0.0% | 2.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:220` |
| 0.0% | 5.4ms | 0.0% | 5.4ms | `replace` | `[native code]` |
| 0.0% | 5.4ms | 0.0% | 2.5ms | `async lock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:81` |
| 0.0% | 5.3ms | 0.0% | 2.2ms | `topicSuggestionSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:106` |
| 0.0% | 5.3ms | 0.0% | 5.3ms | `untpl` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:152` |
| 0.0% | 5.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/charset.js:141` |
| 0.0% | 5.3ms | 0.0% | 0us | `getCodec` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/lib/index.js:102` |
| 0.0% | 5.2ms | 0.0% | 0us | `getTopicSuggestionSignalsForThreadsFromDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:197` |
| 0.0% | 5.2ms | 0.0% | 4.1ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:697` |
| 0.0% | 5.1ms | 0.0% | 0us | `visitBinaryOperation` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:1149` |
| 0.0% | 5.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1214` |
| 0.0% | 5.0ms | 0.0% | 0us | `Tokenizer` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:806` |
| 0.0% | 5.0ms | 0.0% | 0us | `ensureMasterTeamColumns` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:167` |
| 0.0% | 5.0ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:846` |
| 0.0% | 5.0ms | 0.0% | 5.0ms | ``/^[A-Za-z0-9.!#$%&'*+\/=?^_`{\|}~-]+$/`` | `[native code]` |
| 0.0% | 5.0ms | 0.0% | 0us | `installShardWriterGuards` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts:85` |
| 0.0% | 5.0ms | 0.0% | 0us | `migrate` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountKeys.ts:225` |
| 0.0% | 5.0ms | 0.0% | 1.0ms | `async getMessageCalendarInviteDataByMessageId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:189` |
| 0.0% | 4.9ms | 0.0% | 2.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:155` |
| 0.0% | 4.9ms | 0.0% | 4.9ms | `asyncFunctionDrive` | `[native code]` |
| 0.0% | 4.9ms | 0.0% | 0us | `async enrollTestTotp` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testAuthHarness.ts:198` |
| 0.0% | 4.9ms | 0.0% | 4.9ms | `base32Decode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/tests/helpers/totp.ts` |
| 0.0% | 4.9ms | 0.0% | 0us | `compile` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:247` |
| 0.0% | 4.9ms | 0.0% | 0us | `totpFromUri` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/tests/helpers/totp.ts:34` |
| 0.0% | 4.9ms | 0.0% | 1.2ms | `parseStringReferenceWithTable` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js:89` |
| 0.0% | 4.9ms | 0.0% | 2.4ms | `fsyncSync` | `[native code]` |
| 0.0% | 4.8ms | 0.0% | 0us | `toASN` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js:50` |
| 0.0% | 4.8ms | 0.0% | 4.8ms | `Request` | `[native code]` |
| 0.0% | 4.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:110` |
| 0.0% | 4.8ms | 0.0% | 3.5ms | `async get` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:39` |
| 0.0% | 4.8ms | 0.0% | 0us | `insertThreadSignalsFromMessageRows` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:67` |
| 0.0% | 4.8ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:182` |
| 0.0% | 4.8ms | 0.0% | 4.8ms | `async runValidation` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/validator.mjs` |
| 0.0% | 4.8ms | 0.0% | 2.4ms | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:28` |
| 0.0% | 4.8ms | 0.0% | 0us | `async migrateAuthSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:219` |
| 0.0% | 4.8ms | 0.0% | 0us | `async getMigrations` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:685` |
| 0.0% | 4.8ms | 0.0% | 0us | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:80` |
| 0.0% | 4.8ms | 0.0% | 0us | `async migrateAuthSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:211` |
| 0.0% | 4.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:274` |
| 0.0% | 4.8ms | 0.0% | 0us | `async getThreadGroupCounts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1404` |
| 0.0% | 4.8ms | 0.0% | 4.8ms | `reverse` | `[native code]` |
| 0.0% | 4.8ms | 0.0% | 0us | `async serializeSignedCookie` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:84` |
| 0.0% | 4.8ms | 0.0% | 4.8ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs` |
| 0.0% | 4.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:56` |
| 0.0% | 4.8ms | 0.0% | 0us | `async setSessionCookie` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/index.mjs:172` |
| 0.0% | 4.8ms | 0.0% | 0us | `async setSignedCookie` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:58` |
| 0.0% | 4.8ms | 0.0% | 0us | `getCodec` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/lib/index.js:65` |
| 0.0% | 4.8ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/charset.js:28` |
| 0.0% | 4.7ms | 0.0% | 0us | `node:tls` | `node:tls:2` |
| 0.0% | 4.7ms | 0.0% | 2.2ms | `parseAliasedTable` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/table-parser.js:29` |
| 0.0% | 4.7ms | 0.0% | 0us | `toASN` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js:53` |
| 0.0% | 4.7ms | 0.0% | 0us | `toAsnItem` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js:131` |
| 0.0% | 4.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/request.js:23` |
| 0.0% | 4.7ms | 0.0% | 0us | `buildMeaningfulAttachmentExistsSql` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:954` |
| 0.0% | 4.7ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2578` |
| 0.0% | 4.7ms | 0.0% | 0us | `async requireActiveUserSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:94` |
| 0.0% | 4.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/fromJSON.js:6` |
| 0.0% | 4.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:375` |
| 0.0% | 4.7ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:99` |
| 0.0% | 4.7ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs:316` |
| 0.0% | 4.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:539` |
| 0.0% | 4.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ip-address.js:29` |
| 0.0% | 4.6ms | 0.0% | 0us | `async deleteWithHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/with-hooks.mjs:120` |
| 0.0% | 4.6ms | 0.0% | 4.6ms | `async findMany` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` |
| 0.0% | 4.6ms | 0.0% | 970us | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:69` |
| 0.0% | 4.6ms | 0.0% | 4.6ms | `encode` | `[native code]` |
| 0.0% | 4.6ms | 0.0% | 3.6ms | `_recoverAddrSpec` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:368` |
| 0.0% | 4.6ms | 0.0% | 4.6ms | `__getBetterAuthGlobal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/global.mjs:17` |
| 0.0% | 4.6ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs:52` |
| 0.0% | 4.6ms | 0.0% | 0us | `async signIn` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testAuthHarness.ts:175` |
| 0.0% | 4.6ms | 0.0% | 0us | `async ensureAsyncStorage` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:10` |
| 0.0% | 4.6ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs:51` |
| 0.0% | 4.6ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:5` |
| 0.0% | 4.6ms | 0.0% | 4.6ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:621` |
| 0.0% | 4.6ms | 0.0% | 0us | `NextResponse` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:42` |
| 0.0% | 4.6ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2243` |
| 0.0% | 4.6ms | 0.0% | 2.2ms | `query` | `bun:sqlite:382` |
| 0.0% | 4.6ms | 0.0% | 0us | `transformJoinClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:284` |
| 0.0% | 4.5ms | 0.0% | 0us | `__decorate` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:106` |
| 0.0% | 4.5ms | 0.0% | 4.5ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:95` |
| 0.0% | 4.5ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:78` |
| 0.0% | 4.5ms | 0.0% | 4.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:198` |
| 0.0% | 4.5ms | 0.0% | 0us | `getColorDepth` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs:49` |
| 0.0% | 4.5ms | 0.0% | 4.5ms | `async findOne` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:503` |
| 0.0% | 4.5ms | 0.0% | 4.5ms | `/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/` | `[native code]` |
| 0.0% | 4.5ms | 0.0% | 4.5ms | `compileQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:29` |
| 0.0% | 4.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/decorators/index.js:3` |
| 0.0% | 4.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/decorators/auto-injectable.js:4` |
| 0.0% | 4.5ms | 0.0% | 3.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:620` |
| 0.0% | 4.5ms | 0.0% | 4.5ms | `subarray` | `[native code]` |
| 0.0% | 4.5ms | 0.0% | 0us | `decryptPayload` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts:57` |
| 0.0% | 4.5ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2611` |
| 0.0% | 4.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/node.js:3` |
| 0.0% | 4.5ms | 0.0% | 3.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs:9` |
| 0.0% | 4.4ms | 0.0% | 4.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts` |
| 0.0% | 4.4ms | 0.0% | 0us | `createBetterAuth` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/auth/base.mjs:21` |
| 0.0% | 4.4ms | 0.0% | 0us | `getEndpoints` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/index.mjs:119` |
| 0.0% | 4.4ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:277` |
| 0.0% | 4.4ms | 0.0% | 4.4ms | `signUpEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/sign-up.mjs` |
| 0.0% | 4.4ms | 0.0% | 4.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs` |
| 0.0% | 4.4ms | 0.0% | 1.1ms | `async getMessageCalendarInviteDataByMessageId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:164` |
| 0.0% | 4.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:361` |
| 0.0% | 4.4ms | 0.0% | 4.4ms | `init` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js` |
| 0.0% | 4.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/index.js:6` |
| 0.0% | 4.4ms | 0.0% | 0us | `encrypt` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/utils.js:875` |
| 0.0% | 4.4ms | 0.0% | 0us | `async rawEncrypt` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/crypto/index.mjs:33` |
| 0.0% | 4.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:624` |
| 0.0% | 4.3ms | 0.0% | 1.1ms | `async runWithRequestState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:24` |
| 0.0% | 4.3ms | 0.0% | 4.3ms | `async getDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:293` |
| 0.0% | 4.3ms | 0.0% | 0us | `async withAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:412` |
| 0.0% | 4.3ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:533` |
| 0.0% | 4.3ms | 0.0% | 4.3ms | `roleAtLeast` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/accountRole.ts:5` |
| 0.0% | 4.3ms | 0.0% | 0us | `async requireAccountContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/accountContext.ts:58` |
| 0.0% | 4.3ms | 0.0% | 4.3ms | `async ensureCalendarEventRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:665` |
| 0.0% | 4.3ms | 0.0% | 0us | `optional` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:1242` |
| 0.0% | 4.2ms | 0.0% | 1.3ms | `parseStringReference` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js:48` |
| 0.0% | 4.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/libmime.js:45` |
| 0.0% | 4.2ms | 0.0% | 0us | `init` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:76` |
| 0.0% | 4.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:208` |
| 0.0% | 4.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:360` |
| 0.0% | 4.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:179` |
| 0.0% | 4.2ms | 0.0% | 4.2ms | `bump` | `/tmp/spike-switch-server/sqlcounter.ts:48` |
| 0.0% | 4.1ms | 0.0% | 4.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:627` |
| 0.0% | 4.0ms | 0.0% | 4.0ms | `toLowerCase` | `[native code]` |
| 0.0% | 4.0ms | 0.0% | 0us | `generateFastpass` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1147` |
| 0.0% | 4.0ms | 0.0% | 0us | `write` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/doc.js:27` |
| 0.0% | 4.0ms | 0.0% | 0us | `ensureTableColumns` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:147` |
| 0.0% | 4.0ms | 0.0% | 4.0ms | `async runAfterHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs` |
| 0.0% | 4.0ms | 0.0% | 0us | `normalizeUserEmails` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:240` |
| 0.0% | 4.0ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:851` |
| 0.0% | 3.9ms | 0.0% | 3.0ms | `mapAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts:183` |
| 0.0% | 3.9ms | 0.0% | 1.4ms | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:19` |
| 0.0% | 3.8ms | 0.0% | 3.8ms | `sanitizeIdentifier` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:1363` |
| 0.0% | 3.8ms | 0.0% | 3.8ms | `createFunctionModule` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/function-module.js:19` |
| 0.0% | 3.8ms | 0.0% | 0us | `initAccountSchemaBody` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:1004` |
| 0.0% | 3.8ms | 0.0% | 3.8ms | `defaultThreadCollabState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts:54` |
| 0.0% | 3.8ms | 0.0% | 3.8ms | `closeAccountDbConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts` |
| 0.0% | 3.8ms | 0.0% | 0us | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:88` |
| 0.0% | 3.8ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/index.js:4` |
| 0.0% | 3.8ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/attributes/index.js:5` |
| 0.0% | 3.7ms | 0.0% | 1.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:572` |
| 0.0% | 3.7ms | 0.0% | 0us | `toASN` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/converters.js:16` |
| 0.0% | 3.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/rsaes_oaep.js:44` |
| 0.0% | 3.7ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:841` |
| 0.0% | 3.7ms | 0.0% | 3.7ms | `TokenList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 3.7ms | 0.0% | 0us | `async enrichMessagesWithThreadCollab` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadCollab.ts:12` |
| 0.0% | 3.7ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:895` |
| 0.0% | 3.7ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:153` |
| 0.0% | 3.7ms | 0.0% | 0us | `async findSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:369` |
| 0.0% | 3.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/input.js:5` |
| 0.0% | 3.7ms | 0.0% | 0us | `async dispatchAuthEndpoint` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:205` |
| 0.0% | 3.7ms | 0.0% | 3.7ms | `set` | `[native code]` |
| 0.0% | 3.6ms | 0.0% | 0us | `buildMeaningfulAttachmentPredicateSql` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:941` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `createExpressionBuilder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:73` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/middleware.mjs` |
| 0.0% | 3.6ms | 0.0% | 0us | `async setThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:217` |
| 0.0% | 3.6ms | 0.0% | 0us | `flush` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:225` |
| 0.0% | 3.6ms | 0.0% | 0us | `getTopicSuggestionSignalsForThreadsFromDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:206` |
| 0.0% | 3.6ms | 0.0% | 0us | `shouldIgnoreTopicSuggestionSignalUncached` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:144` |
| 0.0% | 3.6ms | 0.0% | 0us | `localFromBER` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1438` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `ResponseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/@edge-runtime/cookies/index.js:256` |
| 0.0% | 3.6ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:273` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:877` |
| 0.0% | 3.6ms | 0.0% | 0us | `compile` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:154` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `is` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/set-operation-node.js` |
| 0.0% | 3.6ms | 0.0% | 0us | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:41` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `join` | `[native code]` |
| 0.0% | 3.6ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:42` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `visitAlias` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js` |
| 0.0% | 3.5ms | 0.0% | 3.5ms | `keys` | `[native code]` |
| 0.0% | 3.5ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:267` |
| 0.0% | 3.5ms | 0.0% | 0us | `async ensureAuthLifetimeLock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authLifetimeLock.ts:75` |
| 0.0% | 3.5ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:285` |
| 0.0% | 3.5ms | 0.0% | 0us | `getAuth` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:285` |
| 0.0% | 3.5ms | 0.0% | 3.5ms | `async acquireAuthLifetimeLock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authLifetimeLock.ts` |
| 0.0% | 3.5ms | 0.0% | 0us | `async getSharedTestAuthHarness` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testAuthHarness.ts:150` |
| 0.0% | 3.5ms | 0.0% | 1.2ms | `async validateAccountFolders` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/folderAccount.ts:12` |
| 0.0% | 3.5ms | 0.0% | 0us | `async validateAccountFolders` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/folderAccount.ts:17` |
| 0.0% | 3.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:16` |
| 0.0% | 3.5ms | 0.0% | 3.5ms | `WeakSet` | `[native code]` |
| 0.0% | 3.5ms | 0.0% | 0us | `Kysely` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/kysely.js:71` |
| 0.0% | 3.5ms | 0.0% | 0us | `RuntimeDriver` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:18` |
| 0.0% | 3.5ms | 0.0% | 1.2ms | `query` | `bun:sqlite:380` |
| 0.0% | 3.5ms | 0.0% | 3.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts` |
| 0.0% | 3.5ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/init.mjs:10` |
| 0.0% | 3.5ms | 0.0% | 0us | `async createAuthContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/create-context.mjs:233` |
| 0.0% | 3.5ms | 0.0% | 3.5ms | `async requireActiveUserSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts` |
| 0.0% | 3.5ms | 0.0% | 3.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs:11` |
| 0.0% | 3.5ms | 0.0% | 2.3ms | `async withAuthResponse` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:51` |
| 0.0% | 3.5ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/well-known/index.js:3` |
| 0.0% | 3.4ms | 0.0% | 0us | `getDbTableColumns` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:110` |
| 0.0% | 3.4ms | 0.0% | 0us | `ensureCalendarReminderRuntimeSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:273` |
| 0.0% | 3.4ms | 0.0% | 0us | `ensureCalendarReminderOptionalColumns` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:250` |
| 0.0% | 3.4ms | 0.0% | 3.4ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:15` |
| 0.0% | 3.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/enveloped_data.js:9` |
| 0.0% | 3.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/recipient_infos.js:7` |
| 0.0% | 3.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/index.js:10` |
| 0.0% | 3.4ms | 0.0% | 3.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:690` |
| 0.0% | 3.4ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accounts.ts:111` |
| 0.0% | 3.4ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:865` |
| 0.0% | 3.4ms | 0.0% | 1.2ms | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1274` |
| 0.0% | 3.4ms | 0.0% | 3.4ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:81` |
| 0.0% | 3.4ms | 0.0% | 2.4ms | `create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/identifier-node.js:11` |
| 0.0% | 3.4ms | 0.0% | 0us | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1337` |
| 0.0% | 3.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:227` |
| 0.0% | 3.4ms | 0.0% | 3.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:181` |
| 0.0% | 3.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/pino.js:4` |
| 0.0% | 3.4ms | 0.0% | 0us | `createAdminInvite` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:691` |
| 0.0% | 3.4ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:900` |
| 0.0% | 3.4ms | 0.0% | 946us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:152` |
| 0.0% | 3.4ms | 0.0% | 3.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts` |
| 0.0% | 3.4ms | 0.0% | 0us | `getTopicSuggestionSignalsForThreadsFromDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:243` |
| 0.0% | 3.3ms | 0.0% | 0us | `_collectAddressParts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:562` |
| 0.0% | 3.3ms | 0.0% | 3.3ms | `async (anonymous)` | `/tmp/spike-switch-server/anatomy.ts` |
| 0.0% | 3.3ms | 0.0% | 0us | `bound max` | `[native code]` |
| 0.0% | 3.3ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/adminMailbox.ts:12` |
| 0.0% | 3.3ms | 0.0% | 0us | `clone` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:39` |
| 0.0% | 3.3ms | 0.0% | 0us | `ZodNumber` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` |
| 0.0% | 3.3ms | 0.0% | 0us | `bound check` | `[native code]` |
| 0.0% | 3.3ms | 0.0% | 3.3ms | `shouldIgnoreTopicSuggestionSignalUncached` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:143` |
| 0.0% | 3.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:155` |
| 0.0% | 3.3ms | 0.0% | 3.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:257` |
| 0.0% | 3.3ms | 0.0% | 0us | `async getAuthDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:119` |
| 0.0% | 3.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/picocolors/picocolors.js:4` |
| 0.0% | 3.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/css-syntax-error.js:3` |
| 0.0% | 3.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/rsaes_oaep.js:8` |
| 0.0% | 3.3ms | 0.0% | 0us | `rebuildAllThreadSignalsForAccountInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:130` |
| 0.0% | 3.3ms | 0.0% | 0us | `async ensureCalendarEventRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:668` |
| 0.0% | 3.3ms | 0.0% | 0us | `ensureCalendarEventOptionalColumns` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:477` |
| 0.0% | 3.3ms | 0.0% | 3.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:179` |
| 0.0% | 3.3ms | 0.0% | 3.3ms | `addMs` | `/tmp/spike-switch-server/sqlcounter.ts` |
| 0.0% | 3.3ms | 0.0% | 0us | `collectTopicSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:92` |
| 0.0% | 3.3ms | 0.0% | 0us | `extractJiraProjectKeys` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:40` |
| 0.0% | 3.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/index.js:7` |
| 0.0% | 3.2ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2495` |
| 0.0% | 3.2ms | 0.0% | 3.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:584` |
| 0.0% | 3.2ms | 0.0% | 0us | `DBCSCodec` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:116` |
| 0.0% | 3.2ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:197` |
| 0.0% | 3.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:245` |
| 0.0% | 3.2ms | 0.0% | 3.2ms | `install` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/storage.ts:258` |
| 0.0% | 3.2ms | 0.0% | 0us | `bound optional` | `[native code]` |
| 0.0% | 3.2ms | 0.0% | 3.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:180` |
| 0.0% | 3.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/dayjs/dayjs.min.js:1` |
| 0.0% | 3.2ms | 0.0% | 3.2ms | `async createInternalContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:7` |
| 0.0% | 3.2ms | 0.0% | 3.2ms | `defineBound` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:771` |
| 0.0% | 3.2ms | 0.0% | 0us | `members` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:740` |
| 0.0% | 3.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/postcss.js:11` |
| 0.0% | 3.2ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:880` |
| 0.0% | 3.2ms | 0.0% | 0us | `ZodOptional` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` |
| 0.0% | 3.1ms | 0.0% | 2.1ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2583` |
| 0.0% | 3.1ms | 0.0% | 0us | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:81` |
| 0.0% | 3.1ms | 0.0% | 0us | `compile` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:174` |
| 0.0% | 3.1ms | 0.0% | 3.1ms | `loadNextHeadersModule` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs` |
| 0.0% | 3.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:70` |
| 0.0% | 3.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:51` |
| 0.0% | 3.1ms | 0.0% | 3.1ms | `Headers` | `[native code]` |
| 0.0% | 3.1ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:850` |
| 0.0% | 3.1ms | 0.0% | 0us | `getHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:157` |
| 0.0% | 3.1ms | 0.0% | 0us | `bound nullish` | `[native code]` |
| 0.0% | 3.1ms | 0.0% | 2.0ms | `expr` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:390` |
| 0.0% | 3.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testDbHarness.ts:49` |
| 0.0% | 3.1ms | 0.0% | 3.1ms | `getSharedDbHarnessState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testDbHarness.ts` |
| 0.0% | 3.0ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:874` |
| 0.0% | 3.0ms | 0.0% | 3.0ms | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:394` |
| 0.0% | 3.0ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:892` |
| 0.0% | 3.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:158` |
| 0.0% | 3.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:243` |
| 0.0% | 3.0ms | 0.0% | 0us | `schemaSql` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:134` |
| 0.0% | 3.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:222` |
| 0.0% | 3.0ms | 0.0% | 0us | `isInstalledControlPlane` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:222` |
| 0.0% | 3.0ms | 0.0% | 1.1ms | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:37` |
| 0.0% | 3.0ms | 0.0% | 3.0ms | `getOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:52` |
| 0.0% | 3.0ms | 0.0% | 0us | `async executeQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:41` |
| 0.0% | 3.0ms | 0.0% | 1.8ms | `resolveDatabaseSchemaIndexes` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/database-index.mjs:145` |
| 0.0% | 3.0ms | 0.0% | 0us | `getAuthTablesWithResolvedIndexes` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/get-tables.mjs:289` |
| 0.0% | 3.0ms | 0.0% | 3.0ms | `shouldIgnoreTopicSuggestionSignalUncached` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:135` |
| 0.0% | 3.0ms | 0.0% | 3.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` |
| 0.0% | 3.0ms | 0.0% | 3.0ms | `reallyExit` | `[native code]` |
| 0.0% | 3.0ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/sign-in.mjs:105` |
| 0.0% | 2.9ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:837` |
| 0.0% | 2.9ms | 0.0% | 0us | `visitColumn` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:126` |
| 0.0% | 2.9ms | 0.0% | 0us | `visitReference` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:291` |
| 0.0% | 2.9ms | 0.0% | 0us | `bound visitColumn` | `[native code]` |
| 0.0% | 2.9ms | 0.0% | 2.9ms | `createExpressionBuilder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:25` |
| 0.0% | 2.9ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:877` |
| 0.0% | 2.8ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/index.js:9` |
| 0.0% | 2.7ms | 0.0% | 2.7ms | `split` | `[native code]` |
| 0.0% | 2.7ms | 0.0% | 2.7ms | `parseStringReference` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js:45` |
| 0.0% | 2.7ms | 0.0% | 2.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts` |
| 0.0% | 2.6ms | 0.0% | 0us | `configureAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:106` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `prepareAccountShardConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `sanitizeIdentifier` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:1364` |
| 0.0% | 2.6ms | 0.0% | 0us | `getChunkedCookie` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/session-store.mjs:142` |
| 0.0% | 2.6ms | 0.0% | 0us | `internal:streams/legacy` | `internal:streams/legacy:2` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `[Symbol.toPrimitive]` | `[native code]` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `addMs` | `/tmp/spike-switch-server/sqlcounter.ts:60` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `columnNames` | `bun:sqlite:198` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `newResolvedPromise` | `[native code]` |
| 0.0% | 2.5ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:649` |
| 0.0% | 2.5ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:648` |
| 0.0% | 2.5ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:647` |
| 0.0% | 2.5ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/mailparser/dist/esm/mail-parser.js:41` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-field-name.mjs` |
| 0.0% | 2.5ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:556` |
| 0.0% | 2.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-model-name.mjs:14` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-model-name.mjs:20` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `includes` | `[native code]` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `shouldIgnoreTopicSuggestionSignal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:122` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/index.mjs` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `Number` | `[native code]` |
| 0.0% | 2.5ms | 0.0% | 0us | `clampThreadListPageSize` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:21` |
| 0.0% | 2.5ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:60` |
| 0.0% | 2.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/headers.js:1` |
| 0.0% | 2.5ms | 0.0% | 0us | `sortGroupsForGroupBy` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/messageGrouping.ts:105` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `withSpan` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/tracer.mjs:34` |
| 0.0% | 2.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/source-map-js/source-map.js:6` |
| 0.0% | 2.5ms | 0.0% | 1.2ms | `openSync` | `[native code]` |
| 0.0% | 2.5ms | 0.0% | 0us | `async update` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:578` |
| 0.0% | 2.5ms | 0.0% | 0us | `ownAddressList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:68` |
| 0.0% | 2.5ms | 0.0% | 1.1ms | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:51` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `fromBER` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js` |
| 0.0% | 2.5ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:228` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `decryptPayload` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts:59` |
| 0.0% | 2.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/attributes/counter_signature.js:6` |
| 0.0% | 2.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/pino.js:6` |
| 0.0% | 2.4ms | 0.0% | 1.1ms | `(anonymous)` | `/tmp/spike-switch-server/anatomy.ts:71` |
| 0.0% | 2.4ms | 0.0% | 0us | `_string` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/api.js:12` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `isFreeMailDomain` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/senderIdentity.ts:272` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/well-known/index.js` |
| 0.0% | 2.4ms | 0.0% | 0us | `normalizeService` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/well-known/index.js:19` |
| 0.0% | 2.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/well-known/index.js:5` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:147` |
| 0.0% | 2.4ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:886` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js` |
| 0.0% | 2.4ms | 0.0% | 0us | `upsertTopicLearningSignalsForThreadIds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:128` |
| 0.0% | 2.4ms | 0.0% | 0us | `normalizeThreadIds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:3` |
| 0.0% | 2.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:220` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2626` |
| 0.0% | 2.4ms | 0.0% | 0us | `async getMigrations` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:345` |
| 0.0% | 2.4ms | 0.0% | 0us | `async getOrCreateEndpointContextStorage` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/endpoint-context.mjs:12` |
| 0.0% | 2.4ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:208` |
| 0.0% | 2.4ms | 0.0% | 1.1ms | `transformJoinClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:282` |
| 0.0% | 2.4ms | 0.0% | 0us | `get WriteStream` | `node:fs:644` |
| 0.0% | 2.4ms | 0.0% | 0us | `bound visitValue` | `[native code]` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `visitValue` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:318` |
| 0.0% | 2.4ms | 0.0% | 0us | `visitBinaryOperation` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:1153` |
| 0.0% | 2.4ms | 0.0% | 0us | `topicSuggestionSignalsFromEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:84` |
| 0.0% | 2.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/index.js:5` |
| 0.0% | 2.4ms | 0.0% | 0us | `setAuthTag` | `node:crypto:352` |
| 0.0% | 2.4ms | 0.0% | 0us | `decryptPayload` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts:61` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `setAuthTag` | `[native code]` |
| 0.0% | 2.4ms | 0.0% | 0us | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:40` |
| 0.0% | 2.4ms | 0.0% | 0us | `migrate` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountKeys.ts:184` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountKeys.ts` |
| 0.0% | 2.4ms | 0.0% | 0us | `ftsNeedsRebuild` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountKeys.ts:163` |
| 0.0% | 2.4ms | 0.0% | 0us | `assertCompleteShardFormat` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts:76` |
| 0.0% | 2.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/charset.js:15` |
| 0.0% | 2.4ms | 0.0% | 0us | `createHasher` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/utils.js:632` |
| 0.0% | 2.4ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:72` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `/[\x00-\x1f\x7f]/` | `[native code]` |
| 0.0% | 2.4ms | 0.0% | 0us | `add` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:373` |
| 0.0% | 2.3ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:820` |
| 0.0% | 2.3ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:166` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `__exportStar` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:203` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `#getNoArgs` | `bun:sqlite` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `buildSqlEndsWithAny` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:935` |
| 0.0% | 2.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:192` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `executeQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs` |
| 0.0% | 2.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js:14` |
| 0.0% | 2.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/after/index.js:6` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `sanitizeIdentifier` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js` |
| 0.0% | 2.3ms | 0.0% | 0us | `node:_http_client` | `node:_http_client:10` |
| 0.0% | 2.3ms | 0.0% | 0us | `async recomputeThreadsForAccountInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:284` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `getKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts` |
| 0.0% | 2.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:4` |
| 0.0% | 2.3ms | 0.0% | 0us | `parseSearchInput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:684` |
| 0.0% | 2.3ms | 0.0% | 1.2ms | `normalizeSearchFields` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:488` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:678` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:34` |
| 0.0% | 2.3ms | 0.0% | 1.1ms | `hydrateIdentityMetadata` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/identityMetadata.ts:8` |
| 0.0% | 2.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:403` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `#get` | `bun:sqlite` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts` |
| 0.0% | 2.3ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2708` |
| 0.0% | 2.3ms | 0.0% | 0us | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1288` |
| 0.0% | 2.3ms | 0.0% | 0us | `async time` | `/tmp/spike-switch-server/anatomy.ts:30` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `reset` | `/tmp/spike-switch-server/sqlcounter.ts:39` |
| 0.0% | 2.3ms | 0.0% | 0us | `transformJoinClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:291` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `arrayIteratorNextHelper` | `[native code]` |
| 0.0% | 2.3ms | 0.0% | 1.0ms | `deriveSystemFlagState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:320` |
| 0.0% | 2.3ms | 0.0% | 0us | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1302` |
| 0.0% | 2.3ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:664` |
| 0.0% | 2.3ms | 0.0% | 0us | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:84` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `fireTriggers` | `/tmp/spike-switch-server/sqlcounter.ts` |
| 0.0% | 2.3ms | 0.0% | 1.1ms | `async getThreadGroupCounts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1381` |
| 0.0% | 2.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js:8` |
| 0.0% | 2.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/user-agent.js:27` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `topicSuggestionSignalsFromEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:75` |
| 0.0% | 2.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/certificate.js:7` |
| 0.0% | 2.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/index.js:7` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `async transformOutput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:145` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `async withAuthResponse` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts` |
| 0.0% | 2.3ms | 0.0% | 0us | `(module)` | `/tmp/spike-switch-server/anatomy.ts:63` |
| 0.0% | 2.3ms | 0.0% | 0us | `isFreeMailDomain` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/senderIdentity.ts:271` |
| 0.0% | 2.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/ua-parser-js/ua-parser.js:1` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `normalizeEmailAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/senderIdentity.ts:61` |
| 0.0% | 2.3ms | 0.0% | 0us | `get` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:820` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `ensureCalendarReminderRuntimeSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `_defu` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/defu/dist/defu.mjs:19` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `catch` | `[native code]` |
| 0.0% | 2.2ms | 0.0% | 0us | `loadManualCategoryStatesForMessageIds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:317` |
| 0.0% | 2.2ms | 0.0% | 0us | `parseUserOutput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/schema.mjs:25` |
| 0.0% | 2.2ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:889` |
| 0.0% | 2.2ms | 0.0% | 0us | `ZodObject` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` |
| 0.0% | 2.2ms | 0.0% | 0us | `async getTables` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:81` |
| 0.0% | 2.2ms | 0.0% | 0us | `async getMigrations` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:361` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:22` |
| 0.0% | 2.2ms | 0.0% | 0us | `async requireActiveUserSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:67` |
| 0.0% | 2.2ms | 0.0% | 0us | `applySearchQueryFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:716` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:157` |
| 0.0% | 2.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/dynamic-rendering-utils.js:101` |
| 0.0% | 2.2ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:491` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:629` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `parseAddressEmails` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts` |
| 0.0% | 2.2ms | 0.0% | 0us | `parseSearchInput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:669` |
| 0.0% | 2.2ms | 0.0% | 0us | `rebuildThreadSignalsForThreadIdsInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:76` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:23` |
| 0.0% | 2.2ms | 0.0% | 0us | `normalizeThreadIds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:23` |
| 0.0% | 2.2ms | 0.0% | 0us | `async ensureCalendarEventRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:661` |
| 0.0% | 2.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/next-url.js:12` |
| 0.0% | 2.2ms | 0.0% | 0us | `async ensureThreadSignalRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:157` |
| 0.0% | 2.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:513` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/parse5/dist/parser/index.js` |
| 0.0% | 2.2ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/parse5/dist/parser/index.js:41` |
| 0.0% | 2.2ms | 0.0% | 0us | `toBER` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:960` |
| 0.0% | 2.2ms | 0.0% | 0us | `async recomputeThreadsForAccountInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:283` |
| 0.0% | 2.2ms | 0.0% | 1.2ms | `async getAccountOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/senderIdentities.ts:20` |
| 0.0% | 2.2ms | 0.0% | 981us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2227` |
| 0.0% | 2.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accounts.ts:110` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:28` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:165` |
| 0.0% | 2.2ms | 0.0% | 1.2ms | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:835` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `get source` | `[native code]` |
| 0.0% | 2.2ms | 0.0% | 992us | `applyInviteUidQueryFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:786` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `install` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/storage.ts` |
| 0.0% | 2.2ms | 0.0% | 0us | `parseSelectAll` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/select-parser.js:39` |
| 0.0% | 2.2ms | 0.0% | 0us | `parseSelectAllArg` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/select-parser.js:44` |
| 0.0% | 2.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_arx.js:237` |
| 0.0% | 2.2ms | 0.0% | 0us | `(module)` | `/tmp/spike-switch-server/anatomy.ts:75` |
| 0.0% | 2.2ms | 0.0% | 0us | `ZodBoolean` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` |
| 0.0% | 2.2ms | 0.0% | 0us | `_boolean` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/api.js:383` |
| 0.0% | 2.2ms | 0.0% | 0us | `encrypt` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:350` |
| 0.0% | 2.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/tools.js:29` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:665` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `freeze` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/object-utils.js:63` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js` |
| 0.0% | 2.2ms | 0.0% | 0us | `(module)` | `/tmp/spike-switch-server/anatomy.ts:73` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `async executeQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:585` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `async acquireConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs` |
| 0.0% | 2.2ms | 0.0% | 0us | `internal:streams/readable` | `internal:streams/readable:2` |
| 0.0% | 2.2ms | 0.0% | 0us | `async createAuthenticatedTestSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testAuthHarness.ts:213` |
| 0.0% | 2.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-model-name.mjs:24` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:346` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:875` |
| 0.0% | 2.1ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2249` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `defineProperty` | `[native code]` |
| 0.0% | 2.1ms | 0.0% | 1.2ms | `rememberTopicLearningForThread` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:47` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testAuthHarness.ts:79` |
| 0.0% | 2.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/generated/decode-data-html.js:4` |
| 0.0% | 2.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sanitize-html/index.js:6` |
| 0.0% | 2.1ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:594` |
| 0.0% | 2.1ms | 0.0% | 0us | `async verifyTOTP` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/utils/dist/otp.mjs:43` |
| 0.0% | 2.1ms | 0.0% | 0us | `async generateHOTP` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/utils/dist/otp.mjs:24` |
| 0.0% | 2.1ms | 0.0% | 0us | `async generateHOTP` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/utils/dist/otp.mjs:22` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `async sign` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/utils/dist/hmac.mjs` |
| 0.0% | 2.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/totp/index.mjs:194` |
| 0.0% | 2.1ms | 0.0% | 0us | `async verifyTOTP` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/utils/dist/otp.mjs:39` |
| 0.0% | 2.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/index.js:6` |
| 0.0% | 2.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/attr_cert_issuer.js:7` |
| 0.0% | 2.1ms | 0.0% | 0us | `create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/schemable-identifier-node.js:14` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `value` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:76` |
| 0.0% | 2.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:251` |
| 0.0% | 2.1ms | 0.0% | 1.0ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2293` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:185` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:699` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:370` |
| 0.0% | 2.1ms | 0.0% | 0us | `parseValueBinaryOperation` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/binary-operation-parser.js:22` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `isIsOperator` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/binary-operation-parser.js` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:393` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `tryDecode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/utils.mjs:60` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:157` |
| 0.0% | 2.1ms | 0.0% | 0us | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:38` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `_collapseAtSpacing` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:272` |
| 0.0% | 2.1ms | 0.0% | 1.1ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2304` |
| 0.0% | 2.0ms | 0.0% | 947us | `sort` | `[native code]` |
| 0.0% | 2.0ms | 0.0% | 0us | `migrate` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountKeys.ts:227` |
| 0.0% | 2.0ms | 0.0% | 1.1ms | `push` | `node:async_hooks:55` |
| 0.0% | 2.0ms | 0.0% | 0us | `run` | `node:async_hooks:141` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:103` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `async #transformResult` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:167` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs` |
| 0.0% | 2.0ms | 0.0% | 946us | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1360` |
| 0.0% | 2.0ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2480` |
| 0.0% | 2.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:205` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/schemable-identifier-node.js` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `Statement` | `bun:sqlite` |
| 0.0% | 2.0ms | 0.0% | 0us | `ZodNullable` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` |
| 0.0% | 2.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/index.js:9` |
| 0.0% | 2.0ms | 0.0% | 0us | `nullish` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:67` |
| 0.0% | 2.0ms | 0.0% | 0us | `nullable` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:1266` |
| 0.0% | 2.0ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/organization/routes/crud-org.mjs:16` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:1260` |
| 0.0% | 2.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/algorithms.js:25` |
| 0.0% | 2.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:41` |
| 0.0% | 2.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/mailparser/dist/esm/tlds.cjs:8` |
| 0.0% | 2.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/tools.js:8` |
| 0.0% | 2.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/request.js:24` |
| 0.0% | 2.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/utils.js:35` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_arx.js:49` |
| 0.0% | 2.0ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_arx.js:49` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `_collectAddressParts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:366` |
| 0.0% | 2.0ms | 0.0% | 0us | `async waitOrAbort` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/abort.js:60` |
| 0.0% | 2.0ms | 0.0% | 0us | `async acquireConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:54` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `async waitOrAbort` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/abort.js:42` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:636` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:674` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `flatIntoArray` | `[native code]` |
| 0.0% | 1.9ms | 0.0% | 943us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:1236` |
| 0.0% | 1.9ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:883` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `slimThreadListItem` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:36` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `filterOutputFields` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs:7` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `async executeQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:35` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs` |
| 0.0% | 1.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ip-address.js:27` |
| 0.0% | 1.9ms | 0.0% | 0us | `async getTopicsForThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:191` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts` |
| 0.0% | 1.8ms | 0.0% | 0us | `async createAuthContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/create-context.mjs:97` |
| 0.0% | 1.8ms | 0.0% | 0us | `getAuthTables` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/get-tables.mjs:297` |
| 0.0% | 1.8ms | 0.0% | 1.8ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2267` |
| 0.0% | 1.7ms | 0.0% | 1.7ms | `date` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js` |
| 0.0% | 1.7ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema/shared.mjs:5` |
| 0.0% | 1.7ms | 0.0% | 1.7ms | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/dom-serializer/node_modules/entities/lib/esm/generated/encode-html.js:9` |
| 0.0% | 1.7ms | 0.0% | 1.7ms | `sanitizeIdentifier` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:1368` |
| 0.0% | 1.6ms | 0.0% | 0us | `async createAuthContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/create-context.mjs:57` |
| 0.0% | 1.6ms | 0.0% | 1.6ms | `getInternalPlugins` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/helpers.mjs` |
| 0.0% | 1.6ms | 0.0% | 1.6ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:103` |
| 0.0% | 1.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:473` |
| 0.0% | 1.6ms | 0.0% | 0us | `async findSchemaProblems` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:252` |
| 0.0% | 1.6ms | 0.0% | 0us | `async findSchemaProblems` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:262` |
| 0.0% | 1.6ms | 0.0% | 1.6ms | `toPhysicalSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:198` |
| 0.0% | 1.5ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:115` |
| 0.0% | 1.5ms | 0.0% | 0us | `tlds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:613` |
| 0.0% | 1.5ms | 0.0% | 1.5ms | `(anonymous)` | `/tmp/spike-switch-server/anatomy.ts:76` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/column-node.js` |
| 0.0% | 1.4ms | 0.0% | 0us | `createSeededLinearModel` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/mail/categorization/linearModel.ts:141` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/mail/categorization/linearModel.ts:53` |
| 0.0% | 1.4ms | 0.0% | 0us | `async getCategoryLinearModel` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/categories.ts:89` |
| 0.0% | 1.4ms | 0.0% | 0us | `setWeights` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/mail/categorization/linearModel.ts:52` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `parseBinaryOperator` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/binary-operation-parser.js:56` |
| 0.0% | 1.4ms | 0.0% | 0us | `loadManualCategoryStatesForMessageIds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:303` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `async dispatchAuthEndpoint` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:192` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/cookie-utils.mjs:158` |
| 0.0% | 1.3ms | 0.0% | 0us | `where` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:36` |
| 0.0% | 1.3ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/endpoint-context.mjs:8` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `getExistingEndpointContextStorage` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/endpoint-context.mjs:5` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `ensureMessageCalendarEventRuntimeSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts` |
| 0.0% | 1.3ms | 0.0% | 0us | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:390` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authPolicyHandler.ts:284` |
| 0.0% | 1.3ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authPolicyHandler.ts:285` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async dispatchAuthEndpoint` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:191` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `ensureMessageCalendarEventOptionalColumns` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts` |
| 0.0% | 1.3ms | 0.0% | 0us | `initAccountSchemaBody` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:1397` |
| 0.0% | 1.3ms | 0.0% | 0us | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:38` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `toISOString` | `[native code]` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:11` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/sign-in.mjs` |
| 0.0% | 1.3ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:80` |
| 0.0% | 1.3ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/sign-in.mjs:368` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/tools.js:9` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:49` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async enrichMessagesWithThreadCollab` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadCollab.ts` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/levels.js` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/levels.js:42` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/pino.js:224` |
| 0.0% | 1.3ms | 0.0% | 0us | `async get` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:33` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async getCurrentRequestState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:21` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:844` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async getMigrations` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs` |
| 0.0% | 1.3ms | 0.0% | 0us | `async runBeforeHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:87` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `getKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts:25` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async requireActiveUserSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:73` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `startsWith` | `[native code]` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/types/index.js:3` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/index.js:7` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `getAuth` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:262` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `TokenList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:25` |
| 0.0% | 1.3ms | 0.0% | 0us | `getThreadCollabStates` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts:78` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `parseStringReferenceWithTable` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js:88` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `visitReference` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:289` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `parseSearchInput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:682` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv6.js:1460` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `applyAddressSearchFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:565` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:26` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:151` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:38` |
| 0.0% | 1.3ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authPolicyHandler.ts:289` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `getHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:166` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/index.js:12` |
| 0.0% | 1.3ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:714` |
| 0.0% | 1.3ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/index.mjs:176` |
| 0.0% | 1.3ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/update-user.mjs:200` |
| 0.0% | 1.3ms | 0.0% | 0us | `node:https` | `node:https:378` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `_addListener` | `node:events:201` |
| 0.0% | 1.3ms | 0.0% | 0us | `addListener` | `node:events:214` |
| 0.0% | 1.3ms | 0.0% | 0us | `Agent` | `node:https:194` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/api/index.mjs` |
| 0.0% | 1.3ms | 0.0% | 0us | `Agent` | `node:_http_agent:32` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `getStore` | `node:async_hooks` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `assign` | `[native code]` |
| 0.0% | 1.3ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:75` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/index.js:9` |
| 0.0% | 1.3ms | 0.0% | 0us | `Kysely` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/kysely.js:68` |
| 0.0% | 1.3ms | 0.0% | 0us | `DefaultQueryCompiler` | `[native code]` |
| 0.0% | 1.3ms | 0.0% | 0us | `OperationNodeVisitor` | `[native code]` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/operation-node-visitor.js:70` |
| 0.0% | 1.3ms | 0.0% | 0us | `BunSqliteQueryCompiler` | `[native code]` |
| 0.0% | 1.3ms | 0.0% | 0us | `createQueryCompiler` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:113` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1296` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:245` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `node:crypto` | `node:crypto:278` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv6.js:32` |
| 0.0% | 1.3ms | 0.0% | 0us | `compile` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:158` |
| 0.0% | 1.3ms | 0.0% | 0us | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:389` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `ensureTopicRuntimeSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/bags/index.js:4` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/encoding/index.js:4` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `buildSqlContainsAny` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:928` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `transformJoinClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:327` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/rsaes_oaep.js:7` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:442` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/authority_information_access.js:7` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/ip_converter.js:3` |
| 0.0% | 1.3ms | 0.0% | 0us | `ZodUnknown` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:100` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/general_name.js:6` |
| 0.0% | 1.3ms | 0.0% | 0us | `_unknown` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/api.js:460` |
| 0.0% | 1.3ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/state.mjs:34` |
| 0.0% | 1.3ms | 0.0% | 0us | `getColorDepth` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs:58` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:79` |
| 0.0% | 1.2ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2256` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `push` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 0us | `visitAlias` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:284` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `BaseBlock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:917` |
| 0.0% | 1.2ms | 0.0% | 0us | `OctetString` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1769` |
| 0.0% | 1.2ms | 0.0% | 0us | `toASN` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/converters.js:59` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/algorithms.js:29` |
| 0.0% | 1.2ms | 0.0% | 0us | `async getAccountIdFromParams` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/accountContext.ts:39` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/source-map-js/lib/source-map-generator.js:10` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `buildSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-schema.mjs` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `parseAliasedExpression` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/expression-parser.js:16` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-android/build/cjs/nonstandard.js:4` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-android/build/cjs/index.js:5` |
| 0.0% | 1.2ms | 0.0% | 0us | `(module)` | `/tmp/spike-switch-server/anatomy.ts:74` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/index.js:15` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/node.js:6` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/index.js:8` |
| 0.0% | 1.2ms | 0.0% | 0us | `noctuaAuthOptions` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:78` |
| 0.0% | 1.2ms | 0.0% | 0us | `compile` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:143` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:152` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `onCompile` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `otp2fa` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/otp/index.mjs` |
| 0.0% | 1.2ms | 0.0% | 0us | `twoFactor` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/index.mjs:37` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `mapAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts:151` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:56` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:696` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `visitReference` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js` |
| 0.0% | 1.2ms | 0.0% | 0us | `async getSessionFromCtx` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:275` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:248` |
| 0.0% | 1.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:299` |
| 0.0% | 1.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:293` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/next-url.js:14` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/shared/lib/router/utils/get-next-pathname-info.js:12` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:776` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/issuer_and_serial_number.js:15` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `decorate` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/signer_identifier.js:7` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/signer_info.js:7` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async verifySignature` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/dependency-container.js:8` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/registry.js:3` |
| 0.0% | 1.2ms | 0.0% | 0us | `persistAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts:312` |
| 0.0% | 1.2ms | 0.0% | 0us | `toOperationNode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:385` |
| 0.0% | 1.2ms | 0.0% | 0us | `seedSenderIdentityRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/senderIdentities.ts:31` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:12` |
| 0.0% | 1.2ms | 0.0% | 0us | `_coercedString` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/api.js:16` |
| 0.0% | 1.2ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema/session.mjs:5` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:253` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/he/he.js:55` |
| 0.0% | 1.2ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/jose/dist/webapi/util/errors.js:1` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/jose/dist/webapi/util/errors.js` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `Hash` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 0us | `createBoundedWorkerJobRegistry` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/boundedWorkerJobRegistry.ts:31` |
| 0.0% | 1.2ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/threadRecomputeJobs.ts:15` |
| 0.0% | 1.2ms | 0.0% | 0us | `Hash` | `node:crypto:168` |
| 0.0% | 1.2ms | 0.0% | 0us | `createHash` | `node:crypto:191` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:9` |
| 0.0% | 1.2ms | 0.0% | 0us | `getTopicSuggestionsForThreadSignalBatch` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:595` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:70` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/charset.js:17` |
| 0.0% | 1.2ms | 0.0% | 0us | `async getMessageCalendarInviteDataByMessageId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:219` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/senderIdentities.ts:13` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/index.js:13` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `parseTableExpression` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/table-parser.js:20` |
| 0.0% | 1.2ms | 0.0% | 0us | `shardWriterGuardsInstalled` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts:69` |
| 0.0% | 1.2ms | 0.0% | 0us | `scopedTables` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts:31` |
| 0.0% | 1.2ms | 0.0% | 0us | `initAccountSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:978` |
| 0.0% | 1.2ms | 0.0% | 0us | `guards` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts:47` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `assertCredentialMode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts:8` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:160` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:94` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/messageGrouping.ts` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `getColorDepth` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs:60` |
| 0.0% | 1.2ms | 0.0% | 0us | `fromBER` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:927` |
| 0.0% | 1.2ms | 0.0% | 0us | `fromBER` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1541` |
| 0.0% | 1.2ms | 0.0% | 0us | `fromBER` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1484` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `fromBER` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:2348` |
| 0.0% | 1.2ms | 0.0% | 0us | `localFromBERWithChildContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1218` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async withAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts` |
| 0.0% | 1.2ms | 0.0% | 0us | `async acquireAuthLifetimeLock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authLifetimeLock.ts:38` |
| 0.0% | 1.2ms | 0.0% | 0us | `internal:streams/compose` | `internal:streams/compose:2` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `node:_http_outgoing` | `node:_http_outgoing:706` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `returningAll` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/update-query-builder.js` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/tracer.mjs:38` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:705` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/tbs_certificate.js:9` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/validity.js:6` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/query-id.js` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/raw-builder/sql.js:13` |
| 0.0% | 1.2ms | 0.0% | 0us | `getType` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:515` |
| 0.0% | 1.2ms | 0.0% | 0us | `async getMigrations` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:645` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:39` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/recipient_info.js:9` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/work-async-storage.external.js:11` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/after/after.js:11` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/work-async-storage-instance.js:11` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `bump` | `/tmp/spike-switch-server/sqlcounter.ts` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/shared/lib/router/utils/format-next-pathname-info.js:12` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `normalizeCalendarEventUidKeys` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/calendarEventUids.ts:29` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `groupsFromRows` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:990` |
| 0.0% | 1.2ms | 0.0% | 0us | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1344` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js` |
| 0.0% | 1.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:819` |
| 0.0% | 1.2ms | 0.0% | 0us | `async rebuildThreadSignalsForThreadIds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:113` |
| 0.0% | 1.2ms | 0.0% | 0us | `NextResponse` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:40` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sanitize-html/index.js:4` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `Response` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:232` |
| 0.0% | 1.2ms | 0.0% | 0us | `getFieldName` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-name.mjs:22` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `value` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:72` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `Statement` | `bun:sqlite:108` |
| 0.0% | 1.2ms | 0.0% | 0us | `async recomputeThreadsForAccountInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:321` |
| 0.0% | 1.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs:48` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `isRequestLike` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/utils/url.mjs:129` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `Statement` | `bun:sqlite:109` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/cookie-utils.mjs:164` |
| 0.0% | 1.2ms | 0.0% | 0us | `async getTopicSuggestionsForThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:699` |
| 0.0% | 1.2ms | 0.0% | 0us | `_interopNamespaceDefault` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:42` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:56` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:160` |
| 0.0% | 1.2ms | 0.0% | 0us | `selectFrom` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-creator.js:133` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `createQueryId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/query-id.js` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:47` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:28` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `getFields` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/schema.mjs:10` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:339` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:859` |
| 0.0% | 1.2ms | 0.0% | 0us | `internal:errors` | `internal:errors:2` |
| 0.0% | 1.2ms | 0.0% | 0us | `internal:streams/destroy` | `internal:streams/destroy:2` |
| 0.0% | 1.2ms | 0.0% | 0us | `bound call` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 0us | `makeSafe` | `internal:primordials:53` |
| 0.0% | 1.2ms | 0.0% | 0us | `copyProps` | `internal:primordials:26` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `hasOwnProperty` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/encode.js:98` |
| 0.0% | 1.2ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/encode.js:103` |
| 0.0% | 1.2ms | 0.0% | 0us | `internal:primordials` | `internal:primordials:83` |
| 0.0% | 1.2ms | 0.0% | 0us | `async acquireAuthLifetimeLock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authLifetimeLock.ts:57` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/next-url.js:11` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts:23` |
| 0.0% | 1.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:11` |
| 0.0% | 1.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:152` |
| 0.0% | 1.2ms | 0.0% | 0us | `async findMany` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:570` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/error.mjs` |
| 0.0% | 1.2ms | 0.0% | 0us | `async findMany` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:530` |
| 0.0% | 1.2ms | 0.0% | 0us | `ValidationError` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/error.mjs:128` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs` |
| 0.0% | 1.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:377` |
| 0.0% | 1.2ms | 0.0% | 0us | `InternalAPIError` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/error.mjs:103` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `decodeTrieDict` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/internal/decode-shared.js:175` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:36` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/lib/index.js:3` |
| 0.0% | 1.2ms | 0.0% | 0us | `async getCurrentAdapter` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/transaction.mjs:23` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async ensureAsyncStorage` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/transaction.mjs:12` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async stageMessageFiles` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/storage.ts:235` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:557` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/socks/build/client/socksclient.js:16` |
| 0.0% | 1.2ms | 0.0% | 0us | `noctuaAuthOptions` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:163` |
| 0.0% | 1.2ms | 0.0% | 0us | `passkey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/passkey/dist/index.mjs:792` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `isFunction` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/object-utils.js` |
| 0.0% | 1.2ms | 0.0% | 0us | `parseSelectArg` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/select-parser.js:10` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/segment-config/ensure-static.js:27` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `verifyPasskeyRegistration` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/passkey/dist/index.mjs` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/tmp/spike-switch-server/fixture.ts:60` |
| 0.0% | 1.2ms | 0.0% | 0us | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:60` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/bytes/index.js:17` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/proxy_info.js:7` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/index.js:18` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/index.js:5` |
| 0.0% | 1.2ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha3.js:327` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha3.js:315` |
| 0.0% | 1.2ms | 0.0% | 0us | `Keccak` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha3.js:173` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `anumber` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/utils.js` |
| 0.0% | 1.2ms | 0.0% | 0us | `applyExcludedFolderFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:908` |
| 0.0% | 1.2ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2306` |
| 0.0% | 1.2ms | 0.0% | 0us | `async dispatchAuthEndpoint` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:203` |
| 0.0% | 1.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/index.mjs:329` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:16` |
| 0.0% | 1.2ms | 0.0% | 0us | `bound omit` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/oauth-proxy/index.mjs:28` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1005` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1088` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/node_modules/jose/dist/webapi/lib/jws_algorithms.js:55` |
| 0.0% | 1.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:364` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:851` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `getStore` | `node:async_hooks:163` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/transaction.mjs:24` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:586` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:37` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `enrollmentState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:381` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/fromJSON.js:8` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `node:tls` | `node:tls:549` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1295` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async runBeforeHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:70` |
| 0.0% | 1.2ms | 0.0% | 0us | `normalizeSearchTermList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:525` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/decorators.js:35` |
| 0.0% | 1.2ms | 0.0% | 0us | `DecorateProperty` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:561` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/attribute.js:14` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `findParentSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/schema.js:159` |
| 0.0% | 1.2ms | 0.0% | 0us | `decorate` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:136` |
| 0.0% | 1.2ms | 0.0% | 0us | `createDefault` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/schema.js:34` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/signer_info.js:9` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `Internals` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js` |
| 0.0% | 1.2ms | 0.0% | 0us | `init` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:52` |
| 0.0% | 1.2ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/device-authorization/index.mjs:26` |
| 0.0% | 1.2ms | 0.0% | 0us | `release` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authLifetimeLock.ts:61` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `find` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `delete` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:287` |
| 0.0% | 1.2ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/mailparser/dist/esm/mail-parser.js:42` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts` |
| 0.0% | 1.2ms | 0.0% | 0us | `validateProvisioningIndex` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:168` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:267` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/source-map-js/source-map.js:7` |
| 0.0% | 1.2ms | 0.0% | 0us | `internal:stream` | `internal:stream:48` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/source-map-js/lib/source-map-consumer.js:9` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `internal:streams/duplexpair` | `internal:streams/duplexpair:11` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `applyAddressSearchFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts` |
| 0.0% | 1.2ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2258` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/api/index.mjs:49` |
| 0.0% | 1.2ms | 0.0% | 0us | `create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/select-all-node.js:11` |
| 0.0% | 1.2ms | 0.0% | 0us | `internal:fs/streams` | `internal:fs/streams:2` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `__exportStar` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/node_modules/tslib/tslib.js:153` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/imapflow/node_modules/iconv-lite/lib/index.js:5` |
| 0.0% | 1.2ms | 0.0% | 0us | `createSelectAll` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/selection-node.js:21` |
| 0.0% | 1.2ms | 0.0% | 0us | `parseSelectAll` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/select-parser.js:33` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/utf8-to-jisx0212-table.js:10` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `__exportAll` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/_virtual/_rolldown/runtime.mjs` |
| 0.0% | 1.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/index.mjs:11` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `throwForMissingRequestStore` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/work-unit-async-storage.external.js` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/request.js:25` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `wrappedCipher` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/utils.js` |
| 0.0% | 1.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:79` |
| 0.0% | 1.1ms | 0.0% | 0us | `deriveSystemFlagState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:324` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async sqliteGeneratedPrimaryKeyColumn` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:29` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:409` |
| 0.0% | 1.1ms | 0.0% | 0us | `async sqliteGeneratedPrimaryKeyColumn` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:30` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `makeBitMapDescriptor` | `internal:streams/writable` |
| 0.0% | 1.1ms | 0.0% | 0us | `query` | `bun:sqlite:386` |
| 0.0% | 1.1ms | 0.0% | 0us | `internal:streams/writable` | `internal:streams/writable:33` |
| 0.0% | 1.1ms | 0.0% | 0us | `[prepareOwned]` | `bun:sqlite:369` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:17` |
| 0.0% | 1.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/htmlparser2/node_modules/entities/dist/esm/generated/decode-data-html.js:3` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:182` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `decodeBase64` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/htmlparser2/node_modules/entities/dist/esm/internal/decode-shared.js:24` |
| 0.0% | 1.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/mailparser/dist/esm/mail-parser.js:53` |
| 0.0% | 1.1ms | 0.0% | 0us | `needsRebuild` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountKeys.ts:148` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:7` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:543` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:444` |
| 0.0% | 1.1ms | 0.0% | 0us | `ensureAccountKeySchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountKeys.ts:165` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:22` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `#all` | `bun:sqlite` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `internal:stream` | `internal:stream:18` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha2.js:378` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `SHA2_32B` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha2.js` |
| 0.0% | 1.1ms | 0.0% | 0us | `async getTables` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:69` |
| 0.0% | 1.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:13` |
| 0.0% | 1.1ms | 0.0% | 0us | `_SHA256` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha2.js:124` |
| 0.0% | 1.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha2.js:378` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:156` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `NextResponse` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:41` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:25` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `initGetFieldAttributes` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-attributes.mjs` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:713` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `getTime` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/dom-serializer/node_modules/entities/lib/esm/generated/decode-data-html.js:5` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:95` |
| 0.0% | 1.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/adapter-kysely.mjs:13` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `array` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/identityMetadata.ts` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async getThreadGroupCounts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1371` |
| 0.0% | 1.1ms | 0.0% | 0us | `enableStreamingAPI` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/lib/index.js:145` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/lib/index.js:170` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async getMessageCalendarInviteDataByMessageId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:201` |
| 0.0% | 1.1ms | 0.0% | 0us | `async requireActiveUserSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:68` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs` |
| 0.0% | 1.1ms | 0.0% | 0us | `async updateWithHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/with-hooks.mjs:63` |
| 0.0% | 1.1ms | 0.0% | 0us | `displayDayNumberUncached` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/i18n/format.ts:55` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `formatToParts` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/redaction.js:4` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async update` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async acquireConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:43` |
| 0.0% | 1.1ms | 0.0% | 0us | `mapUserRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts:61` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2661` |
| 0.0% | 1.1ms | 0.0% | 0us | `(module)` | `/tmp/spike-switch-server/anatomy.ts:71` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `Error` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async assertAccountFolder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/folderAccountGuard.ts` |
| 0.0% | 1.1ms | 0.0% | 0us | `async getMigrations` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:655` |
| 0.0% | 1.1ms | 0.0% | 0us | `getDatabaseIndexName` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/database-index.mjs:39` |
| 0.0% | 1.1ms | 0.0% | 0us | `runCipher` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_arx.js:113` |
| 0.0% | 1.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:64` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `chachaCore` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:78` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/cookies.js:18` |
| 0.0% | 1.1ms | 0.0% | 0us | `async readAuthJson` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/readAuthJson.ts:27` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `releaseLock` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/index.js:3` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/tools.js:6` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async validateAccountFolders` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/folderAccount.ts:11` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:12` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@zone-eu/mailsplit/index.js:5` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `bump` | `/tmp/spike-switch-server/sqlcounter.ts:47` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `headers` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/headers.js:24` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:85` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `applySearchQueryFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:717` |
| 0.0% | 1.1ms | 0.0% | 0us | `cloneWithSelections` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/select-query-node.js:28` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/ua-parser-js/ua-parser.js` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:555` |
| 0.0% | 1.1ms | 0.0% | 0us | `943` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/ua-parser-js/ua-parser.js:1` |
| 0.0% | 1.1ms | 0.0% | 0us | `__nccwpck_require__` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/ua-parser-js/ua-parser.js:1` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async executeTakeFirst` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/insert-query-builder.js` |
| 0.0% | 1.1ms | 0.0% | 0us | `upsertTopicLearningSignalsForThreadIds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:141` |
| 0.0% | 1.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/email-verification.mjs:44` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1200` |
| 0.0% | 1.1ms | 0.0% | 0us | `get value` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:41` |
| 0.0% | 1.1ms | 0.0% | 0us | `normalizeDef` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:940` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:2105` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async tryCatch` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/utils.mjs` |
| 0.0% | 1.1ms | 0.0% | 0us | `async tryCatch` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/utils.mjs:75` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/index.js:22` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `mergeModules` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/lib/helpers/merge-exports.js:8` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/terminal-highlight.js:5` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1245` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:397` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/css-syntax-error.js:5` |
| 0.0% | 1.1ms | 0.0% | 0us | `buildSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-schema.mjs:10` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `__decorate` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `deriveSystemFlagState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `getDatabaseFieldIndexName` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/database-index.mjs:46` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-android/build/cjs/index.js:4` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-android/build/cjs/key_description.js:25` |
| 0.0% | 1.1ms | 0.0% | 0us | `create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/column-node.js:14` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `Promise` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 0us | `async createAuthenticatedTestSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testAuthHarness.ts:208` |
| 0.0% | 1.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testAuthHarness.ts:171` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testAuthHarness.ts` |
| 0.0% | 1.1ms | 0.0% | 0us | `async lock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:79` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/mimetypes.js:6` |
| 0.0% | 1.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testAuthHarness.ts:161` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:249` |
| 0.0% | 1.1ms | 0.0% | 0us | `backfillEmailCalendarEventParticipation` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:560` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts` |
| 0.0% | 1.1ms | 0.0% | 0us | `shardWriterGuardsInstalled` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts:62` |
| 0.0% | 1.1ms | 0.0% | 0us | `ensureAccountKeySchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountKeys.ts:162` |
| 0.0% | 1.1ms | 0.0% | 0us | `async ensureCalendarEventRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:672` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:684` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `isFinalized` | `bun:sqlite:128` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:14` |
| 0.0% | 1.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:336` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `$constructor` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:112` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `getThreadCollabStates` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts:73` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `Proxy` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 0us | `NextResponse` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:43` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `TextEncoder` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 0us | `compile` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:160` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:890` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `parseReferenceExpression` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async ensureCalendarEventRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:663` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/transport.js:10` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/thread-stream/index.js:3` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `decodeSecret` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts` |
| 0.0% | 1.1ms | 0.0% | 0us | `shardWriterGuardsInstalled` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts:60` |
| 0.0% | 1.1ms | 0.0% | 0us | `ensureAccountKeySchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountKeys.ts:164` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1305` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:22` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:571` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/he/he.js:31` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino-std-serializers/index.js:4` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `createWithSpan` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/tracer.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `selectFrom` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js` |
| 0.0% | 1.1ms | 0.0% | 0us | `async runBeforeHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:65` |
| 0.0% | 1.1ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2504` |
| 0.0% | 1.1ms | 0.0% | 0us | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1259` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(unknown)` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:885` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `object` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js` |
| 0.0% | 1.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/jwt/index.mjs:19` |
| 0.0% | 1.1ms | 0.0% | 0us | `async execute` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/raw-builder/raw-builder.js:42` |
| 0.0% | 1.1ms | 0.0% | 0us | `async getMigrations` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:403` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:677` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async rebuildAllThreadSignalsForAccount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts` |
| 0.0% | 1.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/otp/index.mjs:21` |
| 0.0% | 1.1ms | 0.0% | 0us | `async getDatabaseIndexMap` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:135` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `#getExecutor` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/raw-builder/raw-builder.js:49` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/attribute_certificate.js:2` |
| 0.0% | 1.1ms | 0.0% | 0us | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:400` |
| 0.0% | 1.1ms | 0.0% | 0us | `async getDatabaseIndexMap` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:239` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/work-unit-async-storage.external.js:64` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `topicSuggestionEntriesFromThreadSignalRows` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/after/after.js:12` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async runValidation` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/validator.mjs:8` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:59` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/rsassa_pss.js:52` |
| 0.0% | 1.1ms | 0.0% | 0us | `concat` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:75` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async assertAccountFolder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/folderAccountGuard.ts:7` |
| 0.0% | 1.1ms | 0.0% | 0us | `async assertAccountFolder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/folderAccountGuard.ts:9` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/encoding-table.js:2` |
| 0.0% | 1.1ms | 0.0% | 0us | `toBER` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1511` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `Uint8Array` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 0us | `shouldIgnoreTopicSuggestionSignalUncached` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:148` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `applySearchQueryFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:713` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `_recoverAddrSpec` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:31` |
| 0.0% | 1.1ms | 0.0% | 0us | `forwardAuthHeaders` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:30` |
| 0.0% | 1.1ms | 0.0% | 0us | `async requireAccountContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/accountContext.ts:55` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `listUsers` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs` |
| 0.0% | 1.1ms | 0.0% | 0us | `noctuaAuthOptions` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:150` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `resolve` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-model-name.mjs` |
| 0.0% | 1.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:183` |
| 0.0% | 1.1ms | 0.0% | 0us | `admin` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/admin.mjs:73` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:33` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `nullable` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/accountPrefs.ts` |
| 0.0% | 1.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/accountPrefs.ts:21` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs:41` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:582` |
| 0.0% | 1.1ms | 0.0% | 0us | `toRegExp` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/leac/lib/leac.mjs:55` |
| 0.0% | 1.1ms | 0.0% | 0us | `createLexer` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/leac/lib/leac.mjs:77` |
| 0.0% | 1.1ms | 0.0% | 0us | `toUnifiedRule` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/leac/lib/leac.mjs:23` |
| 0.0% | 1.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/parseley/lib/parseley.mjs:15` |
| 0.0% | 1.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/organization/routes/crud-team.mjs:134` |
| 0.0% | 1.1ms | 0.0% | 0us | `optional` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:58` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `ZodOptional` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:103` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async transformSingleOutput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:146` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async getDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async lock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2224` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2320` |
| 0.0% | 1.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/mailboxSummary.ts:48` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `atob` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:53` |
| 0.0% | 1.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:13` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:29` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:1414` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:27` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `tokenize` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 1.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:47` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:589` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `endsWith` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 0us | `decorate` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:143` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `getProvider` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js` |
| 0.0% | 1.1ms | 0.0% | 0us | `DecorateConstructor` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:549` |
| 0.0% | 1.1ms | 0.0% | 0us | `OrdinaryHasOwnMetadata` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:584` |
| 0.0% | 1.1ms | 0.0% | 0us | `getParamInfo` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/reflection-helpers.js:6` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:321` |
| 0.0% | 1.1ms | 0.0% | 0us | `GetMetadataProvider` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:1158` |
| 0.0% | 1.1ms | 0.0% | 0us | `OrdinaryGetMetadata` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:597` |
| 0.0% | 1.1ms | 0.0% | 0us | `OrdinaryGetMetadata` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:592` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/decorators/injectable.js:8` |
| 0.0% | 1.1ms | 0.0% | 0us | `getMetadata` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:370` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/index.js:9` |
| 0.0% | 1.1ms | 0.0% | 0us | `_joinAtSpacing` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:243` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `_isSpaceCode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/encrypted_content_info.js:5` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `_parseAddressList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:676` |
| 0.0% | 1.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema/user.mjs:6` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `shouldIgnoreTopicSuggestionSignal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:126` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `run` | `node:async_hooks` |
| 0.0% | 1.1ms | 0.0% | 0us | `async getTables` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:67` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/value-node.js` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/encoding-convert.js:2` |
| 0.0% | 1.1ms | 0.0% | 0us | `parseSessionOutput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/schema.mjs:53` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/index.js:4` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `normalizeShardSql` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/ftsIdentity.ts` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts:71` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async dispatchAuthEndpoint` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:534` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:185` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `parentNode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/operation-node-visitor.js:6` |
| 0.0% | 1.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:185` |
| 0.0% | 1.1ms | 0.0% | 0us | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:36` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:70` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js:4` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `createFunctionModule` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/function-module.js:20` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-ecc/build/cjs/ec_private_key.js:5` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-ecc/build/cjs/index.js:6` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/libmime.js:43` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@simplewebauthn/server/esm/services/metadataService.js` |
| 0.0% | 1.0ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@simplewebauthn/server/esm/services/metadataService.js:18` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2662` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:204` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:3` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/headers.js:2` |
| 0.0% | 1.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:810` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:810` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:2517` |
| 0.0% | 1.0ms | 0.0% | 0us | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1311` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `__spreadArray` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:648` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sonic-boom/index.js:5` |
| 0.0% | 1.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/outboundWrite.ts:27` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/launder/index.js:1` |
| 0.0% | 1.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:824` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `getTopicSuggestionsForThreadSignalBatch` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:573` |
| 0.0% | 1.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:821` |
| 0.0% | 1.0ms | 0.0% | 0us | `pruneThreadTopicsWithoutMessages` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:174` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/bags/key_bag.js:5` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pkcs8/build/cjs/index.js:4` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pkcs8/build/cjs/encrypted_private_key_info.js:6` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/bags/index.js:6` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/v2_form.js:8` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-attributes.mjs:28` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `rowToTopic` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `transformJoinClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` |
| 0.0% | 1.0ms | 0.0% | 0us | `object` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:906` |
| 0.0% | 1.0ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema/shared.mjs:3` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:852` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:662` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `resolve` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-model-name.mjs:17` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-attributes.mjs:24` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-field-name.mjs:21` |
| 0.0% | 1.0ms | 0.0% | 0us | `loadManualCategoryStatesForMessageIds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:315` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async stageMessageFiles` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/storage.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async time` | `/tmp/spike-switch-server/anatomy.ts:32` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/index.js:14` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2648` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:334` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `runCipher` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_arx.js` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `buildMeaningfulAttachmentPredicateSql` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:638` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async dispatchAuthEndpoint` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:187` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/segment-config/ensure-static.js` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/segment-config/ensure-static.js:34` |
| 0.0% | 1.0ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authPolicyHandler.ts:19` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authPolicyHandler.ts` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:2922` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@zone-eu/mailsplit/index.js:8` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:869` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:1097` |
| 0.0% | 1.0ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/social-providers/index.mjs:78` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `getEnumValues` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js` |
| 0.0% | 1.0ms | 0.0% | 0us | `ZodEnum` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:2009` |
| 0.0% | 1.0ms | 0.0% | 0us | `_enum` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:1139` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/encoding/index.js:10` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async getDatabaseColumnBounds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs` |
| 0.0% | 1.0ms | 0.0% | 0us | `async getMigrations` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:404` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/decorators.js:4` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/index.js:7` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/encoding/base64url.js:8` |
| 0.0% | 1.0ms | 0.0% | 0us | `async getDatabaseColumnBounds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:279` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/converters.js:9` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/types/bit_string.js:5` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:212` |
| 0.0% | 1.0ms | 0.0% | 0us | `__importStar` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:327` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/types/index.js:4` |
| 0.0% | 1.0ms | 0.0% | 0us | `async createAuthContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/create-context.mjs:229` |
| 0.0% | 1.0ms | 0.0% | 0us | `async reconcileLifecycle` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/userLifecycle.ts:247` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async reconcileLifecycle` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/userLifecycle.ts` |
| 0.0% | 1.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:282` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `isPromise` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/utils/is-promise.mjs` |
| 0.0% | 1.0ms | 0.0% | 0us | `async runPluginInit` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/helpers.mjs:53` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/connection.js:16` |
| 0.0% | 1.0ms | 0.0% | 0us | `async runPluginInit` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/helpers.mjs:18` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/utils.js:28` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/action-async-storage.external.js:11` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/react/index.js:6` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/endpoint-context.mjs` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:151` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `NextResponse` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:39` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `groupsFromRows` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async getThreadGroupCounts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1402` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/headers.js:3` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async ensureCalendarEventRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/decorators/index.js:9` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `query` | `bun:sqlite` |
| 0.0% | 1.0ms | 0.0% | 0us | `async createKyselyAdapter` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:115` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs` |
| 0.0% | 1.0ms | 0.0% | 0us | `async getMigrations` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:352` |
| 0.0% | 1.0ms | 0.0% | 0us | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:24` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async getTrustedOrigins` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/helpers.mjs` |
| 0.0% | 1.0ms | 0.0% | 0us | `convertWhereClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:373` |
| 0.0% | 1.0ms | 0.0% | 0us | `async createAuthContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/create-context.mjs:128` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `parseExpression` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/expression-parser.js:7` |
| 0.0% | 1.0ms | 0.0% | 0us | `async getTrustedOrigins` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/helpers.mjs:85` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:376` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `toASN` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `Database` | `bun:sqlite` |
| 0.0% | 1.0ms | 0.0% | 0us | `async getDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:299` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:19` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:2103` |
| 0.0% | 1.0ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema/account.mjs:18` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:423` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2482` |
| 0.0% | 1.0ms | 0.0% | 0us | `parseSelectExpression` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/select-parser.js:22` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/well-known/index.js:6` |
| 0.0% | 1.0ms | 0.0% | 0us | `toPhysicalSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:190` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/lazy-result.js:6` |
| 0.0% | 1.0ms | 0.0% | 0us | `sentIdentifiers` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:211` |
| 0.0% | 1.0ms | 0.0% | 0us | `async getMigrations` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:405` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/parse.js:5` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2683` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/index.js:7` |
| 0.0% | 1.0ms | 0.0% | 0us | `async getMigrations` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:646` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `addColumn` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/schema/create-table-builder.js:127` |
| 0.0% | 1.0ms | 0.0% | 0us | `upsertTopicLearningSignalsForThreadIds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:150` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `debugLog` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:39` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js:12` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:348` |
| 0.0% | 1.0ms | 0.0% | 0us | `ZodIPv6` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:495` |
| 0.0% | 1.0ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/ip.mjs:5` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:198` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:340` |
| 0.0% | 1.0ms | 0.0% | 0us | `_ipv6` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/api.js:178` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async runBeforeHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:67` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/index.js:16` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:928` |
| 0.0% | 1.0ms | 0.0% | 0us | `members` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:734` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `getOwnPropertyDescriptor` | `[native code]` |
| 0.0% | 1.0ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs:845` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:940` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1021` |
| 0.0% | 1.0ms | 0.0% | 0us | `xor` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:949` |
| 0.0% | 1.0ms | 0.0% | 0us | `ZodXor` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/bags/index.js:5` |
| 0.0% | 1.0ms | 0.0% | 0us | `validateFtsIdentity` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/ftsIdentity.ts:60` |
| 0.0% | 1.0ms | 0.0% | 0us | `migrate` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountKeys.ts:219` |
| 0.0% | 1.0ms | 0.0% | 0us | `buildFtsIdentity` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/ftsIdentity.ts:46` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `deepmergeFastUnsafeCustom` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/deepmerge-ts/dist/index.mjs` |
| 0.0% | 1.0ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/deepmerge-ts/dist/index.mjs:924` |
| 0.0% | 1.0ms | 0.0% | 0us | `DBCSCodec` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:26` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs` |
| 0.0% | 1.0ms | 0.0% | 0us | `table` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-data.js:92` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `#run` | `bun:sqlite` |
| 0.0% | 1.0ms | 0.0% | 0us | `compile` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:156` |
| 0.0% | 1.0ms | 0.0% | 0us | `tlds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:618` |
| 0.0% | 1.0ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/encode.js:15` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `isAPIError` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/is-api-error.mjs` |
| 0.0% | 1.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:249` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs` |
| 0.0% | 1.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs:213` |
| 0.0% | 1.0ms | 0.0% | 0us | `async releaseConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:66` |
| 0.0% | 1.0ms | 0.0% | 0us | `_defu` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/defu/dist/defu.mjs:23` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/cookies.js:27` |
| 0.0% | 1.0ms | 0.0% | 0us | `async releaseConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:47` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/request.js:26` |
| 0.0% | 1.0ms | 0.0% | 0us | `unlock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:87` |
| 0.0% | 1.0ms | 0.0% | 0us | `normalizedSql` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:130` |
| 0.0% | 1.0ms | 0.0% | 0us | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:837` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:289` |
| 0.0% | 1.0ms | 0.0% | 0us | `BaseBlock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:924` |
| 0.0% | 1.0ms | 0.0% | 0us | `LocalObjectIdentifierValueBlock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:2342` |
| 0.0% | 1.0ms | 0.0% | 0us | `ObjectIdentifier` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:2473` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `fromString` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js` |
| 0.0% | 1.0ms | 0.0% | 0us | `toASN` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/converters.js:47` |
| 0.0% | 1.0ms | 0.0% | 0us | `LinkifyIt` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:351` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `assign` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/bags/index.js:7` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/bags/pkcs8_shrouded_key_bag.js:2` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `Address6` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv6.js` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv6.js:1443` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv6.js:1444` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/index.js:5` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:820` |
| 0.0% | 1.0ms | 0.0% | 0us | `ZodArray` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` |
| 0.0% | 1.0ms | 0.0% | 0us | `_array` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/api.js:729` |
| 0.0% | 1.0ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/account.mjs:105` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:891` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `capSize` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:19` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `get` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:210` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/key_usage.js:19` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/esm/charsets.js:213` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `applyAddressSearchFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:570` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/dependency-container.js:5` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/providers/index.js:7` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:372` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/index.js:18` |
| 0.0% | 1.0ms | 0.0% | 0us | `node:_http_agent` | `node:_http_agent:8` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/lazy-result.js:11` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async get` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `normalize` | `/tmp/spike-switch-server/anatomy.ts:51` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/shared/lib/router/utils/format-next-pathname-info.js:14` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts:76` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv4.js:31` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async GET` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:55` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `isCorrect` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/common.js` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async getAccountById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/serverDb.ts:24` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `parseValueExpression` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/value-parser.js:14` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async withAuthResponse` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:48` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/legacy/index.js:4` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/index.js:10` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `normalize` | `/tmp/spike-switch-server/anatomy.ts:60` |
| 0.0% | 999us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-attributes.mjs:29` |
| 0.0% | 999us | 0.0% | 999us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-id-field.mjs:43` |
| 0.0% | 999us | 0.0% | 999us | `charAt` | `[native code]` |
| 0.0% | 998us | 0.0% | 0us | `normalizeShardSql` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/ftsIdentity.ts:2` |
| 0.0% | 998us | 0.0% | 998us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:176` |
| 0.0% | 998us | 0.0% | 0us | `async findSchemaProblems` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:253` |
| 0.0% | 998us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:173` |
| 0.0% | 998us | 0.0% | 0us | `shardWriterGuardsInstalled` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts:65` |
| 0.0% | 997us | 0.0% | 997us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:181` |
| 0.0% | 997us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:166` |
| 0.0% | 997us | 0.0% | 0us | `DBCSCodec` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:44` |
| 0.0% | 996us | 0.0% | 996us | `parseSearchInput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:601` |
| 0.0% | 996us | 0.0% | 996us | `compileList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:134` |
| 0.0% | 996us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/input.js:6` |
| 0.0% | 996us | 0.0% | 996us | `initGetDefaultModelName` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-model-name.mjs` |
| 0.0% | 996us | 0.0% | 0us | `initGetModelName` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-model-name.mjs:4` |
| 0.0% | 996us | 0.0% | 0us | `async getMigrations` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:556` |
| 0.0% | 994us | 0.0% | 994us | `safeParseJson` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts` |
| 0.0% | 994us | 0.0% | 994us | `looksLikeJiraMessage` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:31` |
| 0.0% | 994us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:535` |
| 0.0% | 993us | 0.0% | 993us | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:101` |
| 0.0% | 991us | 0.0% | 0us | `getColorDepth` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs:66` |
| 0.0% | 990us | 0.0% | 0us | `createRawBuilder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/raw-builder/raw-builder.js:61` |
| 0.0% | 990us | 0.0% | 990us | `setHeader` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:27` |
| 0.0% | 990us | 0.0% | 990us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/raw-builder/raw-builder.js` |
| 0.0% | 990us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/charset.js:42` |
| 0.0% | 990us | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:34` |
| 0.0% | 990us | 0.0% | 0us | `RawBuilderImpl` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/raw-builder/raw-builder.js:9` |
| 0.0% | 990us | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:71` |
| 0.0% | 989us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/imapflow/dist/esm/special-use.js:69` |
| 0.0% | 989us | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/imapflow/dist/esm/special-use.js:69` |
| 0.0% | 987us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/tools.js:28` |
| 0.0% | 987us | 0.0% | 987us | `async getAccountById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accounts.ts` |
| 0.0% | 987us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/key_agree_recipient_info.js:146` |
| 0.0% | 987us | 0.0% | 0us | `decorate` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:135` |
| 0.0% | 987us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/recipient_info.js:6` |
| 0.0% | 987us | 0.0% | 0us | `ToPropertyKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:760` |
| 0.0% | 987us | 0.0% | 987us | `IsSymbol` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js` |
| 0.0% | 986us | 0.0% | 0us | `async runAfterHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:111` |
| 0.0% | 986us | 0.0% | 986us | `matcher` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:73` |
| 0.0% | 984us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/index.js:9` |
| 0.0% | 983us | 0.0% | 983us | `defaultThreadCollabState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts` |
| 0.0% | 983us | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:668` |
| 0.0% | 983us | 0.0% | 983us | `async reconcileProvisioning` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/userProvisioning.ts` |
| 0.0% | 983us | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:281` |
| 0.0% | 982us | 0.0% | 982us | `finalize` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_poly1305.js` |
| 0.0% | 982us | 0.0% | 0us | `digestInto` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_poly1305.js:287` |
| 0.0% | 982us | 0.0% | 0us | `encrypt` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:351` |
| 0.0% | 982us | 0.0% | 0us | `computeTag` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:328` |
| 0.0% | 982us | 0.0% | 0us | `digest` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_poly1305.js:296` |
| 0.0% | 982us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/index.js:9` |
| 0.0% | 980us | 0.0% | 0us | `parseInsertColumnsAndValues` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/insert-values-parser.js:21` |
| 0.0% | 980us | 0.0% | 980us | `ResponseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/@edge-runtime/cookies/index.js:261` |
| 0.0% | 979us | 0.0% | 979us | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:695` |
| 0.0% | 978us | 0.0% | 978us | `persistAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts` |
| 0.0% | 978us | 0.0% | 978us | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:834` |
| 0.0% | 977us | 0.0% | 977us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:637` |
| 0.0% | 976us | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/mailboxSummary.ts:50` |
| 0.0% | 975us | 0.0% | 975us | `/\s/` | `[native code]` |
| 0.0% | 974us | 0.0% | 0us | `initAccountSchemaBody` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:1003` |
| 0.0% | 974us | 0.0% | 974us | `add` | `[native code]` |
| 0.0% | 974us | 0.0% | 0us | `ensureThreadCollabRuntimeSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:923` |
| 0.0% | 973us | 0.0% | 973us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/node.js:78` |
| 0.0% | 972us | 0.0% | 972us | `expr` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:382` |
| 0.0% | 972us | 0.0% | 0us | `internal:streams/add-abort-signal` | `internal:streams/add-abort-signal:2` |
| 0.0% | 972us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:37` |
| 0.0% | 971us | 0.0% | 971us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:77` |
| 0.0% | 971us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:163` |
| 0.0% | 969us | 0.0% | 0us | `serializeCookieValue` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:74` |
| 0.0% | 969us | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:84` |
| 0.0% | 969us | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs:195` |
| 0.0% | 969us | 0.0% | 969us | `toUpperCase` | `[native code]` |
| 0.0% | 969us | 0.0% | 969us | `async findUserByEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs` |
| 0.0% | 968us | 0.0% | 968us | `async runBeforeHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:83` |
| 0.0% | 967us | 0.0% | 967us | `getChunkedCookie` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/session-store.mjs:138` |
| 0.0% | 960us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/converters/index.js:17` |
| 0.0% | 959us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/converters.js:8` |
| 0.0% | 959us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/tracer.mjs:41` |
| 0.0% | 958us | 0.0% | 0us | `rebuildThreadSignalsForThreadIdsInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:98` |
| 0.0% | 954us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sonic-boom/index.js:7` |
| 0.0% | 952us | 0.0% | 0us | `async recomputeThreadsForAccountInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:275` |
| 0.0% | 952us | 0.0% | 0us | `buildThreadLatestReceivedDateSql` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:196` |
| 0.0% | 952us | 0.0% | 952us | `messageAuthorEmailSql` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/ownAddressSql.ts:11` |
| 0.0% | 951us | 0.0% | 0us | `decodeTrieDict` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/internal/decode-shared.js:119` |
| 0.0% | 951us | 0.0% | 951us | `decodeDelta` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/internal/decode-shared.js:92` |
| 0.0% | 949us | 0.0% | 949us | `$constructor` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:46` |
| 0.0% | 949us | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:545` |
| 0.0% | 947us | 0.0% | 947us | `getAuth` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:263` |
| 0.0% | 947us | 0.0% | 947us | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:49` |
| 0.0% | 944us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/dependency-container.js:14` |
| 0.0% | 944us | 0.0% | 944us | `async #transformResult` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js` |
| 0.0% | 943us | 0.0% | 0us | `async createWithHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/with-hooks.mjs:13` |
| 0.0% | 943us | 0.0% | 943us | `async before` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authPolicyHandler.ts` |
| 0.0% | 943us | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/device-authorization/schema.mjs:54` |
| 0.0% | 941us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/converters/index.js:6` |
| 0.0% | 939us | 0.0% | 939us | `async runValidation` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/validator.mjs:6` |
| 0.0% | 938us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/encoding/index.js:7` |
| 0.0% | 937us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/attribute_certificate_info.js:12` |
| 0.0% | 937us | 0.0% | 937us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/attribute_certificate_info.js` |
| 0.0% | 937us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/attribute_certificate.js:7` |
| 0.0% | 934us | 0.0% | 0us | `WriteStream` | `internal:fs/streams:251` |
| 0.0% | 934us | 0.0% | 934us | `decodeSecret` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts:68` |
| 0.0% | 934us | 0.0% | 934us | `writer` | `[native code]` |
| 0.0% | 931us | 0.0% | 0us | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:388` |
| 0.0% | 931us | 0.0% | 931us | `ensureThreadRuntimeSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:382` |
| 0.0% | 929us | 0.0% | 929us | `async upsertMessages` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts` |
| 0.0% | 929us | 0.0% | 0us | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:55` |
| 0.0% | 922us | 0.0% | 922us | `Frame` | `node:async_hooks` |

## Function Details

### `all`
`[native code]` | Self: 25.9% (4.71s) | Total: 25.9% (4.71s) | Samples: 4031

**Called by:**
- `(anonymous)` (4031)

### `get`
`[native code]` | Self: 8.8% (1.60s) | Total: 8.8% (1.60s) | Samples: 1382

**Called by:**
- `(anonymous)` (1372)
- `query` (2)
- `async (anonymous)` (1)
- `async (anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `require` (1)
- `parseSessionOutput` (1)
- `parseUserOutput` (1)
- `async (anonymous)` (1)

### `prepare`
`[native code]` | Self: 8.0% (1.45s) | Total: 8.0% (1.45s) | Samples: 1032

**Called by:**
- `prepare` (1031)
- `[prepareOwned]` (1)

### `run`
`[native code]` | Self: 7.5% (1.37s) | Total: 7.5% (1.37s) | Samples: 790

**Called by:**
- `#run` (702)
- `#runNoArgs` (52)
- `run` (37)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:655` | Self: 4.5% (820.1ms) | Total: 4.5% (820.1ms) | Samples: 706

**Called by:**
- `forEach` (706)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:648` | Self: 3.2% (589.2ms) | Total: 3.2% (589.2ms) | Samples: 504

**Called by:**
- `forEach` (504)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:659` | Self: 3.2% (581.4ms) | Total: 3.2% (581.4ms) | Samples: 504

**Called by:**
- `forEach` (504)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:651` | Self: 2.5% (469.3ms) | Total: 2.5% (471.7ms) | Samples: 397

**Called by:**
- `forEach` (398)

**Calls:**
- `get` (1)

### `json`
`[native code]` | Self: 2.4% (450.2ms) | Total: 2.4% (450.2ms) | Samples: 388

**Called by:**
- `json` (388)

### `forEach`
`[native code]` | Self: 1.9% (363.2ms) | Total: 65.4% (11.89s) | Samples: 316

**Called by:**
- `getTopicSuggestionsForThreadSignalBatch` (2750)
- `(anonymous)` (2397)
- `(anonymous)` (2325)
- `insertThreadSignalsFromMessageRows` (405)
- `getTopicSuggestionSignalsForThreadsFromDb` (342)
- `upsertBatch` (291)
- `flush` (266)
- `(anonymous)` (224)
- `(anonymous)` (191)
- `collectTopicSignalEntries` (128)
- `upsertTopicLearningSignalsForThreadIds` (103)
- `getTopicSuggestionsForThreadSignalBatch` (85)
- `getTopicSuggestionsForThreadSignalBatch` (83)
- `(anonymous)` (39)
- `getTopicSuggestionSignalsForThreadsFromDb` (27)
- `async listThreads` (7)
- `extractJiraProjectKeys` (3)
- `(module)` (2)
- `sortGroupsForGroupBy` (2)
- `compile` (2)
- `topicSuggestionSignalsFromEntries` (2)
- `(anonymous)` (1)
- `convertWhereClause` (1)
- `setWeights` (1)
- `getTopicSuggestionsForThreadSignalBatch` (1)
- `async getTotalCount` (1)
- `normalizeService` (1)
- `forwardAuthHeaders` (1)
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (2398)
- `(anonymous)` (2333)
- `(anonymous)` (706)
- `(anonymous)` (504)
- `(anonymous)` (504)
- `(anonymous)` (405)
- `(anonymous)` (398)
- `(anonymous)` (330)
- `(anonymous)` (265)
- `(anonymous)` (224)
- `(anonymous)` (191)
- `(anonymous)` (123)
- `(anonymous)` (122)
- `(anonymous)` (103)
- `(anonymous)` (77)
- `(anonymous)` (76)
- `(anonymous)` (57)
- `(anonymous)` (55)
- `(anonymous)` (49)
- `(anonymous)` (49)
- `(anonymous)` (36)
- `(anonymous)` (36)
- `(anonymous)` (34)
- `(anonymous)` (32)
- `(anonymous)` (30)
- `(anonymous)` (27)
- `(anonymous)` (21)
- `(anonymous)` (19)
- `(anonymous)` (12)
- `(anonymous)` (10)
- `(anonymous)` (10)
- `(anonymous)` (10)
- `(anonymous)` (6)
- `(anonymous)` (6)
- `(anonymous)` (5)
- `(anonymous)` (5)
- `(anonymous)` (5)
- `(anonymous)` (5)
- `(anonymous)` (5)
- `(anonymous)` (4)
- `(anonymous)` (4)
- `(anonymous)` (4)
- `(anonymous)` (4)
- `(anonymous)` (4)
- `(anonymous)` (4)
- `(anonymous)` (3)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `anonymous`
`[native code]` | Self: 1.8% (341.2ms) | Total: 6.7% (1.23s) | Samples: 172

**Called by:**
- `require` (764)
- `node:crypto` (9)
- `internal:streams/lazy_transform` (9)
- `internal:streams/transform` (9)
- `internal:streams/duplex` (8)
- `node:http` (7)
- `node:stream` (4)
- `bound require` (3)
- `node:_http_client` (2)
- `get WriteStream` (2)
- `internal:stream` (2)
- `node:tls` (2)
- `internal:streams/legacy` (2)
- `internal:streams/readable` (2)
- `internal:streams/destroy` (1)
- `internal:validators` (1)
- `internal:stream` (1)
- `internal:streams/add-abort-signal` (1)
- `internal:streams/compose` (1)
- `node:_http_agent` (1)
- `node:fs` (1)
- `internal:errors` (1)
- `(anonymous)` (1)
- `internal:fs/streams` (1)

**Calls:**
- `(anonymous)` (40)
- `(anonymous)` (40)
- `(anonymous)` (39)
- `(anonymous)` (33)
- `(anonymous)` (20)
- `(anonymous)` (18)
- `(anonymous)` (17)
- `(anonymous)` (10)
- `internal:streams/transform` (9)
- `internal:streams/lazy_transform` (9)
- `(anonymous)` (9)
- `(anonymous)` (9)
- `(anonymous)` (9)
- `(anonymous)` (9)
- `(anonymous)` (9)
- `internal:streams/duplex` (8)
- `(anonymous)` (8)
- `(anonymous)` (7)
- `(anonymous)` (7)
- `(anonymous)` (7)
- `(anonymous)` (7)
- `(anonymous)` (7)
- `(anonymous)` (6)
- `(anonymous)` (6)
- `(anonymous)` (6)
- `(anonymous)` (6)
- `(anonymous)` (6)
- `(anonymous)` (6)
- `(anonymous)` (5)
- `(anonymous)` (5)
- `(anonymous)` (4)
- `(anonymous)` (4)
- `(anonymous)` (4)
- `(anonymous)` (4)
- `(anonymous)` (4)
- `(anonymous)` (4)
- `(anonymous)` (4)
- `(anonymous)` (4)
- `(anonymous)` (4)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `internal:streams/readable` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `internal:streams/legacy` (2)
- `(anonymous)` (2)
- `internal:stream` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `node:_http_client` (2)
- `(anonymous)` (1)
- `internal:errors` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `internal:streams/add-abort-signal` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `internal:streams/writable` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `internal:primordials` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `internal:streams/compose` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `node:_http_agent` (1)
- `internal:stream` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `internal:streams/destroy` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `internal:stream` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `internal:fs/streams` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `internal:validators` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `internal:streams/duplexpair` (1)
- `(anonymous)` (1)
- `internal:shared` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `node:_http_outgoing` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `async executeTakeFirst`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/insert-query-builder.js:1114` | Self: 1.0% (188.6ms) | Total: 1.0% (189.7ms) | Samples: 1

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `async executeTakeFirst` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/index.mjs:125` | Self: 0.9% (170.8ms) | Total: 1.8% (331.6ms) | Samples: 1

**Calls:**
- `async findOne` (1)

### `isUndefined`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/object-utils.js:12` | Self: 0.9% (165.8ms) | Total: 0.9% (165.8ms) | Samples: 1

**Called by:**
- `parseRowValues` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs` | Self: 0.9% (163.9ms) | Total: 0.9% (163.9ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-attributes.mjs:30` | Self: 0.8% (160.8ms) | Total: 0.8% (160.8ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `normalize`
`/tmp/spike-switch-server/sqlcounter.ts:36` | Self: 0.8% (145.6ms) | Total: 1.0% (183.3ms) | Samples: 120

**Called by:**
- `bump` (85)
- `addMs` (67)

**Calls:**
- `/\s+/g` (32)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:657` | Self: 0.7% (141.6ms) | Total: 0.7% (141.6ms) | Samples: 123

**Called by:**
- `forEach` (123)

### `displayDayNumber`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/i18n/format.ts:43` | Self: 0.6% (126.9ms) | Total: 0.6% (126.9ms) | Samples: 111

**Called by:**
- `buildMessageGroupKey` (42)
- `buildTimeGroupKey` (40)
- `buildTimeGroupKey` (29)

### `importModule`
`[native code]` | Self: 0.6% (111.0ms) | Total: 0.6% (111.0ms) | Samples: 84

**Called by:**
- `async ensureCalendarEventRuntimeData` (66)
- `loadServerDb` (15)
- `async buildFixture` (2)
- `async buildFixture` (1)

### `map`
`[native code]` | Self: 0.5% (103.3ms) | Total: 5.9% (1.08s) | Samples: 84

**Called by:**
- `async listThreads` (278)
- `isOwnAddress` (96)
- `normalize` (28)
- `async (anonymous)` (21)
- `async (anonymous)` (19)
- `(anonymous)` (18)
- `async enrichMessagesWithThreadTopics` (15)
- `_handleAddress` (12)
- `async (anonymous)` (10)
- `(anonymous)` (9)
- `topicSuggestionSignalEntries` (9)
- `async enrichMessagesWithThreadCollab` (8)
- `async (anonymous)` (7)
- `async (anonymous)` (7)
- `getThreadCollabStates` (6)
- `topicSuggestionSignalEntries` (6)
- `getTopicSuggestionSignalsForThreadsFromDb` (6)
- `topicSuggestionSignalEntries` (5)
- `topicSuggestionSignalEntries` (5)
- `async (anonymous)` (5)
- `async getAccountById` (4)
- `async getTables` (4)
- `async getMessageCalendarInviteDataByMessageId` (4)
- `getThreadCollabStates` (4)
- `async listThreads` (4)
- `(anonymous)` (4)
- `async (anonymous)` (4)
- `async getMessageCalendarInviteDataByMessageId` (3)
- `async listThreads` (3)
- `topicSuggestionSignalEntries` (3)
- `header` (2)
- `(anonymous)` (2)
- `getOwnAddresses` (2)
- `normalizeThreadIds` (2)
- `normalizeThreadIds` (2)
- `parseStringReference` (2)
- `(module)` (1)
- `loadManualCategoryStatesForMessageIds` (1)
- `write` (1)
- `pruneThreadTopicsWithoutMessages` (1)
- `parseInsertColumnsAndValues` (1)
- `loadManualCategoryStatesForMessageIds` (1)
- `async listThreads` (1)
- `select` (1)
- `(anonymous)` (1)
- `async (anonymous)` (1)
- `parseInsertColumnsAndValues` (1)
- `async (anonymous)` (1)
- `async (anonymous)` (1)
- `createLexer` (1)
- `(anonymous)` (1)
- `async (anonymous)` (1)
- `upsertTopicLearningSignalsForThreadIds` (1)
- `rebuildThreadSignalsForThreadIdsInternal` (1)
- `async getTopicSuggestionsForThreads` (1)
- `upsertTopicLearningSignalsForThreadIds` (1)
- `(anonymous)` (1)
- `getDbTableColumns` (1)
- `(module)` (1)
- `async findSchemaProblems` (1)

**Calls:**
- `(anonymous)` (171)
- `(anonymous)` (54)
- `normalizeIdentityEmail` (38)
- `(anonymous)` (36)
- `slimThreadListItem` (29)
- `(anonymous)` (18)
- `normalize` (17)
- `(anonymous)` (15)
- `normalizeIdentityEmail` (14)
- `binary` (14)
- `normalizeIdentityEmail` (13)
- `normalize` (9)
- `(anonymous)` (7)
- `normalizeIdentityEmail` (7)
- `(anonymous)` (6)
- `(anonymous)` (5)
- `normalizeIdentityEmail` (5)
- `(anonymous)` (5)
- `_collapseAtSpacing` (5)
- `normalizeIdentityEmail` (5)
- `(anonymous)` (5)
- `(anonymous)` (5)
- `(anonymous)` (4)
- `async (anonymous)` (4)
- `(anonymous)` (4)
- `getCodec` (4)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `expr` (3)
- `normalizeIdentityEmail` (3)
- `normalizeIdentityEmail` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `normalizeIdentityEmail` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `normalizeIdentityEmail` (2)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `async (anonymous)` (1)
- `slimThreadListItem` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `_collapseAtSpacing` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `parseSelectExpression` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `toUnifiedRule` (1)
- `parseRowValues` (1)
- `expr` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `stringify`
`[native code]` | Self: 0.5% (100.4ms) | Total: 0.5% (100.4ms) | Samples: 81

**Called by:**
- `async time` (58)
- `normalizeAccountSettings` (17)
- `(module)` (5)
- `async time` (1)

### `URL`
`[native code]` | Self: 0.4% (90.4ms) | Total: 0.4% (90.4ms) | Samples: 73

**Called by:**
- `normalizeIdentityEmail` (72)
- `async GET` (1)

### `Set`
`[native code]` | Self: 0.4% (85.7ms) | Total: 0.4% (85.7ms) | Samples: 72

**Called by:**
- `async getMessageCalendarInviteDataByMessageId` (15)
- `async enrichMessagesWithThreadTopics` (12)
- `isOwnAddress` (10)
- `async enrichMessagesWithThreadCollab` (10)
- `getThreadCollabStates` (7)
- `getOwnAddresses` (7)
- `async getTopicSuggestionsForThreads` (4)
- `getTopicSuggestionSignalsForThreadsFromDb` (3)
- `ownAddressList` (2)
- `applyExcludedFolderFilters` (1)
- `extractEmailAddresses` (1)

### `Buffer`
`[native code]` | Self: 0.4% (77.6ms) | Total: 0.4% (77.6ms) | Samples: 67

**Called by:**
- `(anonymous)` (67)

### `entries`
`[native code]` | Self: 0.3% (67.7ms) | Total: 0.3% (67.7ms) | Samples: 42

**Called by:**
- `async (anonymous)` (13)
- `transformJoinClause` (8)
- `normalize` (7)
- `filterOutputFields` (7)
- `filterOutputFields` (2)
- `transformJoinClause` (2)
- `(anonymous)` (1)
- `transformJoinClause` (1)
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:625` | Self: 0.3% (64.7ms) | Total: 0.3% (64.7ms) | Samples: 57

**Called by:**
- `forEach` (57)

### `checkChar`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:989` | Self: 0.3% (62.9ms) | Total: 0.3% (62.9ms) | Samples: 54

**Called by:**
- `tokenize` (54)

### `json`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:92` | Self: 0.3% (59.7ms) | Total: 0.3% (68.9ms) | Samples: 53

**Called by:**
- `async (anonymous)` (61)

**Calls:**
- `NextResponse` (4)
- `NextResponse` (1)
- `NextResponse` (1)
- `NextResponse` (1)
- `NextResponse` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js` | Self: 0.3% (59.6ms) | Total: 0.3% (59.6ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `from`
`[native code]` | Self: 0.3% (59.5ms) | Total: 0.4% (72.7ms) | Samples: 3

**Called by:**
- `getTopicSuggestionSignalsForThreadsFromDb` (4)
- `async getMessageCalendarInviteDataByMessageId` (3)
- `async enrichMessagesWithThreadTopics` (2)
- `async getTopicSuggestionsForThreads` (1)
- `(module)` (1)
- `async listThreads` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

**Calls:**
- `arrayFromFastWithoutMapFn` (11)

### `getTopicSuggestionWeight`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:68` | Self: 0.2% (45.4ms) | Total: 0.2% (45.4ms) | Samples: 38

**Called by:**
- `(anonymous)` (38)

### `cloneObject`
`[native code]` | Self: 0.2% (44.3ms) | Total: 0.2% (44.3ms) | Samples: 37

**Called by:**
- `slimThreadListItem` (11)
- `async (anonymous)` (7)
- `(anonymous)` (5)
- `(anonymous)` (5)
- `(anonymous)` (4)
- `(anonymous)` (1)
- `cloneWithSelections` (1)
- `where` (1)
- `async getAccountById` (1)
- `(anonymous)` (1)

### `copyDataProperties`
`[native code]` | Self: 0.2% (43.4ms) | Total: 0.2% (43.4ms) | Samples: 38

**Called by:**
- `(anonymous)` (25)
- `async (anonymous)` (11)
- `_string` (1)
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2666` | Self: 0.2% (42.3ms) | Total: 0.2% (42.3ms) | Samples: 36

**Called by:**
- `map` (36)

### `buildTimeGroupKey`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/messageGrouping.ts:42` | Self: 0.2% (41.6ms) | Total: 0.2% (43.8ms) | Samples: 35

**Called by:**
- `(anonymous)` (31)
- `(anonymous)` (6)

**Calls:**
- `Date` (2)

### `freeze`
`[native code]` | Self: 0.2% (41.1ms) | Total: 0.2% (41.1ms) | Samples: 33

**Called by:**
- `create` (23)
- `cloneWithSelections` (4)
- `create` (2)
- `where` (1)
- `create` (1)
- `parseSelectExpression` (1)
- `parseStringReferenceWithTable` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:583` | Self: 0.2% (38.6ms) | Total: 0.2% (38.6ms) | Samples: 32

**Called by:**
- `forEach` (32)

### `/\s+/g`
`[native code]` | Self: 0.2% (37.7ms) | Total: 0.2% (37.7ms) | Samples: 32

**Called by:**
- `normalize` (32)

### `parse`
`[native code]` | Self: 0.1% (36.3ms) | Total: 0.1% (36.3ms) | Samples: 30

**Called by:**
- `safeParseJson` (21)
- `(module)` (7)
- `normalizeAccountSettings` (2)

### `shouldIgnoreTopicSuggestionSignal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:123` | Self: 0.1% (35.6ms) | Total: 0.1% (35.6ms) | Samples: 31

**Called by:**
- `(anonymous)` (31)

### `normalizeIdentityEmail`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:14` | Self: 0.1% (34.7ms) | Total: 0.6% (123.9ms) | Samples: 30

**Called by:**
- `map` (38)
- `(anonymous)` (33)
- `(anonymous)` (24)
- `(anonymous)` (7)

**Calls:**
- `URL` (72)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:204` | Self: 0.1% (32.5ms) | Total: 0.1% (33.6ms) | Samples: 26

**Called by:**
- `forEach` (27)

**Calls:**
- `topicSuggestionSignalsFromEntries` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:685` | Self: 0.1% (32.4ms) | Total: 0.1% (33.4ms) | Samples: 29

**Called by:**
- `forEach` (30)

**Calls:**
- `compare` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2645` | Self: 0.1% (31.6ms) | Total: 0.3% (62.4ms) | Samples: 27

**Called by:**
- `map` (54)

**Calls:**
- `copyDataProperties` (25)
- `hydrateIdentityMetadata` (2)

### `filter`
`[native code]` | Self: 0.1% (31.1ms) | Total: 0.5% (107.4ms) | Samples: 26

**Called by:**
- `(anonymous)` (36)
- `async enrichMessagesWithThreadCollab` (15)
- `async enrichMessagesWithThreadTopics` (6)
- `async getMessageCalendarInviteDataByMessageId` (5)
- `getTopicSuggestionSignalsForThreadsFromDb` (4)
- `filterOutputFields` (3)
- `transformJoinClause` (2)
- `filterOutputFields` (2)
- `async getTopicSuggestionsForThreads` (2)
- `async enrichMessagesWithThreadTopics` (2)
- `getOwnAddresses` (2)
- `transformJoinClause` (1)
- `normalizeSearchTermList` (1)
- `tlds` (1)
- `isInstalledControlPlane` (1)
- `normalizeSearchFields` (1)
- `normalizeDef` (1)

**Calls:**
- `(anonymous)` (35)
- `(anonymous)` (10)
- `Boolean` (6)
- `(anonymous)` (2)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `structuredClone`
`[native code]` | Self: 0.1% (29.7ms) | Total: 0.1% (29.7ms) | Samples: 22

**Called by:**
- `filterOutputFields` (22)

### `normalizeIdentityEmail`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:17` | Self: 0.1% (29.6ms) | Total: 0.1% (29.6ms) | Samples: 25

**Called by:**
- `map` (14)
- `(anonymous)` (7)
- `(anonymous)` (3)
- `(anonymous)` (1)

### `Cipher`
`[native code]` | Self: 0.1% (27.0ms) | Total: 0.1% (27.0ms) | Samples: 23

**Called by:**
- `Decipheriv2` (23)

### `parseAddressEmails`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:25` | Self: 0.1% (26.8ms) | Total: 0.1% (26.8ms) | Samples: 23

**Called by:**
- `isOwnAddress` (18)
- `flatIntoArrayWithCallback` (3)
- `(anonymous)` (2)

### `addMs`
`/tmp/spike-switch-server/sqlcounter.ts:61` | Self: 0.1% (26.6ms) | Total: 0.5% (104.8ms) | Samples: 22

**Called by:**
- `(anonymous)` (42)
- `(anonymous)` (37)
- `(anonymous)` (10)

**Calls:**
- `normalize` (67)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/esm/mimetypes.js:3` | Self: 0.1% (26.2ms) | Total: 0.1% (26.2ms) | Samples: 11

### `WeakMap`
`[native code]` | Self: 0.1% (23.8ms) | Total: 0.1% (23.8ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `normalizeIdentityEmail`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:16` | Self: 0.1% (23.2ms) | Total: 0.2% (48.0ms) | Samples: 19

**Called by:**
- `(anonymous)` (14)
- `map` (13)
- `(anonymous)` (11)
- `(anonymous)` (1)

**Calls:**
- `every` (20)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2671` | Self: 0.1% (22.8ms) | Total: 1.0% (198.1ms) | Samples: 20

**Called by:**
- `map` (171)

**Calls:**
- `buildGroupKey` (48)
- `buildTimeGroupKey` (31)
- `buildTimeGroupKey` (31)
- `buildTimeGroupKey` (25)
- `buildMessageGroupKey` (16)

### `displayDayNumber`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/i18n/format.ts:42` | Self: 0.1% (22.3ms) | Total: 0.1% (22.3ms) | Samples: 19

**Called by:**
- `buildTimeGroupKey` (10)
- `buildMessageGroupKey` (7)
- `buildTimeGroupKey` (2)

### `normalizeIdentityEmail`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:9` | Self: 0.1% (21.8ms) | Total: 0.1% (21.8ms) | Samples: 19

**Called by:**
- `map` (7)
- `(anonymous)` (6)
- `(anonymous)` (6)

### `bump`
`/tmp/spike-switch-server/sqlcounter.ts:52` | Self: 0.1% (21.4ms) | Total: 0.1% (21.4ms) | Samples: 18

**Called by:**
- `(anonymous)` (9)
- `(anonymous)` (5)
- `(anonymous)` (4)

### `flatIntoArrayWithCallback`
`[native code]` | Self: 0.1% (21.2ms) | Total: 3.2% (596.6ms) | Samples: 18

**Called by:**
- `flatMap` (254)
- `flush` (106)
- `getOwnAddresses` (74)
- `extractEmailAddresses` (32)
- `ownAddressList` (13)
- `isOwnAddress` (9)
- `flatIntoArrayWithCallback` (6)
- `(anonymous)` (4)
- `(anonymous)` (3)
- `getHooks` (3)

**Calls:**
- `(anonymous)` (285)
- `(anonymous)` (73)
- `(anonymous)` (66)
- `parseAddressEmails` (22)
- `(anonymous)` (13)
- `flatIntoArrayWithCallback` (6)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `parseAddressEmails` (3)
- `(anonymous)` (3)
- `flatIntoArray` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `slimThreadListItem`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:32` | Self: 0.1% (20.7ms) | Total: 0.1% (33.9ms) | Samples: 18

**Called by:**
- `map` (29)

**Calls:**
- `cloneObject` (11)

### `async enrichMessagesWithThreadTopics`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:50` | Self: 0.1% (20.5ms) | Total: 0.1% (21.6ms) | Samples: 17

**Calls:**
- `trim` (1)

### `normalizeIdentityEmail`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:12` | Self: 0.1% (19.9ms) | Total: 0.1% (19.9ms) | Samples: 18

**Called by:**
- `(anonymous)` (10)
- `(anonymous)` (5)
- `map` (2)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:16` | Self: 0.1% (18.9ms) | Total: 0.1% (23.5ms) | Samples: 16

**Called by:**
- `every` (19)

**Calls:**
- `/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/` (3)

### `performIteration`
`[native code]` | Self: 0.0% (17.7ms) | Total: 0.1% (20.1ms) | Samples: 5

**Called by:**
- `cloneWithSelections` (5)
- `header` (2)

**Calls:**
- `arrayIteratorNextHelper` (2)

### `wrapStatement`
`/tmp/spike-switch-server/sqlcounter.ts:75` | Self: 0.0% (17.4ms) | Total: 0.0% (17.4ms) | Samples: 15

**Called by:**
- `async getAccountById` (2)
- `(anonymous)` (1)
- `upsertTopicLearningSignalsForThreadIds` (1)
- `(anonymous)` (1)
- `async getMessageCalendarInviteDataByMessageId` (1)
- `getThreadCollabStates` (1)
- `getTopicSignalExclusionSet` (1)
- `executeQuery` (1)
- `async getAccountOwnAddresses` (1)
- `async requireActiveUserSession` (1)
- `readUserById` (1)
- `getTopicSuggestionsForThreadSignalBatch` (1)
- `async getThreadGroupCounts` (1)
- `async listThreads` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js` | Self: 0.0% (17.1ms) | Total: 0.0% (17.1ms) | Samples: 3

**Called by:**
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:29` | Self: 0.0% (17.1ms) | Total: 0.0% (17.1ms) | Samples: 15

**Called by:**
- `map` (15)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:671` | Self: 0.0% (16.7ms) | Total: 0.1% (21.8ms) | Samples: 14

**Called by:**
- `forEach` (19)

**Calls:**
- `cloneObject` (5)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/add-constraint-node.js:6` | Self: 0.0% (15.9ms) | Total: 0.0% (15.9ms) | Samples: 3

### `verify`
`[native code]` | Self: 0.0% (14.8ms) | Total: 0.0% (14.8ms) | Samples: 11

**Called by:**
- `async (anonymous)` (11)

### `(anonymous)`
`[native code]` | Self: 0.0% (14.8ms) | Total: 0.6% (111.3ms) | Samples: 14

**Called by:**
- `compareSqliteText` (60)
- `decodeSecret` (14)
- `(anonymous)` (10)
- `require` (10)
- `(anonymous)` (3)
- `unlock` (1)

**Calls:**
- `Buffer` (67)
- `(anonymous)` (10)
- `(module)` (2)
- `get WriteStream` (2)
- `(module)` (1)
- `WriteStream` (1)
- `(module)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:622` | Self: 0.0% (13.9ms) | Total: 0.0% (13.9ms) | Samples: 12

**Called by:**
- `forEach` (12)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:25` | Self: 0.0% (13.8ms) | Total: 0.0% (13.8ms) | Samples: 10

### `importKey`
`[native code]` | Self: 0.0% (13.2ms) | Total: 0.0% (13.2ms) | Samples: 11

**Called by:**
- `async (anonymous)` (11)

### `arrayFromFastWithoutMapFn`
`[native code]` | Self: 0.0% (13.2ms) | Total: 0.0% (13.2ms) | Samples: 11

**Called by:**
- `from` (11)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:646` | Self: 0.0% (13.2ms) | Total: 0.3% (58.6ms) | Samples: 11

**Called by:**
- `forEach` (49)

**Calls:**
- `getTopicSuggestionWeight` (38)

### `wrapStatement`
`/tmp/spike-switch-server/sqlcounter.ts:74` | Self: 0.0% (12.9ms) | Total: 0.0% (12.9ms) | Samples: 10

**Called by:**
- `async getAccountById` (3)
- `async requireActiveUserSession` (1)
- `async listThreads` (1)
- `async listThreads` (1)
- `listSenderIdentityRows` (1)
- `async getThreadGroupCounts` (1)
- `async getAccountOwnAddresses` (1)
- `async listThreads` (1)

### `async enrichMessagesWithThreadTopics`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:52` | Self: 0.0% (12.9ms) | Total: 0.0% (12.9ms) | Samples: 11

### `LazyQueryId`
`[native code]` | Self: 0.0% (12.3ms) | Total: 0.0% (13.6ms) | Samples: 7

**Called by:**
- `createQueryId` (8)

**Calls:**
- `(anonymous)` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/esm/mimetypes.js:1034` | Self: 0.0% (12.3ms) | Total: 0.0% (12.3ms) | Samples: 9

### `text`
`[native code]` | Self: 0.0% (12.3ms) | Total: 0.1% (24.6ms) | Samples: 11

**Called by:**
- `text` (11)
- `async (anonymous)` (11)

**Calls:**
- `text` (11)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:62` | Self: 0.0% (12.1ms) | Total: 0.0% (12.1ms) | Samples: 10

**Called by:**
- `some` (10)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadCollab.ts:8` | Self: 0.0% (12.0ms) | Total: 0.0% (12.0ms) | Samples: 10

**Called by:**
- `filter` (10)

### `async stageMessageFiles`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/storage.ts:234` | Self: 0.0% (11.9ms) | Total: 0.0% (11.9ms) | Samples: 7

**Called by:**
- `async stageMessageFiles` (7)

### `executeQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:62` | Self: 0.0% (11.9ms) | Total: 0.6% (123.3ms) | Samples: 2

**Called by:**
- `async (anonymous)` (70)

**Calls:**
- `(anonymous)` (63)
- `(anonymous)` (3)
- `columnNames` (2)

### `_collectAddressParts`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:561` | Self: 0.0% (11.8ms) | Total: 0.0% (11.8ms) | Samples: 10

**Called by:**
- `_handleAddress` (10)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:639` | Self: 0.0% (11.7ms) | Total: 0.0% (11.7ms) | Samples: 10

**Called by:**
- `forEach` (10)

### `update`
`[native code]` | Self: 0.0% (11.7ms) | Total: 0.0% (11.7ms) | Samples: 9

**Called by:**
- `update` (7)
- `(module)` (2)

### `async enrichMessagesWithThreadCollab`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadCollab.ts:14` | Self: 0.0% (11.7ms) | Total: 0.0% (11.7ms) | Samples: 10

### `RegExp`
`[native code]` | Self: 0.0% (11.4ms) | Total: 0.0% (11.4ms) | Samples: 9

**Called by:**
- `compile` (3)
- `compile` (2)
- `compile` (1)
- `compile` (1)
- `compile` (1)
- `compile` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:233` | Self: 0.0% (11.3ms) | Total: 0.0% (11.3ms) | Samples: 10

**Called by:**
- `forEach` (10)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/he/he.js` | Self: 0.0% (11.2ms) | Total: 0.0% (11.2ms) | Samples: 4

**Called by:**
- `(anonymous)` (4)

### `flush`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:223` | Self: 0.0% (10.8ms) | Total: 0.0% (10.8ms) | Samples: 9

**Called by:**
- `(anonymous)` (9)

### `rowToTopic`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:65` | Self: 0.0% (10.7ms) | Total: 0.0% (10.7ms) | Samples: 6

**Called by:**
- `(anonymous)` (5)
- `(anonymous)` (1)

### `visitSelectQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:110` | Self: 0.0% (10.4ms) | Total: 0.0% (10.4ms) | Samples: 1

**Called by:**
- `bound visitSelectQuery` (1)

### `flatMap`
`[native code]` | Self: 0.0% (10.4ms) | Total: 1.6% (307.9ms) | Samples: 9

**Called by:**
- `topicSuggestionEntriesFromThreadSignalRows` (213)
- `parseAddressEmails` (48)
- `getOwnAddresses` (2)

**Calls:**
- `flatIntoArrayWithCallback` (254)

### `async enrichMessagesWithThreadTopics`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:53` | Self: 0.0% (10.1ms) | Total: 0.0% (10.1ms) | Samples: 9

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:159` | Self: 0.0% (10.1ms) | Total: 0.1% (30.8ms) | Samples: 2

**Called by:**
- `async transformSingleOutput` (15)

**Calls:**
- `entries` (13)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:82` | Self: 0.0% (10.0ms) | Total: 41.7% (7.58s) | Samples: 9

**Called by:**
- `async listThreads` (1208)
- `async listThreads` (895)
- `async getThreadGroupCounts` (790)
- `async listThreads` (679)
- `getTopicSuggestionsForThreadSignalBatch` (552)
- `async getTotalCount` (272)
- `(anonymous)` (264)
- `async listThreads` (184)
- `async getAccountById` (123)
- `(anonymous)` (120)
- `(anonymous)` (118)
- `getTopicSuggestionSignalsForThreadsFromDb` (115)
- `(anonymous)` (103)
- `async getMessageCalendarInviteDataByMessageId` (87)
- `getThreadCollabStates` (81)
- `listSenderIdentityRows` (78)
- `executeQuery` (63)
- `(anonymous)` (53)
- `(anonymous)` (49)
- `async recomputeThreadsForAccountInternal` (30)
- `insert` (26)
- `insert` (25)
- `async recomputeThreadsForAccountInternal` (23)
- `executeQuery` (17)
- `async getAccountOwnAddresses` (15)
- `(anonymous)` (13)
- `readUserById` (12)
- `async resolveAccountDbPath` (11)
- `async requireActiveUserSession` (11)
- `upsertTopicLearningSignalsForThreadIds` (10)
- `(anonymous)` (10)
- `async assertAccountFolder` (9)
- `rebuildThreadSignalsForThreadIdsInternal` (9)
- `(anonymous)` (8)
- `rebuildThreadSignalsForThreadIdsInternal` (7)
- `async requireActiveUserSession` (7)
- `resolveAccountRoleRow` (6)
- `async requireActiveUserSession` (5)
- `enrollmentState` (5)
- `(anonymous)` (5)
- `async withDbWriteRetry` (4)
- `lookup` (4)
- `rebuildAllThreadSignalsForAccountInternal` (3)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (2)
- `loadManualCategoryStatesForMessageIds` (2)
- `async recomputeThreadsForAccountInternal` (2)
- `shardWriterGuardsInstalled` (1)
- `createAdminInvite` (1)
- `async buildFixture` (1)
- `initMasterSchema` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `validateFtsIdentity` (1)
- `initMasterSchema` (1)
- `initMasterSchema` (1)
- `initMasterSchema` (1)
- `initMasterSchema` (1)
- `initMasterSchema` (1)
- `initMasterSchema` (1)
- `scopedTables` (1)
- `async recomputeThreadsForAccountInternal` (1)
- `initMasterSchema` (1)
- `needsRebuild` (1)
- `initMasterSchema` (1)
- `initMasterSchema` (1)
- `async (anonymous)` (1)
- `initMasterSchema` (1)
- `initMasterSchema` (1)
- `ensureTableColumns` (1)

**Calls:**
- `all` (4031)
- `get` (1372)
- `#run` (702)
- `#runNoArgs` (27)
- `#get` (2)
- `#getNoArgs` (2)
- `#run` (1)
- `#all` (1)

### `transformJoinClause`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:296` | Self: 0.0% (10.0ms) | Total: 0.0% (10.0ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `DateTimeFormat`
`[native code]` | Self: 0.0% (9.9ms) | Total: 0.0% (9.9ms) | Samples: 8

**Called by:**
- `(anonymous)` (8)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts` | Self: 0.0% (9.6ms) | Total: 0.0% (9.6ms) | Samples: 8

**Called by:**
- `async resolveAccountDbPath` (2)
- `insert` (2)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `listSenderIdentityRows` (1)
- `insert` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:677` | Self: 0.0% (9.4ms) | Total: 0.4% (87.5ms) | Samples: 8

**Called by:**
- `forEach` (77)

**Calls:**
- `(anonymous)` (60)
- `compare` (4)
- `(anonymous)` (2)
- `sort` (2)
- `compareSqliteText` (1)

### `async enrichMessagesWithThreadTopics`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:54` | Self: 0.0% (9.3ms) | Total: 0.3% (60.1ms) | Samples: 8

**Called by:**
- `async (anonymous)` (16)
- `async (anonymous)` (16)
- `async (anonymous)` (10)

**Calls:**
- `async enrichMessagesWithThreadTopics` (34)
- `async enrichMessagesWithThreadTopics` (3)
- `async enrichMessagesWithThreadTopics` (3)
- `asyncFunctionDrive` (1)
- `async enrichMessagesWithThreadTopics` (1)

### `Boolean`
`[native code]` | Self: 0.0% (9.3ms) | Total: 0.0% (9.3ms) | Samples: 7

**Called by:**
- `filter` (6)
- `mapAccountRow` (1)

### `normalizeIdentityEmail`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:7` | Self: 0.0% (9.2ms) | Total: 0.0% (9.2ms) | Samples: 8

**Called by:**
- `(anonymous)` (3)
- `map` (3)
- `seedSenderIdentityRow` (1)
- `(anonymous)` (1)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts` | Self: 0.0% (9.1ms) | Total: 0.0% (9.1ms) | Samples: 4

**Called by:**
- `async buildFixture` (4)

### `async createTopic`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts` | Self: 0.0% (9.1ms) | Total: 0.0% (9.1ms) | Samples: 1

**Called by:**
- `async createTopic` (1)

### `createExpressionBuilder`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:32` | Self: 0.0% (9.1ms) | Total: 0.0% (9.1ms) | Samples: 8

**Called by:**
- `parseAliasedExpression` (8)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:647` | Self: 0.0% (9.0ms) | Total: 14.9% (2.72s) | Samples: 8

**Called by:**
- `forEach` (2333)

**Calls:**
- `forEach` (2325)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:206` | Self: 0.0% (8.9ms) | Total: 0.0% (8.9ms) | Samples: 8

**Called by:**
- `async withAccountDb` (8)

### `init`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:51` | Self: 0.0% (8.9ms) | Total: 0.0% (8.9ms) | Samples: 2

**Called by:**
- `(anonymous)` (1)
- `ZodString` (1)

### `_collapseAtSpacing`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:273` | Self: 0.0% (8.9ms) | Total: 0.0% (8.9ms) | Samples: 8

**Called by:**
- `map` (5)
- `_recoverAddrSpec` (3)

### `bump`
`/tmp/spike-switch-server/sqlcounter.ts:53` | Self: 0.0% (8.8ms) | Total: 0.0% (8.8ms) | Samples: 8

**Called by:**
- `(anonymous)` (4)
- `(anonymous)` (2)
- `(anonymous)` (2)

### `transformWhereClause`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` | Self: 0.0% (8.7ms) | Total: 0.0% (8.7ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `Map`
`[native code]` | Self: 0.0% (8.7ms) | Total: 0.0% (8.7ms) | Samples: 7

**Called by:**
- `getThreadCollabStates` (4)
- `(anonymous)` (1)
- `async (anonymous)` (1)
- `async (anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:84` | Self: 0.0% (8.6ms) | Total: 0.1% (30.9ms) | Samples: 6

**Calls:**
- `async internalHandler` (10)
- `cloneObject` (7)

### `Tokenizer`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` | Self: 0.0% (8.5ms) | Total: 0.0% (8.5ms) | Samples: 8

**Called by:**
- `_parseAddressList` (8)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:182` | Self: 0.0% (8.4ms) | Total: 1.8% (337.7ms) | Samples: 7

**Called by:**
- `flatIntoArrayWithCallback` (285)

**Calls:**
- `shouldIgnoreTopicSuggestionSignal` (244)
- `shouldIgnoreTopicSuggestionSignal` (31)
- `shouldIgnoreTopicSuggestionSignal` (2)
- `shouldIgnoreTopicSuggestionSignal` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2523` | Self: 0.0% (8.4ms) | Total: 0.0% (8.4ms) | Samples: 6

**Called by:**
- `forEach` (6)

### `transformQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:16` | Self: 0.0% (8.1ms) | Total: 0.0% (8.1ms) | Samples: 1

**Called by:**
- `compile` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:663` | Self: 0.0% (7.9ms) | Total: 0.0% (7.9ms) | Samples: 2

**Called by:**
- `forEach` (2)

### `async findOne`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:504` | Self: 0.0% (7.7ms) | Total: 0.0% (8.7ms) | Samples: 6

**Called by:**
- `async findOne` (6)

**Calls:**
- `convertWhereClause` (1)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:96` | Self: 0.0% (7.7ms) | Total: 8.0% (1.46s) | Samples: 7

**Called by:**
- `async getAccountById` (201)
- `async listThreads` (129)
- `async getMessageCalendarInviteDataByMessageId` (105)
- `getTopicSuggestionsForThreadSignalBatch` (76)
- `executeQuery` (65)
- `readUserById` (52)
- `async listThreads` (44)
- `async listThreads` (41)
- `(anonymous)` (41)
- `getThreadCollabStates` (37)
- `async getThreadGroupCounts` (36)
- `async listThreads` (29)
- `getTopicSuggestionSignalsForThreadsFromDb` (26)
- `async getTotalCount` (22)
- `async getAccountOwnAddresses` (16)
- `enrollmentState` (16)
- `(anonymous)` (13)
- `upsertTopicLearningSignalsForThreadIds` (13)
- `upsertTopicLearningSignalsForThreadIds` (10)
- `(anonymous)` (10)
- `async requireActiveUserSession` (9)
- `(anonymous)` (9)
- `(anonymous)` (8)
- `getTopicSignalExclusionSet` (8)
- `async requireActiveUserSession` (6)
- `async assertAccountFolder` (5)
- `async requireActiveUserSession` (5)
- `(anonymous)` (3)
- `async recomputeThreadsForAccountInternal` (2)
- `ensureCalendarEventOptionalColumns` (1)
- `async (anonymous)` (1)
- `ensureTableColumns` (1)
- `schemaSql` (1)
- `async (anonymous)` (1)

**Calls:**
- `prepare` (1035)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2615` | Self: 0.0% (7.6ms) | Total: 0.0% (7.6ms) | Samples: 7

**Called by:**
- `map` (7)

### `parseAddressEmails`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:42` | Self: 0.0% (7.5ms) | Total: 0.0% (7.5ms) | Samples: 7

**Called by:**
- `isOwnAddress` (7)

### `_parseAddressList`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1155` | Self: 0.0% (7.5ms) | Total: 0.5% (93.1ms) | Samples: 5

**Called by:**
- `addressparser` (79)

**Calls:**
- `tokenize` (61)
- `Tokenizer` (8)
- `Tokenizer` (4)
- `tokenize` (1)

### `toString`
`[native code]` | Self: 0.0% (7.3ms) | Total: 0.0% (7.3ms) | Samples: 6

**Called by:**
- `decodeSecret` (6)

### `internal:shared`
`internal:shared:2` | Self: 0.0% (7.2ms) | Total: 0.0% (7.2ms) | Samples: 1

**Called by:**
- `anonymous` (1)

### `Date`
`[native code]` | Self: 0.0% (7.2ms) | Total: 0.0% (7.2ms) | Samples: 6

**Called by:**
- `buildMessageGroupKey` (3)
- `buildTimeGroupKey` (2)
- `async (anonymous)` (1)

### `/^[\p{L}\p{M}\p{N}.-]+$/u`
`[native code]` | Self: 0.0% (7.1ms) | Total: 0.0% (7.1ms) | Samples: 6

**Called by:**
- `normalizeIdentityEmail` (6)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:83` | Self: 0.0% (7.0ms) | Total: 0.0% (7.0ms) | Samples: 6

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:209` | Self: 0.0% (7.0ms) | Total: 0.0% (11.5ms) | Samples: 2

**Called by:**
- `async (anonymous)` (5)

**Calls:**
- `getHooks` (3)
- `getHooks` (1)

### `addressparser`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1199` | Self: 0.0% (7.0ms) | Total: 0.9% (175.4ms) | Samples: 6

**Called by:**
- `parseAddressEmails` (150)

**Calls:**
- `_parseAddressList` (79)
- `_parseAddressList` (60)
- `reverse` (4)
- `_parseAddressList` (1)

### `ensureSenderIdentityMessageRuntimeSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts` | Self: 0.0% (6.9ms) | Total: 0.0% (6.9ms) | Samples: 6

**Called by:**
- `async getAccountDb` (6)

### `_handleAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:743` | Self: 0.0% (6.9ms) | Total: 0.0% (6.9ms) | Samples: 6

**Called by:**
- `_parseAddressList` (6)

### `getOwnAddresses`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:55` | Self: 0.0% (6.9ms) | Total: 0.0% (15.2ms) | Samples: 6

**Called by:**
- `async getAccountById` (9)
- `async ensureCalendarEventRuntimeData` (3)
- `async (anonymous)` (1)

**Calls:**
- `Set` (7)

### `tokenize`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:836` | Self: 0.0% (6.9ms) | Total: 0.3% (70.8ms) | Samples: 6

**Called by:**
- `_parseAddressList` (61)

**Calls:**
- `checkChar` (54)
- `charAt` (1)

### `final`
`[native code]` | Self: 0.0% (6.8ms) | Total: 0.0% (6.8ms) | Samples: 5

**Called by:**
- `final` (5)

### `getEnvVar`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/env-impl.mjs:41` | Self: 0.0% (6.8ms) | Total: 0.0% (6.8ms) | Samples: 4

**Called by:**
- `getColorDepth` (2)
- `getColorDepth` (1)
- `getColorDepth` (1)

### `bump`
`/tmp/spike-switch-server/sqlcounter.ts:54` | Self: 0.0% (6.8ms) | Total: 0.0% (6.8ms) | Samples: 4

**Called by:**
- `(anonymous)` (3)
- `(anonymous)` (1)

### `query`
`bun:sqlite:384` | Self: 0.0% (6.7ms) | Total: 0.0% (6.7ms) | Samples: 5

**Called by:**
- `(anonymous)` (5)

### `trim`
`[native code]` | Self: 0.0% (6.7ms) | Total: 0.0% (6.7ms) | Samples: 6

**Called by:**
- `applySearchQueryFilters` (2)
- `mapUserRow` (1)
- `rememberTopicLearningForThread` (1)
- `async enrichMessagesWithThreadTopics` (1)
- `async getAccountIdFromParams` (1)

### `(anonymous)`
`/tmp/spike-switch-server/anatomy.ts:75` | Self: 0.0% (6.6ms) | Total: 0.2% (42.6ms) | Samples: 6

**Called by:**
- `async time` (35)
- `async time` (2)

**Calls:**
- `buildTimeGroupKey` (19)
- `buildTimeGroupKey` (6)
- `buildTimeGroupKey` (6)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:97` | Self: 0.0% (6.6ms) | Total: 0.3% (59.5ms) | Samples: 6

**Called by:**
- `async listThreads` (8)
- `async getAccountById` (7)
- `async listThreads` (5)
- `getTopicSuggestionsForThreadSignalBatch` (5)
- `async listThreads` (4)
- `async getMessageCalendarInviteDataByMessageId` (4)
- `getTopicSuggestionSignalsForThreadsFromDb` (3)
- `async getThreadGroupCounts` (3)
- `async getAccountOwnAddresses` (2)
- `readUserById` (2)
- `executeQuery` (1)
- `async listThreads` (1)
- `async getTotalCount` (1)
- `enrollmentState` (1)
- `(anonymous)` (1)
- `getThreadCollabStates` (1)
- `(anonymous)` (1)

**Calls:**
- `addMs` (42)
- `addMs` (2)

### `concat`
`[native code]` | Self: 0.0% (6.4ms) | Total: 0.0% (6.4ms) | Samples: 6

**Called by:**
- `decryptPayload` (6)

### `topicSuggestionSignalEntries`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:104` | Self: 0.0% (6.3ms) | Total: 0.0% (12.0ms) | Samples: 5

**Called by:**
- `(anonymous)` (10)

**Calls:**
- `map` (5)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:161` | Self: 0.0% (6.2ms) | Total: 0.0% (6.2ms) | Samples: 4

**Called by:**
- `async transformSingleOutput` (4)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:78` | Self: 0.0% (6.1ms) | Total: 0.0% (6.1ms) | Samples: 5

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:573` | Self: 0.0% (6.1ms) | Total: 0.0% (6.1ms) | Samples: 1

**Called by:**
- `async findOne` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadCollab.ts:9` | Self: 0.0% (6.0ms) | Total: 0.0% (6.0ms) | Samples: 5

**Called by:**
- `map` (5)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:233` | Self: 0.0% (6.0ms) | Total: 0.0% (6.0ms) | Samples: 1

**Called by:**
- `run` (1)

### `throwForMissingRequestStore`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/work-unit-async-storage.external.js:88` | Self: 0.0% (6.0ms) | Total: 0.0% (7.1ms) | Samples: 5

**Called by:**
- `headers` (6)

**Calls:**
- `Error` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:17` | Self: 0.0% (5.9ms) | Total: 0.0% (5.9ms) | Samples: 4

### `normalizeIdentityEmail`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:11` | Self: 0.0% (5.8ms) | Total: 0.0% (10.9ms) | Samples: 5

**Called by:**
- `map` (5)
- `(anonymous)` (2)
- `(anonymous)` (1)

**Calls:**
- ``/^[A-Za-z0-9.!#$%&'*+\/=?^_`{\|}~-]+$/`` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:653` | Self: 0.0% (5.8ms) | Total: 0.0% (5.8ms) | Samples: 5

**Called by:**
- `forEach` (5)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:19` | Self: 0.0% (5.8ms) | Total: 0.0% (5.8ms) | Samples: 4

### `normalizeIdentityEmail`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:10` | Self: 0.0% (5.6ms) | Total: 0.0% (12.8ms) | Samples: 5

**Called by:**
- `map` (5)
- `(anonymous)` (4)
- `(anonymous)` (1)
- `(anonymous)` (1)

**Calls:**
- `/^[\p{L}\p{M}\p{N}.-]+$/u` (6)

### `topicSuggestionSignalKey`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:553` | Self: 0.0% (5.5ms) | Total: 0.0% (5.5ms) | Samples: 5

**Called by:**
- `(anonymous)` (4)
- `(anonymous)` (1)

### `compare`
`[native code]` | Self: 0.0% (5.4ms) | Total: 0.0% (5.4ms) | Samples: 5

**Called by:**
- `(anonymous)` (4)
- `(anonymous)` (1)

### `async releaseConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:67` | Self: 0.0% (5.4ms) | Total: 0.0% (6.4ms) | Samples: 1

**Called by:**
- `async provideConnection` (2)

**Calls:**
- `async releaseConnection` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:588` | Self: 0.0% (5.4ms) | Total: 0.0% (5.4ms) | Samples: 5

**Called by:**
- `forEach` (5)

### `parseCookies`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:35` | Self: 0.0% (5.4ms) | Total: 0.0% (5.4ms) | Samples: 5

**Called by:**
- `async (anonymous)` (5)

### `normalize`
`/tmp/spike-switch-server/anatomy.ts:57` | Self: 0.0% (5.4ms) | Total: 0.2% (39.7ms) | Samples: 5

**Called by:**
- `(module)` (18)
- `map` (17)
- `normalize` (1)

**Calls:**
- `map` (28)
- `normalize` (1)
- `normalize` (1)
- `normalize` (1)

### `async GET`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:48` | Self: 0.0% (5.4ms) | Total: 0.0% (6.6ms) | Samples: 5

**Called by:**
- `async GET` (6)

**Calls:**
- `URL` (1)

### `replace`
`[native code]` | Self: 0.0% (5.4ms) | Total: 0.0% (5.4ms) | Samples: 5

**Called by:**
- `parseSearchInput` (2)
- `toRegExp` (1)
- `normalizedSql` (1)
- `normalizeShardSql` (1)

### `untpl`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:152` | Self: 0.0% (5.3ms) | Total: 0.0% (5.3ms) | Samples: 4

**Called by:**
- `compile` (4)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:94` | Self: 0.0% (5.3ms) | Total: 0.4% (73.7ms) | Samples: 4

**Called by:**
- `async listThreads` (10)
- `async getAccountById` (6)
- `async getThreadGroupCounts` (6)
- `getTopicSuggestionsForThreadSignalBatch` (6)
- `executeQuery` (5)
- `async getMessageCalendarInviteDataByMessageId` (4)
- `(anonymous)` (4)
- `async getAccountOwnAddresses` (3)
- `async listThreads` (2)
- `async listThreads` (2)
- `readUserById` (2)
- `async getTotalCount` (2)
- `async requireActiveUserSession` (2)
- `(anonymous)` (1)
- `async requireActiveUserSession` (1)
- `async listThreads` (1)
- `enrollmentState` (1)
- `(anonymous)` (1)

**Calls:**
- `bump` (40)
- `bump` (9)
- `bump` (3)
- `bump` (2)
- `bump` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:8` | Self: 0.0% (5.3ms) | Total: 0.0% (7.2ms) | Samples: 3

**Called by:**
- `async createInternalContext` (4)

**Calls:**
- `Headers` (2)

### ``/^[A-Za-z0-9.!#$%&'*+\/=?^_`{\|}~-]+$/``
`[native code]` | Self: 0.0% (5.0ms) | Total: 0.0% (5.0ms) | Samples: 3

**Called by:**
- `normalizeIdentityEmail` (3)

### `asyncFunctionDrive`
`[native code]` | Self: 0.0% (4.9ms) | Total: 0.0% (4.9ms) | Samples: 4

**Called by:**
- `async lock` (1)
- `async (anonymous)` (1)
- `async resolveAccountDbPath` (1)
- `async enrichMessagesWithThreadTopics` (1)

### `base32Decode`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/tests/helpers/totp.ts` | Self: 0.0% (4.9ms) | Total: 0.0% (4.9ms) | Samples: 1

**Called by:**
- `totpFromUri` (1)

### `Request`
`[native code]` | Self: 0.0% (4.8ms) | Total: 0.0% (4.8ms) | Samples: 3

**Called by:**
- `rq` (3)

### `async runValidation`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/validator.mjs` | Self: 0.0% (4.8ms) | Total: 0.0% (4.8ms) | Samples: 3

**Called by:**
- `async runValidation` (3)

### `reverse`
`[native code]` | Self: 0.0% (4.8ms) | Total: 0.0% (4.8ms) | Samples: 4

**Called by:**
- `addressparser` (4)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs` | Self: 0.0% (4.8ms) | Total: 0.0% (4.8ms) | Samples: 1

**Called by:**
- `async serializeSignedCookie` (1)

### `async getAccountOwnAddresses`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/senderIdentities.ts:22` | Self: 0.0% (4.7ms) | Total: 0.1% (27.0ms) | Samples: 4

**Called by:**
- `async getTotalCount` (2)
- `async listThreads` (1)
- `async rebuildThreadSignalsForThreadIds` (1)

**Calls:**
- `listSenderIdentityRows` (10)
- `getOwnAddresses` (6)
- `async getAccountOwnAddresses` (2)
- `listSenderIdentityRows` (1)
- `getOwnAddresses` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:46` | Self: 0.0% (4.7ms) | Total: 0.4% (81.4ms) | Samples: 4

**Called by:**
- `flatIntoArrayWithCallback` (66)

**Calls:**
- `normalizeIdentityEmail` (24)
- `normalizeIdentityEmail` (14)
- `normalizeIdentityEmail` (7)
- `normalizeIdentityEmail` (6)
- `normalizeIdentityEmail` (5)
- `normalizeIdentityEmail` (3)
- `normalizeIdentityEmail` (2)
- `normalizeIdentityEmail` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2507` | Self: 0.0% (4.7ms) | Total: 1.2% (227.2ms) | Samples: 4

**Calls:**
- `(anonymous)` (184)
- `(anonymous)` (3)
- `(anonymous)` (1)

### `async findMany`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` | Self: 0.0% (4.6ms) | Total: 0.0% (4.6ms) | Samples: 1

**Called by:**
- `async deleteWithHooks` (1)

### `encode`
`[native code]` | Self: 0.0% (4.6ms) | Total: 0.0% (4.6ms) | Samples: 4

**Called by:**
- `async (anonymous)` (4)

### `getOwnAddresses`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:56` | Self: 0.0% (4.6ms) | Total: 0.0% (9.3ms) | Samples: 4

**Called by:**
- `async getAccountById` (6)
- `async (anonymous)` (1)
- `async ensureCalendarEventRuntimeData` (1)

**Calls:**
- `filter` (2)
- `map` (2)

### `__getBetterAuthGlobal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/global.mjs:17` | Self: 0.0% (4.6ms) | Total: 0.0% (4.6ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:621` | Self: 0.0% (4.6ms) | Total: 0.0% (4.6ms) | Samples: 4

**Called by:**
- `forEach` (4)

### `normalizeIdentityEmail`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:6` | Self: 0.0% (4.5ms) | Total: 0.0% (7.0ms) | Samples: 4

**Called by:**
- `(anonymous)` (3)
- `map` (2)
- `(anonymous)` (1)

**Calls:**
- `/[\x00-\x1f\x7f]/` (2)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:95` | Self: 0.0% (4.5ms) | Total: 0.0% (4.5ms) | Samples: 4

**Called by:**
- `executeQuery` (1)
- `(anonymous)` (1)
- `async getAccountById` (1)
- `getTopicSuggestionSignalsForThreadsFromDb` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:198` | Self: 0.0% (4.5ms) | Total: 0.0% (4.5ms) | Samples: 4

**Called by:**
- `map` (4)

### `async findOne`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:503` | Self: 0.0% (4.5ms) | Total: 0.0% (4.5ms) | Samples: 3

**Called by:**
- `(anonymous)` (3)

### `/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/`
`[native code]` | Self: 0.0% (4.5ms) | Total: 0.0% (4.5ms) | Samples: 3

**Called by:**
- `(anonymous)` (3)

### `bound visitFrom`
`[native code]` | Self: 0.0% (4.5ms) | Total: 0.1% (34.4ms) | Samples: 1

**Called by:**
- `visitNode` (13)

**Calls:**
- `visitFrom` (12)

### `compileQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:29` | Self: 0.0% (4.5ms) | Total: 0.0% (4.5ms) | Samples: 4

**Called by:**
- `async execute` (4)

### `subarray`
`[native code]` | Self: 0.0% (4.5ms) | Total: 0.0% (4.5ms) | Samples: 4

**Called by:**
- `decryptPayload` (4)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts` | Self: 0.0% (4.4ms) | Total: 0.0% (4.4ms) | Samples: 4

**Called by:**
- `map` (4)

### `signUpEmail`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/sign-up.mjs` | Self: 0.0% (4.4ms) | Total: 0.0% (4.4ms) | Samples: 1

**Called by:**
- `getEndpoints` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs` | Self: 0.0% (4.4ms) | Total: 0.0% (4.4ms) | Samples: 2

**Called by:**
- `run` (1)
- `flatIntoArrayWithCallback` (1)

### `init`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js` | Self: 0.0% (4.4ms) | Total: 0.0% (4.4ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:369` | Self: 0.0% (4.4ms) | Total: 0.0% (12.5ms) | Samples: 4

**Called by:**
- `async getAccountDb` (7)

**Calls:**
- `async resolveAccountDbPath` (7)

### `async getDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:293` | Self: 0.0% (4.3ms) | Total: 0.0% (4.3ms) | Samples: 4

**Called by:**
- `async getDb` (4)

### `isOwnAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:61` | Self: 0.0% (4.3ms) | Total: 0.7% (131.8ms) | Samples: 4

**Called by:**
- `shouldIgnoreTopicSuggestionSignalUncached` (55)
- `shouldIgnoreTopicSuggestionSignalUncached` (28)
- `(anonymous)` (16)
- `(anonymous)` (11)

**Calls:**
- `map` (96)
- `Set` (10)

### `roleAtLeast`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/accountRole.ts:5` | Self: 0.0% (4.3ms) | Total: 0.0% (4.3ms) | Samples: 4

**Called by:**
- `async requireAccountContext` (4)

### `async ensureCalendarEventRuntimeData`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:665` | Self: 0.0% (4.3ms) | Total: 0.0% (4.3ms) | Samples: 4

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/api/index.mjs:59` | Self: 0.0% (4.2ms) | Total: 0.0% (5.5ms) | Samples: 1

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `async (anonymous)` (1)

### `bump`
`/tmp/spike-switch-server/sqlcounter.ts:48` | Self: 0.0% (4.2ms) | Total: 0.0% (4.2ms) | Samples: 4

**Called by:**
- `(anonymous)` (3)
- `(anonymous)` (1)

### `_handleAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:697` | Self: 0.0% (4.1ms) | Total: 0.0% (5.2ms) | Samples: 4

**Called by:**
- `_parseAddressList` (5)

**Calls:**
- `(unknown)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:627` | Self: 0.0% (4.1ms) | Total: 0.0% (4.1ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `toLowerCase`
`[native code]` | Self: 0.0% (4.0ms) | Total: 0.0% (4.0ms) | Samples: 4

**Called by:**
- `expr` (1)
- `applyBadgeFilters` (1)
- `(anonymous)` (1)
- `applyBadgeFilters` (1)

### `async runAfterHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs` | Self: 0.0% (4.0ms) | Total: 0.0% (4.0ms) | Samples: 1

**Called by:**
- `async runAfterHooks` (1)

### `sanitizeIdentifier`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:1363` | Self: 0.0% (3.8ms) | Total: 0.0% (3.8ms) | Samples: 3

**Called by:**
- `compileUnwrappedIdentifier` (3)

### `createFunctionModule`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/function-module.js:19` | Self: 0.0% (3.8ms) | Total: 0.0% (3.8ms) | Samples: 3

**Called by:**
- `createExpressionBuilder` (3)

### `defaultThreadCollabState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts:54` | Self: 0.0% (3.8ms) | Total: 0.0% (3.8ms) | Samples: 3

**Called by:**
- `(anonymous)` (3)

### `closeAccountDbConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts` | Self: 0.0% (3.8ms) | Total: 0.0% (3.8ms) | Samples: 1

**Called by:**
- `async buildFixture` (1)

### `TokenList`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` | Self: 0.0% (3.7ms) | Total: 0.0% (3.7ms) | Samples: 3

**Called by:**
- `Tokenizer` (3)

### `set`
`[native code]` | Self: 0.0% (3.7ms) | Total: 0.0% (3.7ms) | Samples: 3

**Called by:**
- `(anonymous)` (2)
- `getThreadCollabStates` (1)

### `createExpressionBuilder`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:73` | Self: 0.0% (3.6ms) | Total: 0.0% (3.6ms) | Samples: 2

**Called by:**
- `parseAliasedExpression` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/middleware.mjs` | Self: 0.0% (3.6ms) | Total: 0.0% (3.6ms) | Samples: 3

**Called by:**
- `async internalHandler` (3)

### `some`
`[native code]` | Self: 0.0% (3.6ms) | Total: 0.1% (20.6ms) | Samples: 3

**Called by:**
- `isOwnAddress` (5)
- `(anonymous)` (2)
- `shouldIgnoreTopicSuggestionSignalUncached` (2)
- `shouldIgnoreTopicSuggestionSignalUncached` (1)
- `(anonymous)` (1)
- `deriveSystemFlagState` (1)
- `(anonymous)` (1)
- `ensureAccountKeySchema` (1)
- `ftsNeedsRebuild` (1)
- `deriveSystemFlagState` (1)

**Calls:**
- `(anonymous)` (10)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `needsRebuild` (1)

### `_recoverAddrSpec`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:368` | Self: 0.0% (3.6ms) | Total: 0.0% (4.6ms) | Samples: 3

**Called by:**
- `_handleAddress` (4)

**Calls:**
- `/\s/` (1)

### `async transformOutput`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:216` | Self: 0.0% (3.6ms) | Total: 0.1% (24.6ms) | Samples: 2

**Called by:**
- `async (anonymous)` (17)
- `async (anonymous)` (1)

**Calls:**
- `async (anonymous)` (13)
- `async (anonymous)` (2)
- `async (anonymous)` (1)

### `ResponseCookies`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/@edge-runtime/cookies/index.js:256` | Self: 0.0% (3.6ms) | Total: 0.0% (3.6ms) | Samples: 3

**Called by:**
- `NextResponse` (3)

### `applyBadgeFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:877` | Self: 0.0% (3.6ms) | Total: 0.0% (3.6ms) | Samples: 3

**Called by:**
- `async listThreads` (2)
- `async getTotalCount` (1)

### `is`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/set-operation-node.js` | Self: 0.0% (3.6ms) | Total: 0.0% (3.6ms) | Samples: 1

**Called by:**
- `visitSelectQuery` (1)

### `join`
`[native code]` | Self: 0.0% (3.6ms) | Total: 0.0% (3.6ms) | Samples: 3

**Called by:**
- `async listThreads` (1)
- `getDatabaseIndexName` (1)
- `rq` (1)

### `visitAlias`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js` | Self: 0.0% (3.6ms) | Total: 0.0% (3.6ms) | Samples: 1

**Called by:**
- `bound visitAlias` (1)

### `keys`
`[native code]` | Self: 0.0% (3.5ms) | Total: 0.0% (3.5ms) | Samples: 3

**Called by:**
- `transformJoinClause` (1)
- `_interopNamespaceDefault` (1)
- `_defu` (1)

### `async acquireAuthLifetimeLock`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authLifetimeLock.ts` | Self: 0.0% (3.5ms) | Total: 0.0% (3.5ms) | Samples: 1

**Called by:**
- `async ensureAuthLifetimeLock` (1)

### `WeakSet`
`[native code]` | Self: 0.0% (3.5ms) | Total: 0.0% (3.5ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts` | Self: 0.0% (3.5ms) | Total: 0.0% (3.5ms) | Samples: 3

**Called by:**
- `map` (3)

### `async requireActiveUserSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts` | Self: 0.0% (3.5ms) | Total: 0.0% (3.5ms) | Samples: 2

**Called by:**
- `async requireAccountContext` (1)
- `async requireActiveUserSession` (1)

### `async get`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:39` | Self: 0.0% (3.5ms) | Total: 0.0% (4.8ms) | Samples: 3

**Called by:**
- `async (anonymous)` (4)

**Calls:**
- `async get` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs:11` | Self: 0.0% (3.5ms) | Total: 0.0% (3.5ms) | Samples: 2

**Called by:**
- `reduce` (2)

### `normalizeIdentityEmail`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:15` | Self: 0.0% (3.4ms) | Total: 0.0% (3.4ms) | Samples: 3

**Called by:**
- `map` (2)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:690` | Self: 0.0% (3.4ms) | Total: 0.0% (3.4ms) | Samples: 1

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:81` | Self: 0.0% (3.4ms) | Total: 0.0% (3.4ms) | Samples: 3

**Called by:**
- `listSenderIdentityRows` (1)
- `(anonymous)` (1)
- `async resolveAccountDbPath` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:181` | Self: 0.0% (3.4ms) | Total: 0.0% (3.4ms) | Samples: 3

**Called by:**
- `flatIntoArrayWithCallback` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts` | Self: 0.0% (3.4ms) | Total: 0.0% (3.4ms) | Samples: 3

**Called by:**
- `map` (2)
- `forEach` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:620` | Self: 0.0% (3.3ms) | Total: 0.0% (4.5ms) | Samples: 3

**Called by:**
- `forEach` (4)

**Calls:**
- `get` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:236` | Self: 0.0% (3.3ms) | Total: 0.9% (167.3ms) | Samples: 2

**Called by:**
- `map` (6)

**Calls:**
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `async (anonymous)`
`/tmp/spike-switch-server/anatomy.ts` | Self: 0.0% (3.3ms) | Total: 0.0% (3.3ms) | Samples: 2

**Called by:**
- `async time` (1)
- `async time` (1)

### `init`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:65` | Self: 0.0% (3.3ms) | Total: 0.2% (53.4ms) | Samples: 1

**Called by:**
- `ZodObject` (2)
- `ZodOptional` (2)
- `ZodString` (2)
- `ZodBoolean` (2)
- `ZodEmail` (2)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `ZodNullable` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `ZodXor` (1)
- `ZodEnum` (1)
- `(anonymous)` (1)
- `ZodIPv6` (1)
- `ZodNumber` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `ZodArray` (1)

**Calls:**
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `shouldIgnoreTopicSuggestionSignalUncached`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:143` | Self: 0.0% (3.3ms) | Total: 0.0% (3.3ms) | Samples: 3

**Called by:**
- `shouldIgnoreTopicSuggestionSignal` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:257` | Self: 0.0% (3.3ms) | Total: 0.0% (3.3ms) | Samples: 3

**Called by:**
- `map` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:179` | Self: 0.0% (3.3ms) | Total: 0.0% (3.3ms) | Samples: 3

**Called by:**
- `flatIntoArrayWithCallback` (3)

### `addMs`
`/tmp/spike-switch-server/sqlcounter.ts` | Self: 0.0% (3.3ms) | Total: 0.0% (3.3ms) | Samples: 2

**Called by:**
- `(anonymous)` (1)
- `(anonymous)` (1)

### `async getMessageCalendarInviteDataByMessageId`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:192` | Self: 0.0% (3.3ms) | Total: 0.6% (112.6ms) | Samples: 3

**Called by:**
- `async listThreads` (98)

**Calls:**
- `(anonymous)` (87)
- `(anonymous)` (4)
- `(anonymous)` (4)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:584` | Self: 0.0% (3.2ms) | Total: 0.0% (3.2ms) | Samples: 3

**Called by:**
- `forEach` (3)

### `install`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/storage.ts:258` | Self: 0.0% (3.2ms) | Total: 0.0% (3.2ms) | Samples: 3

**Called by:**
- `(anonymous)` (3)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs:193` | Self: 0.0% (3.2ms) | Total: 0.0% (11.9ms) | Samples: 1

**Calls:**
- `_email` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:180` | Self: 0.0% (3.2ms) | Total: 0.0% (3.2ms) | Samples: 3

**Called by:**
- `flatIntoArrayWithCallback` (3)

### `async createInternalContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:7` | Self: 0.0% (3.2ms) | Total: 0.0% (3.2ms) | Samples: 3

**Called by:**
- `async (anonymous)` (3)

### `defineBound`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:771` | Self: 0.0% (3.2ms) | Total: 0.0% (3.2ms) | Samples: 3

**Called by:**
- `members` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs:9` | Self: 0.0% (3.1ms) | Total: 0.0% (4.5ms) | Samples: 1

**Called by:**
- `filter` (1)
- `reduce` (1)

**Calls:**
- `cloneObject` (1)

### `normalizeAccountSettings`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/accountSettings.ts:5` | Self: 0.0% (3.1ms) | Total: 0.1% (26.1ms) | Samples: 3

**Called by:**
- `mapAccountRow` (22)

**Calls:**
- `stringify` (17)
- `parse` (2)

### `buildMessageGroupKey`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/messageGrouping.ts:71` | Self: 0.0% (3.1ms) | Total: 0.4% (73.3ms) | Samples: 3

**Called by:**
- `buildGroupKey` (48)
- `(anonymous)` (16)

**Calls:**
- `displayDayNumber` (42)
- `displayDayNumber` (9)
- `displayDayNumber` (7)
- `Date` (3)

### `loadNextHeadersModule`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs` | Self: 0.0% (3.1ms) | Total: 0.0% (3.1ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `Headers`
`[native code]` | Self: 0.0% (3.1ms) | Total: 0.0% (3.1ms) | Samples: 3

**Called by:**
- `async (anonymous)` (2)
- `async dispatchAuthEndpoint` (1)

### `getSharedDbHarnessState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testDbHarness.ts` | Self: 0.0% (3.1ms) | Total: 0.0% (3.1ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:394` | Self: 0.0% (3.0ms) | Total: 0.0% (3.0ms) | Samples: 3

### `getThreadCollabStates`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts:76` | Self: 0.0% (3.0ms) | Total: 0.5% (107.4ms) | Samples: 3

**Called by:**
- `async getThreadCollabStates` (92)

**Calls:**
- `(anonymous)` (81)
- `map` (4)
- `(anonymous)` (2)
- `(anonymous)` (2)

### `getOwnAddresses`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:52` | Self: 0.0% (3.0ms) | Total: 0.0% (3.0ms) | Samples: 3

**Called by:**
- `async getAccountById` (2)
- `async getAccountOwnAddresses` (1)

### `shouldIgnoreTopicSuggestionSignalUncached`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:135` | Self: 0.0% (3.0ms) | Total: 0.0% (3.0ms) | Samples: 3

**Called by:**
- `shouldIgnoreTopicSuggestionSignal` (3)

### `mapAccountRow`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts:183` | Self: 0.0% (3.0ms) | Total: 0.0% (3.9ms) | Samples: 2

**Called by:**
- `async getAccountById` (3)

**Calls:**
- `Boolean` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` | Self: 0.0% (3.0ms) | Total: 0.0% (3.0ms) | Samples: 2

**Called by:**
- `filter` (1)
- `(anonymous)` (1)

### `meta`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:108` | Self: 0.0% (3.0ms) | Total: 0.0% (7.7ms) | Samples: 1

**Called by:**
- `bound meta` (2)

**Calls:**
- `bound clone` (1)

### `reallyExit`
`[native code]` | Self: 0.0% (3.0ms) | Total: 0.0% (3.0ms) | Samples: 1

**Called by:**
- `exit` (1)

### `createExpressionBuilder`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:25` | Self: 0.0% (2.9ms) | Total: 0.0% (2.9ms) | Samples: 1

**Called by:**
- `parseAliasedExpression` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:581` | Self: 0.0% (2.9ms) | Total: 0.5% (90.9ms) | Samples: 2

**Called by:**
- `forEach` (76)

**Calls:**
- `forEach` (39)
- `topicSuggestionSignalEntries` (10)
- `topicSuggestionSignalEntries` (9)
- `topicSuggestionSignalEntries` (6)
- `topicSuggestionSignalEntries` (5)
- `topicSuggestionSignalEntries` (5)

### `split`
`[native code]` | Self: 0.0% (2.7ms) | Total: 0.0% (2.7ms) | Samples: 2

**Called by:**
- `(module)` (1)
- `(module)` (1)

### `parseStringReference`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js:45` | Self: 0.0% (2.7ms) | Total: 0.0% (2.7ms) | Samples: 1

**Called by:**
- `parseValueBinaryOperation` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts` | Self: 0.0% (2.7ms) | Total: 0.0% (2.7ms) | Samples: 2

**Called by:**
- `map` (1)
- `forEach` (1)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:102` | Self: 0.0% (2.6ms) | Total: 0.1% (19.8ms) | Samples: 2

**Called by:**
- `listSenderIdentityRows` (7)
- `async resolveAccountDbPath` (7)
- `resolveAccountRoleRow` (2)

**Calls:**
- `query` (5)
- `query` (4)
- `query` (3)
- `query` (1)
- `query` (1)

### `async enrichMessagesWithThreadCollab`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadCollab.ts:8` | Self: 0.0% (2.6ms) | Total: 0.1% (20.6ms) | Samples: 2

**Called by:**
- `async enrichMessagesWithThreadCollab` (16)

**Calls:**
- `filter` (15)

### `_handleAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:682` | Self: 0.0% (2.6ms) | Total: 0.0% (17.1ms) | Samples: 2

**Called by:**
- `_parseAddressList` (14)

**Calls:**
- `map` (12)

### `prepareAccountShardConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts` | Self: 0.0% (2.6ms) | Total: 0.0% (2.6ms) | Samples: 1

**Called by:**
- `configureAccountDb` (1)

### `sanitizeIdentifier`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:1364` | Self: 0.0% (2.6ms) | Total: 0.0% (2.6ms) | Samples: 2

**Called by:**
- `compileUnwrappedIdentifier` (2)

### `[Symbol.toPrimitive]`
`[native code]` | Self: 0.0% (2.6ms) | Total: 0.0% (2.6ms) | Samples: 2

**Called by:**
- `async (anonymous)` (2)

### `addMs`
`/tmp/spike-switch-server/sqlcounter.ts:60` | Self: 0.0% (2.6ms) | Total: 0.0% (2.6ms) | Samples: 2

**Called by:**
- `(anonymous)` (2)

### `columnNames`
`bun:sqlite:198` | Self: 0.0% (2.6ms) | Total: 0.0% (2.6ms) | Samples: 2

**Called by:**
- `executeQuery` (2)

### `newResolvedPromise`
`[native code]` | Self: 0.0% (2.6ms) | Total: 0.0% (2.6ms) | Samples: 2

**Called by:**
- `async (anonymous)` (1)
- `async getMessageCalendarInviteDataByMessageId` (1)

### `async lock`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:81` | Self: 0.0% (2.5ms) | Total: 0.0% (5.4ms) | Samples: 2

**Called by:**
- `async acquireConnection` (4)

**Calls:**
- `asyncFunctionDrive` (1)
- `async lock` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-field-name.mjs` | Self: 0.0% (2.5ms) | Total: 0.0% (2.5ms) | Samples: 2

**Called by:**
- `(anonymous)` (1)
- `getFieldName` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-model-name.mjs:20` | Self: 0.0% (2.5ms) | Total: 0.0% (2.5ms) | Samples: 2

**Called by:**
- `(anonymous)` (2)

### `includes`
`[native code]` | Self: 0.0% (2.5ms) | Total: 0.0% (2.5ms) | Samples: 2

**Called by:**
- `parseAliasedTable` (2)

### `shouldIgnoreTopicSuggestionSignal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:122` | Self: 0.0% (2.5ms) | Total: 0.0% (2.5ms) | Samples: 2

**Called by:**
- `(anonymous)` (2)

### `getTopicSuggestionSignalsForThreadsFromDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:210` | Self: 0.0% (2.5ms) | Total: 0.2% (37.9ms) | Samples: 1

**Called by:**
- `(anonymous)` (31)

**Calls:**
- `(anonymous)` (26)
- `(anonymous)` (3)
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/index.mjs` | Self: 0.0% (2.5ms) | Total: 0.0% (2.5ms) | Samples: 2

**Called by:**
- `async (anonymous)` (1)
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:194` | Self: 0.0% (2.5ms) | Total: 0.3% (56.3ms) | Samples: 2

**Called by:**
- `async withAccountDb` (48)

**Calls:**
- `(anonymous)` (41)
- `(anonymous)` (4)
- `(anonymous)` (1)

### `Number`
`[native code]` | Self: 0.0% (2.5ms) | Total: 0.0% (2.5ms) | Samples: 2

**Called by:**
- `clampThreadListPageSize` (2)

### `withSpan`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/tracer.mjs:34` | Self: 0.0% (2.5ms) | Total: 0.0% (2.5ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `fromBER`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js` | Self: 0.0% (2.5ms) | Total: 0.0% (2.5ms) | Samples: 2

**Called by:**
- `localFromBER` (1)
- `toASN` (1)

### `decryptPayload`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts:59` | Self: 0.0% (2.5ms) | Total: 0.0% (2.5ms) | Samples: 2

**Called by:**
- `decodeSecret` (2)

### `headers`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/headers.js:110` | Self: 0.0% (2.4ms) | Total: 0.0% (10.8ms) | Samples: 2

**Called by:**
- `async (anonymous)` (9)

**Calls:**
- `throwForMissingRequestStore` (6)
- `throwForMissingRequestStore` (1)

### `async enrichMessagesWithThreadCollab`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadCollab.ts:18` | Self: 0.0% (2.4ms) | Total: 0.2% (48.5ms) | Samples: 2

**Called by:**
- `async (anonymous)` (26)
- `async (anonymous)` (14)

**Calls:**
- `async enrichMessagesWithThreadCollab` (18)
- `async enrichMessagesWithThreadCollab` (16)
- `async enrichMessagesWithThreadCollab` (3)
- `async enrichMessagesWithThreadCollab` (1)

### `isFreeMailDomain`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/senderIdentity.ts:272` | Self: 0.0% (2.4ms) | Total: 0.0% (2.4ms) | Samples: 2

**Called by:**
- `shouldIgnoreTopicSuggestionSignalUncached` (1)
- `shouldIgnoreTopicSuggestionSignalUncached` (1)

### `async enrichMessagesWithThreadTopics`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:28` | Self: 0.0% (2.4ms) | Total: 0.0% (4.8ms) | Samples: 2

**Called by:**
- `async enrichMessagesWithThreadTopics` (3)

**Calls:**
- `from` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/well-known/index.js` | Self: 0.0% (2.4ms) | Total: 0.0% (2.4ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:147` | Self: 0.0% (2.4ms) | Total: 0.0% (2.4ms) | Samples: 2

**Called by:**
- `async transformSingleOutput` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js` | Self: 0.0% (2.4ms) | Total: 0.0% (2.4ms) | Samples: 2

**Called by:**
- `ZodUnknown` (1)
- `some` (1)

### `_handleAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:765` | Self: 0.0% (2.4ms) | Total: 0.0% (13.6ms) | Samples: 2

**Called by:**
- `_parseAddressList` (12)

**Calls:**
- `_recoverAddrSpec` (5)
- `_recoverAddrSpec` (4)
- `_recoverAddrSpec` (1)

### `fsyncSync`
`[native code]` | Self: 0.0% (2.4ms) | Total: 0.0% (4.9ms) | Samples: 2

**Called by:**
- `fsyncSync` (2)
- `release` (1)
- `async acquireAuthLifetimeLock` (1)

**Calls:**
- `fsyncSync` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2626` | Self: 0.0% (2.4ms) | Total: 0.0% (2.4ms) | Samples: 2

**Called by:**
- `map` (2)

### `compareSqliteText`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:558` | Self: 0.0% (2.4ms) | Total: 0.3% (70.4ms) | Samples: 2

**Called by:**
- `(anonymous)` (60)
- `(anonymous)` (1)
- `sort` (1)

**Calls:**
- `(anonymous)` (60)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:97` | Self: 0.0% (2.4ms) | Total: 2.8% (521.6ms) | Samples: 1

**Calls:**
- `json` (388)
- `json` (61)

### `visitValue`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:318` | Self: 0.0% (2.4ms) | Total: 0.0% (2.4ms) | Samples: 1

**Called by:**
- `bound visitValue` (1)

### `create`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/identifier-node.js:11` | Self: 0.0% (2.4ms) | Total: 0.0% (3.4ms) | Samples: 2

**Called by:**
- `toOperationNode` (1)
- `create` (1)
- `create` (1)

**Calls:**
- `freeze` (1)

### `setAuthTag`
`[native code]` | Self: 0.0% (2.4ms) | Total: 0.0% (2.4ms) | Samples: 2

**Called by:**
- `setAuthTag` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountKeys.ts` | Self: 0.0% (2.4ms) | Total: 0.0% (2.4ms) | Samples: 1

**Called by:**
- `some` (1)

### `/[\x00-\x1f\x7f]/`
`[native code]` | Self: 0.0% (2.4ms) | Total: 0.0% (2.4ms) | Samples: 2

**Called by:**
- `normalizeIdentityEmail` (2)

### `compileUnwrappedIdentifier`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:305` | Self: 0.0% (2.4ms) | Total: 0.0% (13.0ms) | Samples: 2

**Called by:**
- `visitIdentifier` (10)

**Calls:**
- `sanitizeIdentifier` (3)
- `sanitizeIdentifier` (2)
- `sanitizeIdentifier` (2)
- `sanitizeIdentifier` (1)

### `__exportStar`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:203` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `(anonymous)` (1)
- `(anonymous)` (1)

### `#getNoArgs`
`bun:sqlite` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `(anonymous)` (2)

### `buildSqlEndsWithAny`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:935` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `buildMeaningfulAttachmentPredicateSql` (2)

### `async withAuthResponse`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:51` | Self: 0.0% (2.3ms) | Total: 0.0% (3.5ms) | Samples: 1

**Calls:**
- `forwardAuthHeaders` (1)

### `executeQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `sanitizeIdentifier`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `compileUnwrappedIdentifier` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:155` | Self: 0.0% (2.3ms) | Total: 0.0% (4.9ms) | Samples: 2

**Calls:**
- `[Symbol.toPrimitive]` (2)

### `async getSignedCookie`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:48` | Self: 0.0% (2.3ms) | Total: 0.1% (23.9ms) | Samples: 2

**Called by:**
- `async (anonymous)` (20)

**Calls:**
- `async (anonymous)` (17)
- `async (anonymous)` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2587` | Self: 0.0% (2.3ms) | Total: 5.8% (1.05s) | Samples: 2

**Calls:**
- `(anonymous)` (895)
- `(anonymous)` (11)
- `(anonymous)` (11)

### `getKey`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 1

**Called by:**
- `decryptPayload` (1)

### `async resolveAccountDbPath`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:338` | Self: 0.0% (2.3ms) | Total: 0.2% (45.1ms) | Samples: 2

**Calls:**
- `(anonymous)` (11)
- `(anonymous)` (7)
- `(anonymous)` (7)
- `(anonymous)` (7)
- `(anonymous)` (2)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:678` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `(anonymous)` (2)

### `parseCookies`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:34` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `async (anonymous)` (2)

### `#get`
`bun:sqlite` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `(anonymous)` (2)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `async listThreads` (2)

### `reset`
`/tmp/spike-switch-server/sqlcounter.ts:39` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `async time` (2)

### `arrayIteratorNextHelper`
`[native code]` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `performIteration` (2)

### `fireTriggers`
`/tmp/spike-switch-server/sqlcounter.ts` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `async internalHandler`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:52` | Self: 0.0% (2.3ms) | Total: 0.0% (10.9ms) | Samples: 2

**Called by:**
- `(anonymous)` (7)

**Calls:**
- `async (anonymous)` (4)
- `async (anonymous)` (1)

### `topicSuggestionSignalsFromEntries`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:75` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `flush` (1)
- `(anonymous)` (1)

### `async transformOutput`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:145` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async withAuthResponse`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `async GET` (2)

### `normalizeEmailAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/senderIdentity.ts:61` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `isFreeMailDomain` (2)

### `ensureCalendarReminderRuntimeSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `async getAccountDb` (2)

### `async getDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:327` | Self: 0.0% (2.3ms) | Total: 0.0% (6.6ms) | Samples: 2

**Called by:**
- `async resolveAccountDbPath` (5)
- `async getAccountOwnAddresses` (1)

**Calls:**
- `async getDb` (4)

### `_defu`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/defu/dist/defu.mjs:19` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `reduce` (2)

### `catch`
`[native code]` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 2

**Called by:**
- `async runBeforeHooks` (1)
- `(anonymous)` (1)

### `async getMessageCalendarInviteDataByMessageId`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:178` | Self: 0.0% (2.2ms) | Total: 0.7% (131.2ms) | Samples: 2

**Called by:**
- `async listThreads` (116)

**Calls:**
- `(anonymous)` (105)
- `(anonymous)` (4)
- `(anonymous)` (4)
- `wrapStatement` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:22` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 2

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:157` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 2

**Called by:**
- `async transformSingleOutput` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:629` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 2

**Called by:**
- `forEach` (2)

### `normalize`
`/tmp/spike-switch-server/anatomy.ts:56` | Self: 0.0% (2.2ms) | Total: 0.0% (10.7ms) | Samples: 2

**Called by:**
- `map` (9)

**Calls:**
- `entries` (7)

### `parseAddressEmails`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 2

**Called by:**
- `(anonymous)` (1)
- `isOwnAddress` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 2

**Called by:**
- `forEach` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:23` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 2

**Called by:**
- `map` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:533` | Self: 0.0% (2.2ms) | Total: 0.0% (4.3ms) | Samples: 2

**Called by:**
- `forEach` (4)

**Calls:**
- `(anonymous)` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/parse5/dist/parser/index.js` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/tracer.mjs:37` | Self: 0.0% (2.2ms) | Total: 3.3% (608.7ms) | Samples: 2

**Called by:**
- `async (anonymous)` (91)
- `async (anonymous)` (55)
- `run` (7)
- `async (anonymous)` (5)
- `async runBeforeHooks` (4)
- `async runAfterHooks` (4)
- `async dispatchAuthEndpoint` (2)
- `async createWithHooks` (1)
- `async (anonymous)` (1)
- `async (anonymous)` (1)

**Calls:**
- `async findOne` (140)
- `async internalHandler` (8)
- `async internalHandler` (7)
- `async create` (4)
- `async findOne` (3)
- `async (anonymous)` (2)
- `(anonymous)` (1)
- `async create` (1)
- `async findMany` (1)
- `async update` (1)
- `async before` (1)

### `parseCookies`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:28` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `query`
`bun:sqlite:382` | Self: 0.0% (2.2ms) | Total: 0.0% (4.6ms) | Samples: 2

**Called by:**
- `(anonymous)` (4)

**Calls:**
- `isFinalized` (1)
- `delete` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:165` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 2

**Called by:**
- `map` (2)

### `async ensureCalendarEventRuntimeData`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:675` | Self: 0.0% (2.2ms) | Total: 0.4% (78.4ms) | Samples: 2

**Called by:**
- `async getAccountDb` (68)

**Calls:**
- `async ensureCalendarEventRuntimeData` (66)

### `get source`
`[native code]` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 2

**Called by:**
- `compile` (2)

### `install`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/storage.ts` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 2

**Called by:**
- `(anonymous)` (2)

### `parseAliasedTable`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/table-parser.js:29` | Self: 0.0% (2.2ms) | Total: 0.0% (4.7ms) | Samples: 1

**Called by:**
- `parseTableExpressionOrList` (3)

**Calls:**
- `includes` (2)

### `topicSuggestionSignalEntries`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:106` | Self: 0.0% (2.2ms) | Total: 0.0% (5.3ms) | Samples: 2

**Called by:**
- `(anonymous)` (5)

**Calls:**
- `map` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:665` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 2

**Called by:**
- `forEach` (2)

### `freeze`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/object-utils.js:63` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 2

**Called by:**
- `create` (1)
- `create` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 2

**Called by:**
- `(anonymous)` (2)

### `async executeQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 2

**Called by:**
- `async execute` (1)
- `async executeQuery` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:585` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 2

**Called by:**
- `forEach` (2)

### `async acquireConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 2

**Called by:**
- `async acquireConnection` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:346` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 2

**Called by:**
- `async handleFallbackJoin` (1)

### `applyBadgeFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:875` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 2

**Called by:**
- `async getTotalCount` (2)

### `defineProperty`
`[native code]` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 2

**Called by:**
- `(anonymous)` (1)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testAuthHarness.ts:79` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 2

**Called by:**
- `map` (2)

### `async sign`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/utils/dist/hmac.mjs` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 1

**Called by:**
- `async generateHOTP` (1)

### `_handleAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:660` | Self: 0.0% (2.1ms) | Total: 0.1% (19.4ms) | Samples: 2

**Called by:**
- `_parseAddressList` (17)

**Calls:**
- `_collectAddressParts` (10)
- `_collectAddressParts` (3)
- `_collectAddressParts` (2)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2583` | Self: 0.0% (2.1ms) | Total: 0.0% (3.1ms) | Samples: 2

**Calls:**
- `map` (1)

### `isOwnAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:62` | Self: 0.0% (2.1ms) | Total: 1.2% (223.7ms) | Samples: 2

**Called by:**
- `shouldIgnoreTopicSuggestionSignalUncached` (104)
- `shouldIgnoreTopicSuggestionSignalUncached` (44)
- `(anonymous)` (24)
- `(anonymous)` (17)

**Calls:**
- `parseAddressEmails` (147)
- `parseAddressEmails` (18)
- `flatIntoArrayWithCallback` (9)
- `parseAddressEmails` (7)
- `some` (5)
- `parseAddressEmails` (1)

### `value`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:76` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 2

**Called by:**
- `_collectAddressParts` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:185` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 2

**Called by:**
- `flatIntoArrayWithCallback` (2)

### `_handleAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:699` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 2

**Called by:**
- `_parseAddressList` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:370` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 2

**Called by:**
- `forEach` (2)

### `isIsOperator`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/binary-operation-parser.js` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 2

**Called by:**
- `parseValueBinaryOperation` (2)

### `async getAccountById`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accounts.ts:82` | Self: 0.0% (2.1ms) | Total: 2.3% (423.6ms) | Samples: 2

**Calls:**
- `(anonymous)` (201)
- `(anonymous)` (123)
- `(anonymous)` (7)
- `(anonymous)` (6)
- `wrapStatement` (3)
- `wrapStatement` (2)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `listSenderIdentityRows`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/senderIdentities.ts:12` | Self: 0.0% (2.1ms) | Total: 0.5% (96.0ms) | Samples: 2

**Called by:**
- `async getAccountById` (74)
- `async getAccountOwnAddresses` (10)

**Calls:**
- `(anonymous)` (78)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:393` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 1

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:39` | Self: 0.0% (2.1ms) | Total: 4.9% (897.6ms) | Samples: 2

**Called by:**
- `async provideConnection` (164)
- `async (anonymous)` (161)

**Calls:**
- `async (anonymous)` (161)
- `executeQuery` (73)
- `executeQuery` (70)
- `executeQuery` (17)
- `asyncFunctionDrive` (1)
- `executeQuery` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:220` | Self: 0.0% (2.1ms) | Total: 0.0% (5.4ms) | Samples: 2

**Calls:**
- `reduce` (3)

### `async time`
`/tmp/spike-switch-server/anatomy.ts:27` | Self: 0.0% (2.1ms) | Total: 0.0% (9.0ms) | Samples: 2

**Called by:**
- `async time` (5)

**Calls:**
- `(anonymous)` (2)
- `stringify` (1)
- `async (anonymous)` (1)
- `async (anonymous)` (1)

### `tryDecode`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/utils.mjs:60` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 2

**Called by:**
- `parseCookies` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:157` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 2

**Called by:**
- `flatIntoArrayWithCallback` (2)

### `async requireAccountContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/accountContext.ts:64` | Self: 0.0% (2.1ms) | Total: 0.0% (9.1ms) | Samples: 1

**Called by:**
- `async GET` (5)
- `async time` (1)

**Calls:**
- `async requireAccountContext` (5)

### `_collapseAtSpacing`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:272` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 1

**Called by:**
- `map` (1)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:103` | Self: 0.0% (2.0ms) | Total: 0.0% (2.0ms) | Samples: 2

**Called by:**
- `async resolveAccountDbPath` (1)
- `resolveAccountRoleRow` (1)

### `async #transformResult`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:167` | Self: 0.0% (2.0ms) | Total: 0.0% (2.0ms) | Samples: 2

**Called by:**
- `async executeQuery` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs` | Self: 0.0% (2.0ms) | Total: 0.0% (2.0ms) | Samples: 2

**Called by:**
- `filter` (2)

### `create`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/schemable-identifier-node.js` | Self: 0.0% (2.0ms) | Total: 0.0% (2.0ms) | Samples: 2

**Called by:**
- `create` (2)

### `Statement`
`bun:sqlite` | Self: 0.0% (2.0ms) | Total: 0.0% (2.0ms) | Samples: 2

**Called by:**
- `prepare` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:1260` | Self: 0.0% (2.0ms) | Total: 0.0% (2.0ms) | Samples: 1

**Called by:**
- `init` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_arx.js:49` | Self: 0.0% (2.0ms) | Total: 0.0% (2.0ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `expr`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:390` | Self: 0.0% (2.0ms) | Total: 0.0% (3.1ms) | Samples: 2

**Called by:**
- `map` (3)

**Calls:**
- `toLowerCase` (1)

### `_collectAddressParts`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` | Self: 0.0% (2.0ms) | Total: 0.0% (2.0ms) | Samples: 2

**Called by:**
- `_handleAddress` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:366` | Self: 0.0% (2.0ms) | Total: 0.0% (2.0ms) | Samples: 2

**Called by:**
- `forEach` (2)

### `async waitOrAbort`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/abort.js:42` | Self: 0.0% (2.0ms) | Total: 0.0% (2.0ms) | Samples: 2

**Called by:**
- `async waitOrAbort` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:636` | Self: 0.0% (2.0ms) | Total: 0.0% (2.0ms) | Samples: 2

**Called by:**
- `forEach` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:674` | Self: 0.0% (2.0ms) | Total: 0.0% (2.0ms) | Samples: 2

**Called by:**
- `forEach` (2)

### `flatIntoArray`
`[native code]` | Self: 0.0% (1.9ms) | Total: 0.0% (1.9ms) | Samples: 2

**Called by:**
- `flatIntoArrayWithCallback` (2)

### `slimThreadListItem`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:36` | Self: 0.0% (1.9ms) | Total: 0.0% (1.9ms) | Samples: 1

**Called by:**
- `map` (1)

### `filterOutputFields`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs:7` | Self: 0.0% (1.9ms) | Total: 0.0% (1.9ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async executeQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:35` | Self: 0.0% (1.9ms) | Total: 0.0% (1.9ms) | Samples: 1

**Called by:**
- `async executeQuery` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs` | Self: 0.0% (1.9ms) | Total: 0.0% (1.9ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts` | Self: 0.0% (1.9ms) | Total: 0.0% (1.9ms) | Samples: 1

**Called by:**
- `transaction` (1)

### `resolveDatabaseSchemaIndexes`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/database-index.mjs:145` | Self: 0.0% (1.8ms) | Total: 0.0% (3.0ms) | Samples: 1

**Called by:**
- `getAuthTablesWithResolvedIndexes` (2)

**Calls:**
- `getDatabaseFieldIndexName` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2267` | Self: 0.0% (1.8ms) | Total: 0.0% (1.8ms) | Samples: 1

### `date`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js` | Self: 0.0% (1.7ms) | Total: 0.0% (1.7ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/dom-serializer/node_modules/entities/lib/esm/generated/encode-html.js:9` | Self: 0.0% (1.7ms) | Total: 0.0% (1.7ms) | Samples: 1

### `sanitizeIdentifier`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:1368` | Self: 0.0% (1.7ms) | Total: 0.0% (1.7ms) | Samples: 1

**Called by:**
- `compileUnwrappedIdentifier` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:507` | Self: 0.0% (1.6ms) | Total: 0.3% (55.7ms) | Samples: 1

**Called by:**
- `parseAliasedExpression` (25)
- `parseExpression` (18)

**Calls:**
- `where` (23)
- `map` (18)
- `where` (1)

### `getInternalPlugins`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/helpers.mjs` | Self: 0.0% (1.6ms) | Total: 0.0% (1.6ms) | Samples: 1

**Called by:**
- `async createAuthContext` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:103` | Self: 0.0% (1.6ms) | Total: 0.0% (1.6ms) | Samples: 1

**Called by:**
- `map` (1)

### `toPhysicalSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:198` | Self: 0.0% (1.6ms) | Total: 0.0% (1.6ms) | Samples: 1

**Called by:**
- `async findSchemaProblems` (1)

### `upsertTopicLearningSignalsForThreadIds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:153` | Self: 0.0% (1.5ms) | Total: 0.0% (13.8ms) | Samples: 1

**Called by:**
- `rememberTopicLearningForThread` (11)

**Calls:**
- `(anonymous)` (10)

### `(anonymous)`
`/tmp/spike-switch-server/anatomy.ts:76` | Self: 0.0% (1.5ms) | Total: 0.0% (1.5ms) | Samples: 1

**Called by:**
- `async time` (1)

### `async runValidation`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/validator.mjs:44` | Self: 0.0% (1.5ms) | Total: 0.0% (13.7ms) | Samples: 1

**Called by:**
- `async (anonymous)` (8)

**Calls:**
- `async runValidation` (3)
- `async runValidation` (3)
- `async runValidation` (1)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:19` | Self: 0.0% (1.4ms) | Total: 0.0% (3.9ms) | Samples: 1

**Called by:**
- `async buildFixture` (2)

**Calls:**
- `importModule` (2)

### `create`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/column-node.js` | Self: 0.0% (1.4ms) | Total: 0.0% (1.4ms) | Samples: 1

**Called by:**
- `parseStringReferenceWithTable` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:355` | Self: 0.0% (1.4ms) | Total: 1.0% (190.2ms) | Samples: 1

**Called by:**
- `async findSession` (2)

**Calls:**
- `async findOne` (119)
- `async getCurrentAdapter` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/mail/categorization/linearModel.ts:53` | Self: 0.0% (1.4ms) | Total: 0.0% (1.4ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `parseBinaryOperator`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/binary-operation-parser.js:56` | Self: 0.0% (1.4ms) | Total: 0.0% (1.4ms) | Samples: 1

**Called by:**
- `parseValueBinaryOperation` (1)

### `header`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testAuthHarness.ts:79` | Self: 0.0% (1.4ms) | Total: 0.0% (6.3ms) | Samples: 1

**Called by:**
- `rq` (5)

**Calls:**
- `map` (2)
- `performIteration` (2)

### `async dispatchAuthEndpoint`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:192` | Self: 0.0% (1.4ms) | Total: 0.0% (1.4ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:8` | Self: 0.0% (1.4ms) | Total: 0.0% (7.1ms) | Samples: 1

**Called by:**
- `async getCryptoKey` (6)

**Calls:**
- `encode` (4)
- `TextEncoder` (1)

### `parseCookies`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/cookie-utils.mjs:158` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `getChunkedCookie` (1)

### `getExistingEndpointContextStorage`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/endpoint-context.mjs:5` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `ensureMessageCalendarEventRuntimeSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async getAccountDb` (1)

### `async dispatchAuthEndpoint`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:191` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authPolicyHandler.ts:284` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `ensureMessageCalendarEventOptionalColumns`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `initAccountSchemaBody` (1)

### `toISOString`
`[native code]` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async buildFixture` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/sign-in.mjs` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async getUserById`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/serverDb.ts:151` | Self: 0.0% (1.3ms) | Total: 0.1% (30.2ms) | Samples: 1

**Called by:**
- `async getUserById` (7)
- `async requireActiveUserSession` (7)

**Calls:**
- `async getUserById` (7)
- `loadServerDb` (7)
- `async getUserById` (1)

### `parseValueBinaryOperation`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/binary-operation-parser.js:25` | Self: 0.0% (1.3ms) | Total: 0.1% (18.3ms) | Samples: 1

**Called by:**
- `binary` (12)
- `where` (1)

**Calls:**
- `parseStringReferenceWithTable` (4)
- `parseStringReference` (3)
- `parseStringReferenceWithTable` (1)
- `parseBinaryOperator` (1)
- `parseReferenceExpression` (1)
- `create` (1)
- `parseStringReference` (1)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:49` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

### `async enrichMessagesWithThreadCollab`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadCollab.ts` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async enrichMessagesWithThreadCollab` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/levels.js` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `reduce` (1)

### `async getCurrentRequestState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:21` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async get` (1)

### `async internalHandler`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/middleware.mjs:29` | Self: 0.0% (1.3ms) | Total: 0.1% (22.4ms) | Samples: 1

**Called by:**
- `async (anonymous)` (10)
- `(anonymous)` (8)

**Calls:**
- `async (anonymous)` (14)
- `async (anonymous)` (3)

### `applyBadgeFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:844` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async getTotalCount` (1)

### `async getMigrations`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async getMigrations` (1)

### `getKey`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts:25` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `decryptPayload` (1)

### `startsWith`
`[native code]` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `require` (1)

### `async requireActiveUserSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:73` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

### `getAuth`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:262` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async requireActiveUserSession` (1)

### `TokenList`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:25` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `Tokenizer` (1)

### `parseStringReferenceWithTable`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js:88` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `parseValueBinaryOperation` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:16` | Self: 0.0% (1.3ms) | Total: 0.0% (16.2ms) | Samples: 1

**Called by:**
- `async verifySignature` (12)

**Calls:**
- `verify` (11)

### `visitReference`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:289` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `bound visitReference` (1)

### `parseSearchInput`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:682` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async listThreads` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv6.js:1460` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `anonymous` (1)

### `applyAddressSearchFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:565` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async getTotalCount` (1)

### `parseCookies`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:26` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:151` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async transformSingleOutput` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:38` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

### `getHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:166` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `_addListener`
`node:events:201` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `addListener` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/api/index.mjs` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `compileQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:24` | Self: 0.0% (1.3ms) | Total: 0.2% (48.3ms) | Samples: 1

**Called by:**
- `async execute` (24)

**Calls:**
- `visitNode` (23)

### `getStore`
`node:async_hooks` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async hasRequestState` (1)

### `assign`
`[native code]` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `createExpressionBuilder` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/operation-node-visitor.js:70` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `OperationNodeVisitor` (1)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1296` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:245` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `map` (1)

### `flush`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:45` | Self: 0.0% (1.3ms) | Total: 3.0% (558.4ms) | Samples: 1

**Called by:**
- `(anonymous)` (264)
- `insertThreadSignalsFromMessageRows` (3)

**Calls:**
- `forEach` (266)

### `node:crypto`
`node:crypto:278` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

### `filterOutputFields`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs:8` | Self: 0.0% (1.3ms) | Total: 0.0% (17.3ms) | Samples: 1

**Called by:**
- `async (anonymous)` (4)
- `async (anonymous)` (3)
- `async (anonymous)` (2)
- `async (anonymous)` (1)

**Calls:**
- `entries` (7)
- `filter` (2)

### `ensureTopicRuntimeSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async getAccountDb` (1)

### `async enrichMessagesWithThreadTopics`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:29` | Self: 0.0% (1.3ms) | Total: 0.2% (41.8ms) | Samples: 1

**Called by:**
- `async enrichMessagesWithThreadTopics` (34)

**Calls:**
- `map` (15)
- `Set` (12)
- `filter` (6)

### `buildSqlContainsAny`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:928` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `buildMeaningfulAttachmentPredicateSql` (1)

### `transformJoinClause`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:327` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/ip_converter.js:3` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `anonymous` (1)

### `parseStringReference`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js:48` | Self: 0.0% (1.3ms) | Total: 0.0% (4.2ms) | Samples: 1

**Called by:**
- `parseValueBinaryOperation` (3)

**Calls:**
- `map` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:79` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `_parseAddressList`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1181` | Self: 0.0% (1.2ms) | Total: 0.3% (69.3ms) | Samples: 1

**Called by:**
- `addressparser` (60)

**Calls:**
- `_handleAddress` (17)
- `_handleAddress` (14)
- `_handleAddress` (12)
- `_handleAddress` (6)
- `_handleAddress` (5)
- `_handleAddress` (2)
- `_handleAddress` (1)
- `_handleAddress` (1)
- `_handleAddress` (1)

### `push`
`[native code]` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async listThreads` (1)

### `BaseBlock`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:917` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `OctetString` (1)

### `buildSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-schema.mjs` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async getMigrations` (1)

### `parseAliasedExpression`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/expression-parser.js:16` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `parseTableExpressionOrList` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-android/build/cjs/nonstandard.js:4` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `anonymous` (1)

### `every`
`[native code]` | Self: 0.0% (1.2ms) | Total: 0.1% (27.0ms) | Samples: 1

**Called by:**
- `normalizeIdentityEmail` (20)
- `shardWriterGuardsInstalled` (1)
- `migrate` (1)

**Calls:**
- `(anonymous)` (19)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `exit`
`[native code]` | Self: 0.0% (1.2ms) | Total: 0.0% (5.5ms) | Samples: 1

**Called by:**
- `(module)` (3)

**Calls:**
- `reallyExit` (1)
- `release` (1)

### `onCompile`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `compile` (1)

### `otp2fa`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/otp/index.mjs` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `twoFactor` (1)

### `mapAccountRow`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts:151` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async getAccountById` (1)

### `_handleAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:696` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `_parseAddressList` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:56` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `filter` (1)

### `visitReference`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `bound visitReference` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:248` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async getSessionFromCtx` (1)

### `_handleAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:776` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `_parseAddressList` (1)

### `async verifySignature`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `decorate`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `__decorate` (1)

### `async validateAccountFolders`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/folderAccount.ts:12` | Self: 0.0% (1.2ms) | Total: 0.0% (3.5ms) | Samples: 1

**Called by:**
- `async validateAccountFolders` (3)

**Calls:**
- `async assertAccountFolder` (1)
- `async assertAccountFolder` (1)

### `async runAfterHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:114` | Self: 0.0% (1.2ms) | Total: 0.0% (5.9ms) | Samples: 1

**Called by:**
- `async runAfterHooks` (2)

**Calls:**
- `(anonymous)` (4)

### `async getAccountById`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accounts.ts:85` | Self: 0.0% (1.2ms) | Total: 1.0% (198.2ms) | Samples: 1

**Called by:**
- `async ensureCalendarEventRuntimeData` (1)

**Calls:**
- `listSenderIdentityRows` (74)
- `getOwnAddresses` (51)
- `listSenderIdentityRows` (22)
- `getOwnAddresses` (9)
- `getOwnAddresses` (6)
- `map` (4)
- `getOwnAddresses` (2)
- `cloneObject` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:12` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `init` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/he/he.js:55` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/jose/dist/webapi/util/errors.js` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `Hash`
`[native code]` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `Hash` (1)

### `async (anonymous)`
`/tmp/spike-switch-server/anatomy.ts:65` | Self: 0.0% (1.2ms) | Total: 0.2% (42.9ms) | Samples: 1

**Called by:**
- `async time` (13)
- `async (anonymous)` (13)

**Calls:**
- `async (anonymous)` (13)
- `text` (11)
- `async GET` (7)
- `rq` (6)

### `visitSelectQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:70` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `bound visitSelectQuery` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/senderIdentities.ts:13` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `map` (1)

### `parseTableExpression`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/table-parser.js:20` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `parseTableExpressionOrList` (1)

### `assertCredentialMode`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts:8` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `decodeSecret` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:160` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async transformSingleOutput` (1)

### `getTopicSuggestionsForThreadSignalBatch`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:635` | Self: 0.0% (1.2ms) | Total: 17.6% (3.20s) | Samples: 1

**Called by:**
- `async withAccountDb` (2751)

**Calls:**
- `forEach` (2750)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/messageGrouping.ts` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:94` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `getColorDepth`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs:60` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `formatTransactionId` (1)

### `fromBER`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:2348` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `fromBER` (1)

### `openSync`
`[native code]` | Self: 0.0% (1.2ms) | Total: 0.0% (2.5ms) | Samples: 1

**Called by:**
- `async acquireAuthLifetimeLock` (1)
- `openSync` (1)

**Calls:**
- `openSync` (1)

### `async withAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async setThreadTopics` (1)

### `node:_http_outgoing`
`node:_http_outgoing:706` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `anonymous` (1)

### `applyBadgeFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:835` | Self: 0.0% (1.2ms) | Total: 0.0% (2.2ms) | Samples: 1

**Called by:**
- `async getTotalCount` (1)
- `async listThreads` (1)

**Calls:**
- `toLowerCase` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/tracer.mjs:38` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async dispatchAuthEndpoint` (1)

### `returningAll`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/update-query-builder.js` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:705` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `map` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/query-id.js` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `LazyQueryId` (1)

### `visitSelectQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:39` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `bound visitSelectQuery` (1)

### `normalizeCalendarEventUidKeys`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/calendarEventUids.ts:29` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `applyInviteUidQueryFilters` (1)

### `bump`
`/tmp/spike-switch-server/sqlcounter.ts` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `groupsFromRows`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:990` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async getThreadGroupCounts` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async provideConnection` (1)

### `async getAccountOwnAddresses`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/senderIdentities.ts:20` | Self: 0.0% (1.2ms) | Total: 0.0% (2.2ms) | Samples: 1

**Called by:**
- `async getAccountOwnAddresses` (2)

**Calls:**
- `async getDb` (1)

### `Response`
`[native code]` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `NextResponse` (1)

### `normalizeSearchFields`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:488` | Self: 0.0% (1.2ms) | Total: 0.0% (2.3ms) | Samples: 1

**Called by:**
- `parseSearchInput` (2)

**Calls:**
- `filter` (1)

### `value`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:72` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `_collectAddressParts` (1)

### `Statement`
`bun:sqlite:108` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `prepare` (1)

### `async requireAccountContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/accountContext.ts:53` | Self: 0.0% (1.2ms) | Total: 0.0% (7.0ms) | Samples: 1

**Called by:**
- `async requireAccountContext` (5)

**Calls:**
- `async requireActiveUserSession` (3)
- `async requireActiveUserSession` (1)

### `isRequestLike`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/utils/url.mjs:129` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `Statement`
`bun:sqlite:109` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `prepare` (1)

### `parseCookies`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/cookie-utils.mjs:164` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `getChunkedCookie` (1)

### `createQueryId`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/query-id.js` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `selectFrom` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:47` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `flatIntoArrayWithCallback` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `applyBadgeFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:859` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async getTotalCount` (1)

### `getFields`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/schema.mjs:10` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `parseUserOutput` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:339` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `map` (1)

### `hasOwnProperty`
`[native code]` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `bound call` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/encode.js:98` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `query`
`bun:sqlite:380` | Self: 0.0% (1.2ms) | Total: 0.0% (3.5ms) | Samples: 1

**Called by:**
- `(anonymous)` (3)

**Calls:**
- `get` (2)

### `async getAccountById`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/serverDb.ts:26` | Self: 0.0% (1.2ms) | Total: 0.1% (18.6ms) | Samples: 1

**Called by:**
- `async requireAccountContext` (8)
- `(module)` (1)

**Calls:**
- `async getAccountById` (8)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts:23` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `run` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/error.mjs` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `InternalAPIError` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `parseAliasedExpression` (1)

### `decodeTrieDict`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/internal/decode-shared.js:175` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `_recoverAddrSpec`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:367` | Self: 0.0% (1.2ms) | Total: 0.0% (5.4ms) | Samples: 1

**Called by:**
- `_handleAddress` (5)

**Calls:**
- `_collapseAtSpacing` (3)
- `_joinAtSpacing` (1)

### `rememberTopicLearningForThread`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:47` | Self: 0.0% (1.2ms) | Total: 0.0% (2.1ms) | Samples: 1

**Called by:**
- `(anonymous)` (2)

**Calls:**
- `trim` (1)

### `parseCookies`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:36` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async ensureAsyncStorage`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/transaction.mjs:12` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async getCurrentAdapter` (1)

### `async stageMessageFiles`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/storage.ts:235` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async stageMessageFiles` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:557` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `async getUserById`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/users.ts:73` | Self: 0.0% (1.2ms) | Total: 0.5% (106.2ms) | Samples: 1

**Called by:**
- `async getUserById` (1)

**Calls:**
- `readUserById` (72)
- `mapUserRow` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:572` | Self: 0.0% (1.2ms) | Total: 0.0% (3.7ms) | Samples: 1

**Called by:**
- `async findOne` (3)

**Calls:**
- `formatTransactionId` (2)

### `isFunction`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/object-utils.js` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `parseSelectArg` (1)

### `verifyPasskeyRegistration`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/passkey/dist/index.mjs` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `passkey` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2608` | Self: 0.0% (1.2ms) | Total: 1.5% (283.4ms) | Samples: 1

**Calls:**
- `async getMessageCalendarInviteDataByMessageId` (116)
- `async getMessageCalendarInviteDataByMessageId` (98)
- `async getMessageCalendarInviteDataByMessageId` (24)
- `async getMessageCalendarInviteDataByMessageId` (4)
- `async getMessageCalendarInviteDataByMessageId` (4)
- `async getMessageCalendarInviteDataByMessageId` (1)
- `async getMessageCalendarInviteDataByMessageId` (1)

### `anumber`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/utils.js` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `Keccak` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:16` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `init` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/node_modules/jose/dist/webapi/lib/jws_algorithms.js:55` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

### `getStore`
`node:async_hooks:163` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:586` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `enrollmentState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:381` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async isMfaEnrollmentComplete` (1)

### `async runBeforeHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:70` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async runBeforeHooks` (1)

### `async getThreadGroupCounts`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1398` | Self: 0.0% (1.2ms) | Total: 5.1% (934.7ms) | Samples: 1

**Called by:**
- `async listThreads` (796)

**Calls:**
- `(anonymous)` (790)
- `(anonymous)` (4)
- `(anonymous)` (1)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1295` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

### `node:tls`
`node:tls:549` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

### `findParentSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/schema.js:159` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `createDefault` (1)

### `Internals`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `init` (1)

### `delete`
`[native code]` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `query` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:371` | Self: 0.0% (1.2ms) | Total: 0.0% (6.8ms) | Samples: 1

**Called by:**
- `forEach` (6)

**Calls:**
- `(anonymous)` (5)

### `find`
`[native code]` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/certificate_choices.js:8` | Self: 0.0% (1.2ms) | Total: 0.0% (10.2ms) | Samples: 1

**Called by:**
- `anonymous` (9)

**Calls:**
- `bound require` (8)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async withAccountDb` (1)

### `parseStringReferenceWithTable`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js:89` | Self: 0.0% (1.2ms) | Total: 0.0% (4.9ms) | Samples: 1

**Called by:**
- `parseValueBinaryOperation` (4)

**Calls:**
- `freeze` (1)
- `create` (1)
- `create` (1)

### `internal:streams/duplexpair`
`internal:streams/duplexpair:11` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `anonymous` (1)

### `applyAddressSearchFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async listThreads` (1)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1274` | Self: 0.0% (1.2ms) | Total: 0.0% (3.4ms) | Samples: 1

**Calls:**
- `async getAccountOwnAddresses` (2)

### `async provideConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/default-connection-provider.js:10` | Self: 0.0% (1.2ms) | Total: 2.4% (452.8ms) | Samples: 1

**Calls:**
- `async (anonymous)` (164)
- `async (anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/api/index.mjs:49` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `__exportStar`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/node_modules/tslib/tslib.js:153` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/utf8-to-jisx0212-table.js:10` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `anonymous` (1)

### `__exportAll`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/_virtual/_rolldown/runtime.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `decryptPayload`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts:62` | Self: 0.0% (1.1ms) | Total: 0.1% (25.0ms) | Samples: 1

**Called by:**
- `decodeSecret` (20)

**Calls:**
- `update` (7)
- `final` (6)
- `concat` (6)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:645` | Self: 0.0% (1.1ms) | Total: 15.3% (2.79s) | Samples: 1

**Called by:**
- `forEach` (2398)

**Calls:**
- `forEach` (2397)

### `async time`
`/tmp/spike-switch-server/anatomy.ts:31` | Self: 0.0% (1.1ms) | Total: 1.2% (227.9ms) | Samples: 1

**Calls:**
- `stringify` (58)
- `(anonymous)` (35)
- `async (anonymous)` (22)
- `async (anonymous)` (21)
- `async (anonymous)` (20)
- `async (anonymous)` (13)
- `(anonymous)` (9)
- `(anonymous)` (3)
- `async requireAccountContext` (1)
- `async listThreads` (1)
- `async (anonymous)` (1)
- `async validateAccountFolders` (1)
- `(anonymous)` (1)

### `throwForMissingRequestStore`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/work-unit-async-storage.external.js` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `headers` (1)

### `wrappedCipher`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/utils.js` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `encrypt` (1)

### `async sqliteGeneratedPrimaryKeyColumn`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:29` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async sqliteGeneratedPrimaryKeyColumn` (1)

### `async getMessageCalendarInviteDataByMessageId`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:164` | Self: 0.0% (1.1ms) | Total: 0.0% (4.4ms) | Samples: 1

**Called by:**
- `async listThreads` (4)

**Calls:**
- `from` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:409` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `makeBitMapDescriptor`
`internal:streams/writable` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `internal:streams/writable` (1)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:80` | Self: 0.0% (1.1ms) | Total: 0.3% (60.5ms) | Samples: 1

**Called by:**
- `async listThreads` (11)
- `getTopicSuggestionSignalsForThreadsFromDb` (5)
- `async getMessageCalendarInviteDataByMessageId` (4)
- `async listThreads` (3)
- `getTopicSuggestionsForThreadSignalBatch` (3)
- `executeQuery` (3)
- `async listThreads` (3)
- `async getTotalCount` (2)
- `async getAccountOwnAddresses` (2)
- `async requireActiveUserSession` (2)
- `enrollmentState` (2)
- `getThreadCollabStates` (2)
- `(anonymous)` (1)
- `async getAccountById` (1)
- `listSenderIdentityRows` (1)
- `readUserById` (1)
- `async requireActiveUserSession` (1)
- `lookup` (1)
- `async assertAccountFolder` (1)

**Calls:**
- `bump` (33)
- `bump` (5)
- `bump` (4)
- `bump` (3)
- `bump` (1)
- `bump` (1)
- `bump` (1)

### `decodeBase64`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/htmlparser2/node_modules/entities/dist/esm/internal/decode-shared.js:24` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:182` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:543` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `internal:stream`
`internal:stream:18` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `anonymous` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:22` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `flatIntoArrayWithCallback` (1)

### `#all`
`bun:sqlite` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `where`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:38` | Self: 0.0% (1.1ms) | Total: 0.1% (30.3ms) | Samples: 1

**Called by:**
- `(anonymous)` (23)
- `async getTables` (1)

**Calls:**
- `parseExpression` (19)
- `parseValueExpression` (1)
- `freeze` (1)
- `parseExpression` (1)
- `parseValueBinaryOperation` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async createInternalContext` (1)

### `SHA2_32B`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha2.js` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `_SHA256` (1)

### `NextResponse`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:41` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `json` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async transformSingleOutput` (1)

### `initGetFieldAttributes`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-attributes.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `getTime`
`[native code]` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async getThreadGroupCounts` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2465` | Self: 0.0% (1.1ms) | Total: 7.7% (1.41s) | Samples: 1

**Calls:**
- `(anonymous)` (1208)
- `(anonymous)` (4)
- `(anonymous)` (3)

### `array`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/identityMetadata.ts` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `hydrateIdentityMetadata` (1)

### `async getThreadGroupCounts`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1371` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async listThreads` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:228` | Self: 0.0% (1.1ms) | Total: 0.0% (2.5ms) | Samples: 1

**Called by:**
- `map` (2)

**Calls:**
- `(anonymous)` (1)

### `async runWithRequestState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:24` | Self: 0.0% (1.1ms) | Total: 0.0% (4.3ms) | Samples: 1

**Calls:**
- `run` (2)
- `run` (1)

### `async getMessageCalendarInviteDataByMessageId`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:201` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async listThreads` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async requireActiveUserSession` (1)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:387` | Self: 0.0% (1.1ms) | Total: 0.0% (8.1ms) | Samples: 1

**Calls:**
- `ensureSenderIdentityMessageRuntimeSchema` (6)

### `formatToParts`
`[native code]` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `displayDayNumberUncached` (1)

### `hydrateIdentityMetadata`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/identityMetadata.ts:8` | Self: 0.0% (1.1ms) | Total: 0.0% (2.3ms) | Samples: 1

**Called by:**
- `(anonymous)` (2)

**Calls:**
- `array` (1)

### `async update`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async updateWithHooks` (1)

### `async acquireConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:43` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2661` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `map` (1)

### `push`
`node:async_hooks:55` | Self: 0.0% (1.1ms) | Total: 0.0% (2.0ms) | Samples: 1

**Called by:**
- `run` (2)

**Calls:**
- `Frame` (1)

### `(anonymous)`
`/tmp/spike-switch-server/anatomy.ts:71` | Self: 0.0% (1.1ms) | Total: 0.0% (2.4ms) | Samples: 1

**Called by:**
- `map` (2)

**Calls:**
- `cloneObject` (1)

### `Error`
`[native code]` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `throwForMissingRequestStore` (1)

### `async assertAccountFolder`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/folderAccountGuard.ts` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async validateAccountFolders` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:604` | Self: 0.0% (1.1ms) | Total: 0.7% (140.3ms) | Samples: 1

**Called by:**
- `forEach` (122)

**Calls:**
- `(anonymous)` (120)
- `(anonymous)` (1)

### `chachaCore`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:78` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `runCipher` (1)

### `releaseLock`
`[native code]` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async readAuthJson` (1)

### `async validateAccountFolders`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/folderAccount.ts:11` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

### `async enrichMessagesWithThreadTopics`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async enrichMessagesWithThreadTopics` (1)

### `bump`
`/tmp/spike-switch-server/sqlcounter.ts:47` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:12` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

### `headers`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/headers.js:24` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:85` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `applySearchQueryFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:717` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async getTotalCount` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:555` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async findOne` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/ua-parser-js/ua-parser.js` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `943` (1)

### `async executeTakeFirst`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/insert-query-builder.js` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async executeTakeFirst` (1)

### `async getThreadGroupCounts`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1381` | Self: 0.0% (1.1ms) | Total: 0.0% (2.3ms) | Samples: 1

**Called by:**
- `async listThreads` (2)

**Calls:**
- `getTime` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `init` (1)

### `mergeModules`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/lib/helpers/merge-exports.js:8` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `async tryCatch`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/utils.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async tryCatch` (1)

### `deriveSystemFlagState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `getDatabaseFieldIndexName`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/database-index.mjs:46` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `resolveDatabaseSchemaIndexes` (1)

### `__decorate`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `final`
`node:crypto:344` | Self: 0.0% (1.1ms) | Total: 0.0% (8.0ms) | Samples: 1

**Called by:**
- `decryptPayload` (6)

**Calls:**
- `final` (5)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testAuthHarness.ts` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async withDbWriteRetry` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/mimetypes.js:6` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `anonymous` (1)

### `Promise`
`[native code]` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async lock` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `every` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:684` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `isFinalized`
`bun:sqlite:128` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `query` (1)

### `$constructor`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:112` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `getThreadCollabStates`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts:73` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async getThreadCollabStates` (1)

### `getTopicSuggestionsForThreadSignalBatch`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:619` | Self: 0.0% (1.1ms) | Total: 3.5% (646.4ms) | Samples: 1

**Called by:**
- `async withAccountDb` (558)

**Calls:**
- `(anonymous)` (552)
- `(anonymous)` (3)
- `(anonymous)` (2)

### `Proxy`
`[native code]` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `NextResponse` (1)

### `TextEncoder`
`[native code]` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `applyBadgeFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:890` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async listThreads` (1)

### `parseReferenceExpression`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `parseValueBinaryOperation` (1)

### `async ensureCalendarEventRuntimeData`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:663` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:83` | Self: 0.0% (1.1ms) | Total: 0.2% (45.4ms) | Samples: 1

**Called by:**
- `async listThreads` (11)
- `async getThreadGroupCounts` (4)
- `async getMessageCalendarInviteDataByMessageId` (4)
- `async listThreads` (4)
- `(anonymous)` (3)
- `getTopicSuggestionsForThreadSignalBatch` (2)
- `async listThreads` (2)
- `getThreadCollabStates` (2)
- `async listThreads` (1)
- `async requireActiveUserSession` (1)
- `(anonymous)` (1)
- `async resolveAccountDbPath` (1)
- `readUserById` (1)
- `listSenderIdentityRows` (1)
- `async getAccountById` (1)

**Calls:**
- `addMs` (37)
- `addMs` (1)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:51` | Self: 0.0% (1.1ms) | Total: 0.0% (2.5ms) | Samples: 1

**Calls:**
- `toISOString` (1)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1305` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

### `decodeSecret`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `mapAccountRow` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:571` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/he/he.js:31` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `createWithSpan`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/tracer.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async runBeforeHooks` (1)

### `selectFrom`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `(unknown)`
`[native code]` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `_handleAddress` (1)

### `applyBadgeFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:885` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async getTotalCount` (1)

### `object`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `#getExecutor`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/raw-builder/raw-builder.js:49` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async execute` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:677` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `init` (1)

### `async rebuildAllThreadSignalsForAccount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async rebuildAllThreadSignalsForAccount` (1)

### `insert`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/ftsIdentity.ts:88` | Self: 0.0% (1.1ms) | Total: 0.1% (33.1ms) | Samples: 1

**Called by:**
- `(anonymous)` (29)

**Calls:**
- `(anonymous)` (26)
- `(anonymous)` (2)

### `topicSuggestionEntriesFromThreadSignalRows`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `flush` (1)

### `async runValidation`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/validator.mjs:8` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async runValidation` (1)

### `async enrichMessagesWithThreadTopics`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:37` | Self: 0.0% (1.1ms) | Total: 0.0% (3.0ms) | Samples: 1

**Called by:**
- `async enrichMessagesWithThreadTopics` (3)

**Calls:**
- `async getTopicsForThreads` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:59` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async internalHandler` (1)

### `async assertAccountFolder`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/folderAccountGuard.ts:7` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async assertAccountFolder` (1)

### `Uint8Array`
`[native code]` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `concat` (1)

### `applySearchQueryFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:713` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async listThreads` (1)

### `_recoverAddrSpec`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `_handleAddress` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:506` | Self: 0.0% (1.1ms) | Total: 0.2% (50.0ms) | Samples: 1

**Called by:**
- `parseAliasedExpression` (37)

**Calls:**
- `selectFrom` (28)
- `selectFrom` (7)
- `selectFrom` (1)

### `async getThreadCollabStates`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/threadCollab.ts:44` | Self: 0.0% (1.1ms) | Total: 0.9% (180.0ms) | Samples: 1

**Called by:**
- `async enrichMessagesWithThreadCollab` (3)
- `async getThreadCollabStates` (2)

**Calls:**
- `getThreadCollabStates` (92)
- `getThreadCollabStates` (39)
- `getThreadCollabStates` (10)
- `getThreadCollabStates` (7)
- `async getThreadCollabStates` (2)
- `async getAccountDb` (2)
- `getThreadCollabStates` (1)
- `getThreadCollabStates` (1)

### `async resolveAccountRole`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/accountAccess.ts:12` | Self: 0.0% (1.1ms) | Total: 0.0% (14.7ms) | Samples: 1

**Called by:**
- `async requireAccountContext` (1)

**Calls:**
- `resolveAccountRoleRow` (6)
- `resolveAccountRoleRow` (5)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:31` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `listUsers`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `admin` (1)

### `resolve`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-model-name.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:664` | Self: 0.0% (1.1ms) | Total: 0.0% (2.3ms) | Samples: 1

**Called by:**
- `forEach` (2)

**Calls:**
- `forEach` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:33` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

### `nullable`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/accountPrefs.ts` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs:41` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

### `ZodOptional`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:103` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `optional` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts:72` | Self: 0.0% (1.1ms) | Total: 0.0% (5.9ms) | Samples: 1

**Called by:**
- `map` (5)

**Calls:**
- `defaultThreadCollabState` (3)
- `defaultThreadCollabState` (1)

### `async transformSingleOutput`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:146` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async getDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async resolveAccountDbPath` (1)

### `async lock`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async acquireConnection` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2320` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2224` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `atob`
`[native code]` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `tokenize`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `_parseAddressList` (1)

### `endsWith`
`[native code]` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:589` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `getProvider`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `GetMetadataProvider` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2304` | Self: 0.0% (1.1ms) | Total: 0.0% (2.1ms) | Samples: 1

**Calls:**
- `applyInviteUidQueryFilters` (1)

### `_isSpaceCode`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `_joinAtSpacing` (1)

### `_parseAddressList`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `addressparser` (1)

### `run`
`node:async_hooks` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async runWithRequestState` (1)

### `shouldIgnoreTopicSuggestionSignal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:126` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `create`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/value-node.js` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `parseValueBinaryOperation` (1)

### `transformJoinClause`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:282` | Self: 0.0% (1.1ms) | Total: 0.0% (2.4ms) | Samples: 1

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `keys` (1)

### `normalizeShardSql`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/ftsIdentity.ts` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `async dispatchAuthEndpoint`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:534` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:185` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `map` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:70` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `anonymous` (1)

### `parentNode`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/operation-node-visitor.js:6` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `visitSelectQuery` (1)

### `createFunctionModule`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/function-module.js:20` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `createExpressionBuilder` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `map` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@simplewebauthn/server/esm/services/metadataService.js` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2662` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `map` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:204` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async withAccountDb` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:3` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `map` (1)

### `__spreadArray`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:648` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:810` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `map` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `filter` (1)

### `getTopicSuggestionsForThreadSignalBatch`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:573` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async withAccountDb` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:166` | Self: 0.0% (1.0ms) | Total: 0.0% (2.3ms) | Samples: 1

**Called by:**
- `async transformSingleOutput` (2)

**Calls:**
- `Date` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-attributes.mjs:28` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `transformJoinClause`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `rowToTopic`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:662` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `readUserById`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/users.ts:32` | Self: 0.0% (1.0ms) | Total: 0.5% (103.8ms) | Samples: 1

**Called by:**
- `async getUserById` (72)

**Calls:**
- `(anonymous)` (52)
- `(anonymous)` (12)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (1)
- `wrapStatement` (1)
- `(anonymous)` (1)

### `resolve`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-model-name.mjs:17` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `async stageMessageFiles`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/storage.ts` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async stageMessageFiles` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:41` | Self: 0.0% (1.0ms) | Total: 0.0% (2.0ms) | Samples: 1

**Called by:**
- `forEach` (2)

**Calls:**
- `looksLikeJiraMessage` (1)

### `async time`
`/tmp/spike-switch-server/anatomy.ts:32` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2648` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `map` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:182` | Self: 0.0% (1.0ms) | Total: 0.0% (4.8ms) | Samples: 1

**Called by:**
- `async transformOutput` (2)

**Calls:**
- `async transformSingleOutput` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:334` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async findSession` (1)

### `runCipher`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_arx.js` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:638` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `buildMeaningfulAttachmentPredicateSql`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `buildMeaningfulAttachmentExistsSql` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `map` (1)

### `async dispatchAuthEndpoint`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:187` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/segment-config/ensure-static.js` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authPolicyHandler.ts` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `map` (1)

### `applyBadgeFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:869` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async getTotalCount` (1)

### `async getDatabaseColumnBounds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async getDatabaseColumnBounds` (1)

### `getEnumValues`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:197` | Self: 0.0% (1.0ms) | Total: 0.0% (3.2ms) | Samples: 1

**Called by:**
- `(anonymous)` (3)

**Calls:**
- `(anonymous)` (2)

### `async reconcileLifecycle`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/userLifecycle.ts` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async reconcileLifecycle` (1)

### `isPromise`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/utils/is-promise.mjs` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async runPluginInit` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:57` | Self: 0.0% (1.0ms) | Total: 0.4% (84.1ms) | Samples: 1

**Called by:**
- `flatIntoArrayWithCallback` (73)

**Calls:**
- `normalizeIdentityEmail` (33)
- `normalizeIdentityEmail` (11)
- `normalizeIdentityEmail` (10)
- `normalizeIdentityEmail` (6)
- `normalizeIdentityEmail` (4)
- `normalizeIdentityEmail` (3)
- `normalizeIdentityEmail` (3)
- `normalizeIdentityEmail` (1)
- `normalizeIdentityEmail` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/endpoint-context.mjs` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async getOrCreateEndpointContextStorage` (1)

### `async execute`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:318` | Self: 0.0% (1.0ms) | Total: 0.0% (14.8ms) | Samples: 1

**Called by:**
- `async execute` (12)

**Calls:**
- `async executeQuery` (10)
- `async executeQuery` (1)

### `NextResponse`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:39` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `json` (1)

### `async getThreadGroupCounts`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1402` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async listThreads` (1)

### `groupsFromRows`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async getThreadGroupCounts` (1)

### `async ensureCalendarEventRuntimeData`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async getAccountDb` (1)

### `query`
`bun:sqlite` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async createKyselyAdapter` (1)

### `parseExpression`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/expression-parser.js:7` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `where` (1)

### `async getTrustedOrigins`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/helpers.mjs` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async getTrustedOrigins` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:376` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `toASN`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `serialize` (1)

### `deriveSystemFlagState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:320` | Self: 0.0% (1.0ms) | Total: 0.0% (2.3ms) | Samples: 1

**Called by:**
- `(anonymous)` (2)

**Calls:**
- `some` (1)

### `Database`
`bun:sqlite` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async getDb` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:706` | Self: 0.0% (1.0ms) | Total: 0.1% (21.7ms) | Samples: 1

**Called by:**
- `async withAccountDb` (19)

**Calls:**
- `(anonymous)` (8)
- `(anonymous)` (8)
- `(anonymous)` (1)
- `wrapStatement` (1)

### `visitSelectQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:80` | Self: 0.0% (1.0ms) | Total: 0.0% (9.6ms) | Samples: 1

**Called by:**
- `bound visitSelectQuery` (7)

**Calls:**
- `visitNode` (6)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:19` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `init` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2482` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:423` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/well-known/index.js:6` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2683` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2476` | Self: 0.0% (1.0ms) | Total: 4.2% (776.4ms) | Samples: 1

**Calls:**
- `(anonymous)` (679)
- `(anonymous)` (2)

### `addColumn`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/schema/create-table-builder.js:127` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async getMigrations` (1)

### `decodeSecret`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts:73` | Self: 0.0% (1.0ms) | Total: 0.5% (91.8ms) | Samples: 1

**Called by:**
- `mapAccountRow` (47)
- `mapAccountRow` (17)
- `mapAccountRow` (11)

**Calls:**
- `decryptPayload` (25)
- `decryptPayload` (20)
- `(anonymous)` (14)
- `toString` (6)
- `decryptPayload` (4)
- `decryptPayload` (2)
- `decryptPayload` (2)
- `assertCredentialMode` (1)

### `debugLog`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:39` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:594` | Self: 0.0% (1.0ms) | Total: 0.0% (2.1ms) | Samples: 1

**Calls:**
- `formatTransactionId` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js:12` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:348` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async handleFallbackJoin` (1)

### `async runBeforeHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:67` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1021` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `anonymous` (1)

### `getOwnPropertyDescriptor`
`[native code]` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `members` (1)

### `deepmergeFastUnsafeCustom`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/deepmerge-ts/dist/index.mjs` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `async create`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:105` | Self: 0.0% (1.0ms) | Total: 0.0% (14.6ms) | Samples: 1

**Called by:**
- `async resolveAccountDbPath` (7)
- `listSenderIdentityRows` (4)
- `resolveAccountRoleRow` (1)

**Calls:**
- `addMs` (10)
- `addMs` (1)

### `async getMessageCalendarInviteDataByMessageId`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:189` | Self: 0.0% (1.0ms) | Total: 0.0% (5.0ms) | Samples: 1

**Called by:**
- `async listThreads` (4)

**Calls:**
- `map` (3)

### `#run`
`bun:sqlite` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `isAPIError`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/is-api-error.mjs` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `(anonymous)`
`/tmp/spike-switch-server/anatomy.ts:73` | Self: 0.0% (1.0ms) | Total: 0.0% (5.8ms) | Samples: 1

**Called by:**
- `map` (5)

**Calls:**
- `cloneObject` (4)

### `fromString`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `LocalObjectIdentifierValueBlock` (1)

### `assign`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `LinkifyIt` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:491` | Self: 0.0% (1.0ms) | Total: 0.0% (2.2ms) | Samples: 1

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/bags/pkcs8_shrouded_key_bag.js:2` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `anonymous` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2293` | Self: 0.0% (1.0ms) | Total: 0.0% (2.1ms) | Samples: 1

**Calls:**
- `applySearchQueryFilters` (1)

### `Address6`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv6.js` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `capSize`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/esm/charsets.js:213` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/key_usage.js:19` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `anonymous` (1)

### `get`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:210` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

### `applyAddressSearchFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:570` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async getTotalCount` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:372` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2540` | Self: 0.0% (1.0ms) | Total: 0.9% (170.2ms) | Samples: 1

**Calls:**
- `(anonymous)` (129)
- `(anonymous)` (10)
- `(anonymous)` (8)
- `wrapStatement` (1)

### `async get`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `normalize`
`/tmp/spike-switch-server/anatomy.ts:51` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `normalize` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts:76` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `map` (1)

### `async GET`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:55` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async GET` (1)

### `isCorrect`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/common.js` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `async getAccountById`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/serverDb.ts:24` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async requireAccountContext` (1)

### `parseValueExpression`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/value-parser.js:14` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `where` (1)

### `mapAccountRow`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts:153` | Self: 0.0% (1.0ms) | Total: 0.3% (60.3ms) | Samples: 1

**Called by:**
- `async getAccountById` (49)

**Calls:**
- `decodeSecret` (47)
- `decodeSecret` (1)

### `normalize`
`/tmp/spike-switch-server/anatomy.ts:60` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `normalize` (1)

### `async withAuthResponse`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:48` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-id-field.mjs:43` | Self: 0.0% (999us) | Total: 0.0% (999us) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `charAt`
`[native code]` | Self: 0.0% (999us) | Total: 0.0% (999us) | Samples: 1

**Called by:**
- `tokenize` (1)

### `extractEmailAddresses`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:22` | Self: 0.0% (998us) | Total: 0.2% (41.1ms) | Samples: 1

**Called by:**
- `(anonymous)` (34)

**Calls:**
- `flatIntoArrayWithCallback` (32)
- `Set` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:176` | Self: 0.0% (998us) | Total: 0.0% (998us) | Samples: 1

**Called by:**
- `map` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:181` | Self: 0.0% (997us) | Total: 0.0% (997us) | Samples: 1

**Called by:**
- `DBCSCodec` (1)

### `safeParseJson`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts:22` | Self: 0.0% (997us) | Total: 0.1% (26.3ms) | Samples: 1

**Called by:**
- `mapAccountRow` (22)

**Calls:**
- `parse` (21)

### `compileList`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:134` | Self: 0.0% (996us) | Total: 0.0% (996us) | Samples: 1

**Called by:**
- `visitSelectQuery` (1)

### `parseSearchInput`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:601` | Self: 0.0% (996us) | Total: 0.0% (996us) | Samples: 1

**Called by:**
- `async listThreads` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:248` | Self: 0.0% (996us) | Total: 1.6% (300.1ms) | Samples: 1

**Called by:**
- `async withAccountDb` (152)

**Calls:**
- `rememberTopicLearningForThread` (149)
- `rememberTopicLearningForThread` (2)

### `initGetDefaultModelName`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-model-name.mjs` | Self: 0.0% (996us) | Total: 0.0% (996us) | Samples: 1

**Called by:**
- `initGetModelName` (1)

### `looksLikeJiraMessage`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:31` | Self: 0.0% (994us) | Total: 0.0% (994us) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `safeParseJson`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts` | Self: 0.0% (994us) | Total: 0.0% (994us) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:101` | Self: 0.0% (993us) | Total: 0.0% (993us) | Samples: 1

**Called by:**
- `listSenderIdentityRows` (1)

### `applyInviteUidQueryFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:786` | Self: 0.0% (992us) | Total: 0.0% (2.2ms) | Samples: 1

**Called by:**
- `async getTotalCount` (1)
- `async listThreads` (1)

**Calls:**
- `normalizeCalendarEventUidKeys` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/raw-builder/raw-builder.js` | Self: 0.0% (990us) | Total: 0.0% (990us) | Samples: 1

**Called by:**
- `RawBuilderImpl` (1)

### `setHeader`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:27` | Self: 0.0% (990us) | Total: 0.0% (990us) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `visitWhere`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:144` | Self: 0.0% (989us) | Total: 0.0% (8.5ms) | Samples: 1

**Called by:**
- `bound visitWhere` (6)

**Calls:**
- `visitNode` (5)

### `IsSymbol`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js` | Self: 0.0% (987us) | Total: 0.0% (987us) | Samples: 1

**Called by:**
- `ToPropertyKey` (1)

### `async getAccountById`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accounts.ts` | Self: 0.0% (987us) | Total: 0.0% (987us) | Samples: 1

**Called by:**
- `async ensureCalendarEventRuntimeData` (1)

### `topicSuggestionEntriesFromThreadSignalRows`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:178` | Self: 0.0% (987us) | Total: 1.3% (246.8ms) | Samples: 1

**Called by:**
- `flush` (214)

**Calls:**
- `flatMap` (213)

### `matcher`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:73` | Self: 0.0% (986us) | Total: 0.0% (986us) | Samples: 1

**Called by:**
- `async runAfterHooks` (1)

### `defaultThreadCollabState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts` | Self: 0.0% (983us) | Total: 0.0% (983us) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `async reconcileProvisioning`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/userProvisioning.ts` | Self: 0.0% (983us) | Total: 0.0% (983us) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `finalize`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_poly1305.js` | Self: 0.0% (982us) | Total: 0.0% (982us) | Samples: 1

**Called by:**
- `digestInto` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2227` | Self: 0.0% (981us) | Total: 0.0% (2.2ms) | Samples: 1

**Calls:**
- `async getAccountOwnAddresses` (1)

### `ResponseCookies`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/@edge-runtime/cookies/index.js:261` | Self: 0.0% (980us) | Total: 0.0% (980us) | Samples: 1

**Called by:**
- `NextResponse` (1)

### `_handleAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:695` | Self: 0.0% (979us) | Total: 0.0% (979us) | Samples: 1

**Called by:**
- `_parseAddressList` (1)

### `persistAccountRow`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts` | Self: 0.0% (978us) | Total: 0.0% (978us) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `applyBadgeFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:834` | Self: 0.0% (978us) | Total: 0.0% (978us) | Samples: 1

**Called by:**
- `async listThreads` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:637` | Self: 0.0% (977us) | Total: 0.0% (977us) | Samples: 1

**Called by:**
- `forEach` (1)

### `/\s/`
`[native code]` | Self: 0.0% (975us) | Total: 0.0% (975us) | Samples: 1

**Called by:**
- `_recoverAddrSpec` (1)

### `add`
`[native code]` | Self: 0.0% (974us) | Total: 0.0% (974us) | Samples: 1

**Called by:**
- `ensureThreadCollabRuntimeSchema` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/node.js:78` | Self: 0.0% (973us) | Total: 0.0% (973us) | Samples: 1

**Called by:**
- `anonymous` (1)

### `expr`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:382` | Self: 0.0% (972us) | Total: 0.0% (972us) | Samples: 1

**Called by:**
- `map` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:77` | Self: 0.0% (971us) | Total: 0.0% (971us) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:69` | Self: 0.0% (970us) | Total: 0.0% (4.6ms) | Samples: 1

**Calls:**
- `async setThreadTopics` (3)

### `async findUserByEmail`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs` | Self: 0.0% (969us) | Total: 0.0% (969us) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `toUpperCase`
`[native code]` | Self: 0.0% (969us) | Total: 0.0% (969us) | Samples: 1

**Called by:**
- `serializeCookieValue` (1)

### `async runBeforeHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:83` | Self: 0.0% (968us) | Total: 0.0% (968us) | Samples: 1

**Called by:**
- `async runBeforeHooks` (1)

### `getChunkedCookie`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/session-store.mjs:138` | Self: 0.0% (967us) | Total: 0.0% (967us) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async runBeforeHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:106` | Self: 0.0% (957us) | Total: 0.0% (10.2ms) | Samples: 1

**Called by:**
- `async (anonymous)` (9)

**Calls:**
- `async runBeforeHooks` (4)
- `async runBeforeHooks` (1)
- `async runBeforeHooks` (1)
- `async runBeforeHooks` (1)
- `async runBeforeHooks` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:14` | Self: 0.0% (953us) | Total: 0.0% (15.6ms) | Samples: 1

**Calls:**
- `parseCookies` (5)
- `parseCookies` (2)
- `parseCookies` (2)
- `parseCookies` (1)
- `parseCookies` (1)
- `parseCookies` (1)

### `messageAuthorEmailSql`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/ownAddressSql.ts:11` | Self: 0.0% (952us) | Total: 0.0% (952us) | Samples: 1

**Called by:**
- `buildThreadLatestReceivedDateSql` (1)

### `decodeDelta`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/internal/decode-shared.js:92` | Self: 0.0% (951us) | Total: 0.0% (951us) | Samples: 1

**Called by:**
- `decodeTrieDict` (1)

### `$constructor`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:46` | Self: 0.0% (949us) | Total: 0.0% (949us) | Samples: 1

**Called by:**
- `(module)` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2468` | Self: 0.0% (948us) | Total: 0.2% (38.2ms) | Samples: 1

**Calls:**
- `(anonymous)` (29)
- `(anonymous)` (2)
- `wrapStatement` (1)
- `(anonymous)` (1)

### `getAuth`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:263` | Self: 0.0% (947us) | Total: 0.0% (947us) | Samples: 1

**Called by:**
- `async requireActiveUserSession` (1)

### `async enrichMessagesWithThreadTopics`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:49` | Self: 0.0% (947us) | Total: 0.0% (947us) | Samples: 1

### `sort`
`[native code]` | Self: 0.0% (947us) | Total: 0.0% (2.0ms) | Samples: 1

**Called by:**
- `(anonymous)` (2)

**Calls:**
- `compareSqliteText` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:152` | Self: 0.0% (946us) | Total: 0.0% (3.4ms) | Samples: 1

**Called by:**
- `async transformSingleOutput` (3)

**Calls:**
- `find` (1)
- `entries` (1)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1360` | Self: 0.0% (946us) | Total: 0.0% (2.0ms) | Samples: 1

**Called by:**
- `async listThreads` (2)

**Calls:**
- `async getTotalCount` (1)

### `async #transformResult`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js` | Self: 0.0% (944us) | Total: 0.0% (944us) | Samples: 1

**Called by:**
- `async executeQuery` (1)

### `async before`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authPolicyHandler.ts` | Self: 0.0% (943us) | Total: 0.0% (943us) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:1236` | Self: 0.0% (943us) | Total: 0.0% (1.9ms) | Samples: 1

**Called by:**
- `init` (2)

**Calls:**
- `init` (1)

### `async runValidation`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/validator.mjs:6` | Self: 0.0% (939us) | Total: 0.0% (939us) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/attribute_certificate_info.js` | Self: 0.0% (937us) | Total: 0.0% (937us) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `decodeSecret`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts:68` | Self: 0.0% (934us) | Total: 0.0% (934us) | Samples: 1

**Called by:**
- `mapAccountRow` (1)

### `writer`
`[native code]` | Self: 0.0% (934us) | Total: 0.0% (934us) | Samples: 1

**Called by:**
- `WriteStream` (1)

### `ensureThreadRuntimeSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:382` | Self: 0.0% (931us) | Total: 0.0% (931us) | Samples: 1

**Called by:**
- `async getAccountDb` (1)

### `async upsertMessages`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts` | Self: 0.0% (929us) | Total: 0.0% (929us) | Samples: 1

**Called by:**
- `async buildFixture` (1)

### `Frame`
`node:async_hooks` | Self: 0.0% (922us) | Total: 0.0% (922us) | Samples: 1

**Called by:**
- `push` (1)

### `optional`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:58` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `bound optional` (1)

**Calls:**
- `optional` (1)

### `getTopicSuggestionSignalsForThreadsFromDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:216` | Self: 0.0% (0us) | Total: 0.7% (138.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (120)

**Calls:**
- `(anonymous)` (115)
- `(anonymous)` (5)

### `async createSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:331` | Self: 0.0% (0us) | Total: 0.9% (163.9ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async (anonymous)` (1)

### `bound call`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `copyProps` (1)

**Calls:**
- `hasOwnProperty` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/well-known/index.js:3` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Calls:**
- `forEach` (2)

### `loadManualCategoryStatesForMessageIds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:317` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `(anonymous)` (2)

### `async stageMessageFiles`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/storage.ts:264` | Self: 0.0% (0us) | Total: 0.0% (14.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (9)

**Calls:**
- `async stageMessageFiles` (7)
- `async stageMessageFiles` (1)
- `async stageMessageFiles` (1)

### `async requireActiveUserSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:67` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `async requireActiveUserSession` (2)

**Calls:**
- `getAuth` (1)
- `getAuth` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/update-user.mjs:200` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Calls:**
- `_string` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:293` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async getSessionFromCtx` (1)

### `digestInto`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_poly1305.js:287` | Self: 0.0% (0us) | Total: 0.0% (982us) | Samples: 0

**Called by:**
- `digest` (1)

**Calls:**
- `finalize` (1)

### `LinkifyIt`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:361` | Self: 0.0% (0us) | Total: 0.0% (6.9ms) | Samples: 0

**Called by:**
- `LinkifyIt` (5)

**Calls:**
- `compile` (3)
- `compile` (1)
- `compile` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:880` | Self: 0.0% (0us) | Total: 0.0% (3.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `createSelectAll`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/selection-node.js:21` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `parseSelectAll` (1)

**Calls:**
- `create` (1)

### `cloneWithSelections`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/select-query-node.js:32` | Self: 0.0% (0us) | Total: 0.0% (5.5ms) | Samples: 0

**Called by:**
- `selectAll` (4)

**Calls:**
- `freeze` (4)

### `node:_http_client`
`node:_http_client:10` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `anonymous` (2)

### `flush`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:43` | Self: 0.0% (0us) | Total: 0.9% (167.9ms) | Samples: 0

**Called by:**
- `(anonymous)` (141)
- `insertThreadSignalsFromMessageRows` (1)

**Calls:**
- `collectTopicSignalEntries` (128)
- `collectTopicSignalEntries` (11)
- `collectTopicSignalEntries` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/transport.js:10` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `_unknown`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/api.js:460` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `ZodUnknown` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/index.js:9` | Self: 0.0% (0us) | Total: 0.0% (2.8ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `bound require` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/signer_identifier.js:7` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:820` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `async findOne`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:505` | Self: 0.0% (0us) | Total: 0.6% (112.6ms) | Samples: 0

**Called by:**
- `async findOne` (85)

**Calls:**
- `selectFrom` (84)
- `selectFrom` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema/session.mjs:5` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `_coercedString` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/index.js:6` | Self: 0.0% (0us) | Total: 0.0% (4.4ms) | Samples: 0

**Called by:**
- `anonymous` (4)

**Calls:**
- `bound require` (4)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:37` | Self: 0.0% (0us) | Total: 0.0% (972us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `formatTransactionId`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:865` | Self: 0.0% (0us) | Total: 0.0% (8.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)
- `async (anonymous)` (2)
- `async (anonymous)` (1)

**Calls:**
- `getColorDepth` (2)
- `getColorDepth` (1)
- `getColorDepth` (1)
- `getColorDepth` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:889` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `visitReference`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:288` | Self: 0.0% (0us) | Total: 0.0% (8.8ms) | Samples: 0

**Called by:**
- `bound visitReference` (7)

**Calls:**
- `visitNode` (7)

### `parseRowValues`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/insert-values-parser.js:46` | Self: 0.0% (0us) | Total: 0.9% (165.8ms) | Samples: 0

**Called by:**
- `map` (1)

**Calls:**
- `isUndefined` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/headers.js:1` | Self: 0.0% (0us) | Total: 0.0% (2.5ms) | Samples: 0

**Calls:**
- `bound require` (2)

### `rebuildAllThreadSignalsForAccountInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:131` | Self: 0.0% (0us) | Total: 1.3% (250.8ms) | Samples: 0

**Called by:**
- `async rebuildAllThreadSignalsForAccount` (157)

**Calls:**
- `insertThreadSignalsFromMessageRows` (156)
- `insertThreadSignalsFromMessageRows` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:54` | Self: 0.0% (0us) | Total: 3.9% (721.5ms) | Samples: 0

**Called by:**
- `forEach` (405)

**Calls:**
- `flush` (264)
- `flush` (141)

### `enableStreamingAPI`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/lib/index.js:145` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `bound require` (1)

### `getThreadCollabStates`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts:75` | Self: 0.0% (0us) | Total: 0.2% (43.7ms) | Samples: 0

**Called by:**
- `async getThreadCollabStates` (39)

**Calls:**
- `(anonymous)` (37)
- `(anonymous)` (1)
- `wrapStatement` (1)

### `init`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:52` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `ZodOptional` (1)

**Calls:**
- `Internals` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (1)
- `__exportStar` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:666` | Self: 0.0% (0us) | Total: 1.2% (220.4ms) | Samples: 0

**Called by:**
- `forEach` (191)

**Calls:**
- `forEach` (191)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/tools.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema/account.mjs:18` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `bound nullish` (1)

### `members`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:734` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `getOwnPropertyDescriptor` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:208` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `(anonymous)` (2)

**Calls:**
- `async runWithEndpointContext` (2)

### `parseSelectExpression`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/select-parser.js:22` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `map` (1)

**Calls:**
- `freeze` (1)

### `async updateWithHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/with-hooks.mjs:63` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `async update` (1)

### `insertThreadSignalsFromMessageRows`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:67` | Self: 0.0% (0us) | Total: 0.0% (4.8ms) | Samples: 0

**Called by:**
- `rebuildThreadSignalsForThreadIdsInternal` (3)
- `rebuildAllThreadSignalsForAccountInternal` (1)

**Calls:**
- `flush` (3)
- `flush` (1)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:400` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `async ensureThreadSignalRuntimeData` (1)

### `async getMigrations`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:556` | Self: 0.0% (0us) | Total: 0.0% (996us) | Samples: 0

**Calls:**
- `initGetModelName` (1)

### `write`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/doc.js:27` | Self: 0.0% (0us) | Total: 0.0% (4.0ms) | Samples: 0

**Called by:**
- `generateFastpass` (1)

**Calls:**
- `map` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:16` | Self: 0.0% (0us) | Total: 0.0% (12.5ms) | Samples: 0

**Calls:**
- `copyDataProperties` (11)

### `getTopicSuggestionSignalsForThreadsFromDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:197` | Self: 0.0% (0us) | Total: 0.0% (5.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (4)

**Calls:**
- `from` (4)

### `ToPropertyKey`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:760` | Self: 0.0% (0us) | Total: 0.0% (987us) | Samples: 0

**Called by:**
- `decorate` (1)

**Calls:**
- `IsSymbol` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/index.js:10` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async getDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:313` | Self: 0.0% (0us) | Total: 0.5% (96.4ms) | Samples: 0

**Calls:**
- `async withDbWriteRetry` (36)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/attributes/counter_signature.js:6` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `async requireActiveUserSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:75` | Self: 0.0% (0us) | Total: 0.0% (6.9ms) | Samples: 0

**Calls:**
- `(anonymous)` (5)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/validity.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `admin`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/admin.mjs:73` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `noctuaAuthOptions` (1)

**Calls:**
- `listUsers` (1)

### `filterOutputFields`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs:9` | Self: 0.0% (0us) | Total: 0.2% (40.5ms) | Samples: 0

**Called by:**
- `async (anonymous)` (10)
- `async (anonymous)` (7)
- `async (anonymous)` (6)
- `async (anonymous)` (4)

**Calls:**
- `structuredClone` (22)
- `filter` (3)
- `entries` (2)

### `cached`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/i18n/format.ts:15` | Self: 0.0% (0us) | Total: 0.0% (9.9ms) | Samples: 0

**Called by:**
- `displayDayNumberUncached` (8)

**Calls:**
- `(anonymous)` (8)

### `_string`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/api.js:12` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `(module)` (1)
- `(module)` (1)

**Calls:**
- `ZodString` (1)
- `copyDataProperties` (1)

### `createHasher`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/utils.js:632` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `(module)` (1)
- `(module)` (1)

**Calls:**
- `(anonymous)` (1)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:2922` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:24` | Self: 0.0% (0us) | Total: 0.1% (23.8ms) | Samples: 0

**Calls:**
- `WeakMap` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:11` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:513` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `parseAliasedExpression` (2)

**Calls:**
- `selectAll` (2)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1344` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `applyInviteUidQueryFilters` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:850` | Self: 0.0% (0us) | Total: 0.0% (3.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:222` | Self: 0.0% (0us) | Total: 0.0% (11.7ms) | Samples: 0

**Called by:**
- `async withAccountDb` (10)

**Calls:**
- `(anonymous)` (9)
- `(anonymous)` (1)

### `concat`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:75` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `toBER` (1)

**Calls:**
- `Uint8Array` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/mailparser/dist/esm/mail-parser.js:53` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `add` (1)

### `transformJoinClause`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:288` | Self: 0.0% (0us) | Total: 0.0% (13.8ms) | Samples: 0

**Called by:**
- `async (anonymous)` (10)

**Calls:**
- `entries` (8)
- `filter` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/source-map-js/source-map.js:6` | Self: 0.0% (0us) | Total: 0.0% (2.5ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `async handleFallbackJoin`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:395` | Self: 0.0% (0us) | Total: 0.5% (100.7ms) | Samples: 0

**Called by:**
- `async (anonymous)` (65)

**Calls:**
- `async (anonymous)` (56)
- `async (anonymous)` (6)
- `async (anonymous)` (1)
- `async (anonymous)` (1)
- `async (anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/sign-in.mjs:368` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `run` (1)

**Calls:**
- `async (anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:299` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async (anonymous)` (1)

### `visitSchemableIdentifier`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:384` | Self: 0.0% (0us) | Total: 0.0% (8.8ms) | Samples: 0

**Called by:**
- `bound visitSchemableIdentifier` (7)

**Calls:**
- `visitNode` (7)

### `enrollmentState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:376` | Self: 0.0% (0us) | Total: 0.1% (23.5ms) | Samples: 0

**Called by:**
- `async isMfaEnrollmentComplete` (18)

**Calls:**
- `(anonymous)` (16)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `async update`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:578` | Self: 0.0% (0us) | Total: 0.0% (2.5ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)
- `async update` (1)

**Calls:**
- `async withReturning` (1)
- `async update` (1)

### `async generateHOTP`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/utils/dist/otp.mjs:22` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Called by:**
- `async generateHOTP` (1)

**Calls:**
- `async sign` (1)

### `async requireAccountContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/accountContext.ts:58` | Self: 0.0% (0us) | Total: 0.0% (4.3ms) | Samples: 0

**Calls:**
- `roleAtLeast` (4)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/types/index.js:3` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/mailparser/dist/esm/tlds.cjs:8` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `upsertTopicLearningSignalsForThreadIds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:128` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `rememberTopicLearningForThread` (1)
- `async (anonymous)` (1)

**Calls:**
- `normalizeThreadIds` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testAuthHarness.ts:171` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `run` (1)

**Calls:**
- `async (anonymous)` (1)

### `async findOne`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:521` | Self: 0.0% (0us) | Total: 0.1% (18.6ms) | Samples: 0

**Called by:**
- `async findOne` (6)

**Calls:**
- `select` (6)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/index.js:7` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1088` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `table`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-data.js:92` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `DBCSCodec` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/shared/lib/router/utils/format-next-pathname-info.js:14` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `configureDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:89` | Self: 0.0% (0us) | Total: 0.1% (20.5ms) | Samples: 0

**Called by:**
- `configureAccountDb` (5)
- `async getDb` (4)
- `async getAuthDb` (1)

**Calls:**
- `(anonymous)` (10)

### `DefaultQueryCompiler`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `BunSqliteQueryCompiler` (1)

**Calls:**
- `OperationNodeVisitor` (1)

### `async migrateAuthSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:211` | Self: 0.0% (0us) | Total: 0.0% (4.8ms) | Samples: 0

**Called by:**
- `async migrateAuthSchema` (4)

**Calls:**
- `async getMigrations` (4)

### `serialize`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js:16` | Self: 0.0% (0us) | Total: 0.0% (10.7ms) | Samples: 0

**Called by:**
- `(anonymous)` (3)
- `toASN` (3)
- `(anonymous)` (2)
- `(anonymous)` (1)

**Calls:**
- `toASN` (4)
- `toASN` (4)
- `toASN` (1)

### `bound visitBinaryOperation`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (7.6ms) | Samples: 0

**Called by:**
- `visitNode` (5)

**Calls:**
- `visitBinaryOperation` (4)
- `visitBinaryOperation` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/container.js:3` | Self: 0.0% (0us) | Total: 0.0% (6.7ms) | Samples: 0

**Called by:**
- `anonymous` (6)

**Calls:**
- `bound require` (6)

### `async getTables`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:81` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `async getMigrations` (2)

**Calls:**
- `async getTables` (1)
- `async getTables` (1)

### `getHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:157` | Self: 0.0% (0us) | Total: 0.0% (3.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (3)

**Calls:**
- `flatIntoArrayWithCallback` (3)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/mailparser/dist/esm/mail-parser.js:40` | Self: 0.0% (0us) | Total: 0.0% (13.0ms) | Samples: 0

**Calls:**
- `tlds` (10)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:375` | Self: 0.0% (0us) | Total: 0.0% (4.7ms) | Samples: 0

**Called by:**
- `forEach` (4)

**Calls:**
- `(anonymous)` (3)
- `(anonymous)` (1)

### `async rebuildThreadSignalsForThreadIds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:114` | Self: 0.0% (0us) | Total: 2.7% (498.9ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `rebuildThreadSignalsForThreadIdsInternal` (252)
- `rebuildThreadSignalsForThreadIdsInternal` (9)
- `rebuildThreadSignalsForThreadIdsInternal` (7)
- `rebuildThreadSignalsForThreadIdsInternal` (2)
- `rebuildThreadSignalsForThreadIdsInternal` (1)
- `async rebuildThreadSignalsForThreadIds` (1)

### `async getDatabaseIndexMap`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:239` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async getMigrations` (1)

**Calls:**
- `async getDatabaseIndexMap` (1)

### `_boolean`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/api.js:383` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `(module)` (1)
- `(module)` (1)

**Calls:**
- `ZodBoolean` (2)

### `visitSelection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:123` | Self: 0.0% (0us) | Total: 0.0% (9.2ms) | Samples: 0

**Called by:**
- `bound visitSelection` (7)

**Calls:**
- `visitNode` (7)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/at-rule.js:3` | Self: 0.0% (0us) | Total: 0.0% (8.0ms) | Samples: 0

**Called by:**
- `anonymous` (7)

**Calls:**
- `bound require` (7)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:367` | Self: 0.0% (0us) | Total: 0.4% (81.6ms) | Samples: 0

**Called by:**
- `async handleFallbackJoin` (56)

**Calls:**
- `(anonymous)` (55)
- `withSpan` (1)

### `async ensureThreadSignalRuntimeData`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:157` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `async getAccountDb` (1)
- `async ensureThreadSignalRuntimeData` (1)

**Calls:**
- `async ensureThreadSignalRuntimeData` (1)
- `async rebuildAllThreadSignalsForAccount` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/pino.js:4` | Self: 0.0% (0us) | Total: 0.0% (3.4ms) | Samples: 0

**Calls:**
- `bound require` (2)

### `cloneWithSelections`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/select-query-node.js:28` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `selectAll` (1)

**Calls:**
- `cloneObject` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/headers.js:3` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `buildThreadLatestReceivedDateSql`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:196` | Self: 0.0% (0us) | Total: 0.0% (952us) | Samples: 0

**Called by:**
- `async recomputeThreadsForAccountInternal` (1)

**Calls:**
- `messageAuthorEmailSql` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/index.js:9` | Self: 0.0% (0us) | Total: 0.0% (982us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/work-async-storage.external.js:11` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `ftsNeedsRebuild`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountKeys.ts:163` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `migrate` (1)

**Calls:**
- `some` (1)

### `async isMfaEnrollmentComplete`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authPolicy.ts:21` | Self: 0.0% (0us) | Total: 0.1% (32.7ms) | Samples: 0

**Calls:**
- `enrollmentState` (18)
- `enrollmentState` (7)
- `enrollmentState` (1)

### `bound optional`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (3.2ms) | Samples: 0

**Called by:**
- `(module)` (1)
- `(module)` (1)
- `(module)` (1)

**Calls:**
- `optional` (2)
- `optional` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:2103` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `parseTableExpressionOrList`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/table-parser.js:13` | Self: 0.0% (0us) | Total: 0.6% (119.7ms) | Samples: 0

**Called by:**
- `selectFrom` (83)
- `selectFrom` (7)

**Calls:**
- `parseAliasedExpression` (80)
- `create` (4)
- `parseAliasedTable` (3)
- `parseAliasedExpression` (1)
- `toOperationNode` (1)
- `parseTableExpression` (1)

### `rebuildAllThreadSignalsForAccountInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:130` | Self: 0.0% (0us) | Total: 0.0% (3.3ms) | Samples: 0

**Called by:**
- `async rebuildAllThreadSignalsForAccount` (3)

**Calls:**
- `(anonymous)` (3)

### `(module)`
`/tmp/spike-switch-server/anatomy.ts:74` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `async time` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:5` | Self: 0.0% (0us) | Total: 0.0% (4.6ms) | Samples: 0

**Called by:**
- `async ensureAsyncStorage` (1)

**Calls:**
- `__getBetterAuthGlobal` (1)

### `(module)`
`/tmp/spike-switch-server/anatomy.ts:63` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Calls:**
- `update` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/encoding-table.js:1` | Self: 0.0% (0us) | Total: 0.0% (11.1ms) | Samples: 0

**Called by:**
- `anonymous` (10)

**Calls:**
- `bound require` (10)

### `RuntimeDriver`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:18` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Called by:**
- `Kysely` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/parse.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `needsRebuild`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountKeys.ts:148` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `some` (1)

**Calls:**
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:703` | Self: 0.0% (0us) | Total: 0.1% (23.5ms) | Samples: 0

**Calls:**
- `map` (19)
- `Map` (1)

### `computeTag`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:328` | Self: 0.0% (0us) | Total: 0.0% (982us) | Samples: 0

**Called by:**
- `encrypt` (1)

**Calls:**
- `digest` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/shared/lib/router/utils/format-next-pathname-info.js:12` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `initAccountSchemaBody`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:1003` | Self: 0.0% (0us) | Total: 0.0% (974us) | Samples: 0

**Called by:**
- `async withDbWriteRetry` (1)

**Calls:**
- `ensureThreadCollabRuntimeSchema` (1)

### `where`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:36` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `cloneObject` (1)

### `ensureInviteIssuerSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:127` | Self: 0.0% (0us) | Total: 0.0% (6.7ms) | Samples: 0

**Called by:**
- `initMasterSchema` (2)

**Calls:**
- `transaction` (2)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/state.mjs:34` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Calls:**
- `_unknown` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:321` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `__decorate` (1)

### `executeQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:60` | Self: 0.0% (0us) | Total: 1.5% (279.3ms) | Samples: 0

**Called by:**
- `async (anonymous)` (73)

**Calls:**
- `(anonymous)` (65)
- `(anonymous)` (5)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `wrapStatement` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/he/he.js:342` | Self: 0.0% (0us) | Total: 0.0% (13.6ms) | Samples: 0

**Calls:**
- `(anonymous)` (4)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/decorators/index.js:3` | Self: 0.0% (0us) | Total: 0.0% (4.5ms) | Samples: 0

**Called by:**
- `anonymous` (4)

**Calls:**
- `bound require` (4)

### `Tokenizer`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:806` | Self: 0.0% (0us) | Total: 0.0% (5.0ms) | Samples: 0

**Called by:**
- `_parseAddressList` (4)

**Calls:**
- `TokenList` (3)
- `TokenList` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2614` | Self: 0.0% (0us) | Total: 1.7% (321.8ms) | Samples: 0

**Calls:**
- `map` (278)

### `async waitOrAbort`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/abort.js:60` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `async acquireConnection` (2)

**Calls:**
- `async waitOrAbort` (2)

### `async serializeSignedCookie`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:84` | Self: 0.0% (0us) | Total: 0.0% (4.8ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/index.js:10` | Self: 0.0% (0us) | Total: 0.0% (3.4ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `bound require` (3)

### `OrdinaryGetMetadata`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:592` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `OrdinaryGetMetadata` (1)

**Calls:**
- `OrdinaryHasOwnMetadata` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs:52` | Self: 0.0% (0us) | Total: 0.0% (4.6ms) | Samples: 0

**Called by:**
- `async signIn` (1)

**Calls:**
- `async (anonymous)` (1)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:390` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Calls:**
- `ensureMessageCalendarEventRuntimeSchema` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/encoding/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `run`
`bun:sqlite:318` | Self: 0.0% (0us) | Total: 0.4% (74.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (37)

**Calls:**
- `run` (37)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/input.js:6` | Self: 0.0% (0us) | Total: 0.0% (996us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1302` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Calls:**
- `applyAddressSearchFilters` (1)
- `applyAddressSearchFilters` (1)

### `localFromBER`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1438` | Self: 0.0% (0us) | Total: 0.0% (3.6ms) | Samples: 0

**Called by:**
- `toASN` (2)
- `localFromBERWithChildContext` (1)

**Calls:**
- `fromBER` (1)
- `fromBER` (1)
- `fromBER` (1)

### `Agent`
`node:https:194` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `node:https` (1)

**Calls:**
- `Agent` (1)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:67` | Self: 0.0% (0us) | Total: 0.0% (9.1ms) | Samples: 0

**Calls:**
- `async createTopic` (1)

### `async findOne`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:598` | Self: 0.0% (0us) | Total: 2.0% (366.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (119)
- `async (anonymous)` (6)
- `async (anonymous)` (1)
- `async (anonymous)` (1)

**Calls:**
- `async (anonymous)` (91)
- `async (anonymous)` (19)
- `async (anonymous)` (10)
- `async (anonymous)` (3)
- `async (anonymous)` (2)
- `async (anonymous)` (1)
- `async (anonymous)` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/mailparser/dist/esm/mail-parser.js:38` | Self: 0.0% (0us) | Total: 0.0% (8.0ms) | Samples: 0

**Calls:**
- `LinkifyIt` (6)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:821` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `pruneThreadTopicsWithoutMessages` (1)

### `normalizeShardSql`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/ftsIdentity.ts:2` | Self: 0.0% (0us) | Total: 0.0% (998us) | Samples: 0

**Called by:**
- `shardWriterGuardsInstalled` (1)

**Calls:**
- `replace` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:60` | Self: 0.0% (0us) | Total: 0.0% (2.5ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `clampThreadListPageSize` (2)

### `shouldIgnoreTopicSuggestionSignalUncached`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:148` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `shouldIgnoreTopicSuggestionSignal` (1)

**Calls:**
- `isFreeMailDomain` (1)

### `get value`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:41` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `normalizeDef` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:593` | Self: 0.0% (0us) | Total: 0.1% (24.3ms) | Samples: 0

**Calls:**
- `async transformOutput` (17)
- `async transformOutput` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/parseley/lib/parseley.mjs:15` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `createLexer` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema/shared.mjs:3` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `object` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-ecc/build/cjs/index.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `async getCategoryLinearModel`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/categories.ts:89` | Self: 0.0% (0us) | Total: 0.0% (1.4ms) | Samples: 0

**Calls:**
- `createSeededLinearModel` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:851` | Self: 0.0% (0us) | Total: 0.0% (4.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `normalizeUserEmails` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:9` | Self: 0.0% (0us) | Total: 0.1% (18.2ms) | Samples: 0

**Calls:**
- `webpackUniversalModuleDefinition` (4)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/providers/index.js:7` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `NextResponse`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:40` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `json` (1)

**Calls:**
- `Response` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/index.js:14` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/enveloped_data.js:9` | Self: 0.0% (0us) | Total: 0.0% (3.4ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `bound require` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:53` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `loadManualCategoryStatesForMessageIds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:315` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `map` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/shared/lib/router/utils/get-next-pathname-info.js:12` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `internal:streams/add-abort-signal`
`internal:streams/add-abort-signal:2` | Self: 0.0% (0us) | Total: 0.0% (972us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `anonymous` (1)

### `__nccwpck_require__`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/ua-parser-js/ua-parser.js:1` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `943` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/levels.js:12` | Self: 0.0% (0us) | Total: 0.0% (9.0ms) | Samples: 0

**Called by:**
- `anonymous` (8)

**Calls:**
- `bound require` (8)

### `normalizedSql`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:130` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `replace` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/general_name.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/index.js:18` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:185` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `map` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/attribute_certificate_info.js:12` | Self: 0.0% (0us) | Total: 0.0% (937us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `(anonymous)` (1)

### `createFrom`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/select-query-node.js:23` | Self: 0.0% (0us) | Total: 0.1% (28.3ms) | Samples: 0

**Called by:**
- `selectFrom` (21)
- `selectFrom` (2)

**Calls:**
- `create` (23)

### `visitNode`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/operation-node-visitor.js:112` | Self: 0.0% (0us) | Total: 1.1% (212.3ms) | Samples: 0

**Called by:**
- `compileQuery` (23)
- `compileList` (19)
- `visitSelectQuery` (13)
- `visitAlias` (10)
- `visitSelection` (7)
- `visitSchemableIdentifier` (7)
- `visitTable` (7)
- `visitReference` (7)
- `visitSelectQuery` (6)
- `visitWhere` (5)
- `visitBinaryOperation` (4)
- `visitColumn` (2)
- `visitReference` (2)
- `visitBinaryOperation` (1)
- `visitAlias` (1)

**Calls:**
- `bound visitSelectQuery` (33)
- `bound visitFrom` (13)
- `bound visitAlias` (12)
- `bound visitReference` (11)
- `bound visitIdentifier` (10)
- `bound visitSelection` (7)
- `bound visitSchemableIdentifier` (7)
- `bound visitTable` (7)
- `bound visitWhere` (6)
- `bound visitBinaryOperation` (5)
- `bound visitColumn` (2)
- `bound visitValue` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:602` | Self: 0.0% (0us) | Total: 0.0% (5.6ms) | Samples: 0

**Called by:**
- `forEach` (5)

**Calls:**
- `lookup` (5)

### `internal:streams/legacy`
`internal:streams/legacy:2` | Self: 0.0% (0us) | Total: 0.0% (2.6ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `anonymous` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/raw-builder/sql.js:13` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `getType` (1)

**Calls:**
- `createQueryId` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:68` | Self: 0.0% (0us) | Total: 0.3% (59.6ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `(anonymous)` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2708` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `async time` (1)
- `async (anonymous)` (1)

**Calls:**
- `async listThreads` (2)

### `validate`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:142` | Self: 0.0% (0us) | Total: 0.0% (6.2ms) | Samples: 0

**Called by:**
- `async runValidation` (3)

**Calls:**
- `(anonymous)` (2)
- `(anonymous)` (1)

### `getDbTableColumns`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:110` | Self: 0.0% (0us) | Total: 0.0% (3.4ms) | Samples: 0

**Called by:**
- `ensureCalendarReminderOptionalColumns` (1)

**Calls:**
- `map` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:241` | Self: 0.0% (0us) | Total: 0.0% (13.6ms) | Samples: 0

**Called by:**
- `async withAccountDb` (12)

**Calls:**
- `(anonymous)` (10)
- `(anonymous)` (1)
- `wrapStatement` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:624` | Self: 0.0% (0us) | Total: 0.0% (4.4ms) | Samples: 0

**Called by:**
- `forEach` (4)

**Calls:**
- `topicSuggestionSignalKey` (4)

### `async setSignedCookie`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:58` | Self: 0.0% (0us) | Total: 0.0% (4.8ms) | Samples: 0

**Called by:**
- `async setSessionCookie` (1)

**Calls:**
- `async (anonymous)` (1)

### `async getAuthDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:119` | Self: 0.0% (0us) | Total: 0.0% (3.3ms) | Samples: 0

**Calls:**
- `configureDb` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2480` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Calls:**
- `async getTotalCount` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/encoding/index.js:7` | Self: 0.0% (0us) | Total: 0.0% (938us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:29` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs:845` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `xor` (1)

### `async createAuthContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/create-context.mjs:57` | Self: 0.0% (0us) | Total: 0.0% (1.6ms) | Samples: 0

**Called by:**
- `async createAuthContext` (1)

**Calls:**
- `getInternalPlugins` (1)

### `create`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/column-node.js:14` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `parseStringReferenceWithTable` (1)

**Calls:**
- `create` (1)

### `node:https`
`node:https:378` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Calls:**
- `Agent` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/oauth-proxy/index.mjs:28` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `bound omit` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:282` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `async reconcileLifecycle` (1)

### `getAuth`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:285` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Called by:**
- `async getSharedTestAuthHarness` (1)

**Calls:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/attr_cert_issuer.js:7` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:243` | Self: 0.0% (0us) | Total: 0.0% (3.0ms) | Samples: 0

**Called by:**
- `transaction` (1)

**Calls:**
- `isInstalledControlPlane` (1)

### `async verifyTOTP`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/utils/dist/otp.mjs:43` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async verifyTOTP` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/encoding/index.js:10` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:682` | Self: 0.0% (0us) | Total: 0.3% (68.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (60)

**Calls:**
- `compareSqliteText` (60)

### `ZodObject`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `clone` (1)
- `object` (1)

**Calls:**
- `init` (2)

### `bound visitSelectQuery`
`[native code]` | Self: 0.0% (0us) | Total: 0.3% (72.0ms) | Samples: 0

**Called by:**
- `visitNode` (33)

**Calls:**
- `visitSelectQuery` (13)
- `visitSelectQuery` (8)
- `visitSelectQuery` (7)
- `visitSelectQuery` (1)
- `visitSelectQuery` (1)
- `visitSelectQuery` (1)
- `visitSelectQuery` (1)
- `visitSelectQuery` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:81` | Self: 0.0% (0us) | Total: 0.0% (5.5ms) | Samples: 0

**Called by:**
- `map` (4)

**Calls:**
- `async (anonymous)` (3)
- `async (anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:223` | Self: 0.0% (0us) | Total: 0.0% (14.2ms) | Samples: 0

**Calls:**
- `filterOutputFields` (6)
- `filterOutputFields` (3)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:584` | Self: 0.0% (0us) | Total: 0.0% (16.7ms) | Samples: 0

**Calls:**
- `async findOne` (6)

### `async getDatabaseColumnBounds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:279` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async getMigrations` (1)

**Calls:**
- `async getDatabaseColumnBounds` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/source-map-js/lib/source-map-consumer.js:9` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:724` | Self: 0.0% (0us) | Total: 0.2% (41.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (17)

**Calls:**
- `(anonymous)` (17)

### `passkey`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/passkey/dist/index.mjs:792` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `noctuaAuthOptions` (1)

**Calls:**
- `verifyPasskeyRegistration` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/attribute_certificate.js:2` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `defineProperty` (1)

### `async requireAccountContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/accountContext.ts:59` | Self: 0.0% (0us) | Total: 0.0% (9.7ms) | Samples: 0

**Calls:**
- `async getAccountById` (8)
- `async getAccountById` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:64` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `get` (1)

### `async GET`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:56` | Self: 0.0% (0us) | Total: 0.0% (7.0ms) | Samples: 0

**Calls:**
- `async requireAccountContext` (5)

### `migrate`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountKeys.ts:225` | Self: 0.0% (0us) | Total: 0.0% (5.0ms) | Samples: 0

**Called by:**
- `ensureAccountKeySchema` (4)

**Calls:**
- `installShardWriterGuards` (4)

### `binary`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:27` | Self: 0.0% (0us) | Total: 0.1% (19.3ms) | Samples: 0

**Called by:**
- `map` (14)

**Calls:**
- `parseValueBinaryOperation` (12)
- `parseValueBinaryOperation` (2)

### `#run`
`bun:sqlite:195` | Self: 0.0% (0us) | Total: 6.5% (1.19s) | Samples: 0

**Called by:**
- `(anonymous)` (702)

**Calls:**
- `run` (702)

### `async validateAccountFolders`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/folderAccount.ts:17` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)
- `async time` (1)

**Calls:**
- `async validateAccountFolders` (3)

### `async transformSingleOutput`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:180` | Self: 0.0% (0us) | Total: 0.2% (51.4ms) | Samples: 0

**Called by:**
- `async (anonymous)` (17)
- `async (anonymous)` (12)
- `async (anonymous)` (2)

**Calls:**
- `async (anonymous)` (15)
- `async (anonymous)` (4)
- `async (anonymous)` (3)
- `async (anonymous)` (2)
- `async (anonymous)` (2)
- `async (anonymous)` (2)
- `async (anonymous)` (1)
- `async (anonymous)` (1)
- `async (anonymous)` (1)

### `get`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:820` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:397` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `filter` (1)

**Calls:**
- `get` (1)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:384` | Self: 0.0% (0us) | Total: 0.1% (27.2ms) | Samples: 0

**Calls:**
- `async withDbWriteRetry` (20)

### `toBER`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1511` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `toBER` (1)

**Calls:**
- `toBER` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sanitize-html/index.js:5` | Self: 0.0% (0us) | Total: 0.1% (18.3ms) | Samples: 0

**Calls:**
- `bound require` (16)

### `deriveSystemFlagState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:324` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `some` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:267` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `transaction` (1)

**Calls:**
- `validateProvisioningIndex` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:192` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `async withAccountDb` (2)

**Calls:**
- `map` (2)

### `async recomputeThreadsForAccountInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:318` | Self: 0.0% (0us) | Total: 0.1% (35.2ms) | Samples: 0

**Calls:**
- `(anonymous)` (30)

### `async withDbWriteRetry`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/dbWriteRetry.ts:117` | Self: 0.0% (0us) | Total: 0.7% (135.0ms) | Samples: 0

**Called by:**
- `async getDb` (36)
- `async getAccountDb` (20)
- `async createAuthenticatedTestSession` (2)
- `async (anonymous)` (1)
- `async buildFixture` (1)
- `async buildFixture` (1)

**Calls:**
- `async withDbWriteRetry` (61)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/socks/build/index.js:17` | Self: 0.0% (0us) | Total: 0.0% (10.1ms) | Samples: 0

**Calls:**
- `bound require` (9)

### `async getMigrations`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:352` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async getMigrations` (1)

**Calls:**
- `async createKyselyAdapter` (1)

### `run`
`node:async_hooks:141` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `async runWithRequestState` (2)

**Calls:**
- `push` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/rsaes_oaep.js:7` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `ensureAccountKeySchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountKeys.ts:162` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async withDbWriteRetry` (1)

**Calls:**
- `assertCompleteShardFormat` (1)

### `shardWriterGuardsInstalled`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts:62` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `assertCompleteShardFormat` (1)

**Calls:**
- `every` (1)

### `async findSchemaProblems`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:262` | Self: 0.0% (0us) | Total: 0.0% (1.6ms) | Samples: 0

**Calls:**
- `async findSchemaProblems` (1)

### `(anonymous)`
`/tmp/spike-switch-server/anatomy.ts:74` | Self: 0.0% (0us) | Total: 0.0% (10.0ms) | Samples: 0

**Called by:**
- `async time` (9)

**Calls:**
- `map` (9)

### `async getTrustedOrigins`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/helpers.mjs:85` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async createAuthContext` (1)

**Calls:**
- `async getTrustedOrigins` (1)

### `upsertTopicLearningSignalsForThreadIds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:134` | Self: 0.0% (0us) | Total: 0.0% (16.1ms) | Samples: 0

**Called by:**
- `rememberTopicLearningForThread` (14)

**Calls:**
- `(anonymous)` (13)
- `wrapStatement` (1)

### `displayDayNumberUncached`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/i18n/format.ts:53` | Self: 0.0% (0us) | Total: 0.0% (9.9ms) | Samples: 0

**Called by:**
- `displayDayNumber` (8)

**Calls:**
- `cached` (8)

### `bound visitSchemableIdentifier`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (8.8ms) | Samples: 0

**Called by:**
- `visitNode` (7)

**Calls:**
- `visitSchemableIdentifier` (7)

### `parseSearchInput`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:669` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `async getTotalCount` (1)
- `async listThreads` (1)

**Calls:**
- `replace` (2)

### `buildTimeGroupKey`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/messageGrouping.ts:44` | Self: 0.0% (0us) | Total: 0.3% (57.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (31)
- `(anonymous)` (19)

**Calls:**
- `displayDayNumber` (40)
- `displayDayNumber` (10)

### `async executeQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:41` | Self: 0.0% (0us) | Total: 0.0% (3.0ms) | Samples: 0

**Calls:**
- `async #transformResult` (2)
- `async #transformResult` (1)

### `executeQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:63` | Self: 0.0% (0us) | Total: 0.2% (42.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (17)

**Calls:**
- `(anonymous)` (17)

### `decorate`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:136` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `__decorate` (1)

**Calls:**
- `DecorateProperty` (1)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:89` | Self: 0.0% (0us) | Total: 0.0% (11.6ms) | Samples: 0

**Called by:**
- `(module)` (6)

**Calls:**
- `async buildFixture` (4)
- `async buildFixture` (2)

### `createAdminInvite`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:691` | Self: 0.0% (0us) | Total: 0.0% (3.4ms) | Samples: 0

**Called by:**
- `initMasterSchema` (1)

**Calls:**
- `(anonymous)` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/device-authorization/schema.mjs:54` | Self: 0.0% (0us) | Total: 0.0% (943us) | Samples: 0

**Calls:**
- `bound optional` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:2105` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `get` (1)

**Calls:**
- `get` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:928` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `bound nullish`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (3.1ms) | Samples: 0

**Called by:**
- `(module)` (1)
- `(module)` (1)

**Calls:**
- `nullish` (1)
- `optional` (1)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:38` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pkcs9/build/cjs/index.js:9` | Self: 0.0% (0us) | Total: 0.0% (6.7ms) | Samples: 0

**Called by:**
- `anonymous` (6)

**Calls:**
- `bound require` (6)

### `async executeQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:99` | Self: 0.0% (0us) | Total: 0.0% (12.5ms) | Samples: 0

**Called by:**
- `async execute` (10)

**Calls:**
- `async executeQuery` (8)
- `async executeQuery` (1)
- `async executeQuery` (1)

### `parseInsertColumnsAndValues`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/insert-values-parser.js:21` | Self: 0.0% (0us) | Total: 0.0% (980us) | Samples: 0

**Called by:**
- `values` (1)

**Calls:**
- `map` (1)

### `getColorDepth`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs:58` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `formatTransactionId` (1)

**Calls:**
- `getEnvVar` (1)

### `normalizeThreadIds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:3` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `upsertTopicLearningSignalsForThreadIds` (2)

**Calls:**
- `map` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/dynamic-rendering-utils.js:101` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `forwardAuthHeaders`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:30` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async withAuthResponse` (1)

**Calls:**
- `forEach` (1)

### `rq`
`/tmp/spike-switch-server/anatomy.ts:24` | Self: 0.0% (0us) | Total: 0.0% (12.5ms) | Samples: 0

**Called by:**
- `async (anonymous)` (6)
- `(anonymous)` (3)

**Calls:**
- `header` (5)
- `Request` (3)
- `join` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/algorithms.js:29` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `toASN` (1)

### `persistAccountRow`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts:312` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `seedSenderIdentityRow` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/index.mjs:176` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `run` (1)

**Calls:**
- `async (anonymous)` (1)

### `async time`
`/tmp/spike-switch-server/anatomy.ts:30` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Calls:**
- `reset` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:156` | Self: 0.0% (0us) | Total: 0.0% (5.5ms) | Samples: 0

**Called by:**
- `init` (2)

**Calls:**
- `init` (1)
- `init` (1)

### `enrollmentState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:379` | Self: 0.0% (0us) | Total: 0.0% (7.9ms) | Samples: 0

**Called by:**
- `async isMfaEnrollmentComplete` (7)

**Calls:**
- `(anonymous)` (5)
- `(anonymous)` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:368` | Self: 0.0% (0us) | Total: 0.1% (24.6ms) | Samples: 0

**Calls:**
- `filterOutputFields` (10)
- `filterOutputFields` (4)
- `reduce` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/attribute.js:14` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `__decorate` (1)

### `ensureCalendarEventOptionalColumns`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:477` | Self: 0.0% (0us) | Total: 0.0% (3.3ms) | Samples: 0

**Called by:**
- `async ensureCalendarEventRuntimeData` (1)

**Calls:**
- `(anonymous)` (1)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:375` | Self: 0.0% (0us) | Total: 0.0% (13.5ms) | Samples: 0

**Calls:**
- `configureAccountDb` (5)
- `configureAccountDb` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/charset.js:42` | Self: 0.0% (0us) | Total: 0.0% (990us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `entries` (1)

### `ObjectIdentifier`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:2473` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `toASN` (1)

**Calls:**
- `BaseBlock` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/tbs_certificate.js:9` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:46` | Self: 0.0% (0us) | Total: 3.0% (555.7ms) | Samples: 0

**Called by:**
- `forEach` (265)

**Calls:**
- `(anonymous)` (264)
- `(anonymous)` (1)

### `bound visitSelection`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (9.2ms) | Samples: 0

**Called by:**
- `visitNode` (7)

**Calls:**
- `visitSelection` (7)

### `BaseBlock`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:924` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `ObjectIdentifier` (1)

**Calls:**
- `LocalObjectIdentifierValueBlock` (1)

### `async (anonymous)`
`/tmp/spike-switch-server/anatomy.ts:70` | Self: 0.0% (0us) | Total: 0.2% (40.8ms) | Samples: 0

**Called by:**
- `async time` (20)
- `async (anonymous)` (13)

**Calls:**
- `async (anonymous)` (13)
- `async enrichMessagesWithThreadTopics` (10)
- `async (anonymous)` (7)
- `getOwnAddresses` (2)
- `getOwnAddresses` (1)

### `DBCSCodec`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:116` | Self: 0.0% (0us) | Total: 0.0% (3.2ms) | Samples: 0

**Called by:**
- `getCodec` (3)

**Calls:**
- `(anonymous)` (2)
- `(anonymous)` (1)

### `object`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:906` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `ZodObject` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:714` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Calls:**
- `Map` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:151` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `getAuthTables`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/get-tables.mjs:297` | Self: 0.0% (0us) | Total: 0.0% (1.8ms) | Samples: 0

**Called by:**
- `async createAuthContext` (1)

**Calls:**
- `getAuthTablesWithResolvedIndexes` (1)

### `async dispatchAuthEndpoint`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:203` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `Headers` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:95` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `initGetFieldAttributes` (1)

### `parseInsertColumnsAndValues`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/insert-values-parser.js:22` | Self: 0.0% (0us) | Total: 0.9% (165.8ms) | Samples: 0

**Called by:**
- `values` (1)

**Calls:**
- `map` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/middleware.mjs:9` | Self: 0.0% (0us) | Total: 0.0% (17.4ms) | Samples: 0

**Called by:**
- `async internalHandler` (14)

**Calls:**
- `async createInternalContext` (11)
- `async createInternalContext` (3)

### `clone`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:39` | Self: 0.0% (0us) | Total: 0.0% (3.3ms) | Samples: 0

**Called by:**
- `bound clone` (1)

**Calls:**
- `clone` (1)

### `fromBER`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1541` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `localFromBER` (1)

**Calls:**
- `fromBER` (1)

### `bound omit`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `clone` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:582` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `forEach` (1)

**Calls:**
- `topicSuggestionSignalKey` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:720` | Self: 0.0% (0us) | Total: 1.9% (354.7ms) | Samples: 0

**Calls:**
- `transaction` (291)
- `transaction` (17)

### `_collectAddressParts`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:562` | Self: 0.0% (0us) | Total: 0.0% (3.3ms) | Samples: 0

**Called by:**
- `_handleAddress` (3)

**Calls:**
- `value` (2)
- `value` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:200` | Self: 0.0% (0us) | Total: 0.7% (144.7ms) | Samples: 0

**Called by:**
- `async withAccountDb` (122)

**Calls:**
- `(anonymous)` (118)
- `(anonymous)` (3)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/encoding-table.js:2` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async rebuildAllThreadSignalsForAccount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:136` | Self: 0.0% (0us) | Total: 1.4% (255.3ms) | Samples: 0

**Called by:**
- `async ensureThreadSignalRuntimeData` (1)

**Calls:**
- `rebuildAllThreadSignalsForAccountInternal` (157)
- `rebuildAllThreadSignalsForAccountInternal` (3)
- `async rebuildAllThreadSignalsForAccount` (1)

### `async assertAccountFolder`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/folderAccountGuard.ts:8` | Self: 0.0% (0us) | Total: 0.0% (17.5ms) | Samples: 0

**Calls:**
- `(anonymous)` (9)
- `(anonymous)` (5)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/attributes/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (3.8ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `bound require` (3)

### `(module)`
`/tmp/spike-switch-server/anatomy.ts:71` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `async time` (1)

### `async enrichMessagesWithThreadCollab`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadCollab.ts:12` | Self: 0.0% (0us) | Total: 0.0% (3.7ms) | Samples: 0

**Called by:**
- `async enrichMessagesWithThreadCollab` (3)

**Calls:**
- `async getThreadCollabStates` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/registry.js:3` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:224` | Self: 0.0% (0us) | Total: 0.0% (11.7ms) | Samples: 0

**Calls:**
- `filterOutputFields` (4)
- `parseUserOutput` (2)
- `filterOutputFields` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/sign-in.mjs:105` | Self: 0.0% (0us) | Total: 0.0% (3.0ms) | Samples: 0

**Calls:**
- `bound meta` (1)

### `rebuildThreadSignalsForThreadIdsInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:105` | Self: 0.0% (0us) | Total: 2.6% (475.5ms) | Samples: 0

**Called by:**
- `async rebuildThreadSignalsForThreadIds` (252)

**Calls:**
- `insertThreadSignalsFromMessageRows` (249)
- `insertThreadSignalsFromMessageRows` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:751` | Self: 0.0% (0us) | Total: 1.8% (335.3ms) | Samples: 0

**Called by:**
- `transaction` (291)

**Calls:**
- `upsertBatch` (291)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1245` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `get` (1)

**Calls:**
- `some` (1)

### `getTopicSuggestionsForThreadSignalBatch`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:595` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async withAccountDb` (1)

**Calls:**
- `forEach` (1)

### `initGetModelName`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-model-name.mjs:4` | Self: 0.0% (0us) | Total: 0.0% (996us) | Samples: 0

**Called by:**
- `async getMigrations` (1)

**Calls:**
- `initGetDefaultModelName` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:210` | Self: 0.0% (0us) | Total: 0.0% (10.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (9)

**Calls:**
- `async runBeforeHooks` (9)

### `async hasRequestState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:16` | Self: 0.0% (0us) | Total: 0.0% (10.5ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)
- `async hasRequestState` (1)

**Calls:**
- `getStore` (1)
- `async hasRequestState` (1)
- `async ensureAsyncStorage` (1)

### `decorate`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:143` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `__decorate` (1)

**Calls:**
- `DecorateConstructor` (1)

### `(module)`
`/tmp/spike-switch-server/anatomy.ts:47` | Self: 0.0% (0us) | Total: 0.0% (8.6ms) | Samples: 0

**Calls:**
- `parse` (7)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs:195` | Self: 0.0% (0us) | Total: 0.0% (969us) | Samples: 0

**Calls:**
- `async findUserByEmail` (1)

### `async enrichMessagesWithThreadTopics`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:44` | Self: 0.0% (0us) | Total: 0.0% (9.2ms) | Samples: 0

**Calls:**
- `async getTopicSuggestionsForThreads` (7)
- `async getTopicSuggestionsForThreads` (1)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:88` | Self: 0.0% (0us) | Total: 0.0% (3.8ms) | Samples: 0

**Calls:**
- `closeAccountDbConnection` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:99` | Self: 0.0% (0us) | Total: 0.0% (4.7ms) | Samples: 0

**Called by:**
- `async (anonymous)` (4)

**Calls:**
- `async (anonymous)` (1)
- `async (anonymous)` (1)
- `async (anonymous)` (1)
- `async (anonymous)` (1)

### `async verifySignature`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:18` | Self: 0.0% (0us) | Total: 0.0% (17.3ms) | Samples: 0

**Called by:**
- `async (anonymous)` (13)

**Calls:**
- `async (anonymous)` (12)
- `async (anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:362` | Self: 0.0% (0us) | Total: 1.0% (191.0ms) | Samples: 0

**Called by:**
- `async withReturning` (3)

**Calls:**
- `async executeTakeFirst` (2)
- `returningAll` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:895` | Self: 0.0% (0us) | Total: 0.0% (3.7ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `create`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/table-node.js:14` | Self: 0.0% (0us) | Total: 0.0% (6.8ms) | Samples: 0

**Called by:**
- `parseTableExpressionOrList` (4)
- `parseSelectAllArg` (2)

**Calls:**
- `create` (2)
- `freeze` (2)
- `create` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:256` | Self: 0.0% (0us) | Total: 0.0% (14.8ms) | Samples: 0

**Called by:**
- `async withAccountDb` (13)

**Calls:**
- `(anonymous)` (13)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:110` | Self: 0.0% (0us) | Total: 0.0% (4.8ms) | Samples: 0

**Calls:**
- `Kysely` (1)
- `Kysely` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:886` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `getTopicSuggestionSignalsForThreadsFromDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:206` | Self: 0.0% (0us) | Total: 0.0% (3.6ms) | Samples: 0

**Called by:**
- `(anonymous)` (3)

**Calls:**
- `ownAddressList` (2)
- `ownAddressList` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (14.3ms) | Samples: 0

**Calls:**
- `bound require` (12)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:16` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Called by:**
- `RuntimeDriver` (1)

**Calls:**
- `WeakSet` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:273` | Self: 0.0% (0us) | Total: 0.0% (3.6ms) | Samples: 0

**Calls:**
- `noctuaAuthOptions` (1)
- `noctuaAuthOptions` (1)
- `noctuaAuthOptions` (1)

### `displayDayNumber`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/i18n/format.ts:45` | Self: 0.0% (0us) | Total: 0.0% (11.1ms) | Samples: 0

**Called by:**
- `buildMessageGroupKey` (9)

**Calls:**
- `displayDayNumberUncached` (8)
- `displayDayNumberUncached` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/algorithms.js:25` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `serialize` (2)

### `configureAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:107` | Self: 0.0% (0us) | Total: 0.0% (10.9ms) | Samples: 0

**Called by:**
- `async getAccountDb` (5)

**Calls:**
- `configureDb` (5)

### `(module)`
`/tmp/spike-switch-server/anatomy.ts:8` | Self: 0.0% (0us) | Total: 0.0% (11.6ms) | Samples: 0

**Calls:**
- `async buildFixture` (6)

### `internal:streams/writable`
`internal:streams/writable:33` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `makeBitMapDescriptor` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/config.js:2` | Self: 0.0% (0us) | Total: 0.1% (19.6ms) | Samples: 0

**Called by:**
- `anonymous` (17)

**Calls:**
- `bound require` (17)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/index.js:12` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `__exportStar` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/issuer_and_serial_number.js:15` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `__decorate` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@zone-eu/mailsplit/lib/message-splitter.js:4` | Self: 0.0% (0us) | Total: 0.2% (49.8ms) | Samples: 0

**Called by:**
- `anonymous` (40)

**Calls:**
- `bound require` (40)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1005` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:250` | Self: 0.0% (0us) | Total: 0.0% (17.2ms) | Samples: 0

**Called by:**
- `async withAccountDb` (14)

**Calls:**
- `(anonymous)` (13)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-model-name.mjs:24` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)
- `(anonymous)` (1)

**Calls:**
- `resolve` (1)
- `resolve` (1)

### `async withAuthResponse`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:57` | Self: 0.0% (0us) | Total: 0.0% (7.2ms) | Samples: 0

**Called by:**
- `async GET` (6)

**Calls:**
- `async withAuthResponse` (6)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2495` | Self: 0.0% (0us) | Total: 0.0% (3.2ms) | Samples: 0

**Calls:**
- `map` (3)

### `compile`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:314` | Self: 0.0% (0us) | Total: 0.0% (8.1ms) | Samples: 0

**Called by:**
- `async execute` (1)

**Calls:**
- `transformQuery` (1)

### `visitSelectQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:36` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `bound visitSelectQuery` (1)

**Calls:**
- `parentNode` (1)

### `async (anonymous)`
`/tmp/spike-switch-server/anatomy.ts:69` | Self: 0.0% (0us) | Total: 0.0% (8.0ms) | Samples: 0

**Called by:**
- `async (anonymous)` (7)

**Calls:**
- `map` (7)

### `async migrateAuthSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:219` | Self: 0.0% (0us) | Total: 0.0% (4.8ms) | Samples: 0

**Called by:**
- `async (anonymous)` (4)

**Calls:**
- `async migrateAuthSchema` (4)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (3.8ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `bound require` (3)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:153` | Self: 0.0% (0us) | Total: 0.0% (3.7ms) | Samples: 0

**Calls:**
- `async findSession` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/work-unit-async-storage.external.js:64` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/charset.js:17` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha3.js:327` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `createHasher` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:156` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/segment-config/ensure-static.js:27` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:668` | Self: 0.0% (0us) | Total: 0.0% (983us) | Samples: 0

**Calls:**
- `async findOne` (1)

### `async createAuthContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/create-context.mjs:233` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `async createAuthContext` (1)
- `async createAuthContext` (1)

### `_array`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/api.js:729` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `ZodArray` (1)

### `(anonymous)`
`/tmp/spike-switch-server/anatomy.ts:69` | Self: 0.0% (0us) | Total: 0.0% (5.8ms) | Samples: 0

**Called by:**
- `map` (5)

**Calls:**
- `cloneObject` (5)

### `internal:streams/compose`
`internal:streams/compose:2` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `anonymous` (1)

### `compileList`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:136` | Self: 0.0% (0us) | Total: 0.2% (39.1ms) | Samples: 0

**Called by:**
- `visitFrom` (12)
- `visitSelectQuery` (7)

**Calls:**
- `visitNode` (19)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/adminMailbox.ts:12` | Self: 0.0% (0us) | Total: 0.0% (3.3ms) | Samples: 0

**Calls:**
- `bound max` (1)

### `visitSelectQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:41` | Self: 0.0% (0us) | Total: 0.0% (3.6ms) | Samples: 0

**Called by:**
- `bound visitSelectQuery` (1)

**Calls:**
- `is` (1)

### `_defu`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/defu/dist/defu.mjs:23` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `reduce` (1)

**Calls:**
- `keys` (1)

### `makeSafe`
`internal:primordials:53` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `internal:primordials` (1)

**Calls:**
- `copyProps` (1)

### `query`
`bun:sqlite:386` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `[prepareOwned]` (1)

### `visitAlias`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:284` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `bound visitAlias` (1)

**Calls:**
- `visitNode` (1)

### `normalizeUserEmails`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:240` | Self: 0.0% (0us) | Total: 0.0% (4.0ms) | Samples: 0

**Called by:**
- `initMasterSchema` (1)

**Calls:**
- `transaction` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:557` | Self: 0.0% (0us) | Total: 0.9% (171.1ms) | Samples: 0

**Called by:**
- `async findOne` (10)

**Calls:**
- `map` (10)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/levels.js:42` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `reduce` (1)

### `insertThreadSignalsFromMessageRows`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:50` | Self: 0.0% (0us) | Total: 3.9% (721.5ms) | Samples: 0

**Called by:**
- `rebuildThreadSignalsForThreadIdsInternal` (249)
- `rebuildAllThreadSignalsForAccountInternal` (156)

**Calls:**
- `forEach` (405)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:664` | Self: 0.0% (0us) | Total: 1.4% (257.8ms) | Samples: 0

**Called by:**
- `forEach` (224)

**Calls:**
- `forEach` (224)

### `rebuildThreadSignalsForThreadIdsInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:86` | Self: 0.0% (0us) | Total: 0.0% (10.5ms) | Samples: 0

**Called by:**
- `async rebuildThreadSignalsForThreadIds` (9)

**Calls:**
- `(anonymous)` (9)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/libmime.js:43` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async resolveAccountDbPath`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:335` | Self: 0.0% (0us) | Total: 0.0% (6.7ms) | Samples: 0

**Called by:**
- `async resolveAccountDbPath` (6)

**Calls:**
- `async getDb` (5)
- `async getDb` (1)

### `visitColumn`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:126` | Self: 0.0% (0us) | Total: 0.0% (2.9ms) | Samples: 0

**Called by:**
- `bound visitColumn` (2)

**Calls:**
- `visitNode` (2)

### `ZodString`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` | Self: 0.0% (0us) | Total: 0.0% (7.1ms) | Samples: 0

**Called by:**
- `_coercedString` (1)
- `clone` (1)
- `_string` (1)

**Calls:**
- `init` (2)
- `init` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:34` | Self: 0.0% (0us) | Total: 0.0% (990us) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `setHeader` (1)

### `upsertTopicLearningSignalsForThreadIds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:160` | Self: 0.0% (0us) | Total: 1.2% (220.0ms) | Samples: 0

**Called by:**
- `rememberTopicLearningForThread` (103)

**Calls:**
- `forEach` (103)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `visitAlias`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:282` | Self: 0.0% (0us) | Total: 0.1% (25.0ms) | Samples: 0

**Called by:**
- `bound visitAlias` (10)

**Calls:**
- `visitNode` (10)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha2.js:378` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `createHasher` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:820` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Calls:**
- `upsertTopicLearningSignalsForThreadIds` (1)
- `upsertTopicLearningSignalsForThreadIds` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/imapflow/node_modules/iconv-lite/lib/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/charset.js:16` | Self: 0.0% (0us) | Total: 0.1% (22.9ms) | Samples: 0

**Called by:**
- `anonymous` (20)

**Calls:**
- `bound require` (20)

### `toASN`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js:50` | Self: 0.0% (0us) | Total: 0.0% (4.8ms) | Samples: 0

**Called by:**
- `serialize` (4)

**Calls:**
- `serialize` (3)
- `toBER` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/bags/index.js:7` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `getParamInfo`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/reflection-helpers.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `getMetadata` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/request.js:24` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `ZodArray`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `_array` (1)

**Calls:**
- `init` (1)

### `applySearchQueryFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:716` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `async getTotalCount` (2)

**Calls:**
- `trim` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:48` | Self: 0.0% (0us) | Total: 0.2% (39.0ms) | Samples: 0

**Called by:**
- `async getSignedCookie` (17)

**Calls:**
- `async getCryptoKey` (17)
- `async verifySignature` (13)
- `async verifySignature` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/recipient_info.js:6` | Self: 0.0% (0us) | Total: 0.0% (987us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `json`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:91` | Self: 0.0% (0us) | Total: 2.4% (450.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (388)

**Calls:**
- `json` (388)

### `async requireActiveUserSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:76` | Self: 0.0% (0us) | Total: 0.0% (16.6ms) | Samples: 0

**Calls:**
- `(anonymous)` (11)
- `(anonymous)` (1)

### `node:crypto`
`node:crypto:2` | Self: 0.0% (0us) | Total: 0.0% (16.0ms) | Samples: 0

**Calls:**
- `anonymous` (9)

### `add`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:373` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `(module)` (1)
- `(module)` (1)

**Calls:**
- `compile` (1)
- `compile` (1)

### `async withReturning`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:362` | Self: 0.0% (0us) | Total: 1.0% (191.0ms) | Samples: 0

**Called by:**
- `async create` (2)
- `async update` (1)

**Calls:**
- `async (anonymous)` (3)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:819` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `async rebuildThreadSignalsForThreadIds` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/deepmerge-ts/dist/index.mjs:924` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `deepmergeFastUnsafeCustom` (1)

### `buildMeaningfulAttachmentPredicateSql`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:941` | Self: 0.0% (0us) | Total: 0.0% (3.6ms) | Samples: 0

**Called by:**
- `buildMeaningfulAttachmentExistsSql` (3)

**Calls:**
- `buildSqlEndsWithAny` (2)
- `buildSqlContainsAny` (1)

### `visitTable`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:377` | Self: 0.0% (0us) | Total: 0.0% (8.8ms) | Samples: 0

**Called by:**
- `bound visitTable` (7)

**Calls:**
- `visitNode` (7)

### `copyProps`
`internal:primordials:26` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `makeSafe` (1)

**Calls:**
- `bound call` (1)

### `async get`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:33` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `async get` (1)

**Calls:**
- `async getCurrentRequestState` (1)

### `LinkifyIt`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:351` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `LinkifyIt` (1)

**Calls:**
- `assign` (1)

### `async getTopicsForThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:191` | Self: 0.0% (0us) | Total: 0.0% (1.9ms) | Samples: 0

**Called by:**
- `async enrichMessagesWithThreadTopics` (2)

**Calls:**
- `async withAccountDb` (2)

### `async findOne`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:526` | Self: 0.0% (0us) | Total: 1.1% (216.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (140)

**Calls:**
- `async findOne` (85)
- `async findOne` (37)
- `async findOne` (6)
- `async findOne` (6)
- `async findOne` (6)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:388` | Self: 0.0% (0us) | Total: 0.0% (931us) | Samples: 0

**Calls:**
- `ensureThreadRuntimeSchema` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:249` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `isAPIError` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/middleware.mjs:15` | Self: 0.0% (0us) | Total: 0.0% (14.2ms) | Samples: 0

**Calls:**
- `async (anonymous)` (4)
- `async (anonymous)` (1)
- `async (anonymous)` (1)
- `async (anonymous)` (1)
- `async (anonymous)` (1)
- `async (anonymous)` (1)
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/index.js:18` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `node:_http_agent`
`node:_http_agent:8` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `anonymous` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/tools.js:9` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-android/build/cjs/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:115` | Self: 0.0% (0us) | Total: 0.0% (1.5ms) | Samples: 0

**Calls:**
- `split` (1)

### `(module)`
`/tmp/spike-switch-server/anatomy.ts:75` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Calls:**
- `async time` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js:4` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `flush`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:226` | Self: 0.0% (0us) | Total: 2.0% (378.8ms) | Samples: 0

**Called by:**
- `(anonymous)` (318)
- `getTopicSuggestionSignalsForThreadsFromDb` (3)

**Calls:**
- `topicSuggestionEntriesFromThreadSignalRows` (214)
- `flatIntoArrayWithCallback` (106)
- `topicSuggestionEntriesFromThreadSignalRows` (1)

### `selectFrom`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-creator.js:135` | Self: 0.0% (0us) | Total: 0.6% (112.6ms) | Samples: 0

**Called by:**
- `async findOne` (84)
- `async findMany` (1)

**Calls:**
- `parseTableExpressionOrList` (83)
- `createFrom` (2)

### `bump`
`/tmp/spike-switch-server/sqlcounter.ts:51` | Self: 0.0% (0us) | Total: 0.5% (105.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (40)
- `(anonymous)` (33)
- `(anonymous)` (12)

**Calls:**
- `normalize` (85)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/organization/routes/crud-org.mjs:16` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Calls:**
- `bound nullish` (1)

### `async getMigrations`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:646` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `addColumn` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/index.js:9` | Self: 0.0% (0us) | Total: 0.0% (6.7ms) | Samples: 0

**Called by:**
- `anonymous` (6)

**Calls:**
- `bound require` (5)
- `__exportStar` (1)

### `getTopicSuggestionSignalsForThreadsFromDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:198` | Self: 0.0% (0us) | Total: 0.0% (16.9ms) | Samples: 0

**Called by:**
- `(anonymous)` (13)

**Calls:**
- `map` (6)
- `filter` (4)
- `Set` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sanitize-html/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1288` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Calls:**
- `parseSearchInput` (1)
- `parseSearchInput` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv6.js:32` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `toAsnItem`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js:131` | Self: 0.0% (0us) | Total: 0.0% (4.7ms) | Samples: 0

**Called by:**
- `toASN` (4)

**Calls:**
- `toASN` (3)
- `toASN` (1)

### `scopedTables`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts:31` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `guards` (1)

**Calls:**
- `(anonymous)` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2306` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `applyExcludedFolderFilters` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/after/index.js:6` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `transaction`
`bun:sqlite:451` | Self: 0.0% (0us) | Total: 0.2% (37.4ms) | Samples: 0

**Called by:**
- `async (anonymous)` (17)
- `initAccountSchema` (2)
- `ensureInviteIssuerSchema` (2)
- `installAuthControlPlane` (1)
- `ensureMasterTeamColumns` (1)
- `normalizeUserEmails` (1)
- `async (anonymous)` (1)

**Calls:**
- `#runNoArgs` (25)

### `async acquireAuthLifetimeLock`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authLifetimeLock.ts:57` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `fsyncSync` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-ecc/build/cjs/ec_private_key.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:56` | Self: 0.0% (0us) | Total: 0.0% (4.8ms) | Samples: 0

**Called by:**
- `async setSignedCookie` (1)

**Calls:**
- `async serializeSignedCookie` (1)

### `decorate`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:135` | Self: 0.0% (0us) | Total: 0.0% (987us) | Samples: 0

**Called by:**
- `__decorate` (1)

**Calls:**
- `ToPropertyKey` (1)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1311` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `forEach` (1)

### `async findMany`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:530` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async findMany` (1)

**Calls:**
- `selectFrom` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1214` | Self: 0.0% (0us) | Total: 0.0% (5.1ms) | Samples: 0

**Called by:**
- `validate` (2)

**Calls:**
- `anonymous` (1)
- `generateFastpass` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/cookies.js:27` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:201` | Self: 0.0% (0us) | Total: 1.1% (201.4ms) | Samples: 0

**Called by:**
- `async (anonymous)` (65)

**Calls:**
- `async (anonymous)` (65)
- `async (anonymous)` (65)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/types/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/rsassa_pss.js:52` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `serialize` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/lazy-result.js:11` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async runBeforeHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:65` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async runBeforeHooks` (1)

**Calls:**
- `createWithSpan` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_arx.js:49` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Calls:**
- `(anonymous)` (1)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:389` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Calls:**
- `ensureTopicRuntimeSchema` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/action-async-storage.external.js:11` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:84` | Self: 0.0% (0us) | Total: 0.0% (969us) | Samples: 0

**Calls:**
- `serializeCookieValue` (1)

### `createExpressionBuilder`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:115` | Self: 0.0% (0us) | Total: 0.0% (6.2ms) | Samples: 0

**Called by:**
- `parseAliasedExpression` (4)
- `parseExpression` (1)

**Calls:**
- `createFunctionModule` (3)
- `assign` (1)
- `createFunctionModule` (1)

### `getTopicSuggestionSignalsForThreadsFromDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:232` | Self: 0.0% (0us) | Total: 2.2% (403.8ms) | Samples: 0

**Called by:**
- `(anonymous)` (342)

**Calls:**
- `forEach` (342)

### `async recomputeThreadsForAccountInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:284` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Calls:**
- `(anonymous)` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-model-name.mjs:14` | Self: 0.0% (0us) | Total: 0.0% (2.5ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `(anonymous)` (2)

### `ZodUnknown`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:100` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `_unknown` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/index.js:9` | Self: 0.0% (0us) | Total: 0.0% (984us) | Samples: 0

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/connection.js:16` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2258` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `applyAddressSearchFilters` (1)

### `addListener`
`node:events:214` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `Agent` (1)

**Calls:**
- `_addListener` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@zone-eu/mailsplit/index.js:8` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `async time`
`/tmp/spike-switch-server/anatomy.ts:36` | Self: 0.0% (0us) | Total: 0.0% (6.9ms) | Samples: 0

**Called by:**
- `(module)` (2)
- `(module)` (1)
- `(module)` (1)
- `(module)` (1)

**Calls:**
- `async time` (5)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pkcs8/build/cjs/encrypted_private_key_info.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async createAuthenticatedTestSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testAuthHarness.ts:208` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `run` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:336` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `$constructor` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/index.js:9` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:267` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async ensureAuthLifetimeLock` (1)

### `async enrichMessagesWithThreadCollab`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadCollab.ts:9` | Self: 0.0% (0us) | Total: 0.1% (21.6ms) | Samples: 0

**Called by:**
- `async enrichMessagesWithThreadCollab` (18)

**Calls:**
- `Set` (10)
- `map` (8)

### `visitFrom`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:120` | Self: 0.0% (0us) | Total: 0.1% (29.9ms) | Samples: 0

**Called by:**
- `bound visitFrom` (12)

**Calls:**
- `compileList` (12)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2578` | Self: 0.0% (0us) | Total: 0.0% (4.7ms) | Samples: 0

**Calls:**
- `buildMeaningfulAttachmentExistsSql` (4)

### `decryptPayload`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts:61` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `decodeSecret` (2)

**Calls:**
- `setAuthTag` (2)

### `async runPluginInit`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/helpers.mjs:18` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async runPluginInit` (1)

**Calls:**
- `isPromise` (1)

### `async createAuthenticatedTestSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testAuthHarness.ts:213` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Calls:**
- `async withDbWriteRetry` (2)

### `select`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:62` | Self: 0.0% (0us) | Total: 0.1% (19.6ms) | Samples: 0

**Called by:**
- `async findOne` (6)
- `sentIdentifiers` (1)

**Calls:**
- `cloneWithSelections` (5)
- `map` (1)
- `parseSelectArg` (1)

### `OctetString`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1769` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `toASN` (1)

**Calls:**
- `BaseBlock` (1)

### `upsertTopicLearningSignalsForThreadIds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:131` | Self: 0.0% (0us) | Total: 0.1% (30.8ms) | Samples: 0

**Called by:**
- `rememberTopicLearningForThread` (9)

**Calls:**
- `getTopicSignalExclusionSet` (9)

### `localFromBERWithChildContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1218` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `fromBER` (1)

**Calls:**
- `localFromBER` (1)

### `toASN`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/converters.js:59` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `OctetString` (1)

### `async getDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:299` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `Database` (1)

### `cloneWithSelections`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/select-query-node.js:31` | Self: 0.0% (0us) | Total: 0.0% (17.4ms) | Samples: 0

**Called by:**
- `select` (5)

**Calls:**
- `performIteration` (5)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema/user.mjs:6` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `_boolean` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs:213` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `run` (1)

**Calls:**
- `async (anonymous)` (1)

### `async requireAccountContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/accountContext.ts:55` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `async resolveAccountRole` (1)

### `parseSelectAllArg`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/select-parser.js:44` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `parseSelectAll` (2)

**Calls:**
- `create` (2)

### `encrypt`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:351` | Self: 0.0% (0us) | Total: 0.0% (982us) | Samples: 0

**Called by:**
- `encrypt` (1)

**Calls:**
- `computeTag` (1)

### `applyBadgeFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:837` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async listThreads` (1)

**Calls:**
- `toLowerCase` (1)

### `loadManualCategoryStatesForMessageIds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:303` | Self: 0.0% (0us) | Total: 0.0% (1.4ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `map` (1)

### `ZodBoolean`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `_boolean` (2)

**Calls:**
- `init` (2)

### `noctuaAuthOptions`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:163` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `passkey` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:232` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `map` (1)

**Calls:**
- `getFieldName` (1)

### `bound visitWhere`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (8.5ms) | Samples: 0

**Called by:**
- `visitNode` (6)

**Calls:**
- `visitWhere` (6)

### `async findOne`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:515` | Self: 0.0% (0us) | Total: 0.0% (7.9ms) | Samples: 0

**Called by:**
- `async findOne` (6)

**Calls:**
- `selectAll` (6)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/device-authorization/index.mjs:26` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `bound optional` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv6.js:1444` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `map` (1)

**Calls:**
- `Address6` (1)

### `async signIn`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testAuthHarness.ts:175` | Self: 0.0% (0us) | Total: 0.0% (4.6ms) | Samples: 0

**Calls:**
- `async (anonymous)` (1)

### `ZodNullable`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `nullable` (1)

**Calls:**
- `init` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:841` | Self: 0.0% (0us) | Total: 0.0% (3.7ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/bags/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:220` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `async withAccountDb` (2)

**Calls:**
- `map` (1)
- `from` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/index.js:7` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Calls:**
- `bound require` (2)

### `serializeCookieValue`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:74` | Self: 0.0% (0us) | Total: 0.0% (969us) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `toUpperCase` (1)

### `rememberTopicLearningForThread`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:49` | Self: 0.0% (0us) | Total: 1.6% (296.9ms) | Samples: 0

**Called by:**
- `(anonymous)` (149)

**Calls:**
- `upsertTopicLearningSignalsForThreadIds` (103)
- `upsertTopicLearningSignalsForThreadIds` (14)
- `upsertTopicLearningSignalsForThreadIds` (11)
- `upsertTopicLearningSignalsForThreadIds` (10)
- `upsertTopicLearningSignalsForThreadIds` (9)
- `upsertTopicLearningSignalsForThreadIds` (1)
- `upsertTopicLearningSignalsForThreadIds` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:173` | Self: 0.0% (0us) | Total: 0.0% (998us) | Samples: 0

**Called by:**
- `map` (1)

**Calls:**
- `map` (1)

### `ZodOptional`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` | Self: 0.0% (0us) | Total: 0.0% (3.2ms) | Samples: 0

**Called by:**
- `optional` (3)

**Calls:**
- `init` (2)
- `init` (1)

### `isInstalledControlPlane`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:222` | Self: 0.0% (0us) | Total: 0.0% (3.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `filter` (1)

### `async findSchemaProblems`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:252` | Self: 0.0% (0us) | Total: 0.0% (1.6ms) | Samples: 0

**Called by:**
- `async findSchemaProblems` (1)

**Calls:**
- `toPhysicalSchema` (1)

### `async provideConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/default-connection-provider.js:8` | Self: 0.0% (0us) | Total: 0.0% (9.5ms) | Samples: 0

**Called by:**
- `async provideConnection` (8)

**Calls:**
- `async acquireConnection` (8)

### `toUnifiedRule`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/leac/lib/leac.mjs:23` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `map` (1)

**Calls:**
- `toRegExp` (1)

### `async getOrCreateEndpointContextStorage`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/endpoint-context.mjs:12` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `async runWithEndpointContext` (2)

**Calls:**
- `async (anonymous)` (1)
- `async (anonymous)` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2305` | Self: 0.0% (0us) | Total: 0.0% (6.3ms) | Samples: 0

**Calls:**
- `applyBadgeFilters` (2)
- `applyBadgeFilters` (1)
- `applyBadgeFilters` (1)
- `applyBadgeFilters` (1)
- `applyBadgeFilters` (1)

### `Agent`
`node:_http_agent:32` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `Agent` (1)

**Calls:**
- `addListener` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:87` | Self: 0.0% (0us) | Total: 0.2% (41.1ms) | Samples: 0

**Called by:**
- `forEach` (34)

**Calls:**
- `extractEmailAddresses` (34)

### `NextResponse`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:42` | Self: 0.0% (0us) | Total: 0.0% (4.6ms) | Samples: 0

**Called by:**
- `json` (4)

**Calls:**
- `ResponseCookies` (3)
- `ResponseCookies` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/index.mjs:11` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `__exportAll` (1)

### `async ensureCalendarEventRuntimeData`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:660` | Self: 0.0% (0us) | Total: 0.4% (76.1ms) | Samples: 0

**Called by:**
- `async ensureCalendarEventRuntimeData` (66)

**Calls:**
- `importModule` (66)

### `async createInternalContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:97` | Self: 0.0% (0us) | Total: 0.1% (20.4ms) | Samples: 0

**Called by:**
- `async (anonymous)` (11)
- `async (anonymous)` (3)

**Calls:**
- `async (anonymous)` (9)
- `async (anonymous)` (4)
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/tracer.mjs:41` | Self: 0.0% (0us) | Total: 0.0% (959us) | Samples: 0

**Called by:**
- `async runBeforeHooks` (1)

**Calls:**
- `catch` (1)

### `fromBER`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:927` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `localFromBER` (1)

**Calls:**
- `fromBER` (1)

### `internal:primordials`
`internal:primordials:83` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `makeSafe` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:183` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async transformOutput` (1)

**Calls:**
- `(anonymous)` (1)

### `async requireActiveUserSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:72` | Self: 0.0% (0us) | Total: 0.0% (13.8ms) | Samples: 0

**Calls:**
- `async getUserById` (7)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:262` | Self: 0.0% (0us) | Total: 0.9% (163.9ms) | Samples: 0

**Called by:**
- `async createSession` (1)

**Calls:**
- `async (anonymous)` (1)

### `insert`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/ftsIdentity.ts:87` | Self: 0.0% (0us) | Total: 0.1% (32.4ms) | Samples: 0

**Called by:**
- `(anonymous)` (26)

**Calls:**
- `(anonymous)` (25)
- `(anonymous)` (1)

### `async execute`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:319` | Self: 0.0% (0us) | Total: 0.4% (75.9ms) | Samples: 0

**Called by:**
- `async findOne` (37)
- `async (anonymous)` (3)
- `async getTables` (1)

**Calls:**
- `async execute` (29)
- `async execute` (12)

### `async findSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:369` | Self: 0.0% (0us) | Total: 0.0% (3.7ms) | Samples: 0

**Called by:**
- `async (anonymous)` (3)

**Calls:**
- `async (anonymous)` (2)
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/work-async-storage-instance.js:11` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `internal:stream`
`internal:stream:2` | Self: 0.0% (0us) | Total: 0.2% (38.1ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `anonymous` (2)

### `parseSelectAll`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/select-parser.js:33` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `selectAll` (1)

**Calls:**
- `createSelectAll` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/libmime.js:45` | Self: 0.0% (0us) | Total: 0.0% (4.2ms) | Samples: 0

**Called by:**
- `anonymous` (4)

**Calls:**
- `bound require` (4)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:79` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `async sqliteGeneratedPrimaryKeyColumn` (1)

### `__importStar`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:327` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `getColorDepth`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs:49` | Self: 0.0% (0us) | Total: 0.0% (4.5ms) | Samples: 0

**Called by:**
- `formatTransactionId` (2)

**Calls:**
- `getEnvVar` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/pino.js:8` | Self: 0.0% (0us) | Total: 0.0% (10.4ms) | Samples: 0

**Calls:**
- `bound require` (9)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/htmlparser2/node_modules/entities/dist/esm/generated/decode-data-html.js:3` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `decodeBase64` (1)

### `internal:streams/readable`
`internal:streams/readable:2` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `anonymous` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `compile`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:174` | Self: 0.0% (0us) | Total: 0.0% (3.1ms) | Samples: 0

**Called by:**
- `LinkifyIt` (1)
- `add` (1)

**Calls:**
- `forEach` (2)

### `async getMigrations`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:645` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `getType` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:892` | Self: 0.0% (0us) | Total: 0.0% (3.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `shouldIgnoreTopicSuggestionSignalUncached`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:144` | Self: 0.0% (0us) | Total: 0.0% (3.6ms) | Samples: 0

**Called by:**
- `shouldIgnoreTopicSuggestionSignal` (3)

**Calls:**
- `isFreeMailDomain` (2)
- `isFreeMailDomain` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:846` | Self: 0.0% (0us) | Total: 0.0% (5.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (3)

**Calls:**
- `ensureMasterTeamColumns` (3)

### `listSenderIdentityRows`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/senderIdentities.ts:11` | Self: 0.0% (0us) | Total: 0.1% (28.1ms) | Samples: 0

**Called by:**
- `async getAccountById` (22)
- `async getAccountOwnAddresses` (1)

**Calls:**
- `(anonymous)` (10)
- `(anonymous)` (7)
- `(anonymous)` (4)
- `wrapStatement` (1)
- `(anonymous)` (1)

### `values`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/insert-query-builder.js:200` | Self: 0.0% (0us) | Total: 0.9% (166.8ms) | Samples: 0

**Called by:**
- `async create` (2)

**Calls:**
- `parseInsertColumnsAndValues` (1)
- `parseInsertColumnsAndValues` (1)

### `async getMessageCalendarInviteDataByMessageId`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:219` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async listThreads` (1)

**Calls:**
- `newResolvedPromise` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-android/build/cjs/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `xor`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:949` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `ZodXor` (1)

### `validateFtsIdentity`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/ftsIdentity.ts:60` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `buildFtsIdentity` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:940` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `node:http`
`node:http:2` | Self: 0.0% (0us) | Total: 0.0% (13.1ms) | Samples: 0

**Calls:**
- `anonymous` (7)

### `parseValueBinaryOperation`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/binary-operation-parser.js:22` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Called by:**
- `binary` (2)

**Calls:**
- `isIsOperator` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/totp/index.mjs:194` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Calls:**
- `async verifyTOTP` (1)

### `internal:streams/transform`
`internal:streams/transform:2` | Self: 0.0% (0us) | Total: 0.0% (16.0ms) | Samples: 0

**Called by:**
- `anonymous` (9)

**Calls:**
- `anonymous` (9)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:866` | Self: 0.0% (0us) | Total: 0.0% (6.7ms) | Samples: 0

**Called by:**
- `(anonymous)` (2)

**Calls:**
- `ensureInviteIssuerSchema` (2)

### `async requireActiveUserSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:74` | Self: 0.0% (0us) | Total: 0.1% (27.9ms) | Samples: 0

**Calls:**
- `(anonymous)` (9)
- `(anonymous)` (7)
- `(anonymous)` (2)
- `wrapStatement` (1)
- `wrapStatement` (1)

### `getOwnAddresses`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:57` | Self: 0.0% (0us) | Total: 0.4% (87.7ms) | Samples: 0

**Called by:**
- `async getAccountById` (51)
- `async ensureCalendarEventRuntimeData` (9)
- `async getAccountOwnAddresses` (6)
- `async (anonymous)` (6)
- `async (anonymous)` (2)
- `async (anonymous)` (2)

**Calls:**
- `flatIntoArrayWithCallback` (74)
- `flatMap` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:281` | Self: 0.0% (0us) | Total: 0.0% (983us) | Samples: 0

**Calls:**
- `async reconcileProvisioning` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/converters/index.js:17` | Self: 0.0% (0us) | Total: 0.0% (960us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `upsertTopicLearningSignalsForThreadIds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:150` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `map` (1)

### `createDefault`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/schema.js:34` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `findParentSchema` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:163` | Self: 0.0% (0us) | Total: 0.0% (971us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:13` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `get` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-android/build/cjs/key_description.js:25` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `__decorate` (1)

### `async withDbWriteRetry`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/dbWriteRetry.ts:66` | Self: 0.0% (0us) | Total: 0.7% (135.0ms) | Samples: 0

**Called by:**
- `async withDbWriteRetry` (61)

**Calls:**
- `(anonymous)` (36)
- `initAccountSchema` (15)
- `(anonymous)` (4)
- `ensureAccountKeySchema` (1)
- `initAccountSchema` (1)
- `initAccountSchemaBody` (1)
- `ensureAccountKeySchema` (1)
- `(anonymous)` (1)
- `ensureAccountKeySchema` (1)

### `createDecipheriv`
`node:crypto:362` | Self: 0.0% (0us) | Total: 0.1% (27.0ms) | Samples: 0

**Called by:**
- `decryptPayload` (23)

**Calls:**
- `Decipheriv2` (23)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:900` | Self: 0.0% (0us) | Total: 0.0% (3.4ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `createAdminInvite` (1)

### `setAuthTag`
`node:crypto:352` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `decryptPayload` (2)

**Calls:**
- `setAuthTag` (2)

### `async deleteWithHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/with-hooks.mjs:120` | Self: 0.0% (0us) | Total: 0.0% (4.6ms) | Samples: 0

**Calls:**
- `async findMany` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/social-providers/index.mjs:78` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `_enum` (1)

### `backfillEmailCalendarEventParticipation`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:560` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async ensureCalendarEventRuntimeData` (1)

**Calls:**
- `ownAddressList` (1)

### `async ensureCalendarEventRuntimeData`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:672` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `backfillEmailCalendarEventParticipation` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/organization/routes/crud-team.mjs:134` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `bound optional` (1)

### `DecorateConstructor`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:549` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `decorate` (1)

**Calls:**
- `(anonymous)` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema/shared.mjs:5` | Self: 0.0% (0us) | Total: 0.0% (1.7ms) | Samples: 0

**Calls:**
- `date` (1)

### `async getDatabaseIndexMap`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:135` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async getDatabaseIndexMap` (1)

**Calls:**
- `async execute` (1)

### `visitIdentifier`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:298` | Self: 0.0% (0us) | Total: 0.0% (13.0ms) | Samples: 0

**Called by:**
- `bound visitIdentifier` (10)

**Calls:**
- `compileUnwrappedIdentifier` (10)

### `sentIdentifiers`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:211` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `toPhysicalSchema` (1)

**Calls:**
- `select` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:377` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async handleFallbackJoin` (1)

**Calls:**
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:707` | Self: 0.0% (0us) | Total: 0.0% (14.2ms) | Samples: 0

**Calls:**
- `async stageMessageFiles` (9)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sonic-boom/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ip-address.js:29` | Self: 0.0% (0us) | Total: 0.0% (4.6ms) | Samples: 0

**Called by:**
- `anonymous` (4)

**Calls:**
- `bound require` (4)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-ecc/build/cjs/ec_parameters.js:6` | Self: 0.0% (0us) | Total: 0.0% (5.5ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `get WriteStream`
`node:fs:644` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `(anonymous)` (2)

**Calls:**
- `anonymous` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:236` | Self: 0.0% (0us) | Total: 2.1% (389.8ms) | Samples: 0

**Called by:**
- `forEach` (330)

**Calls:**
- `flush` (318)
- `flush` (9)
- `flush` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/signer_info.js:7` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/outboundWrite.ts:27` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `async (anonymous)` (1)

### `943`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/ua-parser-js/ua-parser.js:1` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `__nccwpck_require__` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/connection.js:13` | Self: 0.0% (0us) | Total: 0.0% (10.3ms) | Samples: 0

**Called by:**
- `anonymous` (9)

**Calls:**
- `bound require` (9)

### `toPhysicalSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:190` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async getMigrations` (1)

**Calls:**
- `sentIdentifiers` (1)

### `async verifyTOTP`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/utils/dist/otp.mjs:39` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Called by:**
- `async verifyTOTP` (1)

**Calls:**
- `async generateHOTP` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/thread-stream/index.js:3` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async runWithEndpointContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/endpoint-context.mjs:45` | Self: 0.0% (0us) | Total: 0.4% (75.7ms) | Samples: 0

**Called by:**
- `async runWithEndpointContext` (2)
- `async (anonymous)` (2)

**Calls:**
- `run` (48)
- `async runWithEndpointContext` (2)
- `async getOrCreateEndpointContextStorage` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:237` | Self: 0.0% (0us) | Total: 0.0% (8.2ms) | Samples: 0

**Called by:**
- `async withAccountDb` (7)

**Calls:**
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (1)

### `mapAccountRow`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts:185` | Self: 0.0% (0us) | Total: 0.1% (21.0ms) | Samples: 0

**Called by:**
- `async getAccountById` (18)

**Calls:**
- `decodeSecret` (17)
- `decodeSecret` (1)

### `async runValidation`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/validator.mjs:12` | Self: 0.0% (0us) | Total: 0.0% (6.2ms) | Samples: 0

**Called by:**
- `async runValidation` (3)

**Calls:**
- `validate` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:169` | Self: 0.0% (0us) | Total: 1.2% (220.0ms) | Samples: 0

**Called by:**
- `forEach` (103)

**Calls:**
- `(anonymous)` (103)

### `clampThreadListPageSize`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:21` | Self: 0.0% (0us) | Total: 0.0% (2.5ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `Number` (2)

### `getTopicSuggestionsForThreadSignalBatch`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:620` | Self: 0.0% (0us) | Total: 0.5% (100.1ms) | Samples: 0

**Called by:**
- `async withAccountDb` (85)

**Calls:**
- `forEach` (85)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/encode.js:15` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `from` (1)

### `bound visitColumn`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (2.9ms) | Samples: 0

**Called by:**
- `visitNode` (2)

**Calls:**
- `visitColumn` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:655` | Self: 0.0% (0us) | Total: 0.3% (65.6ms) | Samples: 0

**Called by:**
- `forEach` (55)

**Calls:**
- `insert` (29)
- `insert` (26)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/index.js:8` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authPolicyHandler.ts:289` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `newResolvedPromise` (1)

### `bound max`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (3.3ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `bound check` (1)

### `decryptPayload`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts:57` | Self: 0.0% (0us) | Total: 0.0% (4.5ms) | Samples: 0

**Called by:**
- `decodeSecret` (4)

**Calls:**
- `subarray` (4)

### `async dispatchAuthEndpoint`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:205` | Self: 0.0% (0us) | Total: 0.0% (3.7ms) | Samples: 0

**Called by:**
- `async (anonymous)` (3)

**Calls:**
- `(anonymous)` (2)
- `(anonymous)` (1)

### `shardWriterGuardsInstalled`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts:60` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `ensureAccountKeySchema` (1)

**Calls:**
- `(anonymous)` (1)

### `async ensureAsyncStorage`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:10` | Self: 0.0% (0us) | Total: 0.0% (4.6ms) | Samples: 0

**Called by:**
- `async hasRequestState` (1)

**Calls:**
- `async (anonymous)` (1)

### `getDatabaseIndexName`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/database-index.mjs:39` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async getMigrations` (1)

**Calls:**
- `join` (1)

### `bound visitValue`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `visitNode` (1)

**Calls:**
- `visitValue` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:211` | Self: 0.0% (0us) | Total: 0.1% (32.7ms) | Samples: 0

**Calls:**
- `async transformSingleOutput` (17)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/sign-in.mjs:352` | Self: 0.0% (0us) | Total: 0.9% (163.9ms) | Samples: 0

**Calls:**
- `async createSession` (1)

### `pruneThreadTopicsWithoutMessages`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:174` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `map` (1)

### `_ipv6`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/api.js:178` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `ZodIPv6` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/dependency-container.js:8` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:95` | Self: 0.0% (0us) | Total: 0.1% (31.8ms) | Samples: 0

**Calls:**
- `async enrichMessagesWithThreadCollab` (26)

### `async createAuthContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/create-context.mjs:229` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `async runPluginInit` (1)

### `ensureCalendarReminderOptionalColumns`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:250` | Self: 0.0% (0us) | Total: 0.0% (3.4ms) | Samples: 0

**Called by:**
- `ensureCalendarReminderRuntimeSchema` (1)

**Calls:**
- `getDbTableColumns` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:208` | Self: 0.0% (0us) | Total: 0.0% (4.2ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `async ensureCalendarEventRuntimeData`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:662` | Self: 0.0% (0us) | Total: 0.0% (15.2ms) | Samples: 0

**Calls:**
- `getOwnAddresses` (9)
- `getOwnAddresses` (3)
- `getOwnAddresses` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:54` | Self: 0.0% (0us) | Total: 0.3% (59.6ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `buildFtsIdentity`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/ftsIdentity.ts:46` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `migrate` (1)

**Calls:**
- `validateFtsIdentity` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/index.js:6` | Self: 0.0% (0us) | Total: 0.0% (10.2ms) | Samples: 0

**Called by:**
- `anonymous` (9)

**Calls:**
- `bound require` (9)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/request.js:23` | Self: 0.0% (0us) | Total: 0.0% (4.7ms) | Samples: 0

**Called by:**
- `anonymous` (4)

**Calls:**
- `bound require` (4)

### `upsertBatch`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:365` | Self: 0.0% (0us) | Total: 1.8% (335.3ms) | Samples: 0

**Called by:**
- `(anonymous)` (291)

**Calls:**
- `forEach` (291)

### `internal:errors`
`internal:errors:2` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `anonymous` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:91` | Self: 0.0% (0us) | Total: 0.0% (6.6ms) | Samples: 0

**Calls:**
- `getOwnAddresses` (6)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/index.mjs:329` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async (anonymous)` (1)

### `generateFastpass`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1147` | Self: 0.0% (0us) | Total: 0.0% (4.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `write` (1)

### `ownAddressList`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:68` | Self: 0.0% (0us) | Total: 0.0% (2.5ms) | Samples: 0

**Called by:**
- `getTopicSuggestionSignalsForThreadsFromDb` (1)
- `collectTopicSignalEntries` (1)

**Calls:**
- `Set` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/converters.js:8` | Self: 0.0% (0us) | Total: 0.0% (959us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async reconcileLifecycle`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/userLifecycle.ts:247` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async reconcileLifecycle` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:32` | Self: 0.0% (0us) | Total: 0.1% (19.9ms) | Samples: 0

**Calls:**
- `bound require` (17)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/proxy_info.js:7` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `selectFrom`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-creator.js:133` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async findOne` (1)

**Calls:**
- `createQueryId` (1)

### `OperationNodeVisitor`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `DefaultQueryCompiler` (1)

**Calls:**
- `(anonymous)` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/jose/dist/webapi/util/errors.js:1` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `(anonymous)` (1)

### `buildTimeGroupKey`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/messageGrouping.ts:43` | Self: 0.0% (0us) | Total: 0.2% (36.7ms) | Samples: 0

**Called by:**
- `(anonymous)` (25)
- `(anonymous)` (6)

**Calls:**
- `displayDayNumber` (29)
- `displayDayNumber` (2)

### `parseExpression`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/expression-parser.js:11` | Self: 0.0% (0us) | Total: 0.1% (24.7ms) | Samples: 0

**Called by:**
- `where` (19)

**Calls:**
- `(anonymous)` (18)
- `createExpressionBuilder` (1)

### `totpFromUri`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/tests/helpers/totp.ts:34` | Self: 0.0% (0us) | Total: 0.0% (4.9ms) | Samples: 0

**Called by:**
- `async enrollTestTotp` (1)

**Calls:**
- `base32Decode` (1)

### `ensureTableColumns`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:147` | Self: 0.0% (0us) | Total: 0.0% (4.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)
- `(anonymous)` (1)

### `getTopicSuggestionSignalsForThreadsFromDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:203` | Self: 0.0% (0us) | Total: 0.1% (33.6ms) | Samples: 0

**Called by:**
- `(anonymous)` (27)

**Calls:**
- `forEach` (27)

### `ensureCalendarReminderRuntimeSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:273` | Self: 0.0% (0us) | Total: 0.0% (3.4ms) | Samples: 0

**Called by:**
- `async getAccountDb` (1)

**Calls:**
- `ensureCalendarReminderOptionalColumns` (1)

### `transaction`
`bun:sqlite:447` | Self: 0.0% (0us) | Total: 2.0% (368.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (291)
- `initAccountSchema` (13)
- `installAuthControlPlane` (5)
- `ensureMasterTeamColumns` (2)
- `async (anonymous)` (2)
- `async buildFixture` (1)

**Calls:**
- `(anonymous)` (291)
- `ensureAccountKeySchema` (8)
- `initAccountSchemaBody` (3)
- `(anonymous)` (2)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `initAccountSchemaBody` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:75` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Calls:**
- `async listThreads` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/react/index.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `[prepareOwned]`
`bun:sqlite:369` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `query` (1)

**Calls:**
- `prepare` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/recipient_infos.js:7` | Self: 0.0% (0us) | Total: 0.0% (3.4ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `bound require` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/utils.js:35` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/bytes/index.js:17` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `ensureThreadCollabRuntimeSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:923` | Self: 0.0% (0us) | Total: 0.0% (974us) | Samples: 0

**Called by:**
- `initAccountSchemaBody` (1)

**Calls:**
- `add` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/ua-parser-js/ua-parser.js:1` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)
- `(anonymous)` (1)

**Calls:**
- `__nccwpck_require__` (1)
- `(anonymous)` (1)

### `visitSelectQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:68` | Self: 0.0% (0us) | Total: 0.0% (10.2ms) | Samples: 0

**Called by:**
- `bound visitSelectQuery` (8)

**Calls:**
- `compileList` (7)
- `compileList` (1)

### `internal:stream`
`internal:stream:48` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `anonymous` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@simplewebauthn/server/esm/services/metadataService.js:18` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `(anonymous)` (1)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1352` | Self: 0.0% (0us) | Total: 0.1% (29.3ms) | Samples: 0

**Calls:**
- `(anonymous)` (22)
- `(anonymous)` (2)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/index.js:22` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `mergeModules` (1)

### `async lock`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:79` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async lock` (1)

**Calls:**
- `Promise` (1)

### `rebuildThreadSignalsForThreadIdsInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:101` | Self: 0.0% (0us) | Total: 0.0% (8.3ms) | Samples: 0

**Called by:**
- `async rebuildThreadSignalsForThreadIds` (7)

**Calls:**
- `(anonymous)` (7)

### `async getTopicSuggestionsForThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:700` | Self: 0.0% (0us) | Total: 0.0% (8.0ms) | Samples: 0

**Called by:**
- `async enrichMessagesWithThreadTopics` (7)

**Calls:**
- `Set` (4)
- `filter` (2)
- `map` (1)

### `async execute`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:317` | Self: 0.0% (0us) | Total: 0.3% (61.0ms) | Samples: 0

**Called by:**
- `async execute` (29)

**Calls:**
- `compileQuery` (24)
- `compileQuery` (4)
- `compile` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/types/bit_string.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `__importStar` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/index.js:7` | Self: 0.0% (0us) | Total: 0.0% (3.3ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `bound require` (3)

### `ZodEnum`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `_enum` (1)

**Calls:**
- `init` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/next-url.js:14` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `compile`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:160` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `tlds` (1)

**Calls:**
- `RegExp` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:473` | Self: 0.0% (0us) | Total: 0.0% (1.6ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `create`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/select-all-node.js:11` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `createSelectAll` (1)

**Calls:**
- `freeze` (1)

### `require`
`[native code]` | Self: 0.0% (0us) | Total: 5.7% (1.05s) | Samples: 0

**Called by:**
- `bound require` (776)

**Calls:**
- `anonymous` (764)
- `(anonymous)` (10)
- `get` (1)
- `startsWith` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/headers.js:2` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `#runNoArgs`
`bun:sqlite:163` | Self: 0.0% (0us) | Total: 0.6% (113.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (27)
- `transaction` (25)

**Calls:**
- `run` (52)

### `parseUserOutput`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/schema.mjs:25` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `get` (1)
- `getFields` (1)

### `async ensureAuthLifetimeLock`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authLifetimeLock.ts:75` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async acquireAuthLifetimeLock` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/launder/index.js:1` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `runCipher`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_arx.js:113` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `chachaCore` (1)

### `async getMigrations`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:405` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `toPhysicalSchema` (1)

### `optional`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:1242` | Self: 0.0% (0us) | Total: 0.0% (4.3ms) | Samples: 0

**Called by:**
- `bound optional` (2)
- `optional` (1)
- `bound nullish` (1)

**Calls:**
- `ZodOptional` (3)
- `ZodOptional` (1)

### `node:stream`
`node:stream:2` | Self: 0.0% (0us) | Total: 0.2% (40.5ms) | Samples: 0

**Calls:**
- `anonymous` (4)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2684` | Self: 0.0% (0us) | Total: 5.5% (999.3ms) | Samples: 0

**Calls:**
- `async getThreadGroupCounts` (796)
- `async getThreadGroupCounts` (47)
- `async getThreadGroupCounts` (4)
- `async getThreadGroupCounts` (2)
- `async getThreadGroupCounts` (1)
- `async getThreadGroupCounts` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:361` | Self: 0.0% (0us) | Total: 0.0% (4.4ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `collectTopicSignalEntries`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:60` | Self: 0.0% (0us) | Total: 0.0% (12.6ms) | Samples: 0

**Called by:**
- `flush` (11)

**Calls:**
- `ownAddressList` (10)
- `ownAddressList` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2249` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Calls:**
- `normalizeSearchTermList` (1)
- `from` (1)

### `shouldIgnoreTopicSuggestionSignalUncached`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:151` | Self: 0.0% (0us) | Total: 0.4% (85.4ms) | Samples: 0

**Called by:**
- `shouldIgnoreTopicSuggestionSignal` (73)

**Calls:**
- `isOwnAddress` (44)
- `isOwnAddress` (28)
- `some` (1)

### `selectFrom`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:39` | Self: 0.0% (0us) | Total: 0.1% (35.4ms) | Samples: 0

**Called by:**
- `(anonymous)` (28)

**Calls:**
- `createFrom` (21)
- `parseTableExpressionOrList` (7)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@zone-eu/mailsplit/lib/headers.js:3` | Self: 0.0% (0us) | Total: 0.2% (44.1ms) | Samples: 0

**Called by:**
- `anonymous` (39)

**Calls:**
- `bound require` (39)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:578` | Self: 0.0% (0us) | Total: 0.8% (145.7ms) | Samples: 0

**Called by:**
- `async findOne` (91)

**Calls:**
- `(anonymous)` (91)

### `normalizeService`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/well-known/index.js:19` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `forEach` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:364` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `copyDataProperties` (1)

### `flush`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:225` | Self: 0.0% (0us) | Total: 0.0% (3.6ms) | Samples: 0

**Called by:**
- `(anonymous)` (3)

**Calls:**
- `topicSuggestionSignalsFromEntries` (2)
- `topicSuggestionSignalsFromEntries` (1)

### `shardWriterGuardsInstalled`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts:69` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `assertCompleteShardFormat` (1)

**Calls:**
- `guards` (1)

### `OrdinaryGetMetadata`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:597` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `getMetadata` (1)

**Calls:**
- `OrdinaryGetMetadata` (1)

### `async (anonymous)`
`/tmp/spike-switch-server/anatomy.ts:71` | Self: 0.0% (0us) | Total: 0.0% (5.5ms) | Samples: 0

**Called by:**
- `async (anonymous)` (4)

**Calls:**
- `map` (4)

### `async withAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:412` | Self: 0.0% (0us) | Total: 0.0% (4.3ms) | Samples: 0

**Called by:**
- `async withAccountDb` (4)

**Calls:**
- `async getAccountDb` (4)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:84` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `async getThreadGroupCounts` (1)

**Calls:**
- `fireTriggers` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:35` | Self: 0.0% (0us) | Total: 0.0% (9.2ms) | Samples: 0

**Calls:**
- `bound require` (8)

### `async withAuthResponse`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:50` | Self: 0.0% (0us) | Total: 0.0% (7.2ms) | Samples: 0

**Called by:**
- `async withAuthResponse` (6)

**Calls:**
- `async (anonymous)` (6)

### `webpackUniversalModuleDefinition`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:3` | Self: 0.0% (0us) | Total: 0.1% (18.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (4)

**Calls:**
- `(anonymous)` (4)

### `async requireActiveUserSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:68` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `async (anonymous)` (1)

### `createRawBuilder`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/raw-builder/raw-builder.js:61` | Self: 0.0% (0us) | Total: 0.0% (990us) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `RawBuilderImpl` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:440` | Self: 0.0% (0us) | Total: 0.3% (55.8ms) | Samples: 0

**Called by:**
- `forEach` (49)

**Calls:**
- `(anonymous)` (49)

### `async findMany`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:570` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `async findMany` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino-std-serializers/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js:8` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Calls:**
- `bound require` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/tools.js:8` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:1414` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `(anonymous)` (1)

### `initAccountSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:992` | Self: 0.0% (0us) | Total: 0.1% (21.5ms) | Samples: 0

**Called by:**
- `async withDbWriteRetry` (15)

**Calls:**
- `transaction` (13)
- `transaction` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:246` | Self: 0.0% (0us) | Total: 0.4% (83.2ms) | Samples: 0

**Called by:**
- `async withAccountDb` (53)

**Calls:**
- `(anonymous)` (53)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/authority_information_access.js:7` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(module)`
`/tmp/spike-switch-server/anatomy.ts:81` | Self: 0.0% (0us) | Total: 0.0% (5.5ms) | Samples: 0

**Calls:**
- `exit` (3)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:51` | Self: 0.0% (0us) | Total: 0.0% (3.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `loadNextHeadersModule` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:179` | Self: 0.0% (0us) | Total: 0.0% (4.2ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/generated/decode-data-html.js:4` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (2)

**Calls:**
- `decodeTrieDict` (1)
- `decodeTrieDict` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:152` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/decorators/injectable.js:8` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `DecorateConstructor` (1)

**Calls:**
- `getParamInfo` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:52` | Self: 0.0% (0us) | Total: 0.0% (12.0ms) | Samples: 0

**Calls:**
- `headers` (9)
- `headers` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:495` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `loadServerDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/serverDb.ts:7` | Self: 0.0% (0us) | Total: 0.1% (31.2ms) | Samples: 0

**Called by:**
- `async getAccountById` (8)
- `async getUserById` (7)

**Calls:**
- `importModule` (15)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/dom-serializer/node_modules/entities/lib/esm/generated/decode-data-html.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `split` (1)

### `initAccountSchemaBody`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:1004` | Self: 0.0% (0us) | Total: 0.0% (3.8ms) | Samples: 0

**Called by:**
- `transaction` (3)

**Calls:**
- `(anonymous)` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:360` | Self: 0.0% (0us) | Total: 0.0% (4.2ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:74` | Self: 0.0% (0us) | Total: 0.1% (24.0ms) | Samples: 0

**Called by:**
- `forEach` (21)

**Calls:**
- `parseAddressEmails` (16)
- `flatIntoArrayWithCallback` (3)
- `parseAddressEmails` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts:71` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `every` (1)

**Calls:**
- `normalizeShardSql` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:80` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `get` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:89` | Self: 0.0% (0us) | Total: 0.0% (18.0ms) | Samples: 0

**Calls:**
- `async enrichMessagesWithThreadTopics` (16)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/index.js:3` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:152` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `(anonymous)` (1)

### `initAccountSchemaBody`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:1397` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `transaction` (1)

**Calls:**
- `ensureMessageCalendarEventOptionalColumns` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/bags/index.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:287` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `transaction` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:222` | Self: 0.0% (0us) | Total: 0.0% (3.0ms) | Samples: 0

**Called by:**
- `filter` (1)

**Calls:**
- `schemaSql` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2455` | Self: 0.0% (0us) | Total: 0.3% (55.9ms) | Samples: 0

**Calls:**
- `(anonymous)` (41)
- `(anonymous)` (5)
- `wrapStatement` (1)
- `(anonymous)` (1)

### `getTopicSuggestionSignalsForThreadsFromDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:243` | Self: 0.0% (0us) | Total: 0.0% (3.4ms) | Samples: 0

**Called by:**
- `(anonymous)` (3)

**Calls:**
- `flush` (3)

### `parseAddressEmails`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:45` | Self: 0.0% (0us) | Total: 1.2% (235.2ms) | Samples: 0

**Called by:**
- `isOwnAddress` (147)
- `flatIntoArrayWithCallback` (22)
- `(anonymous)` (16)
- `(anonymous)` (13)

**Calls:**
- `addressparser` (150)
- `flatMap` (48)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-field-name.mjs:21` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `fromBER`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1484` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `fromBER` (1)

**Calls:**
- `localFromBERWithChildContext` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:56` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `_interopNamespaceDefault` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/css-syntax-error.js:3` | Self: 0.0% (0us) | Total: 0.0% (3.3ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `bound require` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/decorators.js:4` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/account.mjs:105` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `_array` (1)

### `async sqliteGeneratedPrimaryKeyColumn`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:30` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async sqliteGeneratedPrimaryKeyColumn` (1)

### `bound visitIdentifier`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (13.0ms) | Samples: 0

**Called by:**
- `visitNode` (10)

**Calls:**
- `visitIdentifier` (10)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:556` | Self: 0.0% (0us) | Total: 0.0% (2.5ms) | Samples: 0

**Called by:**
- `async findOne` (2)

**Calls:**
- `(anonymous)` (2)

### `async getTables`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:70` | Self: 0.0% (0us) | Total: 0.0% (5.5ms) | Samples: 0

**Calls:**
- `map` (4)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/ip.mjs:5` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `_ipv6` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/node.js:3` | Self: 0.0% (0us) | Total: 0.0% (4.5ms) | Samples: 0

**Called by:**
- `anonymous` (4)

**Calls:**
- `bound require` (4)

### `async getSessionFromCtx`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:275` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async (anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/mailboxSummary.ts:50` | Self: 0.0% (0us) | Total: 0.0% (976us) | Samples: 0

**Calls:**
- `(anonymous)` (1)

### `transformJoinClause`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:291` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `filter` (1)
- `entries` (1)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:391` | Self: 0.0% (0us) | Total: 0.0% (5.7ms) | Samples: 0

**Calls:**
- `ensureCalendarReminderRuntimeSchema` (2)
- `ensureCalendarReminderRuntimeSchema` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/decorators/auto-injectable.js:4` | Self: 0.0% (0us) | Total: 0.0% (4.5ms) | Samples: 0

**Called by:**
- `anonymous` (4)

**Calls:**
- `bound require` (4)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/otp/index.mjs:21` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `_boolean` (1)

### `internal:streams/destroy`
`internal:streams/destroy:2` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `anonymous` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/init.mjs:10` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Calls:**
- `async createAuthContext` (2)

### `async GET`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:58` | Self: 0.0% (0us) | Total: 0.0% (9.5ms) | Samples: 0

**Calls:**
- `async withAuthResponse` (6)
- `async withAuthResponse` (2)

### `(anonymous)`
`/tmp/spike-switch-server/anatomy.ts:79` | Self: 0.0% (0us) | Total: 0.0% (5.4ms) | Samples: 0

**Called by:**
- `async time` (3)

**Calls:**
- `rq` (3)

### `resolveAccountRoleRow`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountAccess.ts:11` | Self: 0.0% (0us) | Total: 0.0% (6.6ms) | Samples: 0

**Called by:**
- `async resolveAccountRole` (6)

**Calls:**
- `(anonymous)` (6)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:851` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `isFreeMailDomain`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/senderIdentity.ts:271` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `shouldIgnoreTopicSuggestionSignalUncached` (2)

**Calls:**
- `normalizeEmailAddress` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/tools.js:28` | Self: 0.0% (0us) | Total: 0.0% (987us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/utils.js:341` | Self: 0.0% (0us) | Total: 0.3% (57.2ms) | Samples: 0

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:158` | Self: 0.0% (0us) | Total: 0.0% (3.0ms) | Samples: 0

**Called by:**
- `transaction` (1)

**Calls:**
- `ensureTableColumns` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:196` | Self: 0.0% (0us) | Total: 0.5% (100.7ms) | Samples: 0

**Called by:**
- `async (anonymous)` (65)

**Calls:**
- `async handleFallbackJoin` (65)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2256` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `push` (1)

### `ZodEmail`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` | Self: 0.0% (0us) | Total: 0.0% (8.6ms) | Samples: 0

**Called by:**
- `_email` (2)

**Calls:**
- `init` (2)

### `Kysely`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/kysely.js:68` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `createQueryCompiler` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/fromJSON.js:8` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:652` | Self: 0.0% (0us) | Total: 0.0% (9.7ms) | Samples: 0

**Called by:**
- `forEach` (5)

**Calls:**
- `rowToTopic` (5)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:14` | Self: 0.0% (0us) | Total: 0.0% (7.4ms) | Samples: 0

**Called by:**
- `async internalHandler` (4)

**Calls:**
- `async createInternalContext` (3)
- `async tryCatch` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ip-address.js:27` | Self: 0.0% (0us) | Total: 0.0% (1.9ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/comment.js:3` | Self: 0.0% (0us) | Total: 0.0% (6.7ms) | Samples: 0

**Called by:**
- `anonymous` (6)

**Calls:**
- `bound require` (6)

### `createQueryId`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/query-id.js:4` | Self: 0.0% (0us) | Total: 0.0% (13.6ms) | Samples: 0

**Called by:**
- `selectFrom` (7)
- `(anonymous)` (1)

**Calls:**
- `LazyQueryId` (8)

### `(anonymous)`
`/tmp/spike-switch-server/fixture.ts:60` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `transaction` (1)

**Calls:**
- `(anonymous)` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:837` | Self: 0.0% (0us) | Total: 0.0% (2.9ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `init`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:76` | Self: 0.0% (0us) | Total: 0.0% (4.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

**Calls:**
- `members` (3)
- `members` (1)

### `toASN`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/converters.js:47` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `toAsnItem` (1)

**Calls:**
- `ObjectIdentifier` (1)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:112` | Self: 0.0% (0us) | Total: 0.4% (74.1ms) | Samples: 0

**Called by:**
- `initMasterSchema` (17)
- `configureDb` (10)
- `installShardWriterGuards` (4)
- `initAccountSchemaBody` (3)
- `(anonymous)` (1)
- `validateProvisioningIndex` (1)
- `(anonymous)` (1)

**Calls:**
- `run` (37)

### `tlds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:618` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `compile` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha3.js:315` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `createHasher` (1)

**Calls:**
- `Keccak` (1)

### `async getTables`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:69` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async getTables` (1)

**Calls:**
- `async execute` (1)

### `async getCurrentAdapter`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/transaction.mjs:23` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async ensureAsyncStorage` (1)

### `(module)`
`/tmp/spike-switch-server/anatomy.ts:41` | Self: 0.0% (0us) | Total: 0.0% (9.9ms) | Samples: 0

**Calls:**
- `async getAccountById` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authPolicyHandler.ts:19` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `map` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs:48` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `isRequestLike` (1)

### `_email`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/api.js:20` | Self: 0.0% (0us) | Total: 0.0% (8.6ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `ZodEmail` (2)

### `(module)`
`/tmp/spike-switch-server/anatomy.ts:73` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Calls:**
- `async time` (1)

### `async requireActiveUserSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:94` | Self: 0.0% (0us) | Total: 0.0% (4.7ms) | Samples: 0

**Called by:**
- `async requireAccountContext` (3)

**Calls:**
- `async requireActiveUserSession` (2)
- `async requireActiveUserSession` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/charset.js:15` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `async recomputeThreadsForAccountInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:283` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Calls:**
- `(anonymous)` (2)

### `rebuildThreadSignalsForThreadIdsInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:98` | Self: 0.0% (0us) | Total: 0.0% (958us) | Samples: 0

**Called by:**
- `async rebuildThreadSignalsForThreadIds` (1)

**Calls:**
- `map` (1)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:104` | Self: 0.0% (0us) | Total: 0.1% (21.0ms) | Samples: 0

**Called by:**
- `listSenderIdentityRows` (10)
- `async resolveAccountDbPath` (7)
- `resolveAccountRoleRow` (1)

**Calls:**
- `bump` (12)
- `bump` (4)
- `bump` (2)

### `topicSuggestionSignalEntries`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:103` | Self: 0.0% (0us) | Total: 0.0% (10.5ms) | Samples: 0

**Called by:**
- `(anonymous)` (9)

**Calls:**
- `map` (9)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:442` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `forEach` (1)

**Calls:**
- `Map` (1)

### `async rawEncrypt`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/crypto/index.mjs:33` | Self: 0.0% (0us) | Total: 0.0% (4.4ms) | Samples: 0

**Calls:**
- `encrypt` (4)

### `encrypt`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/utils.js:875` | Self: 0.0% (0us) | Total: 0.0% (4.4ms) | Samples: 0

**Called by:**
- `async rawEncrypt` (4)

**Calls:**
- `encrypt` (2)
- `encrypt` (1)
- `wrappedCipher` (1)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1345` | Self: 0.0% (0us) | Total: 0.0% (9.5ms) | Samples: 0

**Calls:**
- `applyBadgeFilters` (2)
- `applyBadgeFilters` (1)
- `applyBadgeFilters` (1)
- `applyBadgeFilters` (1)
- `applyBadgeFilters` (1)
- `applyBadgeFilters` (1)
- `applyBadgeFilters` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:11` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `ValidationError` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/index.js:6` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `release`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authLifetimeLock.ts:61` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `exit` (1)

**Calls:**
- `fsyncSync` (1)

### `visitSelectQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:72` | Self: 0.0% (0us) | Total: 0.1% (34.4ms) | Samples: 0

**Called by:**
- `bound visitSelectQuery` (13)

**Calls:**
- `visitNode` (13)

### `parseSelectAll`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/select-parser.js:39` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `selectAll` (2)

**Calls:**
- `parseSelectAllArg` (2)

### `DBCSCodec`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:26` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `getCodec` (1)

**Calls:**
- `table` (1)

### `normalizeSearchTermList`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:525` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async listThreads` (1)

**Calls:**
- `filter` (1)

### `__decorate`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:106` | Self: 0.0% (0us) | Total: 0.0% (4.5ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

**Calls:**
- `decorate` (1)
- `decorate` (1)
- `decorate` (1)
- `decorate` (1)

### `toASN`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/converters.js:16` | Self: 0.0% (0us) | Total: 0.0% (3.7ms) | Samples: 0

**Called by:**
- `toAsnItem` (3)

**Calls:**
- `localFromBER` (2)
- `fromBER` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authPolicyHandler.ts:285` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async (anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:649` | Self: 0.0% (0us) | Total: 0.0% (2.5ms) | Samples: 0

**Called by:**
- `map` (1)

**Calls:**
- `async (anonymous)` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/imapflow/dist/esm/special-use.js:69` | Self: 0.0% (0us) | Total: 0.0% (989us) | Samples: 0

**Calls:**
- `map` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:47` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async getSignedCookie` (1)

**Calls:**
- `endsWith` (1)

### `async runPluginInit`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/helpers.mjs:53` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async createAuthContext` (1)

**Calls:**
- `async runPluginInit` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/tools.js:29` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js:2` | Self: 0.0% (0us) | Total: 0.4% (86.9ms) | Samples: 0

**Calls:**
- `bound require` (9)

### `parseSelectArg`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/select-parser.js:10` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `select` (1)

**Calls:**
- `isFunction` (1)

### `members`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:740` | Self: 0.0% (0us) | Total: 0.0% (3.2ms) | Samples: 0

**Called by:**
- `init` (3)

**Calls:**
- `defineBound` (3)

### `noctuaAuthOptions`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:150` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `admin` (1)

### `toBER`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:960` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `toASN` (1)
- `toBER` (1)

**Calls:**
- `toBER` (1)
- `concat` (1)

### `createBoundedWorkerJobRegistry`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/boundedWorkerJobRegistry.ts:31` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `createHash` (1)

### `buildMeaningfulAttachmentExistsSql`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:954` | Self: 0.0% (0us) | Total: 0.0% (4.7ms) | Samples: 0

**Called by:**
- `async listThreads` (4)

**Calls:**
- `buildMeaningfulAttachmentPredicateSql` (3)
- `buildMeaningfulAttachmentPredicateSql` (1)

### `getEndpoints`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/index.mjs:119` | Self: 0.0% (0us) | Total: 0.0% (4.4ms) | Samples: 0

**Called by:**
- `createBetterAuth` (1)

**Calls:**
- `signUpEmail` (1)

### `async getAccountIdFromParams`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/accountContext.ts:39` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `trim` (1)

### `async (anonymous)`
`/tmp/spike-switch-server/anatomy.ts:72` | Self: 0.0% (0us) | Total: 0.2% (50.6ms) | Samples: 0

**Called by:**
- `async time` (22)
- `async (anonymous)` (19)
- `async time` (1)

**Calls:**
- `async (anonymous)` (19)
- `async enrichMessagesWithThreadTopics` (16)
- `async (anonymous)` (4)
- `getOwnAddresses` (2)
- `getOwnAddresses` (1)

### `async getMigrations`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:655` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `getDatabaseIndexName` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:71` | Self: 0.0% (0us) | Total: 0.0% (990us) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `createRawBuilder` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/redaction.js:4` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha2.js:378` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `createHasher` (1)

**Calls:**
- `_SHA256` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:249` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `transaction` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/bags/key_bag.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:272` | Self: 0.0% (0us) | Total: 0.1% (21.8ms) | Samples: 0

**Called by:**
- `run` (15)

**Calls:**
- `async (anonymous)` (9)
- `async (anonymous)` (5)
- `async (anonymous)` (1)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1359` | Self: 0.0% (0us) | Total: 1.7% (313.2ms) | Samples: 0

**Calls:**
- `(anonymous)` (272)
- `(anonymous)` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/certificate.js:7` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `async releaseConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:47` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async releaseConnection` (1)

**Calls:**
- `unlock` (1)

### `createQueryCompiler`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:113` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `Kysely` (1)

**Calls:**
- `BunSqliteQueryCompiler` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js:14` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Calls:**
- `bound require` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/pino.js:224` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `selectFrom`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:37` | Self: 0.0% (0us) | Total: 0.0% (12.3ms) | Samples: 0

**Called by:**
- `(anonymous)` (7)

**Calls:**
- `createQueryId` (7)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sanitize-html/index.js:1` | Self: 0.0% (0us) | Total: 0.1% (19.2ms) | Samples: 0

**Calls:**
- `bound require` (11)

### `_enum`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:1139` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `ZodEnum` (1)

### `_joinAtSpacing`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:243` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `_recoverAddrSpec` (1)

**Calls:**
- `_isSpaceCode` (1)

### `lookup`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/ftsIdentity.ts:82` | Self: 0.0% (0us) | Total: 0.0% (5.6ms) | Samples: 0

**Called by:**
- `(anonymous)` (5)

**Calls:**
- `(anonymous)` (4)
- `(anonymous)` (1)

### `async createWithHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/with-hooks.mjs:13` | Self: 0.0% (0us) | Total: 0.0% (943us) | Samples: 0

**Calls:**
- `(anonymous)` (1)

### `async getTopicSuggestionsForThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:699` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async enrichMessagesWithThreadTopics` (1)

**Calls:**
- `from` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:275` | Self: 0.0% (0us) | Total: 0.0% (8.9ms) | Samples: 0

**Calls:**
- `installAuthControlPlane` (6)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:27` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sanitize-html/index.js:6` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Calls:**
- `bound require` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testAuthHarness.ts:161` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async withDbWriteRetry` (1)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:408` | Self: 0.0% (0us) | Total: 0.0% (8.0ms) | Samples: 0

**Called by:**
- `async withAccountDb` (4)
- `async getThreadCollabStates` (2)
- `async getTotalCount` (1)

**Calls:**
- `async getAccountDb` (7)

### `parseAliasedExpression`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/expression-parser.js:20` | Self: 0.0% (0us) | Total: 0.5% (106.5ms) | Samples: 0

**Called by:**
- `parseTableExpressionOrList` (80)

**Calls:**
- `(anonymous)` (37)
- `(anonymous)` (25)
- `createExpressionBuilder` (8)
- `createExpressionBuilder` (4)
- `(anonymous)` (2)
- `createExpressionBuilder` (2)
- `createExpressionBuilder` (1)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/index.js:9` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:565` | Self: 0.0% (0us) | Total: 0.1% (35.6ms) | Samples: 0

**Called by:**
- `async findOne` (19)

**Calls:**
- `transformJoinClause` (10)
- `transformJoinClause` (2)
- `transformJoinClause` (2)
- `transformJoinClause` (2)
- `transformJoinClause` (1)
- `transformJoinClause` (1)
- `transformJoinClause` (1)

### `async getMigrations`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:361` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Calls:**
- `async getTables` (2)

### `async tryCatch`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/utils.mjs:75` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async tryCatch` (1)

### `ensureMasterTeamColumns`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:167` | Self: 0.0% (0us) | Total: 0.0% (5.0ms) | Samples: 0

**Called by:**
- `initMasterSchema` (3)

**Calls:**
- `transaction` (2)
- `transaction` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/request.js:26` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:22` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/recipient_info.js:9` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async getTables`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:67` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async getTables` (1)

**Calls:**
- `where` (1)

### `async runBeforeHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:79` | Self: 0.0% (0us) | Total: 0.0% (5.6ms) | Samples: 0

**Called by:**
- `async runBeforeHooks` (4)

**Calls:**
- `(anonymous)` (4)
- `(anonymous)` (1)

### `guards`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts:47` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `shardWriterGuardsInstalled` (1)

**Calls:**
- `scopedTables` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:104` | Self: 0.0% (0us) | Total: 0.0% (7.2ms) | Samples: 0

**Called by:**
- `async withAuthResponse` (6)

**Calls:**
- `async (anonymous)` (2)
- `async (anonymous)` (2)
- `async (anonymous)` (1)
- `async (anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs:44` | Self: 0.0% (0us) | Total: 0.0% (9.8ms) | Samples: 0

**Calls:**
- `async dispatchAuthEndpoint` (3)
- `async dispatchAuthEndpoint` (1)
- `async dispatchAuthEndpoint` (1)
- `async dispatchAuthEndpoint` (1)
- `async dispatchAuthEndpoint` (1)
- `async dispatchAuthEndpoint` (1)

### `assertCompleteShardFormat`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts:76` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `initAccountSchema` (1)
- `ensureAccountKeySchema` (1)

**Calls:**
- `shardWriterGuardsInstalled` (1)
- `shardWriterGuardsInstalled` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:285` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Called by:**
- `getAuth` (1)

**Calls:**
- `async (anonymous)` (1)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:81` | Self: 0.0% (0us) | Total: 0.0% (3.1ms) | Samples: 0

**Calls:**
- `async withDbWriteRetry` (1)

### `async releaseConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:66` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async releaseConnection` (1)

**Calls:**
- `async releaseConnection` (1)

### `parseSessionOutput`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/schema.mjs:53` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `get` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/index.js:16` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `bound visitReference`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (14.3ms) | Samples: 0

**Called by:**
- `visitNode` (11)

**Calls:**
- `visitReference` (7)
- `visitReference` (2)
- `visitReference` (1)
- `visitReference` (1)

### `topicSuggestionSignalsFromEntries`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:84` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `flush` (2)

**Calls:**
- `forEach` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/converters.js:9` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(module)`
`/tmp/spike-switch-server/anatomy.ts:62` | Self: 0.0% (0us) | Total: 0.1% (26.0ms) | Samples: 0

**Calls:**
- `normalize` (18)
- `stringify` (5)

### `async getMigrations`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:685` | Self: 0.0% (0us) | Total: 0.0% (4.8ms) | Samples: 0

**Called by:**
- `async migrateAuthSchema` (4)

**Calls:**
- `async getMigrations` (2)
- `async getMigrations` (1)
- `async getMigrations` (1)

### `getThreadCollabStates`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts:72` | Self: 0.0% (0us) | Total: 0.0% (11.7ms) | Samples: 0

**Called by:**
- `async getThreadCollabStates` (10)

**Calls:**
- `map` (6)
- `Map` (4)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:450` | Self: 0.0% (0us) | Total: 1.9% (357.6ms) | Samples: 0

**Calls:**
- `(anonymous)` (5)

### `_SHA256`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha2.js:124` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `SHA2_32B` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/jwt/index.mjs:19` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `object` (1)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1259` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async getTotalCount` (1)

**Calls:**
- `async getAccountDb` (1)

### `compile`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:158` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `tlds` (1)

**Calls:**
- `RegExp` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/index.js:9` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async setThreadTopics`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:217` | Self: 0.0% (0us) | Total: 0.0% (3.6ms) | Samples: 0

**Called by:**
- `async buildFixture` (3)

**Calls:**
- `async withAccountDb` (2)
- `async withAccountDb` (1)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1337` | Self: 0.0% (0us) | Total: 0.0% (3.4ms) | Samples: 0

**Calls:**
- `applySearchQueryFilters` (2)
- `applySearchQueryFilters` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/pino.js:6` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Calls:**
- `bound require` (2)

### `async findOne`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:522` | Self: 0.0% (0us) | Total: 0.3% (70.1ms) | Samples: 0

**Called by:**
- `async findOne` (37)

**Calls:**
- `async execute` (37)

### `create`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/from-node.js:13` | Self: 0.0% (0us) | Total: 0.1% (28.3ms) | Samples: 0

**Called by:**
- `createFrom` (23)

**Calls:**
- `freeze` (23)

### `async runBeforeHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:87` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `async runBeforeHooks` (1)

**Calls:**
- `catch` (1)

### `async getThreadGroupCounts`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1383` | Self: 0.0% (0us) | Total: 0.3% (55.2ms) | Samples: 0

**Called by:**
- `async listThreads` (47)

**Calls:**
- `(anonymous)` (36)
- `(anonymous)` (6)
- `(anonymous)` (3)
- `wrapStatement` (1)
- `wrapStatement` (1)

### `decryptPayload`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts:60` | Self: 0.0% (0us) | Total: 0.1% (30.7ms) | Samples: 0

**Called by:**
- `decodeSecret` (25)

**Calls:**
- `createDecipheriv` (23)
- `getKey` (1)
- `getKey` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pkcs8/build/cjs/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async acquireAuthLifetimeLock`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authLifetimeLock.ts:38` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `openSync` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-attributes.mjs:24` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/encoding/base64url.js:8` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `Kysely`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/kysely.js:71` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `RuntimeDriver` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/key_agree_recipient_info.js:146` | Self: 0.0% (0us) | Total: 0.0% (987us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `__decorate` (1)

### `async getDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:300` | Self: 0.0% (0us) | Total: 0.0% (6.2ms) | Samples: 0

**Calls:**
- `configureDb` (4)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/postcss.js:3` | Self: 0.0% (0us) | Total: 0.0% (8.0ms) | Samples: 0

**Called by:**
- `anonymous` (7)

**Calls:**
- `bound require` (7)

### `ensureAccountKeySchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountKeys.ts:165` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async withDbWriteRetry` (1)

**Calls:**
- `some` (1)

### `getColorDepth`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs:66` | Self: 0.0% (0us) | Total: 0.0% (991us) | Samples: 0

**Called by:**
- `formatTransactionId` (1)

**Calls:**
- `getEnvVar` (1)

### `extractJiraProjectKeys`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:40` | Self: 0.0% (0us) | Total: 0.0% (3.3ms) | Samples: 0

**Called by:**
- `collectTopicSignalEntries` (3)

**Calls:**
- `forEach` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/lib/index.js:3` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/source-map-js/lib/source-map-generator.js:10` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2514` | Self: 0.0% (0us) | Total: 0.0% (9.5ms) | Samples: 0

**Calls:**
- `forEach` (7)

### `async recomputeThreadsForAccountInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:275` | Self: 0.0% (0us) | Total: 0.0% (952us) | Samples: 0

**Calls:**
- `buildThreadLatestReceivedDateSql` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/encrypted_content_info.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:227` | Self: 0.0% (0us) | Total: 0.0% (3.4ms) | Samples: 0

**Called by:**
- `async withAccountDb` (3)

**Calls:**
- `(anonymous)` (3)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:274` | Self: 0.0% (0us) | Total: 0.0% (4.8ms) | Samples: 0

**Calls:**
- `async migrateAuthSchema` (4)

### `async rebuildThreadSignalsForThreadIds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:113` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async rebuildThreadSignalsForThreadIds` (1)

**Calls:**
- `async getAccountOwnAddresses` (1)

### `run`
`node:async_hooks:144` | Self: 0.0% (0us) | Total: 0.3% (72.0ms) | Samples: 0

**Called by:**
- `async runWithEndpointContext` (48)
- `async createAuthenticatedTestSession` (1)

**Calls:**
- `async (anonymous)` (21)
- `async (anonymous)` (15)
- `(anonymous)` (7)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `async (anonymous)` (1)
- `async (anonymous)` (1)
- `async (anonymous)` (1)
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:2009` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `getEnumValues` (1)

### `async acquireConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:53` | Self: 0.0% (0us) | Total: 0.0% (8.7ms) | Samples: 0

**Called by:**
- `async acquireConnection` (6)

**Calls:**
- `async acquireConnection` (5)
- `async acquireConnection` (2)

### `digest`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_poly1305.js:296` | Self: 0.0% (0us) | Total: 0.0% (982us) | Samples: 0

**Called by:**
- `computeTag` (1)

**Calls:**
- `digestInto` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/node.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async createAuthContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/create-context.mjs:97` | Self: 0.0% (0us) | Total: 0.0% (1.8ms) | Samples: 0

**Called by:**
- `async createAuthContext` (1)

**Calls:**
- `getAuthTables` (1)

### `compile`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:247` | Self: 0.0% (0us) | Total: 0.0% (4.9ms) | Samples: 0

**Called by:**
- `LinkifyIt` (3)
- `add` (1)

**Calls:**
- `RegExp` (2)
- `get source` (2)

### `normalizeThreadIds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:23` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `rebuildThreadSignalsForThreadIdsInternal` (2)

**Calls:**
- `map` (2)

### `async readAuthJson`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/readAuthJson.ts:27` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `releaseLock` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:9` | Self: 0.0% (0us) | Total: 0.0% (13.2ms) | Samples: 0

**Called by:**
- `async getCryptoKey` (11)

**Calls:**
- `importKey` (11)

### `internal:streams/lazy_transform`
`internal:streams/lazy_transform:2` | Self: 0.0% (0us) | Total: 0.0% (16.0ms) | Samples: 0

**Called by:**
- `anonymous` (9)

**Calls:**
- `anonymous` (9)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs:51` | Self: 0.0% (0us) | Total: 0.0% (4.6ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async hasRequestState` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:155` | Self: 0.0% (0us) | Total: 0.0% (3.3ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `bound require` (3)

### `ownAddressList`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:69` | Self: 0.0% (0us) | Total: 0.0% (14.9ms) | Samples: 0

**Called by:**
- `collectTopicSignalEntries` (10)
- `getTopicSuggestionSignalsForThreadsFromDb` (2)
- `backfillEmailCalendarEventParticipation` (1)

**Calls:**
- `flatIntoArrayWithCallback` (13)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accounts.ts:111` | Self: 0.0% (0us) | Total: 0.0% (3.4ms) | Samples: 0

**Calls:**
- `transaction` (2)
- `transaction` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/rsaes_oaep.js:44` | Self: 0.0% (0us) | Total: 0.0% (3.7ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `serialize` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/after/after.js:11` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/lazy-result.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async acquireConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:34` | Self: 0.0% (0us) | Total: 0.0% (6.5ms) | Samples: 0

**Called by:**
- `async acquireConnection` (5)

**Calls:**
- `async lock` (4)
- `async lock` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs:316` | Self: 0.0% (0us) | Total: 0.0% (4.7ms) | Samples: 0

**Calls:**
- `bound meta` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:824` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async (anonymous)` (1)

### `nullish`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:67` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `bound nullish` (1)

**Calls:**
- `nullable` (1)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:55` | Self: 0.0% (0us) | Total: 0.0% (929us) | Samples: 0

**Calls:**
- `async upsertMessages` (1)

### `async recomputeThreadsForAccountInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:321` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:245` | Self: 0.0% (0us) | Total: 0.0% (6.2ms) | Samples: 0

**Calls:**
- `async runAfterHooks` (3)

### `RawBuilderImpl`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/raw-builder/raw-builder.js:9` | Self: 0.0% (0us) | Total: 0.0% (990us) | Samples: 0

**Called by:**
- `createRawBuilder` (1)

**Calls:**
- `(anonymous)` (1)

### `compile`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:154` | Self: 0.0% (0us) | Total: 0.0% (3.6ms) | Samples: 0

**Called by:**
- `tlds` (3)

**Calls:**
- `RegExp` (3)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:874` | Self: 0.0% (0us) | Total: 0.0% (3.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `async setSessionCookie`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/index.mjs:172` | Self: 0.0% (0us) | Total: 0.0% (4.8ms) | Samples: 0

**Calls:**
- `async setSignedCookie` (1)

### `async execute`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/raw-builder/raw-builder.js:42` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async getDatabaseIndexMap` (1)

**Calls:**
- `#getExecutor` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/charset.js:28` | Self: 0.0% (0us) | Total: 0.0% (4.8ms) | Samples: 0

**Called by:**
- `anonymous` (4)

**Calls:**
- `map` (4)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:72` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `async validateAccountFolders` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/parse5/dist/parser/index.js:41` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Calls:**
- `(anonymous)` (1)

### `async getAccountOwnAddresses`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/senderIdentities.ts:21` | Self: 0.0% (0us) | Total: 0.2% (46.0ms) | Samples: 0

**Calls:**
- `(anonymous)` (16)
- `(anonymous)` (15)
- `(anonymous)` (3)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `wrapStatement` (1)
- `wrapStatement` (1)

### `visitBinaryOperation`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:1149` | Self: 0.0% (0us) | Total: 0.0% (5.1ms) | Samples: 0

**Called by:**
- `bound visitBinaryOperation` (4)

**Calls:**
- `visitNode` (4)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:539` | Self: 0.0% (0us) | Total: 0.0% (4.6ms) | Samples: 0

**Called by:**
- `forEach` (4)

**Calls:**
- `deriveSystemFlagState` (2)
- `deriveSystemFlagState` (1)
- `deriveSystemFlagState` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2243` | Self: 0.0% (0us) | Total: 0.0% (4.6ms) | Samples: 0

**Calls:**
- `parseSearchInput` (1)
- `parseSearchInput` (1)
- `parseSearchInput` (1)
- `parseSearchInput` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/accountPrefs.ts:21` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `nullable` (1)

### `_interopNamespaceDefault`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:42` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `keys` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/socks/build/common/helpers.js:11` | Self: 0.0% (0us) | Total: 0.0% (7.6ms) | Samples: 0

**Called by:**
- `anonymous` (7)

**Calls:**
- `bound require` (7)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:877` | Self: 0.0% (0us) | Total: 0.0% (2.9ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:289` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `transaction` (1)

**Calls:**
- `normalizedSql` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:545` | Self: 0.0% (0us) | Total: 0.0% (949us) | Samples: 0

**Calls:**
- `$constructor` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:367` | Self: 0.0% (0us) | Total: 0.0% (17.4ms) | Samples: 0

**Calls:**
- `filterOutputFields` (7)
- `filterOutputFields` (2)
- `filterOutputFields` (1)
- `parseSessionOutput` (1)
- `reduce` (1)

### `node:fs`
`node:fs:8` | Self: 0.0% (0us) | Total: 0.0% (7.2ms) | Samples: 0

**Calls:**
- `anonymous` (1)

### `buildGroupKey`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:71` | Self: 0.0% (0us) | Total: 0.2% (54.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (48)

**Calls:**
- `buildMessageGroupKey` (48)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/user-agent.js:27` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `async requireActiveUserSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:85` | Self: 0.0% (0us) | Total: 0.0% (9.4ms) | Samples: 0

**Calls:**
- `(anonymous)` (5)
- `(anonymous)` (1)

### `getChunkedCookie`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/session-store.mjs:142` | Self: 0.0% (0us) | Total: 0.0% (2.6ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `parseCookies` (1)
- `parseCookies` (1)

### `ZodXor`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `xor` (1)

**Calls:**
- `init` (1)

### `getMetadata`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:370` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `getParamInfo` (1)

**Calls:**
- `OrdinaryGetMetadata` (1)

### `ZodIPv6`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `_ipv6` (1)

**Calls:**
- `init` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:160` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `getTopicSignalExclusionSet`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:27` | Self: 0.0% (0us) | Total: 0.1% (30.8ms) | Samples: 0

**Called by:**
- `upsertTopicLearningSignalsForThreadIds` (9)

**Calls:**
- `(anonymous)` (8)
- `wrapStatement` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:75` | Self: 0.0% (0us) | Total: 0.2% (41.6ms) | Samples: 0

**Called by:**
- `forEach` (36)

**Calls:**
- `isOwnAddress` (24)
- `isOwnAddress` (11)
- `some` (1)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:24` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `importModule` (1)

### `installShardWriterGuards`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts:85` | Self: 0.0% (0us) | Total: 0.0% (5.0ms) | Samples: 0

**Called by:**
- `migrate` (4)

**Calls:**
- `(anonymous)` (4)

### `bound check`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (3.3ms) | Samples: 0

**Called by:**
- `bound max` (1)

**Calls:**
- `bound clone` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (8.4ms) | Samples: 0

**Called by:**
- `anonymous` (7)

**Calls:**
- `bound require` (7)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:78` | Self: 0.0% (0us) | Total: 0.0% (4.5ms) | Samples: 0

**Called by:**
- `async (anonymous)` (3)

**Calls:**
- `async execute` (3)

### `schemaSql`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:134` | Self: 0.0% (0us) | Total: 0.0% (3.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/threadRecomputeJobs.ts:15` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `createBoundedWorkerJobRegistry` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/socks/build/client/socksclient.js:16` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `ValidationError`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/error.mjs:128` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `InternalAPIError` (1)

### `getTopicSuggestionsForThreadSignalBatch`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:577` | Self: 0.0% (0us) | Total: 0.5% (98.8ms) | Samples: 0

**Called by:**
- `async withAccountDb` (83)

**Calls:**
- `forEach` (83)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/index.js:7` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `async enrichMessagesWithThreadTopics`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts:40` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Calls:**
- `filter` (2)

### `twoFactor`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/index.mjs:37` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `noctuaAuthOptions` (1)

**Calls:**
- `otp2fa` (1)

### `ensureAccountKeySchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountKeys.ts:164` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async withDbWriteRetry` (1)

**Calls:**
- `shardWriterGuardsInstalled` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/email-verification.mjs:44` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `_string` (1)

### `noctuaAuthOptions`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:78` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `twoFactor` (1)

### `GetMetadataProvider`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:1158` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `OrdinaryHasOwnMetadata` (1)

**Calls:**
- `getProvider` (1)

### `async withAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:413` | Self: 0.0% (0us) | Total: 30.2% (5.49s) | Samples: 0

**Called by:**
- `async getTopicsForThreads` (2)
- `async setThreadTopics` (2)

**Calls:**
- `getTopicSuggestionsForThreadSignalBatch` (2751)
- `getTopicSuggestionsForThreadSignalBatch` (558)
- `(anonymous)` (543)
- `(anonymous)` (152)
- `(anonymous)` (122)
- `getTopicSuggestionsForThreadSignalBatch` (88)
- `getTopicSuggestionsForThreadSignalBatch` (85)
- `getTopicSuggestionsForThreadSignalBatch` (83)
- `(anonymous)` (53)
- `(anonymous)` (48)
- `(anonymous)` (19)
- `(anonymous)` (14)
- `(anonymous)` (13)
- `(anonymous)` (12)
- `(anonymous)` (10)
- `(anonymous)` (8)
- `(anonymous)` (7)
- `async withAccountDb` (4)
- `(anonymous)` (3)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (1)
- `getTopicSuggestionsForThreadSignalBatch` (1)
- `getTopicSuggestionsForThreadSignalBatch` (1)
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:588` | Self: 0.0% (0us) | Total: 0.0% (5.4ms) | Samples: 0

**Calls:**
- `formatTransactionId` (2)
- `debugLog` (1)

### `DBCSCodec`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:44` | Self: 0.0% (0us) | Total: 0.0% (997us) | Samples: 0

**Called by:**
- `getCodec` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:315` | Self: 0.0% (0us) | Total: 0.5% (96.4ms) | Samples: 0

**Called by:**
- `async withDbWriteRetry` (36)

**Calls:**
- `initMasterSchema` (17)
- `initMasterSchema` (3)
- `initMasterSchema` (2)
- `initMasterSchema` (1)
- `initMasterSchema` (1)
- `initMasterSchema` (1)
- `initMasterSchema` (1)
- `initMasterSchema` (1)
- `initMasterSchema` (1)
- `initMasterSchema` (1)
- `initMasterSchema` (1)
- `initMasterSchema` (1)
- `initMasterSchema` (1)
- `initMasterSchema` (1)
- `initMasterSchema` (1)
- `initMasterSchema` (1)
- `initMasterSchema` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:810` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `map` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/postcss.js:9` | Self: 0.0% (0us) | Total: 0.0% (7.0ms) | Samples: 0

**Called by:**
- `anonymous` (6)

**Calls:**
- `bound require` (6)

### `normalizeDef`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:940` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `get value` (1)

**Calls:**
- `filter` (1)

### `createSeededLinearModel`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/mail/categorization/linearModel.ts:141` | Self: 0.0% (0us) | Total: 0.0% (1.4ms) | Samples: 0

**Called by:**
- `async getCategoryLinearModel` (1)

**Calls:**
- `setWeights` (1)

### `NextResponse`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:43` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `json` (1)

**Calls:**
- `Proxy` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/encoding-table.js:3` | Self: 0.0% (0us) | Total: 0.0% (7.4ms) | Samples: 0

**Called by:**
- `anonymous` (6)

**Calls:**
- `bound require` (6)

### `createHash`
`node:crypto:191` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `createBoundedWorkerJobRegistry` (1)

**Calls:**
- `Hash` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:713` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sonic-boom/index.js:7` | Self: 0.0% (0us) | Total: 0.0% (954us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `compile`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:143` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `LinkifyIt` (1)

**Calls:**
- `onCompile` (1)

### `resolveAccountRoleRow`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountAccess.ts:5` | Self: 0.0% (0us) | Total: 0.0% (6.9ms) | Samples: 0

**Called by:**
- `async resolveAccountRole` (5)

**Calls:**
- `(anonymous)` (2)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:17` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `validateProvisioningIndex`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:168` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2499` | Self: 0.0% (0us) | Total: 0.3% (64.7ms) | Samples: 0

**Calls:**
- `(anonymous)` (44)
- `(anonymous)` (4)
- `(anonymous)` (2)
- `wrapStatement` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:865` | Self: 0.0% (0us) | Total: 0.0% (3.4ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:403` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `forEach` (2)

**Calls:**
- `set` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/attribute_certificate.js:7` | Self: 0.0% (0us) | Total: 0.0% (937us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:3800` | Self: 0.0% (0us) | Total: 0.1% (18.2ms) | Samples: 0

**Called by:**
- `webpackUniversalModuleDefinition` (4)

**Calls:**
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/lib/index.js:170` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `enableStreamingAPI` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts:69` | Self: 0.0% (0us) | Total: 0.0% (14.9ms) | Samples: 0

**Called by:**
- `flatIntoArrayWithCallback` (13)

**Calls:**
- `normalizeIdentityEmail` (7)
- `normalizeIdentityEmail` (1)
- `normalizeIdentityEmail` (1)
- `normalizeIdentityEmail` (1)
- `normalizeIdentityEmail` (1)
- `normalizeIdentityEmail` (1)
- `normalizeIdentityEmail` (1)

### `getCodec`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/lib/index.js:102` | Self: 0.0% (0us) | Total: 0.0% (5.3ms) | Samples: 0

**Called by:**
- `(anonymous)` (5)

**Calls:**
- `DBCSCodec` (3)
- `DBCSCodec` (1)
- `DBCSCodec` (1)

### `create`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/schemable-identifier-node.js:14` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Called by:**
- `create` (2)

**Calls:**
- `freeze` (1)
- `create` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/input.js:5` | Self: 0.0% (0us) | Total: 0.0% (3.7ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `bound require` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/fromJSON.js:6` | Self: 0.0% (0us) | Total: 0.0% (4.7ms) | Samples: 0

**Called by:**
- `anonymous` (4)

**Calls:**
- `bound require` (4)

### `async generateHOTP`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/utils/dist/otp.mjs:24` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Called by:**
- `async verifyTOTP` (1)

**Calls:**
- `async generateHOTP` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:182` | Self: 0.0% (0us) | Total: 0.0% (5.8ms) | Samples: 0

**Calls:**
- `async get` (4)
- `async get` (1)

### `LinkifyIt`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:341` | Self: 0.0% (0us) | Total: 0.0% (8.0ms) | Samples: 0

**Called by:**
- `(module)` (6)

**Calls:**
- `LinkifyIt` (5)
- `LinkifyIt` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/decorators.js:35` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `DecorateProperty` (1)

**Calls:**
- `createDefault` (1)

### `async createAuthContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/create-context.mjs:128` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `async getTrustedOrigins` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:7` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `migrate`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountKeys.ts:219` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `ensureAccountKeySchema` (1)

**Calls:**
- `buildFtsIdentity` (1)

### `getTopicSuggestionsForThreadSignalBatch`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:599` | Self: 0.0% (0us) | Total: 0.5% (103.1ms) | Samples: 0

**Called by:**
- `async withAccountDb` (88)

**Calls:**
- `(anonymous)` (76)
- `(anonymous)` (6)
- `(anonymous)` (5)
- `wrapStatement` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/mailparser/dist/esm/mail-parser.js:41` | Self: 0.0% (0us) | Total: 0.0% (2.5ms) | Samples: 0

**Calls:**
- `tlds` (1)
- `tlds` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:891` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `capSize` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:19` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `mapAccountRow`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts:177` | Self: 0.0% (0us) | Total: 0.2% (52.4ms) | Samples: 0

**Called by:**
- `async getAccountById` (44)

**Calls:**
- `normalizeAccountSettings` (22)
- `safeParseJson` (22)

### `async assertAccountFolder`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/folderAccountGuard.ts:9` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async validateAccountFolders` (1)

**Calls:**
- `async assertAccountFolder` (1)

### `Decipheriv2`
`node:crypto:313` | Self: 0.0% (0us) | Total: 0.1% (27.0ms) | Samples: 0

**Called by:**
- `createDecipheriv` (23)

**Calls:**
- `Cipher` (23)

### `bound meta`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (7.7ms) | Samples: 0

**Called by:**
- `(module)` (1)
- `(module)` (1)

**Calls:**
- `meta` (2)

### `reduce`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (9.4ms) | Samples: 0

**Called by:**
- `async (anonymous)` (3)
- `async (anonymous)` (2)
- `(anonymous)` (1)
- `async (anonymous)` (1)

**Calls:**
- `_defu` (2)
- `(anonymous)` (2)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `_defu` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1200` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `validate` (1)

**Calls:**
- `get value` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/index.js:15` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/bags/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2504` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `join` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:28` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async getAccountById`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/serverDb.ts:25` | Self: 0.0% (0us) | Total: 0.0% (17.4ms) | Samples: 0

**Called by:**
- `async getAccountById` (8)

**Calls:**
- `loadServerDb` (8)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/mailboxSummary.ts:48` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `(anonymous)` (1)

### `async getMigrations`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:404` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `async getDatabaseColumnBounds` (1)

### `getFieldName`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-name.mjs:22` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `async ensureCalendarEventRuntimeData`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:661` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Calls:**
- `async getAccountById` (1)
- `async getAccountById` (1)

### `_coercedString`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/api.js:16` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `ZodString` (1)

### `WriteStream`
`internal:fs/streams:251` | Self: 0.0% (0us) | Total: 0.0% (934us) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `writer` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:603` | Self: 0.0% (0us) | Total: 0.0% (11.2ms) | Samples: 0

**Called by:**
- `forEach` (10)

**Calls:**
- `(anonymous)` (10)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/v2_form.js:8` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `OrdinaryHasOwnMetadata`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:584` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `OrdinaryGetMetadata` (1)

**Calls:**
- `GetMetadataProvider` (1)

### `internal:validators`
`internal:validators:2` | Self: 0.0% (0us) | Total: 0.0% (7.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `anonymous` (1)

### `upsertTopicLearningSignalsForThreadIds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:145` | Self: 0.0% (0us) | Total: 0.0% (13.7ms) | Samples: 0

**Called by:**
- `rememberTopicLearningForThread` (10)

**Calls:**
- `(anonymous)` (10)

### `async acquireConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:54` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `async acquireConnection` (2)

**Calls:**
- `async waitOrAbort` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:707` | Self: 0.0% (0us) | Total: 3.5% (642.8ms) | Samples: 0

**Called by:**
- `async withAccountDb` (543)

**Calls:**
- `getTopicSuggestionSignalsForThreadsFromDb` (342)
- `getTopicSuggestionSignalsForThreadsFromDb` (120)
- `getTopicSuggestionSignalsForThreadsFromDb` (31)
- `getTopicSuggestionSignalsForThreadsFromDb` (27)
- `getTopicSuggestionSignalsForThreadsFromDb` (13)
- `getTopicSuggestionSignalsForThreadsFromDb` (4)
- `getTopicSuggestionSignalsForThreadsFromDb` (3)
- `getTopicSuggestionSignalsForThreadsFromDb` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:852` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `toASN`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js:53` | Self: 0.0% (0us) | Total: 0.0% (4.7ms) | Samples: 0

**Called by:**
- `serialize` (4)

**Calls:**
- `toAsnItem` (4)

### `async getMessageCalendarInviteDataByMessageId`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts:165` | Self: 0.0% (0us) | Total: 0.1% (26.4ms) | Samples: 0

**Called by:**
- `async listThreads` (24)

**Calls:**
- `Set` (15)
- `filter` (5)
- `map` (4)

### `ensureAccountKeySchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountKeys.ts:230` | Self: 0.0% (0us) | Total: 0.0% (10.5ms) | Samples: 0

**Called by:**
- `transaction` (8)

**Calls:**
- `migrate` (4)
- `migrate` (2)
- `migrate` (1)
- `migrate` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@zone-eu/mailsplit/index.js:3` | Self: 0.0% (0us) | Total: 0.2% (49.8ms) | Samples: 0

**Calls:**
- `bound require` (40)

### `createBetterAuth`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/auth/base.mjs:21` | Self: 0.0% (0us) | Total: 0.0% (4.4ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `getEndpoints` (1)

### `ZodNumber`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` | Self: 0.0% (0us) | Total: 0.0% (3.3ms) | Samples: 0

**Called by:**
- `clone` (1)

**Calls:**
- `init` (1)

### `async requireActiveUserSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts:84` | Self: 0.0% (0us) | Total: 0.0% (13.6ms) | Samples: 0

**Calls:**
- `(anonymous)` (6)
- `(anonymous)` (2)

### `bound clone`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (8.0ms) | Samples: 0

**Called by:**
- `bound check` (1)
- `meta` (1)

**Calls:**
- `clone` (1)
- `clone` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:697` | Self: 0.0% (0us) | Total: 0.0% (5.5ms) | Samples: 0

**Called by:**
- `forEach` (5)

**Calls:**
- `install` (3)
- `install` (2)

### `async GET`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:104` | Self: 0.0% (0us) | Total: 0.0% (7.6ms) | Samples: 0

**Called by:**
- `async (anonymous)` (7)

**Calls:**
- `async GET` (6)
- `async GET` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/dependency-container.js:14` | Self: 0.0% (0us) | Total: 0.0% (944us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `internal:streams/duplex`
`internal:streams/duplex:2` | Self: 0.0% (0us) | Total: 0.0% (10.2ms) | Samples: 0

**Called by:**
- `anonymous` (8)

**Calls:**
- `anonymous` (8)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:80` | Self: 0.0% (0us) | Total: 0.0% (4.8ms) | Samples: 0

**Calls:**
- `async withDbWriteRetry` (1)

### `BunSqliteQueryCompiler`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `createQueryCompiler` (1)

**Calls:**
- `DefaultQueryCompiler` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/imapflow/dist/esm/special-use.js:69` | Self: 0.0% (0us) | Total: 0.0% (989us) | Samples: 0

**Called by:**
- `map` (1)

**Calls:**
- `toLowerCase` (1)

### `async getMigrations`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:345` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `async getMigrations` (2)

**Calls:**
- `buildSchema` (1)
- `buildSchema` (1)

### `transformJoinClause`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:284` | Self: 0.0% (0us) | Total: 0.0% (4.6ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `entries` (2)

### `shouldIgnoreTopicSuggestionSignalUncached`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:140` | Self: 0.0% (0us) | Total: 1.0% (193.3ms) | Samples: 0

**Called by:**
- `shouldIgnoreTopicSuggestionSignal` (161)

**Calls:**
- `isOwnAddress` (104)
- `isOwnAddress` (55)
- `some` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-attributes.mjs:29` | Self: 0.0% (0us) | Total: 0.0% (999us) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `async recomputeThreadsForAccountInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:356` | Self: 0.0% (0us) | Total: 0.1% (26.8ms) | Samples: 0

**Calls:**
- `(anonymous)` (23)

### `getAuthTablesWithResolvedIndexes`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/get-tables.mjs:289` | Self: 0.0% (0us) | Total: 0.0% (3.0ms) | Samples: 0

**Called by:**
- `getAuthTables` (1)
- `buildSchema` (1)

**Calls:**
- `resolveDatabaseSchemaIndexes` (2)

### `compile`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:155` | Self: 0.0% (0us) | Total: 0.0% (6.9ms) | Samples: 0

**Called by:**
- `tlds` (5)

**Calls:**
- `untpl` (4)
- `RegExp` (1)

### `InternalAPIError`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/error.mjs:103` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `ValidationError` (1)

**Calls:**
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:184` | Self: 0.0% (0us) | Total: 0.0% (16.0ms) | Samples: 0

**Called by:**
- `async transformOutput` (13)

**Calls:**
- `async transformSingleOutput` (12)
- `async transformSingleOutput` (1)

### `mapAccountRow`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts:192` | Self: 0.0% (0us) | Total: 0.0% (13.5ms) | Samples: 0

**Called by:**
- `async getAccountById` (11)

**Calls:**
- `decodeSecret` (11)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (16.9ms) | Samples: 0

**Calls:**
- `bound require` (16)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (10.8ms) | Samples: 0

**Calls:**
- `bound require` (9)

### `update`
`node:crypto:338` | Self: 0.0% (0us) | Total: 0.0% (9.4ms) | Samples: 0

**Called by:**
- `decryptPayload` (7)

**Calls:**
- `update` (7)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:251` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Called by:**
- `DBCSCodec` (2)

**Calls:**
- `(anonymous)` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/utils.js:341` | Self: 0.0% (0us) | Total: 0.3% (57.2ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `from` (1)

### `topicSuggestionSignalEntries`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:105` | Self: 0.0% (0us) | Total: 0.0% (6.8ms) | Samples: 0

**Called by:**
- `(anonymous)` (5)

**Calls:**
- `map` (5)

### `seedSenderIdentityRow`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/senderIdentities.ts:31` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `persistAccountRow` (1)

**Calls:**
- `normalizeIdentityEmail` (1)

### `async ensureCalendarEventRuntimeData`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:668` | Self: 0.0% (0us) | Total: 0.0% (3.3ms) | Samples: 0

**Calls:**
- `ensureCalendarEventOptionalColumns` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:88` | Self: 0.0% (0us) | Total: 0.4% (86.8ms) | Samples: 0

**Called by:**
- `forEach` (36)
- `filter` (35)

**Calls:**
- `filter` (36)
- `isOwnAddress` (17)
- `isOwnAddress` (16)
- `some` (2)

### `collectTopicSignalEntries`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:73` | Self: 0.0% (0us) | Total: 0.8% (151.9ms) | Samples: 0

**Called by:**
- `flush` (128)

**Calls:**
- `forEach` (128)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/css-syntax-error.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:29` | Self: 0.0% (0us) | Total: 0.0% (5.5ms) | Samples: 0

**Calls:**
- `async (anonymous)` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/picocolors/picocolors.js:4` | Self: 0.0% (0us) | Total: 0.0% (3.3ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `(anonymous)` (3)

### `bound visitTable`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (8.8ms) | Samples: 0

**Called by:**
- `visitNode` (7)

**Calls:**
- `visitTable` (7)

### `toOperationNode`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:385` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `parseTableExpressionOrList` (1)

**Calls:**
- `create` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/proto.js:40` | Self: 0.0% (0us) | Total: 0.0% (10.4ms) | Samples: 0

**Called by:**
- `anonymous` (9)

**Calls:**
- `bound require` (9)

### `clone`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:334` | Self: 0.0% (0us) | Total: 0.0% (9.3ms) | Samples: 0

**Called by:**
- `clone` (1)
- `bound clone` (1)
- `bound omit` (1)

**Calls:**
- `ZodNumber` (1)
- `ZodString` (1)
- `ZodObject` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/libmime.js:44` | Self: 0.0% (0us) | Total: 0.2% (37.7ms) | Samples: 0

**Called by:**
- `anonymous` (33)

**Calls:**
- `bound require` (33)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js:15` | Self: 0.0% (0us) | Total: 0.0% (11.4ms) | Samples: 0

**Calls:**
- `bound require` (10)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/well-known/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `forEach` (1)

**Calls:**
- `normalizeService` (1)

### `DecorateProperty`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:561` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `decorate` (1)

**Calls:**
- `(anonymous)` (1)

### `mapUserRow`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts:61` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async getUserById` (1)

**Calls:**
- `trim` (1)

### `async create`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:501` | Self: 0.0% (0us) | Total: 3.9% (713.2ms) | Samples: 0

**Called by:**
- `async create` (4)
- `(anonymous)` (4)

**Calls:**
- `async create` (4)
- `async withReturning` (2)
- `values` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:37` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts:98` | Self: 0.0% (0us) | Total: 0.1% (25.8ms) | Samples: 0

**Calls:**
- `map` (21)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:2517` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `__spreadArray` (1)

### `async getCryptoKey`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:9` | Self: 0.0% (0us) | Total: 0.1% (20.4ms) | Samples: 0

**Called by:**
- `async (anonymous)` (17)

**Calls:**
- `async (anonymous)` (11)
- `async (anonymous)` (6)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/cookies.js:18` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:704` | Self: 0.0% (0us) | Total: 0.1% (20.8ms) | Samples: 0

**Called by:**
- `map` (18)

**Calls:**
- `parseAddressEmails` (13)
- `flatIntoArrayWithCallback` (4)
- `parseAddressEmails` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/index.js:13` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/utils.js:28` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@zone-eu/mailsplit/lib/mime-node.js:3` | Self: 0.0% (0us) | Total: 0.2% (49.8ms) | Samples: 0

**Called by:**
- `anonymous` (40)

**Calls:**
- `bound require` (40)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/postcss.js:11` | Self: 0.0% (0us) | Total: 0.0% (3.2ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `bound require` (3)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/mailparser/dist/esm/mail-parser.js:42` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `add` (1)

### `async getMigrations`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:403` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `async getDatabaseIndexMap` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:356` | Self: 0.0% (0us) | Total: 0.0% (15.8ms) | Samples: 0

**Called by:**
- `async handleFallbackJoin` (6)

**Calls:**
- `map` (5)
- `transformWhereClause` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:10` | Self: 0.0% (0us) | Total: 0.0% (14.7ms) | Samples: 0

**Called by:**
- `async createInternalContext` (9)

**Calls:**
- `async runValidation` (8)
- `async runValidation` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:883` | Self: 0.0% (0us) | Total: 0.0% (1.9ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:9` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/next-url.js:12` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `node:tls`
`node:tls:2` | Self: 0.0% (0us) | Total: 0.0% (4.7ms) | Samples: 0

**Calls:**
- `anonymous` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/segment-config/ensure-static.js:34` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:676` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:40` | Self: 0.0% (0us) | Total: 0.1% (23.9ms) | Samples: 0

**Called by:**
- `async (anonymous)` (20)

**Calls:**
- `async getSignedCookie` (20)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/terminal-highlight.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `getThreadCollabStates`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts:71` | Self: 0.0% (0us) | Total: 0.0% (8.2ms) | Samples: 0

**Called by:**
- `async getThreadCollabStates` (7)

**Calls:**
- `Set` (7)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/index.js:4` | Self: 0.0% (0us) | Total: 0.3% (59.6ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `topicSuggestionSignalEntries`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:107` | Self: 0.0% (0us) | Total: 0.0% (6.7ms) | Samples: 0

**Called by:**
- `(anonymous)` (6)

**Calls:**
- `map` (6)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/endpoint-context.mjs:8` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `async getOrCreateEndpointContextStorage` (1)

**Calls:**
- `getExistingEndpointContextStorage` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testDbHarness.ts:49` | Self: 0.0% (0us) | Total: 0.0% (3.1ms) | Samples: 0

**Calls:**
- `getSharedDbHarnessState` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:42` | Self: 0.0% (0us) | Total: 0.0% (3.6ms) | Samples: 0

**Calls:**
- `getChunkedCookie` (2)
- `getChunkedCookie` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:535` | Self: 0.0% (0us) | Total: 0.0% (994us) | Samples: 0

**Called by:**
- `forEach` (1)

**Calls:**
- `safeParseJson` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/socks/build/client/socksclient.js:17` | Self: 0.0% (0us) | Total: 0.0% (7.6ms) | Samples: 0

**Called by:**
- `anonymous` (7)

**Calls:**
- `bound require` (7)

### `async resolveAccountDbPath`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:365` | Self: 0.0% (0us) | Total: 0.0% (8.0ms) | Samples: 0

**Called by:**
- `async getAccountDb` (7)

**Calls:**
- `async resolveAccountDbPath` (6)
- `asyncFunctionDrive` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/converters/index.js:6` | Self: 0.0% (0us) | Total: 0.0% (941us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:234` | Self: 0.0% (0us) | Total: 0.1% (24.9ms) | Samples: 0

**Called by:**
- `run` (21)

**Calls:**
- `async (anonymous)` (20)
- `async (anonymous)` (1)

### `async enrollTestTotp`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testAuthHarness.ts:198` | Self: 0.0% (0us) | Total: 0.0% (4.9ms) | Samples: 0

**Calls:**
- `totpFromUri` (1)

### `encrypt`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:350` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `encrypt` (2)

**Calls:**
- `(anonymous)` (2)

### `decodeTrieDict`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/internal/decode-shared.js:119` | Self: 0.0% (0us) | Total: 0.0% (951us) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `decodeDelta` (1)

### `async acquireConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:63` | Self: 0.0% (0us) | Total: 0.0% (9.5ms) | Samples: 0

**Called by:**
- `async provideConnection` (8)

**Calls:**
- `async acquireConnection` (6)
- `async acquireConnection` (2)

### `async executeQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:38` | Self: 0.0% (0us) | Total: 0.0% (9.5ms) | Samples: 0

**Called by:**
- `async executeQuery` (8)

**Calls:**
- `async provideConnection` (8)

### `async (anonymous)`
`/tmp/spike-switch-server/anatomy.ts:73` | Self: 0.0% (0us) | Total: 0.2% (49.5ms) | Samples: 0

**Called by:**
- `async time` (21)
- `async (anonymous)` (21)

**Calls:**
- `async (anonymous)` (21)
- `async enrichMessagesWithThreadCollab` (14)
- `map` (7)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv4.js:31` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `isCorrect` (1)

### `Keccak`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha3.js:173` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `anumber` (1)

### `visitReference`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:291` | Self: 0.0% (0us) | Total: 0.0% (2.9ms) | Samples: 0

**Called by:**
- `bound visitReference` (2)

**Calls:**
- `visitNode` (2)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:392` | Self: 0.0% (0us) | Total: 0.4% (79.4ms) | Samples: 0

**Calls:**
- `async ensureCalendarEventRuntimeData` (68)
- `async ensureCalendarEventRuntimeData` (1)

### `upsertTopicLearningSignalsForThreadIds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts:141` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `rememberTopicLearningForThread` (1)

**Calls:**
- `map` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/encode.js:103` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:339` | Self: 0.0% (0us) | Total: 0.0% (6.0ms) | Samples: 0

**Calls:**
- `loadManualCategoryStatesForMessageIds` (2)
- `loadManualCategoryStatesForMessageIds` (1)
- `map` (1)
- `loadManualCategoryStatesForMessageIds` (1)

### `bound require`
`[native code]` | Self: 0.0% (0us) | Total: 5.8% (1.05s) | Samples: 0

**Called by:**
- `(anonymous)` (40)
- `(anonymous)` (40)
- `(anonymous)` (40)
- `(anonymous)` (39)
- `(anonymous)` (33)
- `(anonymous)` (20)
- `(anonymous)` (18)
- `(anonymous)` (17)
- `(anonymous)` (17)
- `(anonymous)` (16)
- `(anonymous)` (16)
- `(anonymous)` (12)
- `(anonymous)` (11)
- `(anonymous)` (10)
- `(anonymous)` (10)
- `(anonymous)` (9)
- `(anonymous)` (9)
- `(anonymous)` (9)
- `(anonymous)` (9)
- `(anonymous)` (9)
- `(anonymous)` (9)
- `(anonymous)` (9)
- `(anonymous)` (9)
- `(anonymous)` (8)
- `(anonymous)` (8)
- `(anonymous)` (8)
- `(anonymous)` (7)
- `(anonymous)` (7)
- `(anonymous)` (7)
- `(anonymous)` (7)
- `(anonymous)` (7)
- `(anonymous)` (7)
- `(anonymous)` (6)
- `(anonymous)` (6)
- `(anonymous)` (6)
- `(anonymous)` (6)
- `(anonymous)` (6)
- `(anonymous)` (5)
- `(anonymous)` (5)
- `(anonymous)` (4)
- `getCodec` (4)
- `(anonymous)` (4)
- `(anonymous)` (4)
- `(anonymous)` (4)
- `(anonymous)` (4)
- `(anonymous)` (4)
- `(anonymous)` (4)
- `(anonymous)` (4)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `table` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `enableStreamingAPI` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

**Calls:**
- `require` (776)
- `anonymous` (3)

### `async createKyselyAdapter`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:115` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async getMigrations` (1)

**Calls:**
- `async (anonymous)` (1)

### `internal:fs/streams`
`internal:fs/streams:2` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `anonymous` (1)

### `getCodec`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/lib/index.js:65` | Self: 0.0% (0us) | Total: 0.0% (4.8ms) | Samples: 0

**Called by:**
- `map` (4)

**Calls:**
- `bound require` (4)

### `prepare`
`bun:sqlite:366` | Self: 0.0% (0us) | Total: 8.0% (1.46s) | Samples: 0

**Called by:**
- `(anonymous)` (1035)

**Calls:**
- `prepare` (1031)
- `Statement` (2)
- `Statement` (1)
- `Statement` (1)

### `parseCookies`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:38` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `tryDecode` (2)

### `async runAfterHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:135` | Self: 0.0% (0us) | Total: 0.0% (6.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (3)

**Calls:**
- `async runAfterHooks` (2)
- `async runAfterHooks` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accounts.ts:110` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `transaction` (2)

**Calls:**
- `persistAccountRow` (1)
- `persistAccountRow` (1)

### `sortGroupsForGroupBy`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/messageGrouping.ts:105` | Self: 0.0% (0us) | Total: 0.0% (2.5ms) | Samples: 0

**Called by:**
- `async getThreadGroupCounts` (2)

**Calls:**
- `forEach` (2)

### `shouldIgnoreTopicSuggestionSignal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts:125` | Self: 0.0% (0us) | Total: 1.5% (289.9ms) | Samples: 0

**Called by:**
- `(anonymous)` (244)

**Calls:**
- `shouldIgnoreTopicSuggestionSignalUncached` (161)
- `shouldIgnoreTopicSuggestionSignalUncached` (73)
- `shouldIgnoreTopicSuggestionSignalUncached` (3)
- `shouldIgnoreTopicSuggestionSignalUncached` (3)
- `shouldIgnoreTopicSuggestionSignalUncached` (3)
- `shouldIgnoreTopicSuggestionSignalUncached` (1)

### `LocalObjectIdentifierValueBlock`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:2342` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `BaseBlock` (1)

**Calls:**
- `fromString` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/index.js:7` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async getAccountById`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accounts.ts:84` | Self: 0.0% (0us) | Total: 0.8% (152.6ms) | Samples: 0

**Calls:**
- `mapAccountRow` (49)
- `mapAccountRow` (44)
- `mapAccountRow` (18)
- `mapAccountRow` (11)
- `mapAccountRow` (3)
- `mapAccountRow` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@zone-eu/mailsplit/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:340` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `tlds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:613` | Self: 0.0% (0us) | Total: 0.0% (1.5ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `filter` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:212` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `__importStar` (1)

**Calls:**
- `defineProperty` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:13` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async verifySignature` (1)

**Calls:**
- `atob` (1)

### `async findSchemaProblems`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:253` | Self: 0.0% (0us) | Total: 0.0% (998us) | Samples: 0

**Calls:**
- `map` (1)

### `collectTopicSignalEntries`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts:92` | Self: 0.0% (0us) | Total: 0.0% (3.3ms) | Samples: 0

**Called by:**
- `flush` (3)

**Calls:**
- `extractJiraProjectKeys` (3)

### `rebuildThreadSignalsForThreadIdsInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts:76` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `async rebuildThreadSignalsForThreadIds` (2)

**Calls:**
- `normalizeThreadIds` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/dependency-container.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_arx.js:237` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `encrypt` (2)

**Calls:**
- `runCipher` (1)
- `runCipher` (1)

### `getType`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:515` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async getMigrations` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv6.js:1443` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `map` (1)

### `convertWhereClause`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:373` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async findOne` (1)

**Calls:**
- `forEach` (1)

### `migrate`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountKeys.ts:184` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `ensureAccountKeySchema` (1)

**Calls:**
- `ftsNeedsRebuild` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/rsaes_oaep.js:8` | Self: 0.0% (0us) | Total: 0.0% (3.3ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `bound require` (3)

### `configureAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts:106` | Self: 0.0% (0us) | Total: 0.0% (2.6ms) | Samples: 0

**Called by:**
- `async getAccountDb` (1)

**Calls:**
- `prepareAccountShardConnection` (1)

### `parseSearchInput`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:684` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `async getTotalCount` (1)
- `async listThreads` (1)

**Calls:**
- `normalizeSearchFields` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/encoding-convert.js:2` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `Hash`
`node:crypto:168` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `createHash` (1)

**Calls:**
- `Hash` (1)

### `async getSharedTestAuthHarness`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testAuthHarness.ts:150` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Calls:**
- `getAuth` (1)

### `bound visitAlias`
`[native code]` | Self: 0.0% (0us) | Total: 0.1% (29.9ms) | Samples: 0

**Called by:**
- `visitNode` (12)

**Calls:**
- `visitAlias` (10)
- `visitAlias` (1)
- `visitAlias` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/converters.js:7` | Self: 0.0% (0us) | Total: 0.0% (9.4ms) | Samples: 0

**Called by:**
- `anonymous` (9)

**Calls:**
- `bound require` (9)

### `buildSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-schema.mjs:10` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async getMigrations` (1)

**Calls:**
- `getAuthTablesWithResolvedIndexes` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/source-map-js/source-map.js:7` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `initAccountSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:978` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async withDbWriteRetry` (1)

**Calls:**
- `assertCompleteShardFormat` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:70` | Self: 0.0% (0us) | Total: 0.0% (3.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:245` | Self: 0.0% (0us) | Total: 0.0% (3.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (2)
- `DBCSCodec` (1)

**Calls:**
- `(anonymous)` (3)

### `unlock`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:87` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async releaseConnection` (1)

**Calls:**
- `(anonymous)` (1)

### `displayDayNumberUncached`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/i18n/format.ts:55` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `displayDayNumber` (1)

**Calls:**
- `formatToParts` (1)

### `setWeights`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/mail/categorization/linearModel.ts:52` | Self: 0.0% (0us) | Total: 0.0% (1.4ms) | Samples: 0

**Called by:**
- `createSeededLinearModel` (1)

**Calls:**
- `forEach` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:648` | Self: 0.0% (0us) | Total: 0.0% (2.5ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async transformOutput` (1)

### `getThreadCollabStates`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts:78` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `async getThreadCollabStates` (1)

**Calls:**
- `set` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/converters.js:6` | Self: 0.0% (0us) | Total: 0.0% (5.4ms) | Samples: 0

**Called by:**
- `anonymous` (5)

**Calls:**
- `bound require` (5)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts:444` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `forEach` (1)

**Calls:**
- `(anonymous)` (1)

### `applyExcludedFolderFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:908` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async listThreads` (1)

**Calls:**
- `Set` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/charset.js:141` | Self: 0.0% (0us) | Total: 0.0% (5.3ms) | Samples: 0

**Called by:**
- `anonymous` (5)

**Calls:**
- `getCodec` (5)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/transaction.mjs:24` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `getStore` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:205` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `async withAccountDb` (2)

**Calls:**
- `rowToTopic` (1)
- `rowToTopic` (1)

### `selectAll`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:128` | Self: 0.0% (0us) | Total: 0.0% (10.1ms) | Samples: 0

**Called by:**
- `async findOne` (6)
- `(anonymous)` (2)

**Calls:**
- `cloneWithSelections` (4)
- `parseSelectAll` (2)
- `cloneWithSelections` (1)
- `parseSelectAll` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/decorators/index.js:9` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:647` | Self: 0.0% (0us) | Total: 0.0% (2.5ms) | Samples: 0

**Calls:**
- `map` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/adapter-kysely.mjs:13` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:253` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:14` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:198` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/index.js:1` | Self: 0.0% (0us) | Total: 0.1% (20.6ms) | Samples: 0

**Called by:**
- `anonymous` (18)

**Calls:**
- `bound require` (18)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/request.js:25` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:2611` | Self: 0.0% (0us) | Total: 0.0% (4.5ms) | Samples: 0

**Calls:**
- `map` (4)

### `async acquireConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:35` | Self: 0.0% (0us) | Total: 0.0% (6.5ms) | Samples: 0

**Called by:**
- `async acquireConnection` (5)

**Calls:**
- `async acquireConnection` (5)

### `shardWriterGuardsInstalled`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts:65` | Self: 0.0% (0us) | Total: 0.0% (998us) | Samples: 0

**Called by:**
- `migrate` (1)

**Calls:**
- `normalizeShardSql` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts:166` | Self: 0.0% (0us) | Total: 0.0% (997us) | Samples: 0

**Called by:**
- `transaction` (1)

**Calls:**
- `ensureTableColumns` (1)

### `nullable`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:1266` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `nullish` (1)

**Calls:**
- `ZodNullable` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts:277` | Self: 0.0% (0us) | Total: 0.0% (4.4ms) | Samples: 0

**Calls:**
- `createBetterAuth` (1)

### `migrate`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountKeys.ts:227` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `ensureAccountKeySchema` (2)

**Calls:**
- `shardWriterGuardsInstalled` (1)
- `every` (1)

### `async getThreadGroupCounts`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts:1404` | Self: 0.0% (0us) | Total: 0.0% (4.8ms) | Samples: 0

**Called by:**
- `async listThreads` (4)

**Calls:**
- `sortGroupsForGroupBy` (2)
- `groupsFromRows` (1)
- `groupsFromRows` (1)

### `async provideConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/default-connection-provider.js:13` | Self: 0.0% (0us) | Total: 0.0% (16.0ms) | Samples: 0

**Called by:**
- `async executeQuery` (8)

**Calls:**
- `async provideConnection` (8)
- `async releaseConnection` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:1097` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/i18n/format.ts:53` | Self: 0.0% (0us) | Total: 0.0% (9.9ms) | Samples: 0

**Called by:**
- `cached` (8)

**Calls:**
- `DateTimeFormat` (8)

### `async runAfterHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:111` | Self: 0.0% (0us) | Total: 0.0% (986us) | Samples: 0

**Calls:**
- `matcher` (1)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:60` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `transaction` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:25` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/after/after.js:12` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/signer_info.js:9` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:36` | Self: 0.0% (0us) | Total: 0.0% (8.1ms) | Samples: 0

**Calls:**
- `bound require` (7)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/dayjs/dayjs.min.js:1` | Self: 0.0% (0us) | Total: 0.0% (3.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (2)
- `anonymous` (1)

**Calls:**
- `(anonymous)` (2)
- `forEach` (1)

### `tlds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:607` | Self: 0.0% (0us) | Total: 0.0% (13.0ms) | Samples: 0

**Called by:**
- `(module)` (10)

**Calls:**
- `compile` (5)
- `compile` (3)
- `compile` (1)
- `compile` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-ecc/build/cjs/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (5.5ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/legacy/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `compile`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:156` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `tlds` (1)

**Calls:**
- `RegExp` (1)

### `installAuthControlPlane`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts:308` | Self: 0.0% (0us) | Total: 0.0% (8.9ms) | Samples: 0

**Called by:**
- `async (anonymous)` (6)

**Calls:**
- `transaction` (5)
- `transaction` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/next-url.js:11` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `toRegExp`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/leac/lib/leac.mjs:55` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `toUnifiedRule` (1)

**Calls:**
- `replace` (1)

### `async createTopic`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts:122` | Self: 0.0% (0us) | Total: 0.0% (9.1ms) | Samples: 0

**Called by:**
- `async buildFixture` (1)

**Calls:**
- `async createTopic` (1)

### `createLexer`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/leac/lib/leac.mjs:77` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `map` (1)

### `visitBinaryOperation`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:1153` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `bound visitBinaryOperation` (1)

**Calls:**
- `visitNode` (1)

## Files

| Self% | Self | File |
|------:|-----:|------|
| 64.3% | 11.68s | `[native code]` |
| 16.8% | 3.06s | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/suggestions.ts` |
| 1.7% | 313.6ms | `/tmp/spike-switch-server/sqlcounter.ts` |
| 1.4% | 256.6ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/ownAddresses.ts` |
| 1.0% | 191.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/query.ts` |
| 1.0% | 189.7ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/insert-query-builder.js` |
| 0.9% | 173.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/index.mjs` |
| 0.9% | 169.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/object-utils.js` |
| 0.9% | 167.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs` |
| 0.8% | 163.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-attributes.mjs` |
| 0.8% | 162.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.8% | 149.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/i18n/format.ts` |
| 0.5% | 91.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` |
| 0.4% | 77.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadTopics.ts` |
| 0.3% | 65.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs` |
| 0.3% | 64.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js` |
| 0.3% | 63.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js` |
| 0.2% | 46.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/messageGrouping.ts` |
| 0.2% | 43.6ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js` |
| 0.2% | 38.6ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs` |
| 0.2% | 38.5ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/esm/mimetypes.js` |
| 0.2% | 37.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topics/core.ts` |
| 0.1% | 36.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/enrichMessagesWithThreadCollab.ts` |
| 0.1% | 33.7ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/accounts/[accountId]/threads/route.ts` |
| 0.1% | 32.8ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/upsert.ts` |
| 0.1% | 29.1ms | `/tmp/spike-switch-server/anatomy.ts` |
| 0.1% | 27.6ms | `bun:sqlite` |
| 0.1% | 26.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/connection.ts` |
| 0.1% | 25.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs` |
| 0.1% | 24.9ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/schema.ts` |
| 0.1% | 21.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js` |
| 0.1% | 20.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs` |
| 0.1% | 19.8ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/storage.ts` |
| 0.1% | 18.7ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js` |
| 0.1% | 18.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js` |
| 0.0% | 17.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs` |
| 0.0% | 16.8ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js` |
| 0.0% | 15.9ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/add-constraint-node.js` |
| 0.0% | 14.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/_shared.ts` |
| 0.0% | 14.0ms | `/tmp/spike-switch-server/fixture.ts` |
| 0.0% | 13.6ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/he/he.js` |
| 0.0% | 12.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threadCollab.ts` |
| 0.0% | 12.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs` |
| 0.0% | 11.7ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/secret.ts` |
| 0.0% | 11.7ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/auth.ts` |
| 0.0% | 11.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js` |
| 0.0% | 10.7ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs` |
| 0.0% | 9.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/senderIdentities.ts` |
| 0.0% | 8.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/validator.mjs` |
| 0.0% | 8.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/threads.ts` |
| 0.0% | 7.7ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js` |
| 0.0% | 7.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs` |
| 0.0% | 7.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/rowParsers.ts` |
| 0.0% | 7.2ms | `internal:shared` |
| 0.0% | 7.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/work-unit-async-storage.external.js` |
| 0.0% | 7.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/tracer.mjs` |
| 0.0% | 7.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js` |
| 0.0% | 7.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs` |
| 0.0% | 7.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js` |
| 0.0% | 6.8ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/env-impl.mjs` |
| 0.0% | 6.7ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/api/index.mjs` |
| 0.0% | 6.6ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js` |
| 0.0% | 6.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/topics.ts` |
| 0.0% | 5.7ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-model-name.mjs` |
| 0.0% | 5.7ms | `node:async_hooks` |
| 0.0% | 5.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/topicSignals.ts` |
| 0.0% | 5.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs` |
| 0.0% | 5.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/shardFormat.ts` |
| 0.0% | 5.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/middleware.mjs` |
| 0.0% | 4.9ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/tests/helpers/totp.ts` |
| 0.0% | 4.9ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/function-module.js` |
| 0.0% | 4.9ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/binary-operation-parser.js` |
| 0.0% | 4.7ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs` |
| 0.0% | 4.7ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/senderIdentity.ts` |
| 0.0% | 4.7ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs` |
| 0.0% | 4.7ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testAuthHarness.ts` |
| 0.0% | 4.6ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/global.mjs` |
| 0.0% | 4.6ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/@edge-runtime/cookies/index.js` |
| 0.0% | 4.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js` |
| 0.0% | 4.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/sign-up.mjs` |
| 0.0% | 4.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accounts.ts` |
| 0.0% | 4.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/accountRole.ts` |
| 0.0% | 4.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js` |
| 0.0% | 4.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js` |
| 0.0% | 4.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs` |
| 0.0% | 3.6ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/headers.js` |
| 0.0% | 3.6ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/set-operation-node.js` |
| 0.0% | 3.5ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/serverDb.ts` |
| 0.0% | 3.5ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authLifetimeLock.ts` |
| 0.0% | 3.5ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/well-known/index.js` |
| 0.0% | 3.5ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/table-parser.js` |
| 0.0% | 3.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js` |
| 0.0% | 3.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/authPolicyHandler.ts` |
| 0.0% | 3.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/accountContext.ts` |
| 0.0% | 3.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/utils.mjs` |
| 0.0% | 3.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/accountSettings.ts` |
| 0.0% | 3.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_arx.js` |
| 0.0% | 3.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/testDbHarness.ts` |
| 0.0% | 3.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/database-index.mjs` |
| 0.0% | 2.7ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/helpers.mjs` |
| 0.0% | 2.6ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/cookie-utils.mjs` |
| 0.0% | 2.5ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-field-name.mjs` |
| 0.0% | 2.5ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/query-id.js` |
| 0.0% | 2.4ms | `node:crypto` |
| 0.0% | 2.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/app/api/_helpers/folderAccount.ts` |
| 0.0% | 2.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/endpoint-context.mjs` |
| 0.0% | 2.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/identifier-node.js` |
| 0.0% | 2.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/accountKeys.ts` |
| 0.0% | 2.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/operation-node-visitor.js` |
| 0.0% | 2.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs` |
| 0.0% | 2.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/messages/identityMetadata.ts` |
| 0.0% | 2.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv6.js` |
| 0.0% | 2.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/expression-parser.js` |
| 0.0% | 2.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs` |
| 0.0% | 2.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/defu/dist/defu.mjs` |
| 0.0% | 2.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/folderAccountGuard.ts` |
| 0.0% | 2.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/users.ts` |
| 0.0% | 2.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/betterAuth.ts` |
| 0.0% | 2.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/parse5/dist/parser/index.js` |
| 0.0% | 2.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js` |
| 0.0% | 2.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/ftsIdentity.ts` |
| 0.0% | 2.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/internal/decode-shared.js` |
| 0.0% | 2.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/utils/dist/hmac.mjs` |
| 0.0% | 2.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/raw-builder/raw-builder.js` |
| 0.0% | 2.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/schemable-identifier-node.js` |
| 0.0% | 2.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/abort.js` |
| 0.0% | 1.7ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/dom-serializer/node_modules/entities/lib/esm/generated/encode-html.js` |
| 0.0% | 1.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/column-node.js` |
| 0.0% | 1.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/mail/categorization/linearModel.ts` |
| 0.0% | 1.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/sign-in.mjs` |
| 0.0% | 1.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/levels.js` |
| 0.0% | 1.3ms | `node:events` |
| 0.0% | 1.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/ip_converter.js` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-schema.mjs` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-android/build/cjs/nonstandard.js` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/otp/index.mjs` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/jose/dist/webapi/util/errors.js` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs` |
| 0.0% | 1.2ms | `node:_http_outgoing` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/update-query-builder.js` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/calendarEventUids.ts` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/utils/url.mjs` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/schema.mjs` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/encode.js` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/error.mjs` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/transaction.mjs` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/passkey/dist/index.mjs` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/utils.js` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/node_modules/jose/dist/webapi/lib/jws_algorithms.js` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/authPolicy.ts` |
| 0.0% | 1.2ms | `node:tls` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/schema.js` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/certificate_choices.js` |
| 0.0% | 1.2ms | `internal:streams/duplexpair` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/default-connection-provider.js` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/node_modules/tslib/tslib.js` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/utf8-to-jisx0212-table.js` |
| 0.0% | 1.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/_virtual/_rolldown/runtime.mjs` |
| 0.0% | 1.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/utils.js` |
| 0.0% | 1.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs` |
| 0.0% | 1.1ms | `internal:streams/writable` |
| 0.0% | 1.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/htmlparser2/node_modules/entities/dist/esm/internal/decode-shared.js` |
| 0.0% | 1.1ms | `internal:stream` |
| 0.0% | 1.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha2.js` |
| 0.0% | 1.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js` |
| 0.0% | 1.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/ua-parser-js/ua-parser.js` |
| 0.0% | 1.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/lib/helpers/merge-exports.js` |
| 0.0% | 1.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/mimetypes.js` |
| 0.0% | 1.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/threadCollab.ts` |
| 0.0% | 1.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/accountAccess.ts` |
| 0.0% | 1.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/accountPrefs.ts` |
| 0.0% | 1.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/value-node.js` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@simplewebauthn/server/esm/services/metadataService.js` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/segment-config/ensure-static.js` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/userLifecycle.ts` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/utils/is-promise.mjs` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/schema/create-table-builder.js` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/deepmerge-ts/dist/index.mjs` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/is-api-error.mjs` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/bags/pkcs8_shrouded_key_bag.js` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/key_usage.js` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/esm/charsets.js` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/common.js` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/value-parser.js` |
| 0.0% | 999us | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-id-field.mjs` |
| 0.0% | 983us | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/userProvisioning.ts` |
| 0.0% | 982us | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_poly1305.js` |
| 0.0% | 973us | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/node.js` |
| 0.0% | 967us | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/session-store.mjs` |
| 0.0% | 952us | `/home/monkey/code/noctua-mail/wt-spike-switch-server/.tmp/proto/lib/db/ownAddressSql.ts` |
| 0.0% | 937us | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/attribute_certificate_info.js` |
