# CPU Profile

| Duration | Samples | Interval | Functions |
|----------|---------|----------|----------|
| 37.04s | 26131 | 1.0ms | 2017 |

**Top 10:** `run` 24.4%, `all` 23.5%, `get` 10.3%, `formatToParts` 4.8%, `prepare` 3.1%, `URL` 2.5%, `json` 1.6%, `checkChar` 1.5%, `normalizeIdentityEmail` 1.3%, `Set` 1.1%

## Hot Functions (Self Time)

| Self% | Self | Total% | Total | Function | Location |
|------:|-----:|-------:|------:|----------|----------|
| 24.4% | 9.06s | 24.4% | 9.06s | `run` | `[native code]` |
| 23.5% | 8.71s | 23.5% | 8.71s | `all` | `[native code]` |
| 10.3% | 3.84s | 10.4% | 3.85s | `get` | `[native code]` |
| 4.8% | 1.79s | 4.8% | 1.79s | `formatToParts` | `[native code]` |
| 3.1% | 1.15s | 3.1% | 1.15s | `prepare` | `[native code]` |
| 2.5% | 953.5ms | 2.5% | 953.5ms | `URL` | `[native code]` |
| 1.6% | 598.4ms | 1.6% | 598.4ms | `json` | `[native code]` |
| 1.5% | 587.4ms | 1.5% | 587.4ms | `checkChar` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:989` |
| 1.3% | 497.3ms | 1.3% | 497.3ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:17` |
| 1.1% | 428.5ms | 1.1% | 428.5ms | `Set` | `[native code]` |
| 1.0% | 394.7ms | 2.9% | 1.08s | `anonymous` | `[native code]` |
| 0.9% | 367.3ms | 0.9% | 367.3ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:9` |
| 0.9% | 345.9ms | 1.3% | 486.2ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:16` |
| 0.9% | 340.5ms | 3.4% | 1.29s | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:14` |
| 0.6% | 255.1ms | 12.1% | 4.50s | `map` | `[native code]` |
| 0.6% | 246.0ms | 0.6% | 252.0ms | `parseAddressEmails` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:25` |
| 0.6% | 243.0ms | 0.6% | 243.0ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:12` |
| 0.5% | 212.5ms | 0.5% | 213.8ms | `part` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts:42` |
| 0.4% | 182.1ms | 0.4% | 182.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testAuthHarness.ts` |
| 0.4% | 174.1ms | 0.4% | 174.1ms | `getEnvVar` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/env-impl.mjs:41` |
| 0.4% | 161.6ms | 0.4% | 161.6ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:106` |
| 0.4% | 161.2ms | 0.4% | 161.2ms | `cached` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts:13` |
| 0.4% | 160.8ms | 0.4% | 160.8ms | `freeze` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/object-utils.js:63` |
| 0.4% | 160.8ms | 0.4% | 160.8ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:266` |
| 0.4% | 150.3ms | 2.1% | 789.4ms | `tokenize` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:836` |
| 0.3% | 134.5ms | 0.3% | 134.5ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:7` |
| 0.3% | 114.0ms | 0.3% | 140.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:16` |
| 0.2% | 98.8ms | 0.2% | 98.8ms | `parseAddressEmails` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:42` |
| 0.2% | 94.3ms | 0.2% | 94.3ms | `_collectAddressParts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:561` |
| 0.2% | 93.2ms | 2.2% | 816.2ms | `buildTimeGroupKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageGrouping.ts:44` |
| 0.2% | 88.7ms | 0.2% | 88.7ms | `Tokenizer` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.2% | 87.4ms | 0.2% | 92.4ms | `json` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:92` |
| 0.2% | 79.2ms | 0.2% | 80.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:62` |
| 0.2% | 75.8ms | 60.4% | 22.38s | `forEach` | `[native code]` |
| 0.1% | 72.1ms | 0.1% | 72.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:215` |
| 0.1% | 71.0ms | 0.1% | 71.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:570` |
| 0.1% | 70.7ms | 0.2% | 89.6ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:6` |
| 0.1% | 66.0ms | 0.1% | 66.0ms | `Boolean` | `[native code]` |
| 0.1% | 65.5ms | 0.1% | 65.5ms | `importModule` | `[native code]` |
| 0.1% | 65.2ms | 0.2% | 109.8ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2645` |
| 0.1% | 64.6ms | 0.8% | 328.7ms | `displayDayNumber` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts:43` |
| 0.1% | 63.0ms | 0.2% | 97.1ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:11` |
| 0.1% | 62.3ms | 0.1% | 62.3ms | `copyDataProperties` | `[native code]` |
| 0.1% | 60.7ms | 0.1% | 60.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:566` |
| 0.1% | 60.0ms | 0.1% | 60.0ms | `entries` | `[native code]` |
| 0.1% | 58.2ms | 0.1% | 58.2ms | `normalizeEmailAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/senderIdentity.ts:61` |
| 0.1% | 57.9ms | 0.1% | 57.9ms | `getColorDepth` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs` |
| 0.1% | 55.3ms | 0.1% | 55.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2666` |
| 0.1% | 53.5ms | 0.1% | 54.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:565` |
| 0.1% | 53.1ms | 12.3% | 4.56s | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:165` |
| 0.1% | 51.3ms | 0.1% | 51.3ms | `getTopicSuggestionWeight` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:68` |
| 0.1% | 51.0ms | 0.1% | 51.0ms | `_collapseAtSpacing` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:273` |
| 0.1% | 50.3ms | 0.1% | 50.3ms | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts:50` |
| 0.1% | 49.8ms | 0.1% | 49.8ms | `cloneObject` | `[native code]` |
| 0.1% | 49.3ms | 0.1% | 49.3ms | `UTC` | `[native code]` |
| 0.1% | 49.1ms | 16.5% | 6.11s | `flatMap` | `[native code]` |
| 0.1% | 47.7ms | 0.1% | 50.0ms | `createExpressionBuilder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:32` |
| 0.1% | 46.7ms | 4.0% | 1.49s | `addressparser` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1199` |
| 0.1% | 46.4ms | 0.1% | 46.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts:29` |
| 0.1% | 42.9ms | 0.2% | 85.4ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:10` |
| 0.1% | 42.6ms | 0.1% | 45.0ms | `_recoverAddrSpec` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:368` |
| 0.1% | 42.5ms | 0.1% | 42.5ms | `/^[\p{L}\p{M}\p{N}.-]+$/u` | `[native code]` |
| 0.1% | 42.1ms | 0.1% | 42.1ms | `Date` | `[native code]` |
| 0.1% | 40.3ms | 0.1% | 40.3ms | `isFreeMailDomain` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/senderIdentity.ts:272` |
| 0.1% | 39.2ms | 0.1% | 39.2ms | `flush` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:205` |
| 0.1% | 38.0ms | 0.1% | 38.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadCollab.ts:8` |
| 0.1% | 37.9ms | 2.1% | 792.6ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:46` |
| 0.0% | 36.9ms | 0.0% | 36.9ms | `shouldIgnoreTopicSuggestionSignal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:126` |
| 0.0% | 35.9ms | 0.0% | 35.9ms | `freeze` | `[native code]` |
| 0.0% | 34.6ms | 0.0% | 34.6ms | `Map` | `[native code]` |
| 0.0% | 34.5ms | 0.0% | 35.7ms | `async enrichMessagesWithThreadCollab` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadCollab.ts:14` |
| 0.0% | 34.4ms | 0.0% | 34.4ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:78` |
| 0.0% | 34.3ms | 0.0% | 34.3ms | `getChunkedCookie` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/session-store.mjs:138` |
| 0.0% | 34.2ms | 1.3% | 511.3ms | `filter` | `[native code]` |
| 0.0% | 34.1ms | 0.0% | 34.1ms | ``/^[A-Za-z0-9.!#$%&'*+\/=?^_`{\|}~-]+$/`` | `[native code]` |
| 0.0% | 33.1ms | 0.0% | 33.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:162` |
| 0.0% | 31.9ms | 0.1% | 56.3ms | `slimThreadListItem` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:32` |
| 0.0% | 31.1ms | 0.0% | 31.1ms | `shouldIgnoreTopicSuggestionSignal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:118` |
| 0.0% | 29.6ms | 0.2% | 79.9ms | `(anonymous)` | `[native code]` |
| 0.0% | 28.3ms | 0.0% | 28.3ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:776` |
| 0.0% | 28.2ms | 0.0% | 28.2ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:743` |
| 0.0% | 28.2ms | 0.0% | 28.2ms | `node:dns` | `node:dns:2` |
| 0.0% | 26.2ms | 0.0% | 26.2ms | `/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/` | `[native code]` |
| 0.0% | 25.2ms | 0.0% | 30.0ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:697` |
| 0.0% | 25.1ms | 0.0% | 25.1ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:15` |
| 0.0% | 24.9ms | 0.0% | 24.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2523` |
| 0.0% | 24.3ms | 0.0% | 24.3ms | `_joinAtSpacing` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 24.2ms | 0.0% | 24.2ms | `checkChar` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1003` |
| 0.0% | 23.6ms | 4.9% | 1.82s | `displayDayNumber` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts:41` |
| 0.0% | 23.5ms | 0.0% | 23.5ms | `Cipher` | `[native code]` |
| 0.0% | 23.2ms | 0.0% | 23.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:334` |
| 0.0% | 23.1ms | 2.5% | 935.1ms | `_parseAddressList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1155` |
| 0.0% | 23.1ms | 57.2% | 21.19s | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:82` |
| 0.0% | 22.9ms | 0.0% | 22.9ms | `structuredClone` | `[native code]` |
| 0.0% | 22.9ms | 0.0% | 32.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:187` |
| 0.0% | 20.9ms | 0.0% | 20.9ms | `AsyncLocalStorage` | `node:async_hooks` |
| 0.0% | 20.6ms | 0.1% | 73.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:628` |
| 0.0% | 20.1ms | 0.0% | 22.3ms | `checkChar` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1019` |
| 0.0% | 19.8ms | 0.0% | 19.8ms | `createFunctionModule` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/function-module.js:19` |
| 0.0% | 19.4ms | 0.0% | 19.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:164` |
| 0.0% | 18.9ms | 0.0% | 36.6ms | `text` | `[native code]` |
| 0.0% | 18.8ms | 0.0% | 18.8ms | `/[\x00-\x1f\x7f]/` | `[native code]` |
| 0.0% | 18.8ms | 0.0% | 18.8ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:95` |
| 0.0% | 18.6ms | 0.5% | 189.1ms | `displayDayNumber` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts:39` |
| 0.0% | 18.4ms | 0.0% | 18.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:370` |
| 0.0% | 18.2ms | 0.0% | 18.2ms | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/esm/mimetypes.js:3` |
| 0.0% | 18.1ms | 0.0% | 18.1ms | `stringify` | `[native code]` |
| 0.0% | 17.9ms | 19.2% | 7.11s | `flatIntoArrayWithCallback` | `[native code]` |
| 0.0% | 17.5ms | 0.0% | 17.5ms | `compileQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:21` |
| 0.0% | 17.4ms | 0.3% | 117.1ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:660` |
| 0.0% | 16.3ms | 0.0% | 17.3ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:83` |
| 0.0% | 16.1ms | 0.0% | 16.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts` |
| 0.0% | 15.8ms | 0.0% | 15.8ms | `parse` | `[native code]` |
| 0.0% | 15.3ms | 0.0% | 15.3ms | `_collapseAtSpacing` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:272` |
| 0.0% | 15.3ms | 0.0% | 15.3ms | `async acquireConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs` |
| 0.0% | 15.0ms | 3.5% | 1.31s | `isOwnAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:61` |
| 0.0% | 14.9ms | 0.0% | 14.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:163` |
| 0.0% | 14.9ms | 0.0% | 14.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:165` |
| 0.0% | 14.9ms | 0.9% | 336.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:355` |
| 0.0% | 14.7ms | 2.2% | 833.1ms | `buildMessageGroupKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageGrouping.ts:71` |
| 0.0% | 14.2ms | 0.0% | 14.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:346` |
| 0.0% | 14.2ms | 0.0% | 14.2ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:698` |
| 0.0% | 13.7ms | 1.3% | 490.7ms | `_parseAddressList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1181` |
| 0.0% | 13.6ms | 0.0% | 13.6ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:25` |
| 0.0% | 13.5ms | 0.0% | 13.5ms | `reverse` | `[native code]` |
| 0.0% | 13.4ms | 0.0% | 28.8ms | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:80` |
| 0.0% | 13.2ms | 0.0% | 13.2ms | `Buffer` | `[native code]` |
| 0.0% | 13.0ms | 0.0% | 13.0ms | `cloneWithSelections` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/select-query-node.js:30` |
| 0.0% | 13.0ms | 0.0% | 13.0ms | `topicSuggestionSignalsFromEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:75` |
| 0.0% | 12.9ms | 0.0% | 34.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:84` |
| 0.0% | 12.8ms | 0.0% | 12.8ms | `displayDayNumber` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts:38` |
| 0.0% | 12.7ms | 0.0% | 12.7ms | `verify` | `[native code]` |
| 0.0% | 12.4ms | 0.1% | 46.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:506` |
| 0.0% | 12.1ms | 0.5% | 202.1ms | `ownAddressList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:68` |
| 0.0% | 12.0ms | 0.0% | 12.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-field-name.mjs` |
| 0.0% | 11.9ms | 0.0% | 11.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-id-field.mjs:43` |
| 0.0% | 11.8ms | 0.0% | 11.8ms | `_collapseAtSpacing` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:262` |
| 0.0% | 11.5ms | 0.0% | 11.5ms | `encodeURIComponent` | `[native code]` |
| 0.0% | 11.5ms | 0.0% | 11.5ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:699` |
| 0.0% | 11.4ms | 0.0% | 11.4ms | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:36` |
| 0.0% | 11.1ms | 3.6% | 1.33s | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:69` |
| 0.0% | 10.9ms | 0.0% | 10.9ms | `toString` | `[native code]` |
| 0.0% | 10.8ms | 0.0% | 15.9ms | `performIteration` | `[native code]` |
| 0.0% | 10.7ms | 0.0% | 10.7ms | `async runAfterHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:119` |
| 0.0% | 10.6ms | 0.5% | 190.6ms | `formatTransactionId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:865` |
| 0.0% | 10.4ms | 0.0% | 10.4ms | `_joinAtSpacing` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:239` |
| 0.0% | 10.4ms | 0.0% | 10.4ms | `visitNode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/operation-node-visitor.js:111` |
| 0.0% | 10.3ms | 0.0% | 10.3ms | `wrapStatement` | `/tmp/spike-switch-server/sqlcounter.ts:75` |
| 0.0% | 10.2ms | 0.0% | 10.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:77` |
| 0.0% | 10.1ms | 0.0% | 10.1ms | `isReadonlyArray` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/object-utils.js` |
| 0.0% | 10.1ms | 0.0% | 10.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js` |
| 0.0% | 9.9ms | 0.0% | 19.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:697` |
| 0.0% | 9.8ms | 0.0% | 9.8ms | `parseSelectArg` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/select-parser.js:10` |
| 0.0% | 9.6ms | 0.6% | 239.9ms | `insert` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/ftsIdentity.ts:87` |
| 0.0% | 9.6ms | 0.0% | 9.6ms | `TokenList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:25` |
| 0.0% | 9.4ms | 6.0% | 2.24s | `isOwnAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:62` |
| 0.0% | 9.3ms | 0.0% | 9.3ms | `create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/where-node.js:13` |
| 0.0% | 9.2ms | 0.0% | 9.2ms | `DateTimeFormat` | `[native code]` |
| 0.0% | 9.2ms | 0.0% | 9.2ms | `defineProperty` | `[native code]` |
| 0.0% | 9.1ms | 0.0% | 9.1ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:744` |
| 0.0% | 9.0ms | 0.0% | 9.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-field-name.mjs:19` |
| 0.0% | 8.7ms | 0.0% | 8.7ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:81` |
| 0.0% | 8.6ms | 0.0% | 8.6ms | `flatIntoArray` | `[native code]` |
| 0.0% | 8.3ms | 0.0% | 8.3ms | `_mergeNameFragments` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1127` |
| 0.0% | 8.1ms | 0.0% | 8.1ms | `parseValueBinaryOperationOrExpression` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/binary-operation-parser.js` |
| 0.0% | 8.0ms | 0.0% | 8.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2615` |
| 0.0% | 8.0ms | 0.0% | 8.0ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts` |
| 0.0% | 7.9ms | 0.0% | 7.9ms | `join` | `[native code]` |
| 0.0% | 7.7ms | 0.0% | 7.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:257` |
| 0.0% | 7.5ms | 0.0% | 7.5ms | `parseAliasedExpression` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/expression-parser.js:16` |
| 0.0% | 7.4ms | 0.0% | 7.4ms | `wrapStatement` | `/tmp/spike-switch-server/sqlcounter.ts:76` |
| 0.0% | 7.4ms | 0.0% | 7.4ms | `add` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:69` |
| 0.0% | 7.4ms | 0.0% | 7.4ms | `Statement` | `bun:sqlite:108` |
| 0.0% | 7.3ms | 0.0% | 7.3ms | `Request` | `[native code]` |
| 0.0% | 7.1ms | 0.0% | 9.3ms | `async GET` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:48` |
| 0.0% | 7.1ms | 12.6% | 4.69s | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:218` |
| 0.0% | 7.0ms | 0.0% | 8.3ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:84` |
| 0.0% | 7.0ms | 0.0% | 7.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/he/he.js` |
| 0.0% | 7.0ms | 0.0% | 7.0ms | `TokenList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:24` |
| 0.0% | 7.0ms | 0.0% | 24.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:211` |
| 0.0% | 6.9ms | 0.0% | 9.4ms | `topicSuggestionSignalsFromEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:84` |
| 0.0% | 6.9ms | 0.0% | 6.9ms | `TokenList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 6.9ms | 0.0% | 6.9ms | `arrayFromFastWithoutMapFn` | `[native code]` |
| 0.0% | 6.6ms | 0.0% | 11.8ms | `bound visitTable` | `[native code]` |
| 0.0% | 6.5ms | 0.0% | 6.5ms | `importKey` | `[native code]` |
| 0.0% | 6.5ms | 0.0% | 6.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadCollab.ts:9` |
| 0.0% | 6.4ms | 0.0% | 6.4ms | `Tokenizer` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:794` |
| 0.0% | 6.4ms | 0.0% | 6.4ms | `transformJoinClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:287` |
| 0.0% | 6.4ms | 0.0% | 6.4ms | `update` | `[native code]` |
| 0.0% | 6.3ms | 0.0% | 6.3ms | `topicSuggestionSignalKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:535` |
| 0.0% | 6.3ms | 0.0% | 6.3ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:662` |
| 0.0% | 6.3ms | 0.0% | 6.3ms | `visitNode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/operation-node-visitor.js` |
| 0.0% | 6.1ms | 0.0% | 6.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:629` |
| 0.0% | 6.1ms | 0.0% | 6.1ms | `defaultThreadCollabState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts:54` |
| 0.0% | 6.1ms | 0.0% | 6.1ms | `toISOString` | `[native code]` |
| 0.0% | 6.0ms | 0.0% | 6.0ms | `/[\x00-\x08\x0a-\x1f\x7f]/` | `[native code]` |
| 0.0% | 6.0ms | 0.0% | 6.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:23` |
| 0.0% | 5.9ms | 0.0% | 20.0ms | `(module)` | `/tmp/spike-switch-server/inspect.ts:19` |
| 0.0% | 5.8ms | 0.0% | 5.8ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts` |
| 0.0% | 5.8ms | 0.0% | 5.8ms | `set` | `[native code]` |
| 0.0% | 5.7ms | 6.7% | 2.50s | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2671` |
| 0.0% | 5.7ms | 0.0% | 5.7ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:59` |
| 0.0% | 5.7ms | 0.0% | 5.7ms | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts:52` |
| 0.0% | 5.7ms | 0.0% | 5.7ms | `add` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:68` |
| 0.0% | 5.6ms | 0.0% | 5.6ms | `install` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/storage.ts:258` |
| 0.0% | 5.5ms | 0.0% | 5.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:403` |
| 0.0% | 5.5ms | 0.0% | 5.5ms | `async executeQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:35` |
| 0.0% | 5.5ms | 0.0% | 5.5ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:97` |
| 0.0% | 5.4ms | 0.0% | 20.7ms | `topicSuggestionSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:107` |
| 0.0% | 5.4ms | 0.0% | 5.4ms | `async requireActiveUserSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts` |
| 0.0% | 5.4ms | 0.0% | 10.9ms | `async getDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:327` |
| 0.0% | 5.3ms | 0.0% | 17.2ms | `async resolveAccountRole` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/accountAccess.ts:12` |
| 0.0% | 5.3ms | 0.0% | 5.3ms | `RegExp` | `[native code]` |
| 0.0% | 5.3ms | 0.0% | 5.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2660` |
| 0.0% | 5.2ms | 0.0% | 6.5ms | `throwForMissingRequestStore` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/work-unit-async-storage.external.js:88` |
| 0.0% | 5.2ms | 0.0% | 5.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:39` |
| 0.0% | 5.2ms | 0.0% | 7.6ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:166` |
| 0.0% | 5.2ms | 0.0% | 5.2ms | `async runAfterHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs` |
| 0.0% | 5.1ms | 0.0% | 5.1ms | `defineProperties` | `[native code]` |
| 0.0% | 5.1ms | 0.0% | 5.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1207` |
| 0.0% | 5.1ms | 0.0% | 5.1ms | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:71` |
| 0.0% | 5.0ms | 0.0% | 5.0ms | `looksLikeJiraMessage` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:31` |
| 0.0% | 4.8ms | 0.0% | 25.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:646` |
| 0.0% | 4.8ms | 0.0% | 4.8ms | `#all` | `bun:sqlite:177` |
| 0.0% | 4.8ms | 0.0% | 6.0ms | `addressparser` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1200` |
| 0.0% | 4.8ms | 0.0% | 4.8ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:15` |
| 0.0% | 4.7ms | 0.0% | 4.7ms | `async validateAccountFolders` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/folderAccount.ts:11` |
| 0.0% | 4.7ms | 0.0% | 25.7ms | `async enrichMessagesWithThreadCollab` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadCollab.ts:9` |
| 0.0% | 4.7ms | 0.0% | 4.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:578` |
| 0.0% | 4.7ms | 0.0% | 4.7ms | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:49` |
| 0.0% | 4.7ms | 0.0% | 7.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:8` |
| 0.0% | 4.6ms | 0.3% | 112.3ms | `getThreadCollabStates` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts:76` |
| 0.0% | 4.6ms | 0.0% | 4.6ms | `wrapStatement` | `/tmp/spike-switch-server/sqlcounter.ts:74` |
| 0.0% | 4.5ms | 0.0% | 4.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:47` |
| 0.0% | 4.4ms | 0.0% | 4.4ms | `formatTransactionId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` |
| 0.0% | 4.4ms | 0.0% | 4.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts` |
| 0.0% | 4.4ms | 0.0% | 5.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:684` |
| 0.0% | 4.4ms | 0.0% | 4.4ms | `parseSearchInput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:667` |
| 0.0% | 4.4ms | 0.0% | 4.4ms | `async getUserById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/serverDb.ts:150` |
| 0.0% | 4.3ms | 0.0% | 4.3ms | `concat` | `[native code]` |
| 0.0% | 4.3ms | 0.0% | 4.3ms | `_collectAddressParts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 4.3ms | 0.0% | 4.3ms | `atob` | `[native code]` |
| 0.0% | 4.3ms | 0.0% | 4.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:621` |
| 0.0% | 4.3ms | 0.0% | 4.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:168` |
| 0.0% | 4.3ms | 0.2% | 87.0ms | `some` | `[native code]` |
| 0.0% | 4.3ms | 0.0% | 20.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:209` |
| 0.0% | 4.2ms | 0.0% | 4.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:181` |
| 0.0% | 4.1ms | 0.0% | 4.1ms | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:42` |
| 0.0% | 4.1ms | 0.0% | 4.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:567` |
| 0.0% | 4.0ms | 0.0% | 4.0ms | `sanitizeIdentifier` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js` |
| 0.0% | 4.0ms | 0.0% | 4.0ms | `values` | `[native code]` |
| 0.0% | 4.0ms | 0.0% | 10.5ms | `async runAfterHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:114` |
| 0.0% | 4.0ms | 0.0% | 4.0ms | `convertWhereClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:365` |
| 0.0% | 3.9ms | 0.0% | 3.9ms | `async ensureCalendarEventRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts` |
| 0.0% | 3.8ms | 0.0% | 3.8ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:696` |
| 0.0% | 3.8ms | 0.0% | 3.8ms | `async setCookieCache` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/index.mjs:122` |
| 0.0% | 3.8ms | 0.0% | 3.8ms | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/dialect/pglite/pglite-driver.js:12` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `assertCredentialMode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/secret.ts:8` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `checkChar` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `subarray` | `[native code]` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `async ensureAsyncStorage` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/transaction.mjs` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs` |
| 0.0% | 3.6ms | 0.0% | 34.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:375` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `init` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:64` |
| 0.0% | 3.5ms | 0.0% | 4.6ms | `deriveSystemFlagState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:324` |
| 0.0% | 3.5ms | 0.3% | 147.8ms | `async getMessageCalendarInviteDataByMessageId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:192` |
| 0.0% | 3.5ms | 0.0% | 16.7ms | `decryptPayload` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/secret.ts:62` |
| 0.0% | 3.5ms | 0.6% | 223.4ms | `async getAccountById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accounts.ts:85` |
| 0.0% | 3.5ms | 0.0% | 3.5ms | `query` | `bun:sqlite:382` |
| 0.0% | 3.5ms | 0.0% | 3.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/topics.ts:3` |
| 0.0% | 3.5ms | 0.0% | 3.5ms | `__` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js` |
| 0.0% | 3.5ms | 0.0% | 3.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:303` |
| 0.0% | 3.5ms | 0.0% | 3.5ms | `has` | `[native code]` |
| 0.0% | 3.5ms | 0.0% | 36.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:602` |
| 0.0% | 3.5ms | 0.0% | 3.5ms | `assign` | `[native code]` |
| 0.0% | 3.4ms | 0.1% | 67.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:603` |
| 0.0% | 3.4ms | 0.0% | 3.4ms | `#run` | `bun:sqlite` |
| 0.0% | 3.4ms | 0.0% | 4.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2648` |
| 0.0% | 3.4ms | 0.0% | 3.4ms | `slice` | `[native code]` |
| 0.0% | 3.4ms | 0.0% | 4.3ms | `getHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:161` |
| 0.0% | 3.3ms | 0.0% | 3.3ms | `trim` | `[native code]` |
| 0.0% | 3.3ms | 0.0% | 3.3ms | `async requireAccountContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/accountContext.ts:64` |
| 0.0% | 3.3ms | 22.9% | 8.50s | `#run` | `bun:sqlite:195` |
| 0.0% | 3.3ms | 0.2% | 74.9ms | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts:54` |
| 0.0% | 3.3ms | 0.0% | 3.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:618` |
| 0.0% | 3.3ms | 0.2% | 79.1ms | `decodeSecret` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/secret.ts:73` |
| 0.0% | 3.3ms | 0.0% | 16.2ms | `getOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:55` |
| 0.0% | 3.3ms | 0.1% | 64.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/core.ts:200` |
| 0.0% | 3.3ms | 0.0% | 4.6ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:101` |
| 0.0% | 3.2ms | 0.0% | 3.2ms | `addressparser` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1201` |
| 0.0% | 3.2ms | 0.0% | 3.2ms | `query` | `bun:sqlite:384` |
| 0.0% | 3.2ms | 0.0% | 3.2ms | `#get` | `bun:sqlite` |
| 0.0% | 3.2ms | 0.0% | 3.2ms | `createFunctionModule` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/function-module.js` |
| 0.0% | 3.1ms | 0.0% | 3.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/index.mjs` |
| 0.0% | 3.1ms | 0.0% | 3.1ms | `async getDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts` |
| 0.0% | 3.1ms | 0.0% | 3.1ms | `async get` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:39` |
| 0.0% | 3.1ms | 0.0% | 5.1ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2504` |
| 0.0% | 3.1ms | 0.0% | 3.1ms | `normalizeRouteParamValue` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/accountContext.ts` |
| 0.0% | 3.0ms | 0.1% | 47.4ms | `getTopicSuggestionsForThreadSignalBatch` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:601` |
| 0.0% | 3.0ms | 0.0% | 3.0ms | `async acquireAuthLifetimeLock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authLifetimeLock.ts` |
| 0.0% | 3.0ms | 0.0% | 7.8ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:590` |
| 0.0% | 3.0ms | 6.7% | 2.51s | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2587` |
| 0.0% | 3.0ms | 0.0% | 3.0ms | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts:49` |
| 0.0% | 3.0ms | 0.0% | 3.0ms | `(unknown)` | `[native code]` |
| 0.0% | 3.0ms | 0.0% | 3.0ms | `close` | `[native code]` |
| 0.0% | 2.9ms | 0.0% | 2.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js` |
| 0.0% | 2.9ms | 0.0% | 2.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs` |
| 0.0% | 2.9ms | 0.0% | 2.9ms | `combineMiddleware` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:59` |
| 0.0% | 2.8ms | 0.0% | 2.8ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs` |
| 0.0% | 2.8ms | 0.0% | 24.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:236` |
| 0.0% | 2.8ms | 0.0% | 2.8ms | `escapeSqlLiteral` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:921` |
| 0.0% | 2.8ms | 0.3% | 125.7ms | `async execute` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:319` |
| 0.0% | 2.7ms | 0.0% | 2.7ms | `wrapStatement` | `/tmp/spike-switch-server/sqlcounter.ts:79` |
| 0.0% | 2.7ms | 0.0% | 2.7ms | `createFunctionModule` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/function-module.js:20` |
| 0.0% | 2.7ms | 0.0% | 2.7ms | `async enrollTestTotp` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testAuthHarness.ts:197` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs:11` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:229` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `columnNames` | `bun:sqlite:198` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:177` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `info` | `[native code]` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `checkSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema-check.mjs:72` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `deriveSystemFlagState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:320` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `push` | `[native code]` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `parseStringReferenceWithTable` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js:88` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `normalizeImapFlags` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageFlags.ts:172` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `prepareAccountShardConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts` |
| 0.0% | 2.5ms | 0.1% | 54.9ms | `run` | `node:async_hooks:144` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2662` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `async runValidation` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/validator.mjs` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `twoFactor` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/index.mjs` |
| 0.0% | 2.5ms | 0.0% | 5.8ms | `async getMessageCalendarInviteDataByMessageId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:189` |
| 0.0% | 2.5ms | 3.1% | 1.16s | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:96` |
| 0.0% | 2.4ms | 0.3% | 136.3ms | `getOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:57` |
| 0.0% | 2.4ms | 0.0% | 7.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/senderIdentities.ts:13` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv6.js` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `ensureSenderIdentityMessageRuntimeSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts` |
| 0.0% | 2.4ms | 0.0% | 36.5ms | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:72` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:52` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `tokenize` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `extractJiraProjectKeys` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:51` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `HashMD` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/_md.js:77` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `includes` | `[native code]` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `assertPasswordNotTooLong` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/utils/password.mjs:13` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:19` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `async resolveAccountDbPath` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:343` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/ua-parser-js/ua-parser.js` |
| 0.0% | 2.4ms | 0.0% | 17.9ms | `topicSuggestionSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:103` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `async getUserById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/users.ts:72` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `mapUserRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:61` |
| 0.0% | 2.3ms | 0.0% | 6.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:159` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:705` |
| 0.0% | 2.3ms | 0.1% | 45.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:371` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `genShake` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha3.js` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `Log` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/log.js` |
| 0.0% | 2.3ms | 0.0% | 3.4ms | `async getDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:293` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `Headers` | `[native code]` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:80` |
| 0.0% | 2.3ms | 0.0% | 24.6ms | `mapAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:153` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `listSenderIdentityRows` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/senderIdentities.ts` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `async createInternalContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:7` |
| 0.0% | 2.3ms | 0.0% | 8.3ms | `async findOne` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:504` |
| 0.0% | 2.3ms | 0.0% | 3.6ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2249` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:242` |
| 0.0% | 2.3ms | 0.0% | 25.9ms | `Decipheriv2` | `node:crypto:313` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `/\s/` | `[native code]` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:13` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:288` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `open` | `[native code]` |
| 0.0% | 2.3ms | 0.8% | 330.8ms | `insert` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/ftsIdentity.ts:88` |
| 0.0% | 2.3ms | 0.0% | 9.7ms | `walkAddressList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1203` |
| 0.0% | 2.3ms | 0.0% | 3.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:79` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `ensureCalendarEventOptionalColumns` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:444` |
| 0.0% | 2.3ms | 0.0% | 3.3ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2293` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:157` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `displayDayNumber` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/well-known/index.js:11` |
| 0.0% | 2.2ms | 0.0% | 4.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:366` |
| 0.0% | 2.2ms | 1.1% | 412.9ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:578` |
| 0.0% | 2.2ms | 0.0% | 7.0ms | `async runBeforeHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:79` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `init` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:52` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `Statement` | `bun:sqlite:109` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `_getEnv` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/env-impl.mjs` |
| 0.0% | 2.2ms | 0.0% | 5.8ms | `getOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:56` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `install` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/storage.ts` |
| 0.0% | 2.2ms | 0.0% | 8.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:589` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:23` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:560` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:394` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2224` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `async ensureCalendarEventRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:663` |
| 0.0% | 2.2ms | 0.1% | 43.9ms | `async enrichMessagesWithThreadCollab` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadCollab.ts:8` |
| 0.0% | 2.2ms | 0.0% | 5.6ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:442` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `push` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 2.2ms | 0.3% | 132.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:57` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:103` |
| 0.0% | 2.1ms | 0.0% | 7.9ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:821` |
| 0.0% | 2.1ms | 0.0% | 3.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:458` |
| 0.0% | 2.1ms | 1.3% | 516.8ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/tracer.mjs:37` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:147` |
| 0.0% | 2.1ms | 0.1% | 45.4ms | `_recoverAddrSpec` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:367` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts` |
| 0.0% | 2.1ms | 0.0% | 4.3ms | `fsyncSync` | `[native code]` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:5` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2661` |
| 0.0% | 2.1ms | 2.4% | 901.8ms | `bound require` | `[native code]` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `sqliteIntegerPrimaryKeyColumn` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:20` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `roleAtLeast` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/accountRole.ts:5` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:164` |
| 0.0% | 2.1ms | 0.0% | 27.7ms | `buildTimeGroupKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageGrouping.ts:42` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authPolicyHandler.ts:289` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `async getThreadGroupCounts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1402` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `get` | `/tmp/spike-switch-server/inspect.ts` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `sortGroupsForGroupBy` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageGrouping.ts:96` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `async deleteWithHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/with-hooks.mjs` |
| 0.0% | 2.0ms | 0.0% | 3.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/tracer.mjs:38` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `custom` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `getSharedDbHarnessState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testDbHarness.ts` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `next` | `[native code]` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:83` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:77` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `transformJoinClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:296` |
| 0.0% | 1.9ms | 2.2% | 851.8ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:604` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:855` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `hydrateIdentityMetadata` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/identityMetadata.ts:8` |
| 0.0% | 1.9ms | 0.0% | 2.9ms | `header` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testAuthHarness.ts:79` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `resolve` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-model-name.mjs:17` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authPolicyHandler.ts` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `LocalBaseBlock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:201` |
| 0.0% | 1.7ms | 0.0% | 2.9ms | `getAuthTablesWithResolvedIndexes` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/get-tables.mjs:289` |
| 0.0% | 1.7ms | 0.0% | 1.7ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/transaction.mjs:7` |
| 0.0% | 1.7ms | 0.0% | 2.9ms | `async lock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:81` |
| 0.0% | 1.7ms | 0.0% | 1.7ms | `async stageMessageFiles` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/storage.ts:233` |
| 0.0% | 1.7ms | 0.0% | 1.7ms | `splice` | `[native code]` |
| 0.0% | 1.6ms | 0.0% | 24.5ms | `async provideConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/default-connection-provider.js:13` |
| 0.0% | 1.5ms | 0.0% | 1.5ms | `ZodDate` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:95` |
| 0.0% | 1.5ms | 0.0% | 1.5ms | `create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/binary-operation-node.js:11` |
| 0.0% | 1.5ms | 0.0% | 20.8ms | `getTopicSuggestionSignalsForThreadsFromDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:181` |
| 0.0% | 1.5ms | 0.0% | 1.5ms | `getOwnPropertyDescriptor` | `[native code]` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `async #transformResult` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/oauth-popup/index.mjs:98` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `applySearchQueryFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:717` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:31` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/checks.js:9` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `async findOne` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `initAccountSchemaBody` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `async migrateAuthSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts` |
| 0.0% | 1.4ms | 0.0% | 3.4ms | `async validateAccountFolders` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/folderAccount.ts:12` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `transformJoinClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:282` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `append` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:1332` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `async executeQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js` |
| 0.0% | 1.4ms | 0.0% | 2.4ms | `chachaCore` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:102` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `getHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:165` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `ValidationError` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/error.mjs` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `finalize` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_poly1305.js` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `charAt` | `[native code]` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:93` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `rmSync` | `[native code]` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `now` | `[native code]` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/memoizer.js` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `deriveSystemFlagState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:322` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:22` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async getCurrentRequestState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:19` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async stageMessageFiles` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/storage.ts:230` |
| 0.0% | 1.3ms | 0.0% | 3.8ms | `NextResponse` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:42` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `chachaCore` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:75` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `normalizeSearchTermList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:525` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/react/cjs/react.development.js` |
| 0.0% | 1.3ms | 0.5% | 199.4ms | `extractEmailAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:22` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async getAccountIdFromParams` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/accountContext.ts` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:277` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:110` |
| 0.0% | 1.3ms | 0.0% | 14.7ms | `normalizeAccountSettings` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/accountSettings.ts:5` |
| 0.0% | 1.3ms | 0.0% | 2.5ms | `find` | `[native code]` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async verifyTwoFactor` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/verify-two-factor.mjs` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `getOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sanitize-html/node_modules/htmlparser2/node_modules/domutils/node_modules/dom-serializer/dist/foreign-names.js:14` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:231` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `getAuthTablesWithResolvedIndexes` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/get-tables.mjs` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/dom-serializer/node_modules/entities/lib/esm/generated/decode-data-html.js:6` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `__getBetterAuthGlobal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/global.mjs` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:161` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `looksLikeJiraMessage` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:30` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async getMigrations` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/mail/categorization/linearModel.ts:53` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `parseTable` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/table-parser.js:39` |
| 0.0% | 1.3ms | 0.0% | 16.4ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:572` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:56` |
| 0.0% | 1.3ms | 0.8% | 319.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:75` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `addColumn` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/schema/create-table-builder.js` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `init` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:74` |
| 0.0% | 1.3ms | 0.0% | 19.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js:2` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:151` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/index.mjs` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async updateWithHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/with-hooks.mjs` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:35` |
| 0.0% | 1.2ms | 0.0% | 3.7ms | `applyExcludedFolderFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:908` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `WeakReference` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `normalizeAccountSettings` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/accountSettings.ts` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/parse5/dist/common/foreign-content.js` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/operator-node.js:116` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:69` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async acquireConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:43` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `mapAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:179` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2326` |
| 0.0% | 1.2ms | 0.0% | 2.4ms | `parseStringReference` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js:48` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `deepmergeIntoFastUnsafeCustom` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/deepmerge-ts/dist/index.mjs` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:26` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `NameIdentifier` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:253` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` |
| 0.0% | 1.2ms | 12.5% | 4.65s | `flush` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:208` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `sortGroupsForGroupBy` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageGrouping.ts:107` |
| 0.0% | 1.2ms | 0.0% | 2.3ms | `async runWithRequestState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:24` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `createWithSpan` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/tracer.mjs` |
| 0.0% | 1.2ms | 0.1% | 57.8ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/core.ts:194` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `add` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:65` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `unlock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:87` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:18` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async assertAccountFolder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/folderAccountGuard.ts:6` |
| 0.0% | 1.2ms | 0.0% | 7.6ms | `update` | `node:crypto:338` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/htmlparser2/node_modules/entities/dist/esm/decode.js` |
| 0.0% | 1.2ms | 0.0% | 3.9ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs:41` |
| 0.0% | 1.2ms | 0.0% | 3.6ms | `async ensureCalendarEventRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:661` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `keys` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async getThreadCollabStates` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/threadCollab.ts:42` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-field-name.mjs:21` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `parseValueBinaryOperation` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/binary-operation-parser.js:22` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:103` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:158` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `applyVisibleMessageFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2320` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `prepareFtsIdentityWriter` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/ftsIdentity.ts:75` |
| 0.0% | 1.2ms | 0.0% | 5.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-attributes.mjs:24` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `Error` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/middleware.mjs` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `u8to16` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_poly1305.js` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `normalizeAccountSettings` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/accountSettings.ts:16` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `object` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:904` |
| 0.0% | 1.2ms | 0.9% | 351.7ms | `selectFrom` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-creator.js:135` |
| 0.0% | 1.2ms | 0.2% | 106.2ms | `bound visitSelectQuery` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `fireTriggers` | `/tmp/spike-switch-server/sqlcounter.ts` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `setName` | `node:fs:675` |
| 0.0% | 1.2ms | 0.0% | 2.4ms | `getTopicSuggestionSignalsForThreadsFromDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:180` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/tools.js:30` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `expireLegacyCookie` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authCookies.ts:3` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `Libmime` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/libmime.js` |
| 0.0% | 1.2ms | 0.0% | 15.1ms | `cloneWithSelections` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/select-query-node.js:31` |
| 0.0% | 1.2ms | 0.0% | 2.4ms | `getColorDepth` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs:49` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `getHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `createSelectAll` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/reference-node.js` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/doc.js:27` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:591` |
| 0.0% | 1.2ms | 0.0% | 13.6ms | `async getTopicSuggestionsForThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:682` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:714` |
| 0.0% | 1.2ms | 3.5% | 1.29s | `flush` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:43` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/he/he.js:31` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `checkEndpointConflicts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/index.mjs:51` |
| 0.0% | 1.2ms | 0.0% | 2.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:664` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async getThreadGroupCounts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1380` |
| 0.0% | 1.2ms | 0.1% | 50.9ms | `mapAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:185` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:404` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:38` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async handleFallbackJoin` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:345` |
| 0.0% | 1.2ms | 0.0% | 10.6ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs:52` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `readNgramReferences` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/internal/decode-shared.js` |
| 0.0% | 1.2ms | 0.0% | 3.4ms | `has` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/env-impl.mjs:9` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `toASN` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js:45` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/value-node.js` |
| 0.0% | 1.2ms | 0.0% | 3.5ms | `async getTopicsForThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/core.ts:191` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@zone-eu/mailsplit/lib/message-splitter.js:86` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `toOperationNode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async getMessageCalendarInviteDataByMessageId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `getStore` | `node:async_hooks:168` |
| 0.0% | 1.2ms | 14.3% | 5.30s | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:687` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async getMessageCalendarInviteDataByMessageId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:201` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `headers` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/headers.js:90` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `isObject` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `topicSuggestionSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `parseSearchInput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:601` |
| 0.0% | 1.2ms | 0.0% | 2.4ms | `toOperationNode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:385` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `fromBER` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js` |
| 0.0% | 1.2ms | 0.0% | 7.5ms | `reduce` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `TextEncoder` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `getTime` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `toLowerCase` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `createAuthEndpoint` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/api/index.mjs` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:877` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `getFieldName` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-name.mjs:26` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2601` |
| 0.0% | 1.2ms | 0.0% | 9.4ms | `async validateAccountFolders` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/folderAccount.ts:17` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `getKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/secret.ts` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `Libmime` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/esm/libmime.js` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async #transformResult` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:164` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `get` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/index.js:8` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `shouldSearchAttachmentFilenames` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts` |
| 0.0% | 1.2ms | 12.9% | 4.77s | `getTopicSuggestionSignalsForThreadsFromDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:214` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `WriteStream` | `internal:fs/streams` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:847` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `defineRequestState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async getDatabaseIndexMap` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/core.ts:203` |
| 0.0% | 1.1ms | 0.2% | 99.9ms | `collectTopicSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:60` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `resolvePromiseWithFirstResolvingFunctionCallCheck` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `restoreDiff` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/dom-serializer/node_modules/entities/lib/esm/generated/encode-html.js` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `guards` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `Uint8Array` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async getThreadGroupCounts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:28` |
| 0.0% | 1.1ms | 16.4% | 6.08s | `flush` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:45` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async transformOutput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:145` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async runWithRequestState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs` |
| 0.0% | 1.1ms | 0.7% | 284.5ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:201` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:243` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async releaseConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/libmime.js` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `clampThreadListPageSize` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:21` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:105` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `ahead` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/peberminta/lib/core.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `Statement` | `bun:sqlite` |
| 0.0% | 1.1ms | 5.9% | 2.19s | `upsertBatch` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:365` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:38` |
| 0.0% | 1.1ms | 0.0% | 24.8ms | `Tokenizer` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:806` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:30` |
| 0.0% | 1.1ms | 0.0% | 8.0ms | `from` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `flush` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `NextResponse` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:40` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async createInternalContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `looksLikeJiraMessage` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:27` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `clean` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/utils.js` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `isPlainObject` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/defu/dist/defu.mjs:12` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `mapUserRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts` |
| 0.0% | 1.1ms | 0.0% | 4.8ms | `topicSuggestionSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:105` |
| 0.0% | 1.1ms | 3.6% | 1.36s | `ownAddressList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:69` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `toOperationNode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/raw-builder/raw-builder.js:36` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `removeUser` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:158` |
| 0.0% | 1.1ms | 0.0% | 3.5ms | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1360` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `migrate` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accountKeys.ts` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `createExpressionBuilder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:25` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `bound check` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/defu/dist/defu.mjs:52` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:34` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `trim` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js:92` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/defu/dist/defu.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `encode` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs` |
| 0.0% | 1.1ms | 0.0% | 5.4ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:13` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async lock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `getCookie` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:152` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `ExpressionWrapper` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-wrapper.js:11` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:200` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `charCodeAt` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `parseExpression` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/expression-parser.js:7` |
| 0.0% | 1.1ms | 0.0% | 6.5ms | `async requireAccountContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/accountContext.ts:55` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async getThreadGroupCounts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1394` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1009` |
| 0.0% | 1.1ms | 0.0% | 2.2ms | `bound optional` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `mapAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:190` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `query` | `bun:sqlite` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `#get` | `bun:sqlite:174` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:50` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `decodeSecret` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/secret.ts:69` |
| 0.0% | 1.1ms | 0.0% | 23.2ms | `async executeQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:38` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `mapAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:151` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:119` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `startActiveSpan` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/noop.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `_collapseAtSpacing` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:276` |
| 0.0% | 1.1ms | 0.0% | 23.7ms | `async getAccountOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/senderIdentities.ts:22` |
| 0.0% | 1.1ms | 0.0% | 24.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:272` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/reference-node.js:12` |
| 0.0% | 1.1ms | 7.3% | 2.71s | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2614` |
| 0.0% | 1.1ms | 0.0% | 10.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:539` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts` |
| 0.0% | 1.1ms | 4.5% | 1.68s | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2476` |
| 0.0% | 1.1ms | 0.0% | 24.5ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:153` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `compileQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:23` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:3136` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `final` | `[native code]` |
| 0.0% | 1.1ms | 5.6% | 2.07s | `async getThreadGroupCounts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1398` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `internal:streams/state` | `internal:streams/state` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async readAuthJson` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/readAuthJson.ts:10` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `compileList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:134` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async getDatabaseColumnBounds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `applyAddressSearchFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:565` |
| 0.0% | 1.1ms | 0.0% | 3.0ms | `normalizeShardSql` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/ftsIdentity.ts:2` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:225` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `run` | `node:async_hooks` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `bound visitCreateTable` | `[native code]` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `readGap` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/encode.js:41` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `node:crypto` | `node:crypto:98` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/senderIdentities.ts` |
| 0.0% | 1.0ms | 1.0% | 388.9ms | `getTopicSuggestionSignalsForThreadsFromDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:198` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:2107` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `visitNode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/operation-node-visitor.js:113` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-field-name.mjs:22` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `getHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:138` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `applyExcludedFolderFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts` |
| 0.0% | 1.0ms | 0.0% | 8.0ms | `async withAuthResponse` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:51` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `sqliteIntegerPrimaryKeyColumn` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `loadNextHeadersModule` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:27` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `scheduleAccountDbIdleClose` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:253` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `requireJsonSameOrigin` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/requestOrigin.ts:20` |
| 0.0% | 1.0ms | 0.4% | 182.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:588` |
| 0.0% | 1.0ms | 0.0% | 2.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:372` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `normalizeImapFlags` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageFlags.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/update-user.mjs:95` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async get` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `registerDbShutdownHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:285` |
| 0.0% | 1.0ms | 0.0% | 16.7ms | `topicSuggestionSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:104` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `unquoteCookieValue` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/cookie-utils.mjs:125` |
| 0.0% | 1.0ms | 1.9% | 727.8ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:88` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `normalizeCalendarEventUidKeys` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/calendarEventUids.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `Statement` | `bun:sqlite:115` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `applyAddressSearchFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:542` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `topicSuggestionSignalsFromEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts` |
| 0.0% | 1.0ms | 0.0% | 2.3ms | `getColorDepth` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs:59` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2626` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `createAccessControl` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/access/access.mjs` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `rotl` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_arx.js:65` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `isRecursive` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/memoizer.js:66` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `cloneWithWhere` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/query-node.js` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:423` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:36` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `normalizeCalendarEventUids` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/calendarEventUids.ts:18` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `utilToBase` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pvutils/build/utils.js:89` |
| 0.0% | 1.0ms | 0.0% | 2.1ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2530` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `members` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:740` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/signed_data.js:25` |
| 0.0% | 1.0ms | 7.7% | 2.86s | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2465` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-model-name.mjs` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `createRandomStringGenerator` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/utils/dist/random.mjs:12` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `applySearchQueryFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:713` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `runtimeSchemaCheckFor` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema-check.mjs` |
| 0.0% | 1.0ms | 2.4% | 894.1ms | `require` | `[native code]` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `defaultThreadCollabState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts` |
| 0.0% | 1.0ms | 0.0% | 2.0ms | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1274` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authPolicyHandler.ts:287` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async createAuthContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/create-context.mjs` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/mail/categorization/linearModel.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/utf8-to-jis-table.js:6` |
| 0.0% | 1.0ms | 0.0% | 3.3ms | `getThreadCollabStates` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts:78` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `write` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js` |
| 0.0% | 1.0ms | 0.3% | 116.2ms | `getTopicSuggestionsForThreadSignalBatch` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:581` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:17` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `quote` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:45` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `hasFlag` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:316` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `decodeTrieDict` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/internal/decode-shared.js:175` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/sign-in.mjs` |
| 0.0% | 1.0ms | 1.3% | 491.8ms | `async findOne` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:526` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `internal:streams/writable` | `internal:streams/writable:14` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `applyAddressSearchFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:548` |
| 0.0% | 1.0ms | 0.7% | 269.8ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:74` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `getThreadCollabStates` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts:73` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `installLazyProp` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:847` |
| 0.0% | 1.0ms | 1.5% | 571.8ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:655` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `node:_http_server` | `node:_http_server:3` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `toArrayBuffer` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pvtsutils/build/index.js:34` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async transformInput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/api/index.mjs` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `parseAddressEmails` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:35` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/core.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async assertAccountFolder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/folderAccountGuard.ts` |
| 0.0% | 1.0ms | 0.0% | 7.8ms | `getHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:157` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accounts.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:160` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:553` |
| 0.0% | 1.0ms | 0.0% | 6.3ms | `(anonymous)` | `/tmp/spike-switch-server/fixture.ts:60` |
| 0.0% | 1.0ms | 0.0% | 10.3ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:102` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:543` |
| 0.0% | 1.0ms | 16.2% | 6.01s | `async withAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:413` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:13` |
| 0.0% | 1.0ms | 2.7% | 1.01s | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2507` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:193` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `_collectAddressParts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:562` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:51` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async update` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `_isAddrSpec` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async getCurrentAdapter` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/transaction.mjs:27` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `bound visitParens` | `[native code]` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/decorators.js:50` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `extractJiraProjectKeys` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `bun:sqlite` | `bun:sqlite:228` |
| 0.0% | 999us | 0.0% | 999us | `cookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/cookies.js` |
| 0.0% | 998us | 0.0% | 998us | `dlopen` | `[native code]` |
| 0.0% | 998us | 0.5% | 203.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:563` |
| 0.0% | 994us | 0.0% | 994us | `add` | `[native code]` |
| 0.0% | 993us | 0.0% | 993us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:157` |
| 0.0% | 992us | 0.0% | 992us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:535` |
| 0.0% | 992us | 0.0% | 12.8ms | `async getSignedCookie` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:48` |
| 0.0% | 991us | 0.0% | 991us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts` |
| 0.0% | 991us | 0.0% | 991us | `async upsertMessages` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts` |
| 0.0% | 989us | 0.0% | 989us | `ensureThreadRuntimeSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts` |
| 0.0% | 988us | 0.0% | 988us | `managedNonce` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/utils.js` |
| 0.0% | 987us | 0.0% | 987us | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:38` |
| 0.0% | 981us | 0.0% | 981us | `get source` | `[native code]` |
| 0.0% | 981us | 0.2% | 86.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:704` |
| 0.0% | 981us | 0.0% | 981us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:378` |
| 0.0% | 979us | 0.0% | 979us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:166` |
| 0.0% | 978us | 0.0% | 978us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:619` |
| 0.0% | 978us | 0.1% | 45.7ms | `async ensureCalendarEventRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:660` |
| 0.0% | 976us | 0.0% | 976us | `debugLog` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` |
| 0.0% | 974us | 0.0% | 974us | `CreateTableBuilder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/schema/create-table-builder.js:26` |
| 0.0% | 973us | 0.0% | 973us | `collectTopicSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:64` |
| 0.0% | 972us | 0.0% | 2.8ms | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1288` |
| 0.0% | 972us | 0.0% | 972us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:662` |
| 0.0% | 971us | 0.0% | 3.1ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2583` |
| 0.0% | 971us | 0.0% | 971us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:2118` |
| 0.0% | 971us | 0.0% | 971us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/parse5/dist/common/token.js` |
| 0.0% | 970us | 0.0% | 970us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:148` |
| 0.0% | 970us | 0.0% | 970us | `/[\s";]+/g` | `[native code]` |
| 0.0% | 966us | 0.0% | 966us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs` |
| 0.0% | 966us | 0.0% | 19.1ms | `async acquireConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:53` |
| 0.0% | 965us | 0.0% | 5.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:71` |
| 0.0% | 964us | 0.0% | 964us | `async getAccountOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/senderIdentities.ts` |
| 0.0% | 958us | 0.0% | 11.8ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:350` |
| 0.0% | 958us | 0.0% | 958us | `parseSearchInput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts` |
| 0.0% | 956us | 0.0% | 8.7ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2243` |
| 0.0% | 953us | 0.0% | 953us | `async requireAccountContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/accountContext.ts:63` |
| 0.0% | 953us | 0.0% | 953us | `replace` | `[native code]` |
| 0.0% | 953us | 16.4% | 6.08s | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:46` |
| 0.0% | 953us | 0.0% | 953us | `async getUserById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/users.ts` |
| 0.0% | 953us | 0.0% | 953us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/middleware.mjs:7` |
| 0.0% | 951us | 0.0% | 951us | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/cookie-utils.mjs:159` |
| 0.0% | 949us | 0.0% | 949us | `AsnType` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/decorators.js:8` |
| 0.0% | 948us | 0.0% | 8.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts:72` |
| 0.0% | 948us | 0.0% | 948us | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:768` |
| 0.0% | 940us | 0.0% | 940us | `parseSearchInput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:657` |
| 0.0% | 938us | 0.0% | 938us | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1344` |
| 0.0% | 937us | 0.0% | 2.8ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2708` |
| 0.0% | 934us | 0.0% | 934us | `lookup` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/ftsIdentity.ts` |
| 0.0% | 934us | 0.0% | 29.3ms | `mapAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:177` |
| 0.0% | 930us | 0.0% | 18.7ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:224` |
| 0.0% | 930us | 0.0% | 930us | `getFieldName` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-name.mjs` |
| 0.0% | 930us | 0.0% | 930us | `buildScopedFtsTokenQueries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:476` |
| 0.0% | 923us | 0.0% | 14.0ms | `bound visitReference` | `[native code]` |
| 0.0% | 919us | 0.0% | 919us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/imapflow/dist/esm/charsets.js:275` |
| 0.0% | 899us | 0.0% | 899us | `part` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts` |

## Call Tree (Total Time)

| Total% | Total | Self% | Self | Function | Location |
|-------:|------:|------:|-----:|----------|----------|
| 60.4% | 22.38s | 0.2% | 75.8ms | `forEach` | `[native code]` |
| 57.2% | 21.19s | 0.0% | 23.1ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:82` |
| 24.4% | 9.06s | 24.4% | 9.06s | `run` | `[native code]` |
| 23.5% | 8.71s | 23.5% | 8.71s | `all` | `[native code]` |
| 22.9% | 8.50s | 0.0% | 3.3ms | `#run` | `bun:sqlite:195` |
| 19.9% | 7.38s | 0.0% | 0us | `insertThreadSignalsFromMessageRows` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:50` |
| 19.9% | 7.38s | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:54` |
| 19.2% | 7.11s | 0.0% | 17.9ms | `flatIntoArrayWithCallback` | `[native code]` |
| 16.5% | 6.11s | 0.1% | 49.1ms | `flatMap` | `[native code]` |
| 16.4% | 6.08s | 0.0% | 1.1ms | `flush` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:45` |
| 16.4% | 6.08s | 0.0% | 953us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:46` |
| 16.2% | 6.01s | 0.0% | 1.0ms | `async withAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:413` |
| 15.6% | 5.79s | 0.0% | 0us | `async rebuildThreadSignalsForThreadIds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:114` |
| 15.0% | 5.56s | 0.0% | 0us | `rebuildThreadSignalsForThreadIdsInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:105` |
| 14.3% | 5.30s | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:687` |
| 12.9% | 4.77s | 0.0% | 1.2ms | `getTopicSuggestionSignalsForThreadsFromDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:214` |
| 12.6% | 4.69s | 0.0% | 7.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:218` |
| 12.5% | 4.65s | 0.0% | 1.2ms | `flush` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:208` |
| 12.3% | 4.56s | 0.1% | 53.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:165` |
| 12.1% | 4.50s | 0.6% | 255.1ms | `map` | `[native code]` |
| 10.5% | 3.89s | 0.0% | 0us | `topicSuggestionEntriesFromThreadSignalRows` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:161` |
| 10.4% | 3.85s | 10.3% | 3.84s | `get` | `[native code]` |
| 7.7% | 2.86s | 0.0% | 1.0ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2465` |
| 7.3% | 2.71s | 0.0% | 1.1ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2614` |
| 7.2% | 2.67s | 0.0% | 0us | `shouldIgnoreTopicSuggestionSignal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:123` |
| 6.7% | 2.51s | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:720` |
| 6.7% | 2.51s | 0.0% | 3.0ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2587` |
| 6.7% | 2.50s | 0.0% | 5.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2671` |
| 6.2% | 2.30s | 0.0% | 0us | `parseAddressEmails` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:45` |
| 6.0% | 2.24s | 0.0% | 9.4ms | `isOwnAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:62` |
| 6.0% | 2.23s | 0.0% | 0us | `transaction` | `bun:sqlite:447` |
| 6.0% | 2.22s | 0.0% | 0us | `buildGroupKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:71` |
| 5.9% | 2.19s | 0.0% | 1.1ms | `upsertBatch` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:365` |
| 5.9% | 2.19s | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:751` |
| 5.7% | 2.13s | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2684` |
| 5.6% | 2.07s | 0.0% | 1.1ms | `async getThreadGroupCounts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1398` |
| 4.9% | 1.85s | 0.0% | 0us | `async rebuildAllThreadSignalsForAccount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:136` |
| 4.9% | 1.83s | 0.0% | 0us | `rebuildAllThreadSignalsForAccountInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:131` |
| 4.9% | 1.82s | 0.0% | 23.6ms | `displayDayNumber` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts:41` |
| 4.8% | 1.79s | 4.8% | 1.79s | `formatToParts` | `[native code]` |
| 4.5% | 1.68s | 0.0% | 1.1ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2476` |
| 4.3% | 1.62s | 0.0% | 0us | `buildMessageGroupKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageGrouping.ts:74` |
| 4.0% | 1.49s | 0.1% | 46.7ms | `addressparser` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1199` |
| 3.9% | 1.46s | 0.0% | 0us | `shouldIgnoreTopicSuggestionSignal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:117` |
| 3.6% | 1.36s | 0.0% | 1.1ms | `ownAddressList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:69` |
| 3.6% | 1.33s | 0.0% | 11.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:69` |
| 3.5% | 1.31s | 0.0% | 15.0ms | `isOwnAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:61` |
| 3.5% | 1.29s | 0.0% | 1.2ms | `flush` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:43` |
| 3.4% | 1.29s | 0.9% | 340.5ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:14` |
| 3.1% | 1.18s | 0.0% | 0us | `collectTopicSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:73` |
| 3.1% | 1.16s | 0.0% | 2.5ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:96` |
| 3.1% | 1.16s | 0.0% | 0us | `prepare` | `bun:sqlite:366` |
| 3.1% | 1.15s | 3.1% | 1.15s | `prepare` | `[native code]` |
| 2.9% | 1.08s | 1.0% | 394.7ms | `anonymous` | `[native code]` |
| 2.8% | 1.03s | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:39` |
| 2.7% | 1.01s | 0.0% | 1.0ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2507` |
| 2.5% | 953.5ms | 2.5% | 953.5ms | `URL` | `[native code]` |
| 2.5% | 935.1ms | 0.0% | 23.1ms | `_parseAddressList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1155` |
| 2.4% | 901.8ms | 0.0% | 2.1ms | `bound require` | `[native code]` |
| 2.4% | 894.1ms | 0.0% | 1.0ms | `require` | `[native code]` |
| 2.2% | 851.8ms | 0.0% | 1.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:604` |
| 2.2% | 833.1ms | 0.0% | 14.7ms | `buildMessageGroupKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageGrouping.ts:71` |
| 2.2% | 825.5ms | 0.0% | 0us | `buildTimeGroupKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageGrouping.ts:43` |
| 2.2% | 816.2ms | 0.2% | 93.2ms | `buildTimeGroupKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageGrouping.ts:44` |
| 2.1% | 792.6ms | 0.1% | 37.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:46` |
| 2.1% | 789.4ms | 0.4% | 150.3ms | `tokenize` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:836` |
| 1.9% | 727.8ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:88` |
| 1.8% | 690.9ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:97` |
| 1.8% | 683.9ms | 0.0% | 0us | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1359` |
| 1.6% | 598.4ms | 0.0% | 0us | `json` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:91` |
| 1.6% | 598.4ms | 1.6% | 598.4ms | `json` | `[native code]` |
| 1.5% | 587.4ms | 1.5% | 587.4ms | `checkChar` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:989` |
| 1.5% | 571.8ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:655` |
| 1.4% | 524.3ms | 0.0% | 0us | `async provideConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/default-connection-provider.js:10` |
| 1.3% | 516.8ms | 0.0% | 2.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/tracer.mjs:37` |
| 1.3% | 511.3ms | 0.0% | 34.2ms | `filter` | `[native code]` |
| 1.3% | 497.3ms | 1.3% | 497.3ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:17` |
| 1.3% | 491.8ms | 0.0% | 1.0ms | `async findOne` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:526` |
| 1.3% | 490.7ms | 0.0% | 13.7ms | `_parseAddressList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1181` |
| 1.3% | 486.2ms | 0.9% | 345.9ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:16` |
| 1.3% | 485.7ms | 0.0% | 0us | `async findOne` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:598` |
| 1.2% | 467.0ms | 0.0% | 0us | `#runNoArgs` | `bun:sqlite:163` |
| 1.1% | 428.5ms | 1.1% | 428.5ms | `Set` | `[native code]` |
| 1.1% | 412.9ms | 0.0% | 2.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:578` |
| 1.0% | 403.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:440` |
| 1.0% | 388.9ms | 0.0% | 1.0ms | `getTopicSuggestionSignalsForThreadsFromDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:198` |
| 0.9% | 367.3ms | 0.9% | 367.3ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:9` |
| 0.9% | 366.4ms | 0.0% | 0us | `transaction` | `bun:sqlite:451` |
| 0.9% | 351.7ms | 0.0% | 1.2ms | `selectFrom` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-creator.js:135` |
| 0.9% | 350.6ms | 0.0% | 0us | `parseTableExpressionOrList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/table-parser.js:13` |
| 0.9% | 347.1ms | 0.0% | 0us | `async findOne` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:505` |
| 0.9% | 346.3ms | 0.0% | 0us | `async withDbWriteRetry` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/dbWriteRetry.ts:117` |
| 0.9% | 346.3ms | 0.0% | 0us | `async withDbWriteRetry` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/dbWriteRetry.ts:66` |
| 0.9% | 343.7ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2608` |
| 0.9% | 338.1ms | 0.0% | 0us | `parseAliasedExpression` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/expression-parser.js:20` |
| 0.9% | 336.1ms | 0.0% | 14.9ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:355` |
| 0.8% | 330.8ms | 0.0% | 2.3ms | `insert` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/ftsIdentity.ts:88` |
| 0.8% | 328.7ms | 0.1% | 64.6ms | `displayDayNumber` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts:43` |
| 0.8% | 319.2ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:75` |
| 0.7% | 295.1ms | 0.0% | 0us | `async getAccountById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accounts.ts:82` |
| 0.7% | 290.8ms | 0.0% | 0us | `executeQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:62` |
| 0.7% | 284.5ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:201` |
| 0.7% | 279.8ms | 0.0% | 0us | `async recomputeThreadsForAccountInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:318` |
| 0.7% | 278.3ms | 0.0% | 0us | `getTopicSuggestionsForThreadSignalBatch` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:559` |
| 0.7% | 269.8ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:74` |
| 0.6% | 252.0ms | 0.6% | 246.0ms | `parseAddressEmails` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:25` |
| 0.6% | 243.9ms | 0.0% | 0us | `visitNode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/operation-node-visitor.js:112` |
| 0.6% | 243.0ms | 0.6% | 243.0ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:12` |
| 0.6% | 239.9ms | 0.0% | 9.6ms | `insert` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/ftsIdentity.ts:87` |
| 0.6% | 223.4ms | 0.0% | 3.5ms | `async getAccountById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accounts.ts:85` |
| 0.5% | 213.8ms | 0.5% | 212.5ms | `part` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts:42` |
| 0.5% | 211.2ms | 0.0% | 0us | `shouldIgnoreTopicSuggestionSignal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:134` |
| 0.5% | 209.1ms | 0.0% | 0us | `async getThreadCollabStates` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/threadCollab.ts:44` |
| 0.5% | 203.9ms | 0.0% | 998us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:563` |
| 0.5% | 202.1ms | 0.0% | 12.1ms | `ownAddressList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:68` |
| 0.5% | 199.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:87` |
| 0.5% | 199.4ms | 0.0% | 1.3ms | `extractEmailAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:22` |
| 0.5% | 190.6ms | 0.0% | 10.6ms | `formatTransactionId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:865` |
| 0.5% | 189.1ms | 0.0% | 18.6ms | `displayDayNumber` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts:39` |
| 0.4% | 182.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testAuthHarness.ts:166` |
| 0.4% | 182.1ms | 0.4% | 182.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testAuthHarness.ts` |
| 0.4% | 182.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:588` |
| 0.4% | 175.2ms | 0.0% | 0us | `selectAll` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:128` |
| 0.4% | 174.1ms | 0.4% | 174.1ms | `getEnvVar` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/env-impl.mjs:41` |
| 0.4% | 172.9ms | 0.0% | 0us | `async recomputeThreadsForAccountInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:356` |
| 0.4% | 170.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:513` |
| 0.4% | 166.5ms | 0.0% | 0us | `executeQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:60` |
| 0.4% | 165.5ms | 0.0% | 0us | `rebuildThreadSignalsForThreadIdsInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:86` |
| 0.4% | 163.7ms | 0.0% | 0us | `async transformInput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:143` |
| 0.4% | 163.7ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:445` |
| 0.4% | 163.7ms | 0.0% | 0us | `async createWithHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/with-hooks.mjs:26` |
| 0.4% | 163.7ms | 0.0% | 0us | `async create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:468` |
| 0.4% | 161.6ms | 0.4% | 161.6ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:106` |
| 0.4% | 161.4ms | 0.0% | 0us | `getColorDepth` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs:66` |
| 0.4% | 161.2ms | 0.4% | 161.2ms | `cached` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts:13` |
| 0.4% | 160.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/index.mjs:125` |
| 0.4% | 160.8ms | 0.0% | 0us | `cloneWithSelections` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/select-query-node.js:32` |
| 0.4% | 160.8ms | 0.4% | 160.8ms | `freeze` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/object-utils.js:63` |
| 0.4% | 160.8ms | 0.4% | 160.8ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:266` |
| 0.4% | 150.1ms | 0.0% | 0us | `async getMessageCalendarInviteDataByMessageId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:178` |
| 0.4% | 148.8ms | 0.0% | 0us | `every` | `[native code]` |
| 0.3% | 147.8ms | 0.0% | 3.5ms | `async getMessageCalendarInviteDataByMessageId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:192` |
| 0.3% | 141.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:196` |
| 0.3% | 140.2ms | 0.3% | 114.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:16` |
| 0.3% | 139.8ms | 0.0% | 0us | `async handleFallbackJoin` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:395` |
| 0.3% | 136.3ms | 0.0% | 2.4ms | `getOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:57` |
| 0.3% | 135.7ms | 0.0% | 0us | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:682` |
| 0.3% | 134.5ms | 0.3% | 134.5ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:7` |
| 0.3% | 132.7ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:57` |
| 0.3% | 129.3ms | 0.0% | 0us | `getTopicSuggestionsForThreadSignalBatch` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:617` |
| 0.3% | 125.7ms | 0.0% | 2.8ms | `async execute` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:319` |
| 0.3% | 120.5ms | 0.0% | 0us | `async getAccountById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accounts.ts:84` |
| 0.3% | 117.1ms | 0.0% | 17.4ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:660` |
| 0.3% | 116.2ms | 0.0% | 1.0ms | `getTopicSuggestionsForThreadSignalBatch` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:581` |
| 0.3% | 112.3ms | 0.0% | 4.6ms | `getThreadCollabStates` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts:76` |
| 0.2% | 109.8ms | 0.1% | 65.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2645` |
| 0.2% | 106.2ms | 0.0% | 1.2ms | `bound visitSelectQuery` | `[native code]` |
| 0.2% | 105.4ms | 0.0% | 0us | `async findOne` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:522` |
| 0.2% | 102.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:315` |
| 0.2% | 102.6ms | 0.0% | 0us | `async getDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:313` |
| 0.2% | 100.3ms | 0.0% | 0us | `async recomputeThreadsForAccountInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:283` |
| 0.2% | 99.9ms | 0.0% | 1.1ms | `collectTopicSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:60` |
| 0.2% | 99.1ms | 0.0% | 0us | `node:tls` | `node:tls:2` |
| 0.2% | 98.8ms | 0.2% | 98.8ms | `parseAddressEmails` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:42` |
| 0.2% | 98.1ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2540` |
| 0.2% | 97.1ms | 0.1% | 63.0ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:11` |
| 0.2% | 94.4ms | 0.0% | 0us | `async execute` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:317` |
| 0.2% | 94.3ms | 0.2% | 94.3ms | `_collectAddressParts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:561` |
| 0.2% | 93.5ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:703` |
| 0.2% | 92.8ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:627` |
| 0.2% | 92.4ms | 0.2% | 87.4ms | `json` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:92` |
| 0.2% | 90.4ms | 0.0% | 0us | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:765` |
| 0.2% | 89.6ms | 0.1% | 70.7ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:6` |
| 0.2% | 88.8ms | 0.0% | 0us | `run` | `bun:sqlite:318` |
| 0.2% | 88.8ms | 0.0% | 0us | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:112` |
| 0.2% | 88.7ms | 0.2% | 88.7ms | `Tokenizer` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.2% | 88.1ms | 0.0% | 0us | `listSenderIdentityRows` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/senderIdentities.ts:12` |
| 0.2% | 87.0ms | 0.0% | 4.3ms | `some` | `[native code]` |
| 0.2% | 86.5ms | 0.0% | 981us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:704` |
| 0.2% | 85.4ms | 0.1% | 42.9ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:10` |
| 0.2% | 81.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:367` |
| 0.2% | 81.0ms | 0.0% | 0us | `async getUserById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/users.ts:73` |
| 0.2% | 80.4ms | 0.2% | 79.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:62` |
| 0.2% | 79.9ms | 0.0% | 29.6ms | `(anonymous)` | `[native code]` |
| 0.2% | 79.1ms | 0.0% | 3.3ms | `decodeSecret` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/secret.ts:73` |
| 0.2% | 78.2ms | 0.0% | 0us | `shouldIgnoreTopicSuggestionSignal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:127` |
| 0.2% | 75.6ms | 0.0% | 0us | `compileQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:24` |
| 0.2% | 74.9ms | 0.0% | 3.3ms | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts:54` |
| 0.2% | 74.1ms | 0.0% | 0us | `readUserById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/users.ts:32` |
| 0.1% | 73.3ms | 0.0% | 0us | `async enrichMessagesWithThreadCollab` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadCollab.ts:18` |
| 0.1% | 73.3ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:95` |
| 0.1% | 73.1ms | 0.0% | 20.6ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:628` |
| 0.1% | 72.5ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:89` |
| 0.1% | 72.1ms | 0.1% | 72.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:215` |
| 0.1% | 71.0ms | 0.1% | 71.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:570` |
| 0.1% | 67.9ms | 0.0% | 3.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:603` |
| 0.1% | 66.0ms | 0.1% | 66.0ms | `Boolean` | `[native code]` |
| 0.1% | 65.8ms | 0.0% | 0us | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts:29` |
| 0.1% | 65.5ms | 0.1% | 65.5ms | `importModule` | `[native code]` |
| 0.1% | 64.7ms | 0.0% | 3.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/core.ts:200` |
| 0.1% | 62.8ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:507` |
| 0.1% | 62.3ms | 0.1% | 62.3ms | `copyDataProperties` | `[native code]` |
| 0.1% | 61.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:98` |
| 0.1% | 60.7ms | 0.1% | 60.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:566` |
| 0.1% | 60.0ms | 0.1% | 60.0ms | `entries` | `[native code]` |
| 0.1% | 58.9ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:810` |
| 0.1% | 58.2ms | 0.1% | 58.2ms | `normalizeEmailAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/senderIdentity.ts:61` |
| 0.1% | 58.2ms | 0.0% | 0us | `isFreeMailDomain` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/senderIdentity.ts:271` |
| 0.1% | 57.9ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/logger.mjs:78` |
| 0.1% | 57.9ms | 0.0% | 0us | `createLogger` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/logger.mjs:59` |
| 0.1% | 57.9ms | 0.1% | 57.9ms | `getColorDepth` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs` |
| 0.1% | 57.8ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/core.ts:194` |
| 0.1% | 56.9ms | 0.0% | 0us | `executeQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:63` |
| 0.1% | 56.3ms | 0.0% | 31.9ms | `slimThreadListItem` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:32` |
| 0.1% | 55.3ms | 0.1% | 55.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2666` |
| 0.1% | 54.9ms | 0.0% | 2.5ms | `run` | `node:async_hooks:144` |
| 0.1% | 54.5ms | 0.1% | 53.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:565` |
| 0.1% | 52.3ms | 0.0% | 0us | `async runWithEndpointContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/endpoint-context.mjs:45` |
| 0.1% | 52.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@zone-eu/mailsplit/lib/flowed-decoder.js:6` |
| 0.1% | 51.4ms | 0.0% | 0us | `where` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:38` |
| 0.1% | 51.3ms | 0.1% | 51.3ms | `getTopicSuggestionWeight` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:68` |
| 0.1% | 51.0ms | 0.1% | 51.0ms | `_collapseAtSpacing` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:273` |
| 0.1% | 50.9ms | 0.0% | 1.2ms | `mapAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:185` |
| 0.1% | 50.6ms | 0.0% | 0us | `rebuildThreadSignalsForThreadIdsInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:101` |
| 0.1% | 50.3ms | 0.1% | 50.3ms | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts:50` |
| 0.1% | 50.0ms | 0.1% | 47.7ms | `createExpressionBuilder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:32` |
| 0.1% | 49.8ms | 0.1% | 49.8ms | `cloneObject` | `[native code]` |
| 0.1% | 49.7ms | 0.0% | 0us | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:392` |
| 0.1% | 49.3ms | 0.1% | 49.3ms | `UTC` | `[native code]` |
| 0.1% | 48.6ms | 0.0% | 0us | `async ensureCalendarEventRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:675` |
| 0.1% | 48.2ms | 0.0% | 0us | `async getAccountOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/senderIdentities.ts:21` |
| 0.1% | 48.1ms | 0.0% | 0us | `compileList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:136` |
| 0.1% | 47.4ms | 0.0% | 3.0ms | `getTopicSuggestionsForThreadSignalBatch` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:601` |
| 0.1% | 46.5ms | 0.0% | 0us | `filterOutputFields` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs:9` |
| 0.1% | 46.4ms | 0.0% | 12.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:506` |
| 0.1% | 46.4ms | 0.1% | 46.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts:29` |
| 0.1% | 45.7ms | 0.0% | 978us | `async ensureCalendarEventRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:660` |
| 0.1% | 45.4ms | 0.0% | 2.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:371` |
| 0.1% | 45.4ms | 0.0% | 2.1ms | `_recoverAddrSpec` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:367` |
| 0.1% | 45.0ms | 0.1% | 42.6ms | `_recoverAddrSpec` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:368` |
| 0.1% | 43.9ms | 0.0% | 2.2ms | `async enrichMessagesWithThreadCollab` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadCollab.ts:8` |
| 0.1% | 43.7ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2499` |
| 0.1% | 43.3ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:724` |
| 0.1% | 43.3ms | 0.0% | 0us | `getTopicSuggestionSignalsForThreadsFromDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:192` |
| 0.1% | 42.5ms | 0.1% | 42.5ms | `/^[\p{L}\p{M}\p{N}.-]+$/u` | `[native code]` |
| 0.1% | 42.5ms | 0.0% | 0us | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:384` |
| 0.1% | 42.1ms | 0.1% | 42.1ms | `Date` | `[native code]` |
| 0.1% | 41.6ms | 0.0% | 0us | `init` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:65` |
| 0.1% | 40.9ms | 0.0% | 0us | `async getThreadGroupCounts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1383` |
| 0.1% | 40.5ms | 0.0% | 0us | `(module)` | `/tmp/spike-switch-server/inspect.ts:23` |
| 0.1% | 40.3ms | 0.1% | 40.3ms | `isFreeMailDomain` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/senderIdentity.ts:272` |
| 0.1% | 40.1ms | 0.0% | 0us | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:60` |
| 0.1% | 39.2ms | 0.1% | 39.2ms | `flush` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:205` |
| 0.1% | 39.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/libmime.js:44` |
| 0.1% | 38.7ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:42` |
| 0.1% | 38.0ms | 0.1% | 38.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadCollab.ts:8` |
| 0.1% | 37.2ms | 0.0% | 0us | `getThreadCollabStates` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts:75` |
| 0.1% | 37.1ms | 0.0% | 0us | `getTopicSuggestionSignalsForThreadsFromDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:186` |
| 0.0% | 36.9ms | 0.0% | 36.9ms | `shouldIgnoreTopicSuggestionSignal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:126` |
| 0.0% | 36.6ms | 0.0% | 18.9ms | `text` | `[native code]` |
| 0.0% | 36.5ms | 0.0% | 2.4ms | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:72` |
| 0.0% | 36.1ms | 0.0% | 3.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:602` |
| 0.0% | 35.9ms | 0.0% | 35.9ms | `freeze` | `[native code]` |
| 0.0% | 35.7ms | 0.0% | 34.5ms | `async enrichMessagesWithThreadCollab` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadCollab.ts:14` |
| 0.0% | 34.7ms | 0.0% | 3.6ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:375` |
| 0.0% | 34.6ms | 0.0% | 34.6ms | `Map` | `[native code]` |
| 0.0% | 34.4ms | 0.0% | 34.4ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:78` |
| 0.0% | 34.3ms | 0.0% | 34.3ms | `getChunkedCookie` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/session-store.mjs:138` |
| 0.0% | 34.3ms | 0.0% | 12.9ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:84` |
| 0.0% | 34.1ms | 0.0% | 0us | `visitFrom` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:120` |
| 0.0% | 34.1ms | 0.0% | 0us | `bound visitAlias` | `[native code]` |
| 0.0% | 34.1ms | 0.0% | 0us | `bound visitFrom` | `[native code]` |
| 0.0% | 34.1ms | 0.0% | 0us | `visitAlias` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:282` |
| 0.0% | 34.1ms | 0.0% | 34.1ms | ``/^[A-Za-z0-9.!#$%&'*+\/=?^_`{\|}~-]+$/`` | `[native code]` |
| 0.0% | 33.9ms | 0.0% | 0us | `selectFrom` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:39` |
| 0.0% | 33.8ms | 0.0% | 0us | `create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/from-node.js:13` |
| 0.0% | 33.8ms | 0.0% | 0us | `createFrom` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/select-query-node.js:23` |
| 0.0% | 33.4ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:565` |
| 0.0% | 33.1ms | 0.0% | 33.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:162` |
| 0.0% | 32.8ms | 0.0% | 0us | `async getMessageCalendarInviteDataByMessageId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:165` |
| 0.0% | 32.7ms | 0.0% | 0us | `decryptPayload` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/secret.ts:60` |
| 0.0% | 32.5ms | 0.0% | 22.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:187` |
| 0.0% | 31.7ms | 0.0% | 0us | `parseExpression` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/expression-parser.js:11` |
| 0.0% | 31.7ms | 0.0% | 0us | `lookup` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/ftsIdentity.ts:82` |
| 0.0% | 31.6ms | 0.0% | 0us | `initAccountSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:992` |
| 0.0% | 31.1ms | 0.0% | 31.1ms | `shouldIgnoreTopicSuggestionSignal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:118` |
| 0.0% | 31.0ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2468` |
| 0.0% | 30.1ms | 0.0% | 0us | `async executeQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:99` |
| 0.0% | 30.0ms | 0.0% | 25.2ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:697` |
| 0.0% | 29.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sanitize-html/index.js:1` |
| 0.0% | 29.9ms | 0.0% | 0us | `getThreadCollabStates` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts:72` |
| 0.0% | 29.3ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:356` |
| 0.0% | 29.3ms | 0.0% | 934us | `mapAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:177` |
| 0.0% | 28.9ms | 0.0% | 0us | `async transformSingleOutput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:180` |
| 0.0% | 28.8ms | 0.0% | 13.4ms | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:80` |
| 0.0% | 28.5ms | 0.0% | 0us | `async execute` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:318` |
| 0.0% | 28.3ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:48` |
| 0.0% | 28.3ms | 0.0% | 28.3ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:776` |
| 0.0% | 28.2ms | 0.0% | 28.2ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:743` |
| 0.0% | 28.2ms | 0.0% | 28.2ms | `node:dns` | `node:dns:2` |
| 0.0% | 27.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:533` |
| 0.0% | 27.7ms | 0.0% | 2.1ms | `buildTimeGroupKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageGrouping.ts:42` |
| 0.0% | 27.3ms | 0.0% | 0us | `getTopicSuggestionSignalsForThreadsFromDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:225` |
| 0.0% | 26.5ms | 0.0% | 0us | `async assertAccountFolder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/folderAccountGuard.ts:8` |
| 0.0% | 26.4ms | 0.0% | 0us | `async runAfterHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:135` |
| 0.0% | 26.4ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:245` |
| 0.0% | 26.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sanitize-html/index.js:5` |
| 0.0% | 26.2ms | 0.0% | 26.2ms | `/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/` | `[native code]` |
| 0.0% | 25.9ms | 0.0% | 0us | `createDecipheriv` | `node:crypto:362` |
| 0.0% | 25.9ms | 0.0% | 2.3ms | `Decipheriv2` | `node:crypto:313` |
| 0.0% | 25.8ms | 0.0% | 0us | `createExpressionBuilder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:115` |
| 0.0% | 25.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:367` |
| 0.0% | 25.7ms | 0.0% | 4.7ms | `async enrichMessagesWithThreadCollab` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadCollab.ts:9` |
| 0.0% | 25.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:409` |
| 0.0% | 25.5ms | 0.0% | 4.8ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:646` |
| 0.0% | 25.1ms | 0.0% | 25.1ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:15` |
| 0.0% | 24.9ms | 0.0% | 0us | `async findOne` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:521` |
| 0.0% | 24.9ms | 0.0% | 0us | `select` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:62` |
| 0.0% | 24.9ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2514` |
| 0.0% | 24.9ms | 0.0% | 24.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2523` |
| 0.0% | 24.8ms | 0.0% | 1.1ms | `Tokenizer` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:806` |
| 0.0% | 24.6ms | 0.0% | 2.3ms | `mapAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:153` |
| 0.0% | 24.5ms | 0.0% | 1.6ms | `async provideConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/default-connection-provider.js:13` |
| 0.0% | 24.5ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:153` |
| 0.0% | 24.3ms | 0.0% | 24.3ms | `_joinAtSpacing` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 24.3ms | 0.0% | 2.8ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:236` |
| 0.0% | 24.2ms | 0.0% | 7.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:211` |
| 0.0% | 24.2ms | 0.0% | 24.2ms | `checkChar` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1003` |
| 0.0% | 24.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:272` |
| 0.0% | 24.1ms | 0.0% | 0us | `configureDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:89` |
| 0.0% | 23.7ms | 0.0% | 1.1ms | `async getAccountOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/senderIdentities.ts:22` |
| 0.0% | 23.5ms | 0.0% | 23.5ms | `Cipher` | `[native code]` |
| 0.0% | 23.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/charset.js:16` |
| 0.0% | 23.4ms | 0.0% | 0us | `async findSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:369` |
| 0.0% | 23.2ms | 0.0% | 23.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:334` |
| 0.0% | 23.2ms | 0.0% | 1.1ms | `async executeQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:38` |
| 0.0% | 23.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/index.js:4` |
| 0.0% | 22.9ms | 0.0% | 22.9ms | `structuredClone` | `[native code]` |
| 0.0% | 22.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:557` |
| 0.0% | 22.3ms | 0.0% | 20.1ms | `checkChar` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1019` |
| 0.0% | 21.8ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:32` |
| 0.0% | 21.8ms | 0.0% | 0us | `async verifySignature` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:18` |
| 0.0% | 21.3ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:81` |
| 0.0% | 21.3ms | 0.0% | 0us | `async getTables` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:70` |
| 0.0% | 20.9ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/mail/imapCancellation.ts:9` |
| 0.0% | 20.9ms | 0.0% | 20.9ms | `AsyncLocalStorage` | `node:async_hooks` |
| 0.0% | 20.8ms | 0.0% | 1.5ms | `getTopicSuggestionSignalsForThreadsFromDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:181` |
| 0.0% | 20.7ms | 0.0% | 5.4ms | `topicSuggestionSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:107` |
| 0.0% | 20.4ms | 0.0% | 0us | `async provideConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/default-connection-provider.js:8` |
| 0.0% | 20.4ms | 0.0% | 0us | `async acquireConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:63` |
| 0.0% | 20.3ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2455` |
| 0.0% | 20.3ms | 0.0% | 0us | `rebuildAllThreadSignalsForAccountInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:130` |
| 0.0% | 20.3ms | 0.0% | 4.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:209` |
| 0.0% | 20.2ms | 0.0% | 0us | `shouldIgnoreTopicSuggestionSignal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:131` |
| 0.0% | 20.0ms | 0.0% | 5.9ms | `(module)` | `/tmp/spike-switch-server/inspect.ts:19` |
| 0.0% | 19.9ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js:2` |
| 0.0% | 19.8ms | 0.0% | 19.8ms | `createFunctionModule` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/function-module.js:19` |
| 0.0% | 19.8ms | 0.0% | 0us | `async createInternalContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:97` |
| 0.0% | 19.4ms | 0.0% | 19.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:164` |
| 0.0% | 19.1ms | 0.0% | 966us | `async acquireConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:53` |
| 0.0% | 19.0ms | 0.0% | 9.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:697` |
| 0.0% | 18.9ms | 0.0% | 0us | `async ensureCalendarEventRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:662` |
| 0.0% | 18.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:78` |
| 0.0% | 18.8ms | 0.0% | 18.8ms | `/[\x00-\x1f\x7f]/` | `[native code]` |
| 0.0% | 18.8ms | 0.0% | 18.8ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:95` |
| 0.0% | 18.7ms | 0.0% | 930us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:224` |
| 0.0% | 18.7ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:339` |
| 0.0% | 18.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/index.js:1` |
| 0.0% | 18.6ms | 0.0% | 0us | `async withAuthResponse` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:57` |
| 0.0% | 18.6ms | 0.0% | 0us | `async withAuthResponse` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:50` |
| 0.0% | 18.4ms | 0.0% | 18.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:370` |
| 0.0% | 18.3ms | 0.0% | 0us | `loadServerDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/serverDb.ts:7` |
| 0.0% | 18.2ms | 0.0% | 18.2ms | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/esm/mimetypes.js:3` |
| 0.0% | 18.1ms | 0.0% | 0us | `async getUserById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/serverDb.ts:151` |
| 0.0% | 18.1ms | 0.0% | 18.1ms | `stringify` | `[native code]` |
| 0.0% | 18.0ms | 0.0% | 0us | `transformJoinClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:288` |
| 0.0% | 17.9ms | 0.0% | 2.4ms | `topicSuggestionSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:103` |
| 0.0% | 17.8ms | 0.0% | 0us | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1352` |
| 0.0% | 17.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/index.js:5` |
| 0.0% | 17.6ms | 0.0% | 0us | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:375` |
| 0.0% | 17.5ms | 0.0% | 17.5ms | `compileQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:21` |
| 0.0% | 17.5ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:104` |
| 0.0% | 17.5ms | 0.0% | 0us | `async GET` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:58` |
| 0.0% | 17.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/config.js:2` |
| 0.0% | 17.3ms | 0.0% | 16.3ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:83` |
| 0.0% | 17.2ms | 0.0% | 5.3ms | `async resolveAccountRole` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/accountAccess.ts:12` |
| 0.0% | 16.9ms | 0.0% | 0us | `getThreadCollabStates` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts:71` |
| 0.0% | 16.7ms | 0.0% | 3.5ms | `decryptPayload` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/secret.ts:62` |
| 0.0% | 16.7ms | 0.0% | 1.0ms | `topicSuggestionSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:104` |
| 0.0% | 16.6ms | 0.0% | 0us | `ensureAccountKeySchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accountKeys.ts:230` |
| 0.0% | 16.4ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:572` |
| 0.0% | 16.2ms | 0.0% | 3.3ms | `getOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:55` |
| 0.0% | 16.2ms | 0.0% | 0us | `async isMfaEnrollmentComplete` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authPolicy.ts:21` |
| 0.0% | 16.1ms | 0.0% | 16.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts` |
| 0.0% | 16.0ms | 0.0% | 0us | `async resolveAccountDbPath` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:338` |
| 0.0% | 15.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:444` |
| 0.0% | 15.9ms | 0.0% | 10.8ms | `performIteration` | `[native code]` |
| 0.0% | 15.8ms | 0.0% | 15.8ms | `parse` | `[native code]` |
| 0.0% | 15.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-attributes.mjs:29` |
| 0.0% | 15.3ms | 0.0% | 0us | `async internalHandler` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/middleware.mjs:29` |
| 0.0% | 15.3ms | 0.0% | 0us | `visitWhere` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:144` |
| 0.0% | 15.3ms | 0.0% | 0us | `bound visitWhere` | `[native code]` |
| 0.0% | 15.3ms | 0.0% | 15.3ms | `_collapseAtSpacing` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:272` |
| 0.0% | 15.3ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:895` |
| 0.0% | 15.3ms | 0.0% | 15.3ms | `async acquireConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs` |
| 0.0% | 15.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js:15` |
| 0.0% | 15.1ms | 0.0% | 0us | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:68` |
| 0.0% | 15.1ms | 0.0% | 1.2ms | `cloneWithSelections` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/select-query-node.js:31` |
| 0.0% | 15.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:16` |
| 0.0% | 15.0ms | 0.0% | 0us | `configureAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:107` |
| 0.0% | 14.9ms | 0.0% | 14.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:163` |
| 0.0% | 14.9ms | 0.0% | 14.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:165` |
| 0.0% | 14.7ms | 0.0% | 1.3ms | `normalizeAccountSettings` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/accountSettings.ts:5` |
| 0.0% | 14.6ms | 0.0% | 0us | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts:44` |
| 0.0% | 14.2ms | 0.0% | 14.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:346` |
| 0.0% | 14.2ms | 0.0% | 14.2ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:698` |
| 0.0% | 14.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/middleware.mjs:9` |
| 0.0% | 14.0ms | 0.0% | 0us | `visitSelection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:123` |
| 0.0% | 14.0ms | 0.0% | 0us | `bound visitSelection` | `[native code]` |
| 0.0% | 14.0ms | 0.0% | 923us | `bound visitReference` | `[native code]` |
| 0.0% | 13.9ms | 0.0% | 0us | `flush` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:207` |
| 0.0% | 13.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:34` |
| 0.0% | 13.7ms | 0.0% | 0us | `async recomputeThreadsForAccountInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:284` |
| 0.0% | 13.6ms | 0.0% | 13.6ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:25` |
| 0.0% | 13.6ms | 0.0% | 1.2ms | `async getTopicSuggestionsForThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:682` |
| 0.0% | 13.6ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:223` |
| 0.0% | 13.5ms | 0.0% | 0us | `topicSuggestionSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:106` |
| 0.0% | 13.5ms | 0.0% | 13.5ms | `reverse` | `[native code]` |
| 0.0% | 13.2ms | 0.0% | 13.2ms | `Buffer` | `[native code]` |
| 0.0% | 13.2ms | 0.0% | 0us | `async requireActiveUserSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:74` |
| 0.0% | 13.2ms | 0.0% | 0us | `node:http` | `node:http:2` |
| 0.0% | 13.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/index.js:4` |
| 0.0% | 13.0ms | 0.0% | 13.0ms | `cloneWithSelections` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/select-query-node.js:30` |
| 0.0% | 13.0ms | 0.0% | 13.0ms | `topicSuggestionSignalsFromEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:75` |
| 0.0% | 12.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:593` |
| 0.0% | 12.8ms | 0.0% | 992us | `async getSignedCookie` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:48` |
| 0.0% | 12.8ms | 0.0% | 12.8ms | `displayDayNumber` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts:38` |
| 0.0% | 12.7ms | 0.0% | 12.7ms | `verify` | `[native code]` |
| 0.0% | 12.4ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:91` |
| 0.0% | 12.4ms | 0.0% | 0us | `filterOutputFields` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs:8` |
| 0.0% | 12.4ms | 0.0% | 0us | `binary` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:27` |
| 0.0% | 12.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/index.js:4` |
| 0.0% | 12.1ms | 0.0% | 0us | `async requireActiveUserSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:75` |
| 0.0% | 12.0ms | 0.0% | 0us | `mapAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:192` |
| 0.0% | 12.0ms | 0.0% | 12.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-field-name.mjs` |
| 0.0% | 11.9ms | 0.0% | 11.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-id-field.mjs:43` |
| 0.0% | 11.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:76` |
| 0.0% | 11.9ms | 0.0% | 0us | `node:stream` | `node:stream:2` |
| 0.0% | 11.9ms | 0.0% | 0us | `internal:streams/compose` | `internal:streams/compose:2` |
| 0.0% | 11.9ms | 0.0% | 0us | `internal:stream` | `internal:stream:2` |
| 0.0% | 11.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/middleware.mjs:15` |
| 0.0% | 11.8ms | 0.0% | 958us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:350` |
| 0.0% | 11.8ms | 0.0% | 11.8ms | `_collapseAtSpacing` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:262` |
| 0.0% | 11.8ms | 0.0% | 0us | `async requireActiveUserSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:72` |
| 0.0% | 11.8ms | 0.0% | 6.6ms | `bound visitTable` | `[native code]` |
| 0.0% | 11.8ms | 0.0% | 0us | `visitReference` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:288` |
| 0.0% | 11.7ms | 0.0% | 0us | `async runValidation` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/validator.mjs:44` |
| 0.0% | 11.7ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:10` |
| 0.0% | 11.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/connection.js:13` |
| 0.0% | 11.6ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:184` |
| 0.0% | 11.6ms | 0.0% | 0us | `async transformOutput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:216` |
| 0.0% | 11.6ms | 0.0% | 0us | `async hasRequestState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:16` |
| 0.0% | 11.5ms | 0.0% | 11.5ms | `encodeURIComponent` | `[native code]` |
| 0.0% | 11.5ms | 0.0% | 0us | `getColorDepth` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs:57` |
| 0.0% | 11.5ms | 0.0% | 11.5ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:699` |
| 0.0% | 11.4ms | 0.0% | 11.4ms | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:36` |
| 0.0% | 11.4ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:820` |
| 0.0% | 11.1ms | 0.0% | 0us | `enrollmentState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/authPolicy.ts:376` |
| 0.0% | 11.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/socks/build/index.js:17` |
| 0.0% | 11.0ms | 0.0% | 0us | `safeParseJson` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:22` |
| 0.0% | 10.9ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:185` |
| 0.0% | 10.9ms | 0.0% | 0us | `collectTopicSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:92` |
| 0.0% | 10.9ms | 0.0% | 5.4ms | `async getDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:327` |
| 0.0% | 10.9ms | 0.0% | 10.9ms | `toString` | `[native code]` |
| 0.0% | 10.9ms | 0.0% | 0us | `async requireAccountContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/accountContext.ts:59` |
| 0.0% | 10.9ms | 0.0% | 0us | `async getAccountById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/serverDb.ts:26` |
| 0.0% | 10.9ms | 0.0% | 0us | `async getAccountById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/serverDb.ts:25` |
| 0.0% | 10.7ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:539` |
| 0.0% | 10.7ms | 0.0% | 0us | `resolveAccountRoleRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accountAccess.ts:11` |
| 0.0% | 10.7ms | 0.0% | 0us | `async recomputeThreadsForAccountInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:321` |
| 0.0% | 10.7ms | 0.0% | 10.7ms | `async runAfterHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:119` |
| 0.0% | 10.6ms | 0.0% | 1.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs:52` |
| 0.0% | 10.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:35` |
| 0.0% | 10.5ms | 0.0% | 4.0ms | `async runAfterHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:114` |
| 0.0% | 10.4ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:16` |
| 0.0% | 10.4ms | 0.0% | 10.4ms | `_joinAtSpacing` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:239` |
| 0.0% | 10.4ms | 0.0% | 10.4ms | `visitNode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/operation-node-visitor.js:111` |
| 0.0% | 10.3ms | 0.0% | 1.0ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:102` |
| 0.0% | 10.3ms | 0.0% | 0us | `async requireActiveUserSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:84` |
| 0.0% | 10.3ms | 0.0% | 10.3ms | `wrapStatement` | `/tmp/spike-switch-server/sqlcounter.ts:75` |
| 0.0% | 10.2ms | 0.0% | 10.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:77` |
| 0.0% | 10.2ms | 0.0% | 0us | `listSenderIdentityRows` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/senderIdentities.ts:11` |
| 0.0% | 10.1ms | 0.0% | 0us | `and` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:90` |
| 0.0% | 10.1ms | 0.0% | 10.1ms | `isReadonlyArray` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/object-utils.js` |
| 0.0% | 10.1ms | 0.0% | 10.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js` |
| 0.0% | 10.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/pino.js:8` |
| 0.0% | 9.9ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/mailboxSummary.ts:50` |
| 0.0% | 9.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/postcss.js:3` |
| 0.0% | 9.8ms | 0.0% | 9.8ms | `parseSelectArg` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/select-parser.js:10` |
| 0.0% | 9.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:234` |
| 0.0% | 9.7ms | 0.0% | 2.3ms | `walkAddressList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1203` |
| 0.0% | 9.7ms | 0.0% | 0us | `addressparser` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1210` |
| 0.0% | 9.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/index.js:6` |
| 0.0% | 9.6ms | 0.0% | 9.6ms | `TokenList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:25` |
| 0.0% | 9.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/index.js:4` |
| 0.0% | 9.6ms | 0.0% | 0us | `parseValueBinaryOperation` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/binary-operation-parser.js:25` |
| 0.0% | 9.4ms | 0.0% | 6.9ms | `topicSuggestionSignalsFromEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:84` |
| 0.0% | 9.4ms | 0.0% | 1.2ms | `async validateAccountFolders` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/folderAccount.ts:17` |
| 0.0% | 9.4ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:72` |
| 0.0% | 9.4ms | 0.0% | 0us | `async getCryptoKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:9` |
| 0.0% | 9.3ms | 0.0% | 0us | `rebuildThreadSignalsForThreadIdsInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:82` |
| 0.0% | 9.3ms | 0.0% | 0us | `cloneWithWhere` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/query-node.js:37` |
| 0.0% | 9.3ms | 0.0% | 9.3ms | `create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/where-node.js:13` |
| 0.0% | 9.3ms | 0.0% | 7.1ms | `async GET` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:48` |
| 0.0% | 9.3ms | 0.0% | 0us | `async GET` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:104` |
| 0.0% | 9.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/converters.js:7` |
| 0.0% | 9.2ms | 0.0% | 9.2ms | `DateTimeFormat` | `[native code]` |
| 0.0% | 9.2ms | 0.0% | 0us | `cached` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts:15` |
| 0.0% | 9.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts:39` |
| 0.0% | 9.2ms | 0.0% | 9.2ms | `defineProperty` | `[native code]` |
| 0.0% | 9.2ms | 0.0% | 0us | `async internalHandler` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:52` |
| 0.0% | 9.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:14` |
| 0.0% | 9.2ms | 0.0% | 0us | `validate` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:142` |
| 0.0% | 9.1ms | 0.0% | 9.1ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:744` |
| 0.0% | 9.0ms | 0.0% | 0us | `async getDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:300` |
| 0.0% | 9.0ms | 0.0% | 9.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-field-name.mjs:19` |
| 0.0% | 8.9ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:589` |
| 0.0% | 8.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:27` |
| 0.0% | 8.8ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/proto.js:40` |
| 0.0% | 8.8ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/levels.js:12` |
| 0.0% | 8.8ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/encoding-table.js:1` |
| 0.0% | 8.8ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2611` |
| 0.0% | 8.8ms | 0.0% | 0us | `migrate` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accountKeys.ts:225` |
| 0.0% | 8.8ms | 0.0% | 0us | `installShardWriterGuards` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:85` |
| 0.0% | 8.7ms | 0.0% | 956us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2243` |
| 0.0% | 8.7ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:584` |
| 0.0% | 8.7ms | 0.0% | 8.7ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:81` |
| 0.0% | 8.6ms | 0.0% | 0us | `serialize` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js:16` |
| 0.0% | 8.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:36` |
| 0.0% | 8.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/certificate_choices.js:8` |
| 0.0% | 8.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/postcss.js:9` |
| 0.0% | 8.6ms | 0.0% | 0us | `getTopicSuggestionsForThreadSignalBatch` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:577` |
| 0.0% | 8.6ms | 0.0% | 8.6ms | `flatIntoArray` | `[native code]` |
| 0.0% | 8.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/socks/build/client/socksclient.js:17` |
| 0.0% | 8.3ms | 0.0% | 0us | `node:crypto` | `node:crypto:2` |
| 0.0% | 8.3ms | 0.0% | 0us | `internal:streams/transform` | `internal:streams/transform:2` |
| 0.0% | 8.3ms | 0.0% | 0us | `internal:streams/lazy_transform` | `internal:streams/lazy_transform:2` |
| 0.0% | 8.3ms | 0.0% | 0us | `internal:streams/duplex` | `internal:streams/duplex:2` |
| 0.0% | 8.3ms | 0.0% | 7.0ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:84` |
| 0.0% | 8.3ms | 0.0% | 2.3ms | `async findOne` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:504` |
| 0.0% | 8.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/he/he.js:342` |
| 0.0% | 8.3ms | 0.0% | 8.3ms | `_mergeNameFragments` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1127` |
| 0.0% | 8.2ms | 0.0% | 0us | `async runValidation` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/validator.mjs:12` |
| 0.0% | 8.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:275` |
| 0.0% | 8.1ms | 0.0% | 0us | `installAuthControlPlane` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/authPolicy.ts:308` |
| 0.0% | 8.1ms | 0.0% | 948us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts:72` |
| 0.0% | 8.1ms | 0.0% | 8.1ms | `parseValueBinaryOperationOrExpression` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/binary-operation-parser.js` |
| 0.0% | 8.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/at-rule.js:3` |
| 0.0% | 8.0ms | 0.0% | 8.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2615` |
| 0.0% | 8.0ms | 0.0% | 1.1ms | `from` | `[native code]` |
| 0.0% | 8.0ms | 0.0% | 8.0ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts` |
| 0.0% | 8.0ms | 0.0% | 1.0ms | `async withAuthResponse` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:51` |
| 0.0% | 8.0ms | 0.0% | 0us | `loadManualCategoryStatesForMessageIds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:310` |
| 0.0% | 7.9ms | 0.0% | 7.9ms | `join` | `[native code]` |
| 0.0% | 7.9ms | 0.0% | 2.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:821` |
| 0.0% | 7.9ms | 0.0% | 0us | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:369` |
| 0.0% | 7.9ms | 0.0% | 0us | `async resolveAccountDbPath` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:335` |
| 0.0% | 7.9ms | 0.0% | 0us | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:408` |
| 0.0% | 7.9ms | 0.0% | 0us | `async resolveAccountDbPath` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:365` |
| 0.0% | 7.8ms | 0.0% | 3.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:590` |
| 0.0% | 7.8ms | 0.0% | 1.0ms | `getHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:157` |
| 0.0% | 7.7ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:52` |
| 0.0% | 7.7ms | 0.0% | 2.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/senderIdentities.ts:13` |
| 0.0% | 7.7ms | 0.0% | 7.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:257` |
| 0.0% | 7.6ms | 0.0% | 1.2ms | `update` | `node:crypto:338` |
| 0.0% | 7.6ms | 0.0% | 5.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:166` |
| 0.0% | 7.6ms | 0.0% | 0us | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:53` |
| 0.0% | 7.5ms | 0.0% | 7.5ms | `parseAliasedExpression` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/expression-parser.js:16` |
| 0.0% | 7.5ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:40` |
| 0.0% | 7.5ms | 0.0% | 1.2ms | `reduce` | `[native code]` |
| 0.0% | 7.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:41` |
| 0.0% | 7.5ms | 0.0% | 0us | `extractJiraProjectKeys` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:40` |
| 0.0% | 7.4ms | 0.0% | 7.4ms | `wrapStatement` | `/tmp/spike-switch-server/sqlcounter.ts:76` |
| 0.0% | 7.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/index.js:9` |
| 0.0% | 7.4ms | 0.0% | 7.4ms | `add` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:69` |
| 0.0% | 7.4ms | 0.0% | 7.4ms | `Statement` | `bun:sqlite:108` |
| 0.0% | 7.3ms | 0.0% | 0us | `node:_http_agent` | `node:_http_agent:8` |
| 0.0% | 7.3ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:714` |
| 0.0% | 7.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/encoding-table.js:3` |
| 0.0% | 7.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/fromJSON.js:6` |
| 0.0% | 7.3ms | 0.0% | 7.3ms | `Request` | `[native code]` |
| 0.0% | 7.3ms | 0.0% | 0us | `get` | `/tmp/spike-switch-server/inspect.ts:11` |
| 0.0% | 7.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pkcs9/build/cjs/index.js:9` |
| 0.0% | 7.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/socks/build/common/helpers.js:11` |
| 0.0% | 7.1ms | 0.0% | 4.7ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:8` |
| 0.0% | 7.0ms | 0.0% | 7.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/he/he.js` |
| 0.0% | 7.0ms | 0.0% | 7.0ms | `TokenList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:24` |
| 0.0% | 7.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:210` |
| 0.0% | 7.0ms | 0.0% | 0us | `async runBeforeHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:106` |
| 0.0% | 7.0ms | 0.0% | 2.2ms | `async runBeforeHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:79` |
| 0.0% | 7.0ms | 0.0% | 0us | `_parseAddressList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1196` |
| 0.0% | 6.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/container.js:3` |
| 0.0% | 6.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/comment.js:3` |
| 0.0% | 6.9ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:14` |
| 0.0% | 6.9ms | 0.0% | 0us | `forwardAuthHeaders` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:30` |
| 0.0% | 6.9ms | 0.0% | 6.9ms | `TokenList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 6.9ms | 0.0% | 6.9ms | `arrayFromFastWithoutMapFn` | `[native code]` |
| 0.0% | 6.9ms | 0.0% | 0us | `object` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:906` |
| 0.0% | 6.9ms | 0.0% | 0us | `async getThreadGroupCounts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1404` |
| 0.0% | 6.8ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2512` |
| 0.0% | 6.7ms | 0.0% | 0us | `createAdminInvite` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:691` |
| 0.0% | 6.7ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:900` |
| 0.0% | 6.5ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:9` |
| 0.0% | 6.5ms | 0.0% | 6.5ms | `importKey` | `[native code]` |
| 0.0% | 6.5ms | 0.0% | 0us | `_email` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/api.js:20` |
| 0.0% | 6.5ms | 0.0% | 0us | `ZodEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` |
| 0.0% | 6.5ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs:193` |
| 0.0% | 6.5ms | 0.0% | 0us | `(module)` | `/tmp/spike-switch-server/inspect.ts:15` |
| 0.0% | 6.5ms | 0.0% | 0us | `async POST` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/auth/switch-account/route.ts:28` |
| 0.0% | 6.5ms | 0.0% | 0us | `headers` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/headers.js:110` |
| 0.0% | 6.5ms | 0.0% | 5.2ms | `throwForMissingRequestStore` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/work-unit-async-storage.external.js:88` |
| 0.0% | 6.5ms | 0.0% | 6.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadCollab.ts:9` |
| 0.0% | 6.5ms | 0.0% | 1.1ms | `async requireAccountContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/accountContext.ts:55` |
| 0.0% | 6.4ms | 0.0% | 6.4ms | `Tokenizer` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:794` |
| 0.0% | 6.4ms | 0.0% | 6.4ms | `transformJoinClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:287` |
| 0.0% | 6.4ms | 0.0% | 6.4ms | `update` | `[native code]` |
| 0.0% | 6.3ms | 0.0% | 1.0ms | `(anonymous)` | `/tmp/spike-switch-server/fixture.ts:60` |
| 0.0% | 6.3ms | 0.0% | 6.3ms | `topicSuggestionSignalKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:535` |
| 0.0% | 6.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:564` |
| 0.0% | 6.3ms | 0.0% | 6.3ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:662` |
| 0.0% | 6.3ms | 0.0% | 2.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:159` |
| 0.0% | 6.3ms | 0.0% | 6.3ms | `visitNode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/operation-node-visitor.js` |
| 0.0% | 6.1ms | 0.0% | 6.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:629` |
| 0.0% | 6.1ms | 0.0% | 6.1ms | `defaultThreadCollabState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts:54` |
| 0.0% | 6.1ms | 0.0% | 0us | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:51` |
| 0.0% | 6.1ms | 0.0% | 6.1ms | `toISOString` | `[native code]` |
| 0.0% | 6.0ms | 0.0% | 0us | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1345` |
| 0.0% | 6.0ms | 0.0% | 4.8ms | `addressparser` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1200` |
| 0.0% | 6.0ms | 0.0% | 6.0ms | `/[\x00-\x08\x0a-\x1f\x7f]/` | `[native code]` |
| 0.0% | 6.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:228` |
| 0.0% | 6.0ms | 0.0% | 6.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:23` |
| 0.0% | 5.8ms | 0.0% | 0us | `loadManualCategoryStatesForMessageIds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:303` |
| 0.0% | 5.8ms | 0.0% | 2.5ms | `async getMessageCalendarInviteDataByMessageId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:189` |
| 0.0% | 5.8ms | 0.0% | 0us | `initAccountSchemaBody` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:1004` |
| 0.0% | 5.8ms | 0.0% | 5.8ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts` |
| 0.0% | 5.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:274` |
| 0.0% | 5.8ms | 0.0% | 0us | `async migrateAuthSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:219` |
| 0.0% | 5.8ms | 0.0% | 2.2ms | `getOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:56` |
| 0.0% | 5.8ms | 0.0% | 5.8ms | `set` | `[native code]` |
| 0.0% | 5.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs:51` |
| 0.0% | 5.8ms | 0.0% | 0us | `async ensureAsyncStorage` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:10` |
| 0.0% | 5.7ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-attributes.mjs:24` |
| 0.0% | 5.7ms | 0.0% | 0us | `assertCompleteShardFormat` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:76` |
| 0.0% | 5.7ms | 0.0% | 5.7ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:59` |
| 0.0% | 5.7ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:368` |
| 0.0% | 5.7ms | 0.0% | 5.7ms | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts:52` |
| 0.0% | 5.7ms | 0.0% | 5.7ms | `add` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:68` |
| 0.0% | 5.6ms | 0.0% | 0us | `upsertTopicLearningSignalsForThreadIds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/topics.ts:153` |
| 0.0% | 5.6ms | 0.0% | 0us | `async requireActiveUserSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:68` |
| 0.0% | 5.6ms | 0.0% | 0us | `getCodec` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/lib/index.js:65` |
| 0.0% | 5.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/charset.js:28` |
| 0.0% | 5.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/converters.js:6` |
| 0.0% | 5.6ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:442` |
| 0.0% | 5.6ms | 0.0% | 5.6ms | `install` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/storage.ts:258` |
| 0.0% | 5.5ms | 0.0% | 5.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:403` |
| 0.0% | 5.5ms | 0.0% | 4.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:684` |
| 0.0% | 5.5ms | 0.0% | 5.5ms | `async executeQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:35` |
| 0.0% | 5.5ms | 0.0% | 0us | `ZodObject` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` |
| 0.0% | 5.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/charset.js:141` |
| 0.0% | 5.5ms | 0.0% | 0us | `getCodec` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/lib/index.js:102` |
| 0.0% | 5.5ms | 0.0% | 5.5ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:97` |
| 0.0% | 5.4ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:13` |
| 0.0% | 5.4ms | 0.0% | 5.4ms | `async requireActiveUserSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts` |
| 0.0% | 5.4ms | 0.0% | 0us | `async POST` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/auth/switch-account/route.ts:10` |
| 0.0% | 5.4ms | 0.0% | 0us | `async getCurrentAdapter` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/transaction.mjs:23` |
| 0.0% | 5.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:156` |
| 0.0% | 5.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/request.js:23` |
| 0.0% | 5.3ms | 0.0% | 5.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2660` |
| 0.0% | 5.3ms | 0.0% | 5.3ms | `RegExp` | `[native code]` |
| 0.0% | 5.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:51` |
| 0.0% | 5.2ms | 0.0% | 5.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:39` |
| 0.0% | 5.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:707` |
| 0.0% | 5.2ms | 0.0% | 5.2ms | `async runAfterHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs` |
| 0.0% | 5.1ms | 0.0% | 0us | `visitSchemableIdentifier` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:384` |
| 0.0% | 5.1ms | 0.0% | 0us | `visitTable` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:377` |
| 0.0% | 5.1ms | 0.0% | 0us | `bound visitSchemableIdentifier` | `[native code]` |
| 0.0% | 5.1ms | 0.0% | 0us | `strict` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:870` |
| 0.0% | 5.1ms | 0.0% | 5.1ms | `defineProperties` | `[native code]` |
| 0.0% | 5.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/adminMailbox.ts:13` |
| 0.0% | 5.1ms | 0.0% | 0us | `bound strict` | `[native code]` |
| 0.0% | 5.1ms | 0.0% | 3.1ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2504` |
| 0.0% | 5.1ms | 0.0% | 5.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1207` |
| 0.0% | 5.1ms | 0.0% | 5.1ms | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:71` |
| 0.0% | 5.0ms | 0.0% | 0us | `enrollmentState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/authPolicy.ts:379` |
| 0.0% | 5.0ms | 0.0% | 965us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:71` |
| 0.0% | 5.0ms | 0.0% | 5.0ms | `looksLikeJiraMessage` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:31` |
| 0.0% | 4.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/mailparser/dist/esm/tlds.cjs:8` |
| 0.0% | 4.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1214` |
| 0.0% | 4.9ms | 0.0% | 0us | `async findOne` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:515` |
| 0.0% | 4.9ms | 0.0% | 0us | `async rawEncrypt` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/crypto/index.mjs:33` |
| 0.0% | 4.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/input.js:5` |
| 0.0% | 4.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/decorators/index.js:3` |
| 0.0% | 4.8ms | 0.0% | 1.1ms | `topicSuggestionSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:105` |
| 0.0% | 4.8ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/node.js:3` |
| 0.0% | 4.8ms | 0.0% | 4.8ms | `#all` | `bun:sqlite:177` |
| 0.0% | 4.8ms | 0.0% | 4.8ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:15` |
| 0.0% | 4.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:273` |
| 0.0% | 4.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:79` |
| 0.0% | 4.8ms | 0.0% | 0us | `async sqliteGeneratedPrimaryKeyColumn` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:30` |
| 0.0% | 4.8ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/ua-parser-js/ua-parser.js:1` |
| 0.0% | 4.8ms | 0.0% | 0us | `loadManualCategoryStatesForMessageIds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:317` |
| 0.0% | 4.7ms | 0.0% | 0us | `(module)` | `/tmp/spike-switch-server/inspect.ts:17` |
| 0.0% | 4.7ms | 0.0% | 4.7ms | `async validateAccountFolders` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/folderAccount.ts:11` |
| 0.0% | 4.7ms | 0.0% | 4.7ms | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:49` |
| 0.0% | 4.7ms | 0.0% | 4.7ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:578` |
| 0.0% | 4.7ms | 0.0% | 0us | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:71` |
| 0.0% | 4.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/index.js:6` |
| 0.0% | 4.7ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:220` |
| 0.0% | 4.7ms | 0.0% | 0us | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:70` |
| 0.0% | 4.7ms | 0.0% | 0us | `async enrichMessagesWithThreadCollab` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadCollab.ts:12` |
| 0.0% | 4.6ms | 0.0% | 3.3ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:101` |
| 0.0% | 4.6ms | 0.0% | 0us | `async getMessageCalendarInviteDataByMessageId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:164` |
| 0.0% | 4.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:3800` |
| 0.0% | 4.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:9` |
| 0.0% | 4.6ms | 0.0% | 0us | `webpackUniversalModuleDefinition` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:3` |
| 0.0% | 4.6ms | 0.0% | 3.5ms | `deriveSystemFlagState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:324` |
| 0.0% | 4.6ms | 0.0% | 0us | `upsertTopicLearningSignalsForThreadIds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/topics.ts:128` |
| 0.0% | 4.6ms | 0.0% | 0us | `normalizeThreadIds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/topics.ts:3` |
| 0.0% | 4.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/index.js:10` |
| 0.0% | 4.6ms | 0.0% | 4.6ms | `wrapStatement` | `/tmp/spike-switch-server/sqlcounter.ts:74` |
| 0.0% | 4.5ms | 0.0% | 4.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:47` |
| 0.0% | 4.4ms | 0.0% | 4.4ms | `formatTransactionId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` |
| 0.0% | 4.4ms | 0.0% | 0us | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts:40` |
| 0.0% | 4.4ms | 0.0% | 4.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts` |
| 0.0% | 4.4ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2495` |
| 0.0% | 4.4ms | 0.0% | 0us | `async getAccountIdFromParams` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/accountContext.ts:39` |
| 0.0% | 4.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/postcss.js:11` |
| 0.0% | 4.4ms | 0.0% | 4.4ms | `parseSearchInput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:667` |
| 0.0% | 4.4ms | 0.0% | 0us | `normalizeThreadIds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:23` |
| 0.0% | 4.4ms | 0.0% | 4.4ms | `async getUserById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/serverDb.ts:150` |
| 0.0% | 4.4ms | 0.0% | 0us | `rebuildThreadSignalsForThreadIdsInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:94` |
| 0.0% | 4.4ms | 0.0% | 0us | `async migrateAuthSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:211` |
| 0.0% | 4.4ms | 0.0% | 0us | `async getMigrations` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:685` |
| 0.0% | 4.4ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:366` |
| 0.0% | 4.4ms | 0.0% | 3.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2648` |
| 0.0% | 4.4ms | 0.0% | 0us | `insertThreadSignalsFromMessageRows` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:67` |
| 0.0% | 4.3ms | 0.0% | 3.4ms | `getHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:161` |
| 0.0% | 4.3ms | 0.0% | 4.3ms | `concat` | `[native code]` |
| 0.0% | 4.3ms | 0.0% | 4.3ms | `_collectAddressParts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 4.3ms | 0.0% | 4.3ms | `atob` | `[native code]` |
| 0.0% | 4.3ms | 0.0% | 0us | `migrate` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accountKeys.ts:227` |
| 0.0% | 4.3ms | 0.0% | 2.1ms | `fsyncSync` | `[native code]` |
| 0.0% | 4.3ms | 0.0% | 4.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:621` |
| 0.0% | 4.3ms | 0.0% | 4.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:168` |
| 0.0% | 4.3ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:364` |
| 0.0% | 4.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/index.js:4` |
| 0.0% | 4.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/rsaes_oaep.js:44` |
| 0.0% | 4.2ms | 0.0% | 0us | `toASN` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js:50` |
| 0.0% | 4.2ms | 0.0% | 0us | `async verifyTwoFactor` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/verify-two-factor.mjs:115` |
| 0.0% | 4.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/totp/index.mjs:172` |
| 0.0% | 4.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/totp/index.mjs:225` |
| 0.0% | 4.2ms | 0.0% | 4.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:181` |
| 0.0% | 4.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:182` |
| 0.0% | 4.2ms | 0.0% | 0us | `initAccountSchemaBody` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:1003` |
| 0.0% | 4.1ms | 0.0% | 0us | `toBER` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:960` |
| 0.0% | 4.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accounts.ts:111` |
| 0.0% | 4.1ms | 0.0% | 4.1ms | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:42` |
| 0.0% | 4.1ms | 0.0% | 0us | `async acquireConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:35` |
| 0.0% | 4.1ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2578` |
| 0.0% | 4.1ms | 0.0% | 0us | `buildSqlContainsAny` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:927` |
| 0.0% | 4.1ms | 0.0% | 0us | `buildMeaningfulAttachmentExistsSql` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:954` |
| 0.0% | 4.1ms | 0.0% | 4.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:567` |
| 0.0% | 4.0ms | 0.0% | 4.0ms | `sanitizeIdentifier` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js` |
| 0.0% | 4.0ms | 0.0% | 0us | `compileUnwrappedIdentifier` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:305` |
| 0.0% | 4.0ms | 0.0% | 0us | `visitIdentifier` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:298` |
| 0.0% | 4.0ms | 0.0% | 0us | `bound visitIdentifier` | `[native code]` |
| 0.0% | 4.0ms | 0.0% | 4.0ms | `values` | `[native code]` |
| 0.0% | 4.0ms | 0.0% | 4.0ms | `convertWhereClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:365` |
| 0.0% | 3.9ms | 0.0% | 3.9ms | `async ensureCalendarEventRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts` |
| 0.0% | 3.9ms | 0.0% | 0us | `internal:streams/legacy` | `internal:streams/legacy:2` |
| 0.0% | 3.9ms | 0.0% | 0us | `encrypt` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/utils.js:875` |
| 0.0% | 3.9ms | 0.0% | 1.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs:41` |
| 0.0% | 3.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_arx.js:210` |
| 0.0% | 3.8ms | 0.0% | 3.8ms | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:696` |
| 0.0% | 3.8ms | 0.0% | 1.3ms | `NextResponse` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:42` |
| 0.0% | 3.8ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/decorators/auto-injectable.js:4` |
| 0.0% | 3.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:222` |
| 0.0% | 3.8ms | 0.0% | 3.8ms | `async setCookieCache` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/index.mjs:122` |
| 0.0% | 3.8ms | 0.0% | 3.8ms | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/dialect/pglite/pglite-driver.js:12` |
| 0.0% | 3.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-id-field.mjs:56` |
| 0.0% | 3.7ms | 0.0% | 0us | `async createAuthenticatedTestSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testAuthHarness.ts:213` |
| 0.0% | 3.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@zone-eu/mailsplit/index.js:3` |
| 0.0% | 3.7ms | 0.0% | 0us | `getTopicSuggestionSignalsForThreadsFromDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:190` |
| 0.0% | 3.7ms | 0.0% | 0us | `shardWriterGuardsInstalled` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:62` |
| 0.0% | 3.7ms | 0.0% | 1.2ms | `applyExcludedFolderFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:908` |
| 0.0% | 3.6ms | 0.0% | 0us | `ensureCalendarReminderOptionalColumns` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:262` |
| 0.0% | 3.6ms | 0.0% | 0us | `decodeSecret` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/secret.ts:68` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `assertCredentialMode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/secret.ts:8` |
| 0.0% | 3.6ms | 0.0% | 0us | `noctuaAuthOptions` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:78` |
| 0.0% | 3.6ms | 0.0% | 2.3ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2249` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `checkChar` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 3.6ms | 0.0% | 0us | `decryptPayload` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/secret.ts:57` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `subarray` | `[native code]` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `async ensureAsyncStorage` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/transaction.mjs` |
| 0.0% | 3.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:538` |
| 0.0% | 3.6ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:883` |
| 0.0% | 3.6ms | 0.0% | 0us | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1346` |
| 0.0% | 3.6ms | 0.0% | 0us | `pruneThreadTopicsWithoutMessages` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:181` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs` |
| 0.0% | 3.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ip-address.js:29` |
| 0.0% | 3.6ms | 0.0% | 1.2ms | `async ensureCalendarEventRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:661` |
| 0.0% | 3.6ms | 0.0% | 3.6ms | `init` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:64` |
| 0.0% | 3.5ms | 0.0% | 0us | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts:37` |
| 0.0% | 3.5ms | 0.0% | 1.2ms | `async getTopicsForThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/core.ts:191` |
| 0.0% | 3.5ms | 0.0% | 0us | `node:fs` | `node:fs:8` |
| 0.0% | 3.5ms | 0.0% | 0us | `internal:validators` | `internal:validators:2` |
| 0.0% | 3.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ip-address.js:27` |
| 0.0% | 3.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/css-syntax-error.js:3` |
| 0.0% | 3.5ms | 0.0% | 3.5ms | `query` | `bun:sqlite:382` |
| 0.0% | 3.5ms | 0.0% | 3.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/topics.ts:3` |
| 0.0% | 3.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/tools.js:8` |
| 0.0% | 3.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js:14` |
| 0.0% | 3.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:748` |
| 0.0% | 3.5ms | 0.0% | 0us | `__extends` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:506` |
| 0.0% | 3.5ms | 0.0% | 3.5ms | `__` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js` |
| 0.0% | 3.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:735` |
| 0.0% | 3.5ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs:44` |
| 0.0% | 3.5ms | 0.0% | 0us | `_string` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/api.js:12` |
| 0.0% | 3.5ms | 0.0% | 3.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:303` |
| 0.0% | 3.5ms | 0.0% | 0us | `ZodString` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` |
| 0.0% | 3.5ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2480` |
| 0.0% | 3.5ms | 0.0% | 1.1ms | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1360` |
| 0.0% | 3.5ms | 0.0% | 3.5ms | `has` | `[native code]` |
| 0.0% | 3.5ms | 0.0% | 3.5ms | `assign` | `[native code]` |
| 0.0% | 3.5ms | 0.0% | 2.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:458` |
| 0.0% | 3.4ms | 0.0% | 2.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:79` |
| 0.0% | 3.4ms | 0.0% | 0us | `DBCSCodec` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:116` |
| 0.0% | 3.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:251` |
| 0.0% | 3.4ms | 0.0% | 0us | `performProxyObjectHas` | `[native code]` |
| 0.0% | 3.4ms | 0.0% | 1.2ms | `has` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/env-impl.mjs:9` |
| 0.0% | 3.4ms | 0.0% | 3.4ms | `#run` | `bun:sqlite` |
| 0.0% | 3.4ms | 0.0% | 0us | `async ensureCalendarEventRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:668` |
| 0.0% | 3.4ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/sign-in.mjs:368` |
| 0.0% | 3.4ms | 0.0% | 1.4ms | `async validateAccountFolders` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/folderAccount.ts:12` |
| 0.0% | 3.4ms | 0.0% | 0us | `rebuildThreadSignalsForThreadIdsInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:76` |
| 0.0% | 3.4ms | 0.0% | 3.4ms | `slice` | `[native code]` |
| 0.0% | 3.4ms | 0.0% | 2.3ms | `async getDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:293` |
| 0.0% | 3.4ms | 0.0% | 0us | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:79` |
| 0.0% | 3.4ms | 0.0% | 0us | `(module)` | `/tmp/spike-switch-server/inspect.ts:7` |
| 0.0% | 3.4ms | 0.0% | 0us | `async withAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:412` |
| 0.0% | 3.4ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:880` |
| 0.0% | 3.3ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/from-json-schema.js:7` |
| 0.0% | 3.3ms | 0.0% | 1.0ms | `getThreadCollabStates` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts:78` |
| 0.0% | 3.3ms | 0.0% | 3.3ms | `trim` | `[native code]` |
| 0.0% | 3.3ms | 0.0% | 0us | `transformJoinClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:291` |
| 0.0% | 3.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/headers.js:1` |
| 0.0% | 3.3ms | 0.0% | 3.3ms | `async requireAccountContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/accountContext.ts:64` |
| 0.0% | 3.3ms | 0.0% | 0us | `ensureAccountKeySchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accountKeys.ts:162` |
| 0.0% | 3.3ms | 0.0% | 3.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:618` |
| 0.0% | 3.3ms | 0.0% | 2.3ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2293` |
| 0.0% | 3.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/enveloped_data.js:9` |
| 0.0% | 3.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/recipient_infos.js:7` |
| 0.0% | 3.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:155` |
| 0.0% | 3.2ms | 0.0% | 3.2ms | `addressparser` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1201` |
| 0.0% | 3.2ms | 0.0% | 3.2ms | `query` | `bun:sqlite:384` |
| 0.0% | 3.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/pino.js:4` |
| 0.0% | 3.2ms | 0.0% | 3.2ms | `#get` | `bun:sqlite` |
| 0.0% | 3.2ms | 0.0% | 0us | `async sqliteGeneratedPrimaryKeyColumn` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:25` |
| 0.0% | 3.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/libmime.js:45` |
| 0.0% | 3.2ms | 0.0% | 3.2ms | `createFunctionModule` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/function-module.js` |
| 0.0% | 3.2ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:850` |
| 0.0% | 3.1ms | 0.0% | 971us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2583` |
| 0.0% | 3.1ms | 0.0% | 0us | `async requireActiveUserSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:71` |
| 0.0% | 3.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:277` |
| 0.0% | 3.1ms | 0.0% | 3.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/index.mjs` |
| 0.0% | 3.1ms | 0.0% | 0us | `getEndpoints` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/index.mjs:92` |
| 0.0% | 3.1ms | 0.0% | 0us | `createBetterAuth` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/auth/base.mjs:21` |
| 0.0% | 3.1ms | 0.0% | 0us | `ensureAccountKeySchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accountKeys.ts:164` |
| 0.0% | 3.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/attributes/index.js:5` |
| 0.0% | 3.1ms | 0.0% | 0us | `getChunkedCookie` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/session-store.mjs:142` |
| 0.0% | 3.1ms | 0.0% | 3.1ms | `async getDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts` |
| 0.0% | 3.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:4` |
| 0.0% | 3.1ms | 0.0% | 2.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/tracer.mjs:38` |
| 0.0% | 3.1ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:874` |
| 0.0% | 3.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/rsaes_oaep.js:8` |
| 0.0% | 3.1ms | 0.0% | 0us | `ensureMasterTeamColumns` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:167` |
| 0.0% | 3.1ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:846` |
| 0.0% | 3.1ms | 0.0% | 3.1ms | `async get` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:39` |
| 0.0% | 3.1ms | 0.0% | 3.1ms | `normalizeRouteParamValue` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/accountContext.ts` |
| 0.0% | 3.0ms | 0.0% | 0us | `async stageMessageFiles` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/storage.ts:264` |
| 0.0% | 3.0ms | 0.0% | 0us | `async getMigrations` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:345` |
| 0.0% | 3.0ms | 0.0% | 0us | `buildSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-schema.mjs:10` |
| 0.0% | 3.0ms | 0.0% | 0us | `async recomputeThreadsForAccountInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:281` |
| 0.0% | 3.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:285` |
| 0.0% | 3.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:267` |
| 0.0% | 3.0ms | 0.0% | 0us | `async acquireAuthLifetimeLock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authLifetimeLock.ts:64` |
| 0.0% | 3.0ms | 0.0% | 0us | `async ensureAuthLifetimeLock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authLifetimeLock.ts:75` |
| 0.0% | 3.0ms | 0.0% | 0us | `async getSharedTestAuthHarness` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testAuthHarness.ts:150` |
| 0.0% | 3.0ms | 0.0% | 0us | `getAuth` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:285` |
| 0.0% | 3.0ms | 0.0% | 3.0ms | `async acquireAuthLifetimeLock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authLifetimeLock.ts` |
| 0.0% | 3.0ms | 0.0% | 3.0ms | `async enrichMessagesWithThreadTopics` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts:49` |
| 0.0% | 3.0ms | 0.0% | 3.0ms | `(unknown)` | `[native code]` |
| 0.0% | 3.0ms | 0.0% | 1.1ms | `normalizeShardSql` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/ftsIdentity.ts:2` |
| 0.0% | 3.0ms | 0.0% | 0us | `closeAccountDbConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:194` |
| 0.0% | 3.0ms | 0.0% | 0us | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:78` |
| 0.0% | 3.0ms | 0.0% | 3.0ms | `close` | `[native code]` |
| 0.0% | 2.9ms | 0.0% | 0us | `convertWhereClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:373` |
| 0.0% | 2.9ms | 0.0% | 2.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js` |
| 0.0% | 2.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:360` |
| 0.0% | 2.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:179` |
| 0.0% | 2.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:208` |
| 0.0% | 2.9ms | 0.0% | 2.9ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs` |
| 0.0% | 2.9ms | 0.0% | 2.9ms | `combineMiddleware` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:59` |
| 0.0% | 2.9ms | 0.0% | 0us | `async getSessionFromCtx` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:275` |
| 0.0% | 2.9ms | 0.0% | 0us | `async verifyTwoFactor` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/verify-two-factor.mjs:14` |
| 0.0% | 2.9ms | 0.0% | 0us | `createConfiguredEndpoint` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:67` |
| 0.0% | 2.9ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:248` |
| 0.0% | 2.9ms | 0.0% | 1.7ms | `getAuthTablesWithResolvedIndexes` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/get-tables.mjs:289` |
| 0.0% | 2.9ms | 0.0% | 0us | `get` | `/tmp/spike-switch-server/inspect.ts:12` |
| 0.0% | 2.9ms | 0.0% | 1.9ms | `header` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testAuthHarness.ts:79` |
| 0.0% | 2.9ms | 0.0% | 0us | `ensureTableColumns` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:147` |
| 0.0% | 2.9ms | 0.0% | 1.7ms | `async lock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:81` |
| 0.0% | 2.9ms | 0.0% | 0us | `async acquireConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:34` |
| 0.0% | 2.8ms | 0.0% | 937us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2708` |
| 0.0% | 2.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:75` |
| 0.0% | 2.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:56` |
| 0.0% | 2.8ms | 0.0% | 0us | `async makeSignature` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:24` |
| 0.0% | 2.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:27` |
| 0.0% | 2.8ms | 0.0% | 0us | `async setSessionCookie` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/index.mjs:172` |
| 0.0% | 2.8ms | 0.0% | 0us | `async serializeSignedCookie` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:84` |
| 0.0% | 2.8ms | 0.0% | 0us | `async setSignedCookie` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:58` |
| 0.0% | 2.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:83` |
| 0.0% | 2.8ms | 0.0% | 2.8ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs` |
| 0.0% | 2.8ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:22` |
| 0.0% | 2.8ms | 0.0% | 0us | `async signCookieValue` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:30` |
| 0.0% | 2.8ms | 0.0% | 972us | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1288` |
| 0.0% | 2.8ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:927` |
| 0.0% | 2.8ms | 0.0% | 2.8ms | `escapeSqlLiteral` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:921` |
| 0.0% | 2.7ms | 0.0% | 0us | `encrypt` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:351` |
| 0.0% | 2.7ms | 0.0% | 2.7ms | `wrapStatement` | `/tmp/spike-switch-server/sqlcounter.ts:79` |
| 0.0% | 2.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/headers.js:2` |
| 0.0% | 2.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/next-url.js:12` |
| 0.0% | 2.7ms | 0.0% | 0us | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:391` |
| 0.0% | 2.7ms | 0.0% | 0us | `backfillCalendarReminderEventUidKeys` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:1446` |
| 0.0% | 2.7ms | 0.0% | 0us | `ensureCalendarReminderRuntimeSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:273` |
| 0.0% | 2.7ms | 0.0% | 2.7ms | `createFunctionModule` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/function-module.js:20` |
| 0.0% | 2.7ms | 0.0% | 0us | `_date` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/api.js:480` |
| 0.0% | 2.7ms | 0.0% | 0us | `async deleteWithHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/with-hooks.mjs:137` |
| 0.0% | 2.7ms | 0.0% | 2.7ms | `async enrollTestTotp` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testAuthHarness.ts:197` |
| 0.0% | 2.7ms | 0.0% | 0us | `hchacha` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:154` |
| 0.0% | 2.7ms | 0.0% | 0us | `computeTag` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:318` |
| 0.0% | 2.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/converters.js:9` |
| 0.0% | 2.7ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:877` |
| 0.0% | 2.6ms | 0.0% | 0us | `async #transformResult` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:167` |
| 0.0% | 2.6ms | 0.0% | 0us | `async executeQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:41` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs:11` |
| 0.0% | 2.6ms | 0.0% | 0us | `__exportStar` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:203` |
| 0.0% | 2.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:212` |
| 0.0% | 2.6ms | 0.0% | 0us | `buildMeaningfulAttachmentPredicateSql` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:941` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:229` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `columnNames` | `bun:sqlite:198` |
| 0.0% | 2.6ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:892` |
| 0.0% | 2.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:151` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:177` |
| 0.0% | 2.6ms | 0.0% | 0us | `async getDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:302` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `info` | `[native code]` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `checkSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema-check.mjs:72` |
| 0.0% | 2.6ms | 0.0% | 0us | `async getTables` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:81` |
| 0.0% | 2.6ms | 0.0% | 0us | `async getMigrations` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:361` |
| 0.0% | 2.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/index.js:9` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `deriveSystemFlagState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:320` |
| 0.0% | 2.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/authPolicy.ts:243` |
| 0.0% | 2.6ms | 0.0% | 0us | `isInstalledControlPlane` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/authPolicy.ts:222` |
| 0.0% | 2.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/authPolicy.ts:222` |
| 0.0% | 2.6ms | 0.0% | 0us | `schemaSql` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/authPolicy.ts:134` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `push` | `[native code]` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `parseStringReferenceWithTable` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js:88` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `normalizeImapFlags` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageFlags.ts:172` |
| 0.0% | 2.5ms | 0.0% | 1.3ms | `find` | `[native code]` |
| 0.0% | 2.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/socks/build/client/socksclient.js:15` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `prepareAccountShardConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts` |
| 0.0% | 2.5ms | 0.0% | 0us | `configureAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:106` |
| 0.0% | 2.5ms | 0.0% | 0us | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:38` |
| 0.0% | 2.5ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:865` |
| 0.0% | 2.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:33` |
| 0.0% | 2.5ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testAuthHarness.ts:161` |
| 0.0% | 2.5ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testAuthHarness.ts:171` |
| 0.0% | 2.5ms | 0.0% | 0us | `async createAuthenticatedTestSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testAuthHarness.ts:208` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2662` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `async runValidation` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/validator.mjs` |
| 0.0% | 2.5ms | 0.0% | 2.5ms | `twoFactor` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/index.mjs` |
| 0.0% | 2.4ms | 0.0% | 0us | `ResponseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/@edge-runtime/cookies/index.js:256` |
| 0.0% | 2.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/after/index.js:6` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv6.js` |
| 0.0% | 2.4ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:886` |
| 0.0% | 2.4ms | 0.0% | 1.2ms | `getTopicSuggestionSignalsForThreadsFromDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:180` |
| 0.0% | 2.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:253` |
| 0.0% | 2.4ms | 0.0% | 0us | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:387` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `ensureSenderIdentityMessageRuntimeSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts` |
| 0.0% | 2.4ms | 0.0% | 1.2ms | `getColorDepth` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs:49` |
| 0.0% | 2.4ms | 0.0% | 1.4ms | `chachaCore` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:102` |
| 0.0% | 2.4ms | 0.0% | 0us | `async releaseConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:67` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:52` |
| 0.0% | 2.4ms | 0.0% | 1.2ms | `toOperationNode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:385` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `tokenize` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `extractJiraProjectKeys` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:51` |
| 0.0% | 2.4ms | 0.0% | 0us | `localFromBER` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1438` |
| 0.0% | 2.4ms | 0.0% | 1.2ms | `parseStringReference` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js:48` |
| 0.0% | 2.4ms | 0.0% | 0us | `SHA2_64B` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha2.js:189` |
| 0.0% | 2.4ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha2.js:417` |
| 0.0% | 2.4ms | 0.0% | 0us | `_SHA384` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha2.js:325` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `HashMD` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/_md.js:77` |
| 0.0% | 2.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha2.js:417` |
| 0.0% | 2.4ms | 0.0% | 0us | `createHasher` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/utils.js:632` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `includes` | `[native code]` |
| 0.0% | 2.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/connection.js:16` |
| 0.0% | 2.4ms | 0.0% | 0us | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:838` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `assertPasswordNotTooLong` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/utils/password.mjs:13` |
| 0.0% | 2.4ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/sign-in.mjs:316` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:19` |
| 0.0% | 2.4ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:824` |
| 0.0% | 2.4ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/outboundWrite.ts:27` |
| 0.0% | 2.4ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:105` |
| 0.0% | 2.4ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:71` |
| 0.0% | 2.4ms | 0.0% | 0us | `shardWriterGuardsInstalled` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:60` |
| 0.0% | 2.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/index.js:6` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/ua-parser-js/ua-parser.js` |
| 0.0% | 2.4ms | 0.0% | 0us | `__nccwpck_require__` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/ua-parser-js/ua-parser.js:1` |
| 0.0% | 2.4ms | 0.0% | 0us | `943` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/ua-parser-js/ua-parser.js:1` |
| 0.0% | 2.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/user-agent.js:27` |
| 0.0% | 2.4ms | 0.0% | 2.4ms | `async resolveAccountDbPath` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:343` |
| 0.0% | 2.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js:8` |
| 0.0% | 2.4ms | 0.0% | 0us | `async rawDecrypt` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/crypto/index.mjs:39` |
| 0.0% | 2.4ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:372` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `async getUserById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/users.ts:72` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `mapUserRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:61` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:705` |
| 0.0% | 2.3ms | 0.0% | 1.2ms | `async runWithRequestState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:24` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `genShake` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha3.js` |
| 0.0% | 2.3ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha3.js:433` |
| 0.0% | 2.3ms | 0.0% | 0us | `buildFtsIdentity` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/ftsIdentity.ts:38` |
| 0.0% | 2.3ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:110` |
| 0.0% | 2.3ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:60` |
| 0.0% | 2.3ms | 0.0% | 0us | `Kysely` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/kysely.js:70` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `Log` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/log.js` |
| 0.0% | 2.3ms | 0.0% | 0us | `migrate` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accountKeys.ts:219` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `Headers` | `[native code]` |
| 0.0% | 2.3ms | 0.0% | 0us | `(module)` | `/tmp/spike-switch-server/inspect.ts:27` |
| 0.0% | 2.3ms | 0.0% | 0us | `exit` | `[native code]` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:80` |
| 0.0% | 2.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/picocolors/picocolors.js:4` |
| 0.0% | 2.3ms | 0.0% | 0us | `setWeights` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/mail/categorization/linearModel.ts:52` |
| 0.0% | 2.3ms | 0.0% | 0us | `async getCategoryLinearModel` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/categories.ts:89` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `listSenderIdentityRows` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/senderIdentities.ts` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `async createInternalContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:7` |
| 0.0% | 2.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/adapters/request-cookies.js:50` |
| 0.0% | 2.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/cookies.js:11` |
| 0.0% | 2.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:37` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:242` |
| 0.0% | 2.3ms | 0.0% | 0us | `async create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:501` |
| 0.0% | 2.3ms | 0.0% | 0us | `initAccountSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:978` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `/\s/` | `[native code]` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:13` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:288` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `open` | `[native code]` |
| 0.0% | 2.3ms | 0.0% | 0us | `async getDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:299` |
| 0.0% | 2.3ms | 0.0% | 0us | `Database` | `bun:sqlite:268` |
| 0.0% | 2.3ms | 0.0% | 0us | `internal:streams/readable` | `internal:streams/readable:2` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `ensureCalendarEventOptionalColumns` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:444` |
| 0.0% | 2.3ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:664` |
| 0.0% | 2.3ms | 0.0% | 1.0ms | `getColorDepth` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs:59` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:157` |
| 0.0% | 2.3ms | 0.0% | 2.3ms | `displayDayNumber` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts` |
| 0.0% | 2.3ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:809` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/well-known/index.js:11` |
| 0.0% | 2.2ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/well-known/index.js:3` |
| 0.0% | 2.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/well-known/index.js:10` |
| 0.0% | 2.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/imapflow/node_modules/iconv-lite/lib/index.js:6` |
| 0.0% | 2.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/init.mjs:10` |
| 0.0% | 2.2ms | 0.0% | 0us | `async createAuthContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/create-context.mjs:233` |
| 0.0% | 2.2ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/generated/decode-data-html.js:4` |
| 0.0% | 2.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:851` |
| 0.0% | 2.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1088` |
| 0.0% | 2.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:13` |
| 0.0% | 2.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/dynamic-rendering-utils.js:101` |
| 0.0% | 2.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:70` |
| 0.0% | 2.2ms | 0.0% | 0us | `async dispatchAuthEndpoint` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:205` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `init` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:52` |
| 0.0% | 2.2ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/passkey/dist/index.mjs:583` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `Statement` | `bun:sqlite:109` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `_getEnv` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/env-impl.mjs` |
| 0.0% | 2.2ms | 0.0% | 0us | `getColorDepth` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs:65` |
| 0.0% | 2.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/source-map-js/source-map.js:6` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `install` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/storage.ts` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:23` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:560` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:394` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2224` |
| 0.0% | 2.2ms | 0.0% | 0us | `async update` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:578` |
| 0.0% | 2.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:491` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `async ensureCalendarEventRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:663` |
| 0.0% | 2.2ms | 0.0% | 0us | `initAccountSchemaBody` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:1377` |
| 0.0% | 2.2ms | 0.0% | 1.1ms | `bound optional` | `[native code]` |
| 0.0% | 2.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/index.js:7` |
| 0.0% | 2.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/index.js:7` |
| 0.0% | 2.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/certificate.js:7` |
| 0.0% | 2.2ms | 0.0% | 0us | `normalizeUserEmails` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:240` |
| 0.0% | 2.2ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:851` |
| 0.0% | 2.2ms | 0.0% | 2.2ms | `push` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 2.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authPolicyHandler.ts:285` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:103` |
| 0.0% | 2.1ms | 0.0% | 1.0ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2530` |
| 0.0% | 2.1ms | 0.0% | 0us | `toAsnItem` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js:131` |
| 0.0% | 2.1ms | 0.0% | 0us | `toASN` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js:53` |
| 0.0% | 2.1ms | 0.0% | 0us | `async execute` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/schema/create-table-builder.js:463` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:147` |
| 0.0% | 2.1ms | 0.0% | 0us | `async getThreadGroupCounts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1381` |
| 0.0% | 2.1ms | 0.0% | 0us | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1302` |
| 0.0% | 2.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:709` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:5` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2661` |
| 0.0% | 2.1ms | 0.0% | 0us | `async findMany` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:570` |
| 0.0% | 2.1ms | 0.0% | 0us | `async findMany` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:530` |
| 0.0% | 2.1ms | 0.0% | 0us | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:75` |
| 0.0% | 2.1ms | 0.0% | 0us | `add` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:373` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `sqliteIntegerPrimaryKeyColumn` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:20` |
| 0.0% | 2.1ms | 0.0% | 0us | `ensureThreadCollabRuntimeSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:969` |
| 0.0% | 2.1ms | 0.0% | 0us | `install` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:927` |
| 0.0% | 2.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:173` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `roleAtLeast` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/accountRole.ts:5` |
| 0.0% | 2.1ms | 0.0% | 0us | `async requireAccountContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/accountContext.ts:58` |
| 0.0% | 2.1ms | 0.0% | 0us | `own` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:745` |
| 0.0% | 2.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/social-providers/index.mjs:78` |
| 0.0% | 2.1ms | 0.0% | 0us | `transformJoinClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:317` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:164` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts` |
| 0.0% | 2.1ms | 0.0% | 0us | `async getMigrations` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:646` |
| 0.0% | 2.1ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:889` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authPolicyHandler.ts:289` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `async getThreadGroupCounts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1402` |
| 0.0% | 2.1ms | 0.0% | 2.1ms | `get` | `/tmp/spike-switch-server/inspect.ts` |
| 0.0% | 2.0ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:837` |
| 0.0% | 2.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:124` |
| 0.0% | 2.0ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2227` |
| 0.0% | 2.0ms | 0.0% | 0us | `toBER` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1511` |
| 0.0% | 2.0ms | 0.0% | 0us | `toBER` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:2366` |
| 0.0% | 2.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/index.js:4` |
| 0.0% | 2.0ms | 0.0% | 0us | `getFieldName` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-name.mjs:22` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `sortGroupsForGroupBy` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageGrouping.ts:96` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `async deleteWithHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/with-hooks.mjs` |
| 0.0% | 2.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/totp/index.mjs:213` |
| 0.0% | 2.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:496` |
| 0.0% | 2.0ms | 0.0% | 0us | `async deleteSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:499` |
| 0.0% | 2.0ms | 0.0% | 0us | `async deleteWithHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/with-hooks.mjs:151` |
| 0.0% | 2.0ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/device-authorization/index.mjs:10` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `custom` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `getSharedDbHarnessState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testDbHarness.ts` |
| 0.0% | 2.0ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testDbHarness.ts:49` |
| 0.0% | 2.0ms | 0.0% | 0us | `async assertAccountFolder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/folderAccountGuard.ts:9` |
| 0.0% | 2.0ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:841` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `next` | `[native code]` |
| 0.0% | 2.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/algorithms.js:25` |
| 0.0% | 2.0ms | 0.0% | 2.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:83` |
| 0.0% | 2.0ms | 0.0% | 1.0ms | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1274` |
| 0.0% | 2.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/attributes/counter_signature.js:6` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `transformJoinClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:296` |
| 0.0% | 1.9ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:99` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:77` |
| 0.0% | 1.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:376` |
| 0.0% | 1.9ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2305` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:855` |
| 0.0% | 1.9ms | 0.0% | 0us | `tlds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:607` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `hydrateIdentityMetadata` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/identityMetadata.ts:8` |
| 0.0% | 1.9ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/mailparser/dist/esm/mail-parser.js:40` |
| 0.0% | 1.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:158` |
| 0.0% | 1.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/tools.js:28` |
| 0.0% | 1.9ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:348` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `resolve` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-model-name.mjs:17` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authPolicyHandler.ts` |
| 0.0% | 1.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-model-name.mjs:24` |
| 0.0% | 1.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-model-name.mjs:14` |
| 0.0% | 1.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/charset.js:15` |
| 0.0% | 1.9ms | 0.0% | 0us | `tlds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:618` |
| 0.0% | 1.9ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/mailparser/dist/esm/mail-parser.js:41` |
| 0.0% | 1.9ms | 0.0% | 0us | `ValueBlock` | `[native code]` |
| 0.0% | 1.9ms | 0.0% | 1.9ms | `LocalBaseBlock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:201` |
| 0.0% | 1.9ms | 0.0% | 0us | `BaseBlock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:924` |
| 0.0% | 1.9ms | 0.0% | 0us | `ObjectIdentifier` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:2473` |
| 0.0% | 1.9ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:548` |
| 0.0% | 1.8ms | 0.0% | 0us | `ensureInviteIssuerSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:127` |
| 0.0% | 1.8ms | 0.0% | 0us | `initMasterSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:866` |
| 0.0% | 1.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/processor.js:5` |
| 0.0% | 1.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/postcss.js:15` |
| 0.0% | 1.7ms | 0.0% | 0us | `async ensureAsyncStorage` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/transaction.mjs:12` |
| 0.0% | 1.7ms | 0.0% | 1.7ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/transaction.mjs:7` |
| 0.0% | 1.7ms | 0.0% | 1.7ms | `async stageMessageFiles` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/storage.ts:233` |
| 0.0% | 1.7ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/index.js:8` |
| 0.0% | 1.7ms | 0.0% | 1.7ms | `splice` | `[native code]` |
| 0.0% | 1.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/postcss.js:8` |
| 0.0% | 1.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/source-map-js/source-map.js:7` |
| 0.0% | 1.6ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/request.js:25` |
| 0.0% | 1.6ms | 0.0% | 0us | `async execute` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/raw-builder/raw-builder.js:43` |
| 0.0% | 1.6ms | 0.0% | 0us | `async sqliteGeneratedPrimaryKeyColumn` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:29` |
| 0.0% | 1.5ms | 0.0% | 1.5ms | `ZodDate` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:95` |
| 0.0% | 1.5ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema/verification.mjs:6` |
| 0.0% | 1.5ms | 0.0% | 1.5ms | `create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/binary-operation-node.js:11` |
| 0.0% | 1.5ms | 0.0% | 1.5ms | `getOwnPropertyDescriptor` | `[native code]` |
| 0.0% | 1.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/types/index.js:5` |
| 0.0% | 1.5ms | 0.0% | 0us | `__importStar` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:327` |
| 0.0% | 1.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:208` |
| 0.0% | 1.5ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/types/octet_string.js:5` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `async #transformResult` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/oauth-popup/index.mjs:98` |
| 0.0% | 1.4ms | 0.0% | 0us | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1337` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `applySearchQueryFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:717` |
| 0.0% | 1.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv4.js:29` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:31` |
| 0.0% | 1.4ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/organization/routes/crud-org.mjs:13` |
| 0.0% | 1.4ms | 0.0% | 0us | `min` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:219` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/checks.js:9` |
| 0.0% | 1.4ms | 0.0% | 0us | `bound min` | `[native code]` |
| 0.0% | 1.4ms | 0.0% | 0us | `_minLength` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/api.js:604` |
| 0.0% | 1.4ms | 0.0% | 0us | `$ZodCheckMinLength` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` |
| 0.0% | 1.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/checks.js:290` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `async findOne` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` |
| 0.0% | 1.4ms | 0.0% | 0us | `buildMeaningfulAttachmentPredicateSql` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:942` |
| 0.0% | 1.4ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/next-url.js:11` |
| 0.0% | 1.4ms | 0.0% | 0us | `async recomputeThreadsForAccountInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:322` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `initAccountSchemaBody` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `async migrateAuthSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `transformJoinClause` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:282` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `append` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:1332` |
| 0.0% | 1.4ms | 0.0% | 0us | `bound visitBinaryOperation` | `[native code]` |
| 0.0% | 1.4ms | 0.0% | 0us | `visitOperator` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:374` |
| 0.0% | 1.4ms | 0.0% | 0us | `bound visitOperator` | `[native code]` |
| 0.0% | 1.4ms | 0.0% | 0us | `visitBinaryOperation` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:1151` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `async executeQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js` |
| 0.0% | 1.4ms | 0.0% | 0us | `async getTables` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:69` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `getHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:165` |
| 0.0% | 1.3ms | 0.0% | 0us | `accountRuntimeProbesSettled` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:171` |
| 0.0% | 1.3ms | 0.0% | 0us | `query` | `bun:sqlite:386` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/index.js:16` |
| 0.0% | 1.3ms | 0.0% | 0us | `[prepareOwned]` | `bun:sqlite:369` |
| 0.0% | 1.3ms | 0.0% | 0us | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:403` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `ValidationError` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/error.mjs` |
| 0.0% | 1.3ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:11` |
| 0.0% | 1.3ms | 0.0% | 0us | `digest` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_poly1305.js:296` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `finalize` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_poly1305.js` |
| 0.0% | 1.3ms | 0.0% | 0us | `digestInto` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_poly1305.js:287` |
| 0.0% | 1.3ms | 0.0% | 0us | `computeTag` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:328` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `charAt` | `[native code]` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:93` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `rmSync` | `[native code]` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testDbHarness.ts:43` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/attribute_certificate_info.js:7` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/index.js:9` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/attribute_certificate.js:7` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/providers/index.js:3` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `now` | `[native code]` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/dependency-container.js:5` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/dependency-container.js:6` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `normalizeIdentityEmail` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:156` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/memoizer.js` |
| 0.0% | 1.3ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema/shared.mjs:3` |
| 0.0% | 1.3ms | 0.0% | 0us | `ZodObject` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:100` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv6.js:1454` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `deriveSystemFlagState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:322` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:22` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async stageMessageFiles` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/storage.ts:230` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async getCurrentRequestState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:19` |
| 0.0% | 1.3ms | 0.0% | 0us | `decrypt` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:360` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `chachaCore` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:75` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `normalizeSearchTermList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:525` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/react/cjs/react.development.js:1329` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/react/index.js:6` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/react/cjs/react.development.js` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:110` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:277` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async getAccountIdFromParams` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/accountContext.ts` |
| 0.0% | 1.3ms | 0.0% | 0us | `async GET` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:55` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/index.js:10` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/converters/index.js:4` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async verifyTwoFactor` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/verify-two-factor.mjs` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/authPolicy.ts:287` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `getOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sanitize-html/node_modules/htmlparser2/node_modules/domutils/node_modules/dom-serializer/dist/foreign-names.js:14` |
| 0.0% | 1.3ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sanitize-html/node_modules/htmlparser2/node_modules/domutils/node_modules/dom-serializer/dist/foreign-names.js:14` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:231` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/css-syntax-error.js:5` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/terminal-highlight.js:5` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `getAuthTablesWithResolvedIndexes` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/get-tables.mjs` |
| 0.0% | 1.3ms | 0.0% | 0us | `getBetterAuthVersion` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/global.mjs:36` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/dom-serializer/node_modules/entities/lib/esm/generated/decode-data-html.js:6` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:161` |
| 0.0% | 1.3ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/dom-serializer/node_modules/entities/lib/esm/generated/decode-data-html.js:6` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `__getBetterAuthGlobal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/global.mjs` |
| 0.0% | 1.3ms | 0.0% | 0us | `async createAuthContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/create-context.mjs:133` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:62` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `looksLikeJiraMessage` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:30` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/mail/categorization/linearModel.ts:53` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async getMigrations` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs` |
| 0.0% | 1.3ms | 0.0% | 0us | `createSeededLinearModel` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/mail/categorization/linearModel.ts:141` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `parseTable` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/table-parser.js:39` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/work-async-storage.external.js:11` |
| 0.0% | 1.3ms | 0.0% | 0us | `visitReference` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:291` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/after/after.js:11` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:56` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `addColumn` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/schema/create-table-builder.js` |
| 0.0% | 1.3ms | 0.0% | 0us | `async getMigrations` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:631` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `init` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:74` |
| 0.0% | 1.3ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/oauth2/authorization-params.mjs:10` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-ecc/build/cjs/index.js:5` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/headers.js:11` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/decorators/index.js:8` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/index.js:22` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:151` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-csr/build/cjs/index.js:5` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:37` |
| 0.0% | 1.3ms | 0.0% | 0us | `async updateUser` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:627` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async updateWithHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/with-hooks.mjs` |
| 0.0% | 1.3ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:617` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/fromJSON.js:9` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/index.mjs` |
| 0.0% | 1.3ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/totp/index.mjs:208` |
| 0.0% | 1.3ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/index.js:13` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:35` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `WeakReference` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 0us | `set` | `node:diagnostics_channel:22` |
| 0.0% | 1.2ms | 0.0% | 0us | `channel` | `node:diagnostics_channel:141` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `normalizeAccountSettings` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/accountSettings.ts` |
| 0.0% | 1.2ms | 0.0% | 0us | `node:_http_client` | `node:_http_client:16` |
| 0.0% | 1.2ms | 0.0% | 0us | `Channel` | `node:diagnostics_channel:108` |
| 0.0% | 1.2ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/parse5/dist/common/foreign-content.js:121` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/parse5/dist/common/foreign-content.js` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/operator-node.js:116` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:69` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async acquireConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:43` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `mapAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:179` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2326` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/index.js:6` |
| 0.0% | 1.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:62` |
| 0.0% | 1.2ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/deepmerge-ts/dist/index.mjs:1632` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `deepmergeIntoFastUnsafeCustom` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/deepmerge-ts/dist/index.mjs` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:26` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/enveloped_data.js:10` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/originator_info.js:7` |
| 0.0% | 1.2ms | 0.0% | 0us | `ftsIdentitySchemaInstalled` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/ftsIdentity.ts:17` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:667` |
| 0.0% | 1.2ms | 0.0% | 0us | `async findSchemaProblems` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:262` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:253` |
| 0.0% | 1.2ms | 0.0% | 0us | `async findSchemaProblems` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:253` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `NameIdentifier` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/converters/index.js:17` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `sortGroupsForGroupBy` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageGrouping.ts:107` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `createWithSpan` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/tracer.mjs` |
| 0.0% | 1.2ms | 0.0% | 0us | `async dispatchAuthEndpoint` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:187` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `unlock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:87` |
| 0.0% | 1.2ms | 0.0% | 0us | `async releaseConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:66` |
| 0.0% | 1.2ms | 0.0% | 0us | `async releaseConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:47` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:89` |
| 0.0% | 1.2ms | 0.0% | 0us | `rebuildThreadSignalsForThreadIdsInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:102` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `add` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:65` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:18` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/recipient_info.js:8` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/kek_recipient_info.js:6` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/htmlparser2/node_modules/entities/dist/esm/decode.js` |
| 0.0% | 1.2ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/htmlparser2/node_modules/entities/dist/esm/decode.js:58` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async assertAccountFolder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/folderAccountGuard.ts:6` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/index.js:5` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/bytes/index.js:17` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `keys` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-android/build/cjs/index.js:4` |
| 0.0% | 1.2ms | 0.0% | 0us | `_defu` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/defu/dist/defu.mjs:23` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async getThreadCollabStates` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/threadCollab.ts:42` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-field-name.mjs:21` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:28` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `parseValueBinaryOperation` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/binary-operation-parser.js:22` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/config.js:1` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:103` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:158` |
| 0.0% | 1.2ms | 0.0% | 0us | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1301` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `applyVisibleMessageFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2320` |
| 0.0% | 1.2ms | 0.0% | 0us | `getTopicSuggestionsForThreadSignalBatch` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:575` |
| 0.0% | 1.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:256` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `prepareFtsIdentityWriter` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/ftsIdentity.ts:75` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_poly1305.js:318` |
| 0.0% | 1.2ms | 0.0% | 0us | `wrapMacConstructor` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/utils.js:632` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `u8to16` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_poly1305.js` |
| 0.0% | 1.2ms | 0.0% | 0us | `Poly1305` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_poly1305.js:57` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `Error` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/middleware.mjs` |
| 0.0% | 1.2ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_poly1305.js:318` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/utils.js:28` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `normalizeAccountSettings` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/accountSettings.ts:16` |
| 0.0% | 1.2ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/session-store.mjs:174` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `object` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:904` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/encoding-table.js:4` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `fireTriggers` | `/tmp/spike-switch-server/sqlcounter.ts` |
| 0.0% | 1.2ms | 0.0% | 0us | `node:fs` | `node:fs:728` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `setName` | `node:fs:675` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1215` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/tools.js:30` |
| 0.0% | 1.2ms | 0.0% | 0us | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:19` |
| 0.0% | 1.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:153` |
| 0.0% | 1.2ms | 0.0% | 0us | `async requireActiveUserSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:69` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `expireLegacyCookie` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authCookies.ts:3` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/libmime.js:1117` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `Libmime` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/libmime.js` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `getHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs` |
| 0.0% | 1.2ms | 0.0% | 0us | `parseSelectAll` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/select-parser.js:39` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:27` |
| 0.0% | 1.2ms | 0.0% | 0us | `generateFastpass` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1129` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:104` |
| 0.0% | 1.2ms | 0.0% | 0us | `createSelectAllFromTable` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/selection-node.js:27` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/doc.js:27` |
| 0.0% | 1.2ms | 0.0% | 0us | `write` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/doc.js:27` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:152` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `createSelectAll` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/reference-node.js` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sonic-boom/index.js:8` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:591` |
| 0.0% | 1.2ms | 0.0% | 0us | `node:assert` | `node:assert:2` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:714` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/he/he.js:31` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:36` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/charset.js:42` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `checkEndpointConflicts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/index.mjs:51` |
| 0.0% | 1.2ms | 0.0% | 0us | `insertThreadSignalsFromMessageRows` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:35` |
| 0.0% | 1.2ms | 0.0% | 0us | `async createAuthContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/create-context.mjs:90` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/index.js:19` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/index.js:8` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/certificate_list.js:7` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async getThreadGroupCounts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1380` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:38` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:404` |
| 0.0% | 1.2ms | 0.0% | 0us | `sortGroupsForGroupBy` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageGrouping.ts:105` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async handleFallbackJoin` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:345` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `readNgramReferences` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/internal/decode-shared.js` |
| 0.0% | 1.2ms | 0.0% | 0us | `decodeTrieDict` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/internal/decode-shared.js:151` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-ecc/build/cjs/index.js:6` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/encoding/index.js:5` |
| 0.0% | 1.2ms | 0.0% | 0us | `scopedTables` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:31` |
| 0.0% | 1.2ms | 0.0% | 0us | `guards` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:47` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `toASN` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js:45` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/index.js:5` |
| 0.0% | 1.2ms | 0.0% | 0us | `RsaSaPssParams` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/rsassa_pss.js:17` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/shared/lib/router/utils/format-next-pathname-info.js:14` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/rsassa_pss.js:13` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/rsassa_pss.js:52` |
| 0.0% | 1.2ms | 0.0% | 0us | `async getTables` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:67` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/value-node.js` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@zone-eu/mailsplit/lib/message-splitter.js:86` |
| 0.0% | 1.2ms | 0.0% | 0us | `LinkifyIt` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:361` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `toOperationNode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js` |
| 0.0% | 1.2ms | 0.0% | 0us | `compile` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:156` |
| 0.0% | 1.2ms | 0.0% | 0us | `LinkifyIt` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:341` |
| 0.0% | 1.2ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/mailparser/dist/esm/mail-parser.js:38` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async getMessageCalendarInviteDataByMessageId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts` |
| 0.0% | 1.2ms | 0.0% | 0us | `where` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/update-query-builder.js:25` |
| 0.0% | 1.2ms | 0.0% | 0us | `async update` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:576` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/transaction.mjs:24` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `getStore` | `node:async_hooks:168` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:21` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sanitize-html/index.js:6` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/launder/index.js:1` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async getMessageCalendarInviteDataByMessageId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:201` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/decorators/inject-with-transform.js:3` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `isObject` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `headers` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/headers.js:90` |
| 0.0% | 1.2ms | 0.0% | 0us | `bound extend` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 0us | `extend` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:450` |
| 0.0% | 1.2ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema/account.mjs:4` |
| 0.0% | 1.2ms | 0.0% | 0us | `isPlainObject` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:237` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/decorators/index.js:17` |
| 0.0% | 1.2ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:279` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `topicSuggestionSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts` |
| 0.0% | 1.2ms | 0.0% | 0us | `persistAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:283` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accounts.ts:110` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `parseSearchInput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:601` |
| 0.0% | 1.2ms | 0.0% | 0us | `toASN` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/converters.js:16` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `TextEncoder` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 0us | `fromBER` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1484` |
| 0.0% | 1.2ms | 0.0% | 0us | `fromBER` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1541` |
| 0.0% | 1.2ms | 0.0% | 0us | `localFromBERWithChildContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1218` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `fromBER` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sonic-boom/index.js:5` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `getTime` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `toLowerCase` | `[native code]` |
| 0.0% | 1.2ms | 0.0% | 0us | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:837` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/bags/index.js:8` |
| 0.0% | 1.2ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:377` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `createAuthEndpoint` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/api/index.mjs` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:877` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `getFieldName` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-name.mjs:26` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2601` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/parser.js:9` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/index.js:16` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `getKey` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/secret.ts` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async #transformResult` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:164` |
| 0.0% | 1.2ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/esm/libmime.js:1077` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `Libmime` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/esm/libmime.js` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/input.js:9` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:8` |
| 0.0% | 1.2ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/certificate_policies.js:33` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `get` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/index.js:8` |
| 0.0% | 1.2ms | 0.0% | 0us | `internal:streams/destroy` | `internal:streams/destroy:2` |
| 0.0% | 1.2ms | 0.0% | 0us | `parseSearchInput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:685` |
| 0.0% | 1.2ms | 0.0% | 0us | `internal:errors` | `internal:errors:2` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `shouldSearchAttachmentFilenames` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts` |
| 0.0% | 1.2ms | 0.0% | 0us | `node:_http_client` | `node:_http_client:10` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `applyBadgeFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:847` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `WriteStream` | `internal:fs/streams` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `defineRequestState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs` |
| 0.0% | 1.2ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/state/oauth.mjs:3` |
| 0.0% | 1.1ms | 0.0% | 0us | `async getMigrations` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:403` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/core.ts:203` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async getDatabaseIndexMap` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs` |
| 0.0% | 1.1ms | 0.0% | 0us | `async getDatabaseIndexMap` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:239` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/segment-config/ensure-static.js:28` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `resolvePromiseWithFirstResolvingFunctionCallCheck` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `guards` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `restoreDiff` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/dom-serializer/node_modules/entities/lib/esm/generated/encode-html.js` |
| 0.0% | 1.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:377` |
| 0.0% | 1.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/dom-serializer/node_modules/entities/lib/esm/generated/encode-html.js:9` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `Uint8Array` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:14` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async getThreadGroupCounts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:28` |
| 0.0% | 1.1ms | 0.0% | 0us | `node:tls` | `node:tls:11` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/decorators.js:7` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/storage.js:4` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/index.js:7` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/schema.js:7` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/input.js:3` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async transformOutput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:145` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/pino.js:5` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async runWithRequestState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/libmime.js` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/libmime.js:42` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:243` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async releaseConnection` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `clampThreadListPageSize` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:21` |
| 0.0% | 1.1ms | 0.0% | 0us | `async requireActiveUserSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:76` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/after/after.js:12` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `ahead` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/peberminta/lib/core.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js` |
| 0.0% | 1.1ms | 0.0% | 0us | `async reconcileProvisioning` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/userProvisioning.ts:86` |
| 0.0% | 1.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/parseley/lib/parseley.mjs:123` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1638` |
| 0.0% | 1.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:281` |
| 0.0% | 1.1ms | 0.0% | 0us | `async reconcileProvisioning` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/userProvisioning.ts:87` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:105` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `Statement` | `bun:sqlite` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:37` |
| 0.0% | 1.1ms | 0.0% | 0us | `getAuthTables` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/get-tables.mjs:297` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:713` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `visitSelectQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:38` |
| 0.0% | 1.1ms | 0.0% | 0us | `async acquireAuthLifetimeLock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authLifetimeLock.ts:57` |
| 0.0% | 1.1ms | 0.0% | 0us | `resolveDatabaseSchemaIndexes` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/database-index.mjs:135` |
| 0.0% | 1.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/adapter-kysely.mjs:13` |
| 0.0% | 1.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema/session.mjs:6` |
| 0.0% | 1.1ms | 0.0% | 0us | `ZodDate` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:100` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:30` |
| 0.0% | 1.1ms | 0.0% | 0us | `parseRowValues` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/insert-values-parser.js:39` |
| 0.0% | 1.1ms | 0.0% | 0us | `parseInsertColumnsAndValues` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/insert-values-parser.js:22` |
| 0.0% | 1.1ms | 0.0% | 0us | `values` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/insert-query-builder.js:200` |
| 0.0% | 1.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:450` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/source-map-js/lib/source-map-generator.js:8` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/source-map-js/lib/base64-vlq.js:38` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/lazy-result.js:6` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/parse.js:5` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `flush` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `NextResponse` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:40` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/index.js:4` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async createInternalContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/utils.js:30` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/index.js:14` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `looksLikeJiraMessage` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:27` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/pino.js:10` |
| 0.0% | 1.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/account.mjs:314` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:1276` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `isPlainObject` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/defu/dist/defu.mjs:12` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `clean` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/utils.js` |
| 0.0% | 1.1ms | 0.0% | 0us | `hchacha` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:167` |
| 0.0% | 1.1ms | 0.0% | 0us | `bound default` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 0us | `encrypt` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:350` |
| 0.0% | 1.1ms | 0.0% | 0us | `_default` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:1283` |
| 0.0% | 1.1ms | 0.0% | 0us | `_defu` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/defu/dist/defu.mjs:19` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:2159` |
| 0.0% | 1.1ms | 0.0% | 0us | `ZodDefault` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` |
| 0.0% | 1.1ms | 0.0% | 0us | `twoFactor` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/index.mjs:39` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `mapUserRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/tbs_certificate.js:8` |
| 0.0% | 1.1ms | 0.0% | 0us | `toOperationNode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/raw-builder/raw-builder.js:80` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `toOperationNode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/raw-builder/raw-builder.js:36` |
| 0.0% | 1.1ms | 0.0% | 0us | `noctuaAuthOptions` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:150` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `removeUser` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs` |
| 0.0% | 1.1ms | 0.0% | 0us | `admin` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/admin.mjs:81` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:158` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `createExpressionBuilder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:25` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `migrate` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accountKeys.ts` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv6.js:34` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `bound check` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 0us | `bound max` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/senderIdentities.ts:16` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:34` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/defu/dist/defu.mjs:52` |
| 0.0% | 1.1ms | 0.0% | 0us | `internal:fs/streams` | `internal:fs/streams:2` |
| 0.0% | 1.1ms | 0.0% | 0us | `get WriteStream` | `node:fs:644` |
| 0.0% | 1.1ms | 0.0% | 0us | `ensureCalendarEventOptionalColumns` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:406` |
| 0.0% | 1.1ms | 0.0% | 0us | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1259` |
| 0.0% | 1.1ms | 0.0% | 0us | `getDbTableColumns` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:110` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `trim` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js:92` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `encode` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/defu/dist/defu.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async lock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:152` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `getCookie` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs` |
| 0.0% | 1.1ms | 0.0% | 0us | `getChunkedCookie` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/session-store.mjs:137` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `ExpressionWrapper` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-wrapper.js:11` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:245` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `charCodeAt` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 0us | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/cookie-utils.mjs:163` |
| 0.0% | 1.1ms | 0.0% | 0us | `trimOWS` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/cookie-utils.mjs:144` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:200` |
| 0.0% | 1.1ms | 0.0% | 0us | `addColumn` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/schema/create-table-builder.js:124` |
| 0.0% | 1.1ms | 0.0% | 0us | `getReferencePath` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:570` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:24` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:648` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async getThreadGroupCounts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1394` |
| 0.0% | 1.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/mailparser/dist/esm/mail-parser.js:43` |
| 0.0% | 1.1ms | 0.0% | 0us | `compile` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:157` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `parseExpression` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/expression-parser.js:7` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/authority_information_access.js:8` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1009` |
| 0.0% | 1.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/sign-out.mjs:5` |
| 0.0% | 1.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/account.mjs:120` |
| 0.0% | 1.1ms | 0.0% | 0us | `toPhysicalSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:190` |
| 0.0% | 1.1ms | 0.0% | 0us | `async getMigrations` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:405` |
| 0.0% | 1.1ms | 0.0% | 0us | `sentIdentifiers` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:221` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:37` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `mapAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:190` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/encrypted_content_info.js:4` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/index.js:9` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `query` | `bun:sqlite` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:50` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `decodeSecret` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/secret.ts:69` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `#get` | `bun:sqlite:174` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `mapAccountRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:151` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:119` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/outboundWrite.ts:28` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `startActiveSpan` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/noop.mjs` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/shared/lib/router/utils/get-next-pathname-info.js:11` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/next-url.js:14` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:10` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `_collapseAtSpacing` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:276` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/index.js:12` |
| 0.0% | 1.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/device-authorization/index.mjs:19` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1018` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv6.js:29` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pkcs8/build/cjs/index.js:4` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/bags/key_bag.js:5` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/lazy-result.js:5` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/reference-node.js:12` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/bags/index.js:6` |
| 0.0% | 1.1ms | 0.0% | 0us | `backfillEmailCalendarEventParticipation` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:563` |
| 0.0% | 1.1ms | 0.0% | 0us | `async ensureCalendarEventRuntimeData` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:672` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts` |
| 0.0% | 1.1ms | 0.0% | 0us | `upsertTopicLearningSignalsForThreadIds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/topics.ts:145` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/index.js:5` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/attributes/index.js:6` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:162` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/core.ts:192` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs` |
| 0.0% | 1.1ms | 0.0% | 0us | `async createUser` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:169` |
| 0.0% | 1.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs:196` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `compileQuery` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:23` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/pino.js:6` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:922` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/redaction.js:4` |
| 0.0% | 1.1ms | 0.0% | 0us | `ensureThreadCollabRuntimeSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:921` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/attr_cert_issuer.js:7` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:3136` |
| 0.0% | 1.1ms | 0.0% | 0us | `resolveAccountRoleRow` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accountAccess.ts:5` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `final` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 0us | `final` | `node:crypto:344` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `internal:streams/state` | `internal:streams/state` |
| 0.0% | 1.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:34` |
| 0.0% | 1.1ms | 0.0% | 0us | `setHeader` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:27` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/tmp/spike-switch-server/sqlcounter.ts:98` |
| 0.0% | 1.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/auth/switch-account/route.ts:13` |
| 0.0% | 1.1ms | 0.0% | 0us | `bound meta` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/auth/switch-account/route.ts:28` |
| 0.0% | 1.1ms | 0.0% | 0us | `async POST` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/auth/switch-account/route.ts:12` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:2009` |
| 0.0% | 1.1ms | 0.0% | 0us | `bound clone` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 0us | `clone` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:334` |
| 0.0% | 1.1ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs:322` |
| 0.0% | 1.1ms | 0.0% | 0us | `async readAuthJson` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/readAuthJson.ts:30` |
| 0.0% | 1.1ms | 0.0% | 0us | `ZodEnum` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` |
| 0.0% | 1.1ms | 0.0% | 0us | `getEnumValues` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:19` |
| 0.0% | 1.1ms | 0.0% | 0us | `meta` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:108` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:1097` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async readAuthJson` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/readAuthJson.ts:10` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/index.js:10` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/authPolicy.ts:272` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `compileList` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:134` |
| 0.0% | 1.1ms | 0.0% | 0us | `async getDatabaseColumnBounds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:279` |
| 0.0% | 1.1ms | 0.0% | 0us | `async getMigrations` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:404` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async getDatabaseColumnBounds` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `applyAddressSearchFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:565` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/ftsIdentity.ts:20` |
| 0.0% | 1.1ms | 0.0% | 1.1ms | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts` |
| 0.0% | 1.1ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/dependency-container.js:11` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:225` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `run` | `node:async_hooks` |
| 0.0% | 1.0ms | 0.0% | 0us | `async migrateAuthSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:212` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `bound visitCreateTable` | `[native code]` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `readGap` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/encode.js:41` |
| 0.0% | 1.0ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/encode.js:103` |
| 0.0% | 1.0ms | 0.0% | 0us | `async runMigrations` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:669` |
| 0.0% | 1.0ms | 0.0% | 0us | `async runMigrations` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:671` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/encode.js:56` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `node:crypto` | `node:crypto:98` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/senderIdentities.ts` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/bags/index.js:5` |
| 0.0% | 1.0ms | 0.0% | 0us | `rebuildThreadSignalsForThreadIdsInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:85` |
| 0.0% | 1.0ms | 0.0% | 0us | `optional` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:1242` |
| 0.0% | 1.0ms | 0.0% | 0us | `optional` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:58` |
| 0.0% | 1.0ms | 0.0% | 0us | `ZodOptional` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:2107` |
| 0.0% | 1.0ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/one-tap/index.mjs:22` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:1236` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/result.js:3` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:620` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/lazy-result.js:7` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `visitNode` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/operation-node-visitor.js:113` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-field-name.mjs:22` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `applyExcludedFolderFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `getHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:138` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `sqliteIntegerPrimaryKeyColumn` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/factories/index.js:5` |
| 0.0% | 1.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:51` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `loadNextHeadersModule` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:27` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/index.js:10` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `scheduleAccountDbIdleClose` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:253` |
| 0.0% | 1.0ms | 0.0% | 0us | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:407` |
| 0.0% | 1.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:212` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/request.js:24` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/utils.js:35` |
| 0.0% | 1.0ms | 0.0% | 0us | `async POST` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/auth/switch-account/route.ts:8` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `requireJsonSameOrigin` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/requestOrigin.ts:20` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `normalizeImapFlags` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageFlags.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async get` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/update-user.mjs:95` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/source-map-js/lib/source-map-generator.js:10` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `registerDbShutdownHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:285` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/legacy/index.js:6` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/index.js:10` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `unquoteCookieValue` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/cookie-utils.mjs:125` |
| 0.0% | 1.0ms | 0.0% | 0us | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/cookie-utils.mjs:164` |
| 0.0% | 1.0ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2304` |
| 0.0% | 1.0ms | 0.0% | 0us | `applyInviteUidQueryFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:786` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `normalizeCalendarEventUidKeys` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/calendarEventUids.ts` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:18` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `Statement` | `bun:sqlite:115` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `applyAddressSearchFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:542` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `topicSuggestionSignalsFromEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2626` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/key_agree_recipient_info.js:10` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/recipient_info.js:6` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `createAccessControl` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/access/access.mjs` |
| 0.0% | 1.0ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/access/statement.mjs:23` |
| 0.0% | 1.0ms | 0.0% | 0us | `sortGroupsForGroupBy` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageGrouping.ts:104` |
| 0.0% | 1.0ms | 0.0% | 0us | `decrypt` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:369` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `rotl` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_arx.js:65` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_arx.js:237` |
| 0.0% | 1.0ms | 0.0% | 0us | `runCipher` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_arx.js:113` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/segment-config/ensure-static.js:27` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/shared/lib/router/utils/parse-loader-tree.js:11` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `isRecursive` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/memoizer.js:66` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `cloneWithWhere` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/query-node.js` |
| 0.0% | 1.0ms | 0.0% | 0us | `wrapped` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/memoizer.js:233` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:423` |
| 0.0% | 1.0ms | 0.0% | 0us | `DBCSCodec` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:26` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `normalizeCalendarEventUids` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/calendarEventUids.ts:18` |
| 0.0% | 1.0ms | 0.0% | 0us | `table` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-data.js:92` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:36` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `utilToBase` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pvutils/build/utils.js:89` |
| 0.0% | 1.0ms | 0.0% | 0us | `toBER` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:2286` |
| 0.0% | 1.0ms | 0.0% | 0us | `init` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:76` |
| 0.0% | 1.0ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema/shared.mjs:4` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:254` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:198` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `members` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:740` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/index.js:21` |
| 0.0% | 1.0ms | 0.0% | 0us | `deriveSystemFlagState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:317` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/signed_data.js:25` |
| 0.0% | 1.0ms | 0.0% | 0us | `shardWriterGuardsInstalled` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:68` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/tools.js:5` |
| 0.0% | 1.0ms | 0.0% | 0us | `getFieldName` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-name.mjs:21` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-model-name.mjs` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `createRandomStringGenerator` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/utils/dist/random.mjs:12` |
| 0.0% | 1.0ms | 0.0% | 0us | `generateId` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/id.mjs:4` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/tbs_certificate.js:10` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `applySearchQueryFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:713` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/transport.js:10` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/tools.js:29` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `runtimeSchemaCheckFor` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema-check.mjs` |
| 0.0% | 1.0ms | 0.0% | 0us | `async createAuthContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/create-context.mjs:231` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `defaultThreadCollabState` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/index.js:6` |
| 0.0% | 1.0ms | 0.0% | 0us | `parse` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv4.js:116` |
| 0.0% | 1.0ms | 0.0% | 0us | `pruneThreadTopicsWithoutMessages` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:171` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv4.js:599` |
| 0.0% | 1.0ms | 0.0% | 0us | `async getTopicSuggestionsForThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:686` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/index.js:16` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv4.js:598` |
| 0.0% | 1.0ms | 0.0% | 0us | `Address4` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv4.js:87` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authPolicyHandler.ts:287` |
| 0.0% | 1.0ms | 0.0% | 0us | `compile` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:154` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/utf8-to-jis-table.js:6` |
| 0.0% | 1.0ms | 0.0% | 0us | `assertSupportedShardFormat` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:9` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async createAuthContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/create-context.mjs` |
| 0.0% | 1.0ms | 0.0% | 0us | `createSeededLinearModel` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/mail/categorization/linearModel.ts:147` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/mail/categorization/linearModel.ts` |
| 0.0% | 1.0ms | 0.0% | 0us | `shardWriterGuardsInstalled` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:59` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `write` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js` |
| 0.0% | 1.0ms | 0.0% | 0us | `toBER` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:953` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/cookies.js:18` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:17` |
| 0.0% | 1.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:486` |
| 0.0% | 1.0ms | 0.0% | 0us | `async updateWithHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/with-hooks.mjs:63` |
| 0.0% | 1.0ms | 0.0% | 0us | `onUpdate` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/get-tables.mjs:121` |
| 0.0% | 1.0ms | 0.0% | 0us | `async update` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:510` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/dynamic-rendering-utils.js:100` |
| 0.0% | 1.0ms | 0.0% | 0us | `pruneThreadTopicsWithoutMessages` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:165` |
| 0.0% | 1.0ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/senderMessages.ts:91` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/authority_information_access.js:7` |
| 0.0% | 1.0ms | 0.0% | 0us | `guardSql` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:52` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/general_name.js:6` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `quote` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:45` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `decodeTrieDict` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/internal/decode-shared.js:175` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `hasFlag` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:316` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/sign-in.mjs` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/index.js:7` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:158` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `internal:streams/writable` | `internal:streams/writable:14` |
| 0.0% | 1.0ms | 0.0% | 0us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2258` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `applyAddressSearchFilters` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:548` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `getThreadCollabStates` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts:73` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:854` |
| 0.0% | 1.0ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/password.mjs:133` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `installLazyProp` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:847` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/lib/index.js:6` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/source-map-js/source-map.js:8` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `node:_http_server` | `node:_http_server:3` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `toArrayBuffer` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pvtsutils/build/index.js:34` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/crl_issuing_distribution_point.js:5` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:12` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testAuthHarness.ts:179` |
| 0.0% | 1.0ms | 0.0% | 0us | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:370` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async transformInput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `parseAddressEmails` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:35` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/core.ts` |
| 0.0% | 1.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:29` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/api/index.mjs` |
| 0.0% | 1.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/api/index.mjs:59` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async assertAccountFolder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/folderAccountGuard.ts` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:153` |
| 0.0% | 1.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accounts.ts:116` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/signer_info.js:8` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accounts.ts` |
| 0.0% | 1.0ms | 0.0% | 0us | `async upsertAccount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accounts.ts:104` |
| 0.0% | 1.0ms | 0.0% | 0us | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:33` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/node.js:5` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:160` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:553` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:543` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:6` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:56` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:45` |
| 0.0% | 1.0ms | 0.0% | 0us | `_interopNamespaceDefault` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:42` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:13` |
| 0.0% | 1.0ms | 0.0% | 0us | `compile` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:174` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/index.js:7` |
| 0.0% | 1.0ms | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/mailparser/dist/esm/mail-parser.js:53` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:193` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `_collectAddressParts` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:562` |
| 0.0% | 1.0ms | 0.0% | 0us | `async assertAccountFolder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/folderAccountGuard.ts:7` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:51` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async update` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs` |
| 0.0% | 1.0ms | 0.0% | 0us | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:695` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `_isAddrSpec` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js:6` |
| 0.0% | 1.0ms | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:668` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `async getCurrentAdapter` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/transaction.mjs:27` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `bound visitParens` | `[native code]` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/decorators.js:50` |
| 0.0% | 1.0ms | 0.0% | 0us | `decorate` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:136` |
| 0.0% | 1.0ms | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/rsaes_oaep.js:28` |
| 0.0% | 1.0ms | 0.0% | 0us | `__decorate` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:106` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `bun:sqlite` | `bun:sqlite:228` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `extractJiraProjectKeys` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts` |
| 0.0% | 1.0ms | 0.0% | 0us | `DecorateProperty` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:561` |
| 0.0% | 999us | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:86` |
| 0.0% | 999us | 0.0% | 999us | `cookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/cookies.js` |
| 0.0% | 998us | 0.0% | 0us | `async acquireAuthLifetimeLock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authLifetimeLock.ts:36` |
| 0.0% | 998us | 0.0% | 998us | `dlopen` | `[native code]` |
| 0.0% | 998us | 0.0% | 0us | `dlopen` | `bun:ffi:155` |
| 0.0% | 996us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sanitize-html/index.js:4` |
| 0.0% | 995us | 0.0% | 0us | `release` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authLifetimeLock.ts:61` |
| 0.0% | 994us | 0.0% | 994us | `add` | `[native code]` |
| 0.0% | 993us | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:152` |
| 0.0% | 993us | 0.0% | 993us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:157` |
| 0.0% | 992us | 0.0% | 992us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:535` |
| 0.0% | 991us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/encoding-convert.js:4` |
| 0.0% | 991us | 0.0% | 0us | `async buildFixture` | `/tmp/spike-switch-server/fixture.ts:55` |
| 0.0% | 991us | 0.0% | 991us | `async upsertMessages` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts` |
| 0.0% | 991us | 0.0% | 991us | `async listThreads` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts` |
| 0.0% | 989us | 0.0% | 0us | `async getAccountDb` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:388` |
| 0.0% | 989us | 0.0% | 989us | `ensureThreadRuntimeSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts` |
| 0.0% | 988us | 0.0% | 0us | `async recomputeThreadsForAccountInternal` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:278` |
| 0.0% | 988us | 0.0% | 988us | `managedNonce` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/utils.js` |
| 0.0% | 987us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/signer_identifier.js:4` |
| 0.0% | 987us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/signer_info.js:7` |
| 0.0% | 987us | 0.0% | 987us | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:38` |
| 0.0% | 986us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino-std-serializers/index.js:3` |
| 0.0% | 986us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino-std-serializers/lib/err.js:6` |
| 0.0% | 983us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/encoding/index.js:8` |
| 0.0% | 983us | 0.0% | 0us | `async requireActiveUserSession` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:85` |
| 0.0% | 983us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@zone-eu/mailsplit/index.js:8` |
| 0.0% | 981us | 0.0% | 0us | `async delete` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:603` |
| 0.0% | 981us | 0.0% | 0us | `async delete` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:599` |
| 0.0% | 981us | 0.0% | 981us | `get source` | `[native code]` |
| 0.0% | 981us | 0.0% | 0us | `compile` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:247` |
| 0.0% | 981us | 0.0% | 0us | `async delete` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:678` |
| 0.0% | 981us | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:670` |
| 0.0% | 981us | 0.0% | 981us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:378` |
| 0.0% | 979us | 0.0% | 0us | `DBCSCodec` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:44` |
| 0.0% | 979us | 0.0% | 979us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:166` |
| 0.0% | 978us | 0.0% | 978us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:619` |
| 0.0% | 976us | 0.0% | 976us | `debugLog` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` |
| 0.0% | 975us | 0.0% | 0us | `toASN` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js:27` |
| 0.0% | 975us | 0.0% | 0us | `cache` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/schema.js:26` |
| 0.0% | 975us | 0.0% | 0us | `create` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/schema.js:54` |
| 0.0% | 975us | 0.0% | 0us | `LocalObjectIdentifierValueBlock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:2339` |
| 0.0% | 974us | 0.0% | 974us | `CreateTableBuilder` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/schema/create-table-builder.js:26` |
| 0.0% | 974us | 0.0% | 0us | `addColumn` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/schema/create-table-builder.js:125` |
| 0.0% | 973us | 0.0% | 0us | `compile` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:155` |
| 0.0% | 973us | 0.0% | 973us | `collectTopicSignalEntries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:64` |
| 0.0% | 972us | 0.0% | 972us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:662` |
| 0.0% | 972us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/authPolicy.ts:249` |
| 0.0% | 971us | 0.0% | 971us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/parse5/dist/common/token.js` |
| 0.0% | 971us | 0.0% | 971us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:2118` |
| 0.0% | 971us | 0.0% | 0us | `async runValidation` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/validator.mjs:20` |
| 0.0% | 971us | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/parse5/dist/common/token.js:11` |
| 0.0% | 970us | 0.0% | 970us | `/[\s";]+/g` | `[native code]` |
| 0.0% | 970us | 0.0% | 970us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:148` |
| 0.0% | 969us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1200` |
| 0.0% | 969us | 0.0% | 0us | `normalizeDef` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:940` |
| 0.0% | 969us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:397` |
| 0.0% | 969us | 0.0% | 0us | `get value` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:41` |
| 0.0% | 969us | 0.0% | 0us | `get` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:816` |
| 0.0% | 968us | 0.0% | 0us | `LocalSidValueBlock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:2208` |
| 0.0% | 968us | 0.0% | 0us | `toASN` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/converters.js:47` |
| 0.0% | 968us | 0.0% | 0us | `fromString` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:2411` |
| 0.0% | 968us | 0.0% | 0us | `Some` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:146` |
| 0.0% | 968us | 0.0% | 0us | `LocalObjectIdentifierValueBlock` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:2342` |
| 0.0% | 967us | 0.0% | 0us | `async deleteWithHooks` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/with-hooks.mjs:120` |
| 0.0% | 967us | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:629` |
| 0.0% | 967us | 0.0% | 0us | `async findMany` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:654` |
| 0.0% | 966us | 0.0% | 966us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs` |
| 0.0% | 964us | 0.0% | 964us | `async getAccountOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/senderIdentities.ts` |
| 0.0% | 958us | 0.0% | 958us | `parseSearchInput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts` |
| 0.0% | 958us | 0.0% | 0us | `async getAccountOwnAddresses` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/senderIdentities.ts:20` |
| 0.0% | 953us | 0.0% | 953us | `replace` | `[native code]` |
| 0.0% | 953us | 0.0% | 953us | `async getUserById` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/users.ts` |
| 0.0% | 953us | 0.0% | 953us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/middleware.mjs:7` |
| 0.0% | 953us | 0.0% | 953us | `async requireAccountContext` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/accountContext.ts:63` |
| 0.0% | 952us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/index.js:8` |
| 0.0% | 952us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/authPolicy.ts:265` |
| 0.0% | 951us | 0.0% | 0us | `async (anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:715` |
| 0.0% | 951us | 0.0% | 951us | `parseCookies` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/cookie-utils.mjs:159` |
| 0.0% | 949us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/extended_key_usage.js:17` |
| 0.0% | 949us | 0.0% | 949us | `AsnType` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/decorators.js:8` |
| 0.0% | 949us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:15` |
| 0.0% | 948us | 0.0% | 948us | `_handleAddress` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:768` |
| 0.0% | 945us | 0.0% | 0us | `initAccountSchemaBody` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:1429` |
| 0.0% | 945us | 0.0% | 0us | `backfillCalendarReminderEventUidKeys` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:1440` |
| 0.0% | 944us | 0.0% | 0us | `ensureThreadCollabRuntimeSchema` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:919` |
| 0.0% | 940us | 0.0% | 0us | `node:worker_threads` | `node:worker_threads:205` |
| 0.0% | 940us | 0.0% | 940us | `parseSearchInput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:657` |
| 0.0% | 940us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/lib/index.js:3` |
| 0.0% | 938us | 0.0% | 938us | `async getTotalCount` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1344` |
| 0.0% | 934us | 0.0% | 934us | `lookup` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/ftsIdentity.ts` |
| 0.0% | 934us | 0.0% | 0us | `compile` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:160` |
| 0.0% | 930us | 0.0% | 0us | `parseSearchInput` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:686` |
| 0.0% | 930us | 0.0% | 930us | `getFieldName` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-name.mjs` |
| 0.0% | 930us | 0.0% | 930us | `buildScopedFtsTokenQueries` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:476` |
| 0.0% | 919us | 0.0% | 0us | `(module)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/imapflow/dist/esm/charsets.js:272` |
| 0.0% | 919us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-android/build/cjs/index.js:5` |
| 0.0% | 919us | 0.0% | 919us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/imapflow/dist/esm/charsets.js:275` |
| 0.0% | 899us | 0.0% | 899us | `part` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts` |
| 0.0% | 885us | 0.0% | 0us | `(anonymous)` | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/index.js:5` |

## Function Details

### `run`
`[native code]` | Self: 24.4% (9.06s) | Total: 24.4% (9.06s) | Samples: 3902

**Called by:**
- `#run` (3655)
- `#runNoArgs` (199)
- `run` (48)

### `all`
`[native code]` | Self: 23.5% (8.71s) | Total: 23.5% (8.71s) | Samples: 7383

**Called by:**
- `(anonymous)` (7383)

### `get`
`[native code]` | Self: 10.3% (3.84s) | Total: 10.4% (3.85s) | Samples: 3325

**Called by:**
- `(anonymous)` (3314)
- `async buildFixture` (3)
- `(anonymous)` (2)
- `async (anonymous)` (2)
- `async enrichMessagesWithThreadTopics` (1)
- `async (anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `require` (1)
- `async (anonymous)` (1)
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (3)

### `formatToParts`
`[native code]` | Self: 4.8% (1.79s) | Total: 4.8% (1.79s) | Samples: 1554

**Called by:**
- `displayDayNumber` (1554)

### `prepare`
`[native code]` | Self: 3.1% (1.15s) | Total: 3.1% (1.15s) | Samples: 891

**Called by:**
- `prepare` (890)
- `[prepareOwned]` (1)

### `URL`
`[native code]` | Self: 2.5% (953.5ms) | Total: 2.5% (953.5ms) | Samples: 820

**Called by:**
- `normalizeIdentityEmail` (818)
- `async GET` (2)

### `json`
`[native code]` | Self: 1.6% (598.4ms) | Total: 1.6% (598.4ms) | Samples: 514

**Called by:**
- `json` (514)

### `checkChar`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:989` | Self: 1.5% (587.4ms) | Total: 1.5% (587.4ms) | Samples: 497

**Called by:**
- `tokenize` (497)

### `normalizeIdentityEmail`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:17` | Self: 1.3% (497.3ms) | Total: 1.3% (497.3ms) | Samples: 426

**Called by:**
- `(anonymous)` (186)
- `map` (139)
- `(anonymous)` (93)
- `(anonymous)` (8)

### `Set`
`[native code]` | Self: 1.1% (428.5ms) | Total: 1.1% (428.5ms) | Samples: 372

**Called by:**
- `ownAddressList` (163)
- `isOwnAddress` (117)
- `getThreadCollabStates` (15)
- `async enrichMessagesWithThreadTopics` (13)
- `extractEmailAddresses` (12)
- `getOwnAddresses` (11)
- `getTopicSuggestionSignalsForThreadsFromDb` (10)
- `async enrichMessagesWithThreadCollab` (10)
- `async getMessageCalendarInviteDataByMessageId` (9)
- `async getTopicSuggestionsForThreads` (6)
- `applyExcludedFolderFilters` (2)
- `loadManualCategoryStatesForMessageIds` (2)
- `async (anonymous)` (2)

### `anonymous`
`[native code]` | Self: 1.0% (394.7ms) | Total: 2.9% (1.08s) | Samples: 187

**Called by:**
- `require` (690)
- `node:http` (6)
- `bound require` (5)
- `internal:streams/duplex` (5)
- `internal:streams/lazy_transform` (5)
- `internal:streams/transform` (5)
- `node:crypto` (5)
- `node:tls` (3)
- `internal:streams/readable` (2)
- `node:stream` (1)
- `node:tls` (1)
- `get WriteStream` (1)
- `(anonymous)` (1)
- `node:fs` (1)
- `node:_http_agent` (1)
- `internal:stream` (1)
- `internal:validators` (1)
- `internal:streams/destroy` (1)
- `internal:streams/compose` (1)
- `internal:streams/legacy` (1)
- `internal:errors` (1)
- `node:assert` (1)
- `node:worker_threads` (1)
- `internal:fs/streams` (1)
- `node:_http_client` (1)

**Calls:**
- `(anonymous)` (35)
- `(anonymous)` (21)
- `(anonymous)` (17)
- `(anonymous)` (16)
- `(anonymous)` (11)
- `(anonymous)` (10)
- `(anonymous)` (9)
- `(anonymous)` (8)
- `(anonymous)` (8)
- `(anonymous)` (8)
- `(anonymous)` (8)
- `(anonymous)` (8)
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
- `internal:streams/duplex` (5)
- `(anonymous)` (5)
- `(anonymous)` (5)
- `internal:streams/transform` (5)
- `(anonymous)` (5)
- `internal:streams/lazy_transform` (5)
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
- `internal:streams/readable` (2)
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
- `internal:errors` (1)
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
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `node:_http_server` (1)
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
- `internal:validators` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `node:worker_threads` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `node:_http_agent` (1)
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
- `internal:streams/state` (1)
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
- `node:assert` (1)
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
- `internal:streams/legacy` (1)
- `node:_http_client` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `internal:fs/streams` (1)
- `node:_http_client` (1)
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
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `normalizeIdentityEmail`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:9` | Self: 0.9% (367.3ms) | Total: 0.9% (367.3ms) | Samples: 306

**Called by:**
- `map` (114)
- `(anonymous)` (112)
- `(anonymous)` (71)
- `(anonymous)` (9)

### `normalizeIdentityEmail`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:16` | Self: 0.9% (345.9ms) | Total: 1.3% (486.2ms) | Samples: 291

**Called by:**
- `(anonymous)` (176)
- `map` (152)
- `(anonymous)` (81)
- `(anonymous)` (5)

**Calls:**
- `every` (123)

### `normalizeIdentityEmail`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:14` | Self: 0.9% (340.5ms) | Total: 3.4% (1.29s) | Samples: 292

**Called by:**
- `(anonymous)` (455)
- `map` (383)
- `(anonymous)` (241)
- `(anonymous)` (31)

**Calls:**
- `URL` (818)

### `map`
`[native code]` | Self: 0.6% (255.1ms) | Total: 12.1% (4.50s) | Samples: 200

**Called by:**
- `async listThreads` (2339)
- `isOwnAddress` (984)
- `_handleAddress` (114)
- `async (anonymous)` (79)
- `async (anonymous)` (54)
- `async enrichMessagesWithThreadTopics` (42)
- `topicSuggestionSignalEntries` (14)
- `async getMessageCalendarInviteDataByMessageId` (14)
- `topicSuggestionSignalEntries` (14)
- `topicSuggestionSignalEntries` (13)
- `topicSuggestionSignalEntries` (12)
- `getThreadCollabStates` (10)
- `(anonymous)` (10)
- `async enrichMessagesWithThreadCollab` (9)
- `async (anonymous)` (8)
- `async listThreads` (8)
- `async getTables` (8)
- `async getAccountById` (7)
- `getTopicSuggestionSignalsForThreadsFromDb` (6)
- `async listThreads` (6)
- `async (anonymous)` (6)
- `(anonymous)` (5)
- `async listThreads` (4)
- `normalizeThreadIds` (3)
- `loadManualCategoryStatesForMessageIds` (3)
- `buildSqlContainsAny` (3)
- `topicSuggestionSignalEntries` (3)
- `normalizeThreadIds` (3)
- `getOwnAddresses` (2)
- `async getTopicSuggestionsForThreads` (2)
- `async (anonymous)` (2)
- `async getMessageCalendarInviteDataByMessageId` (2)
- `flatIntoArrayWithCallback` (2)
- `async (anonymous)` (2)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `async listThreads` (1)
- `(module)` (1)
- `getEndpoints` (1)
- `parseStringReference` (1)
- `parseInsertColumnsAndValues` (1)
- `sentIdentifiers` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(module)` (1)
- `async (anonymous)` (1)
- `(module)` (1)
- `async getAccountOwnAddresses` (1)
- `async getThreadGroupCounts` (1)
- `filterOutputFields` (1)
- `(anonymous)` (1)
- `getTopicSuggestionSignalsForThreadsFromDb` (1)
- `write` (1)
- `async listThreads` (1)

**Calls:**
- `(anonymous)` (2164)
- `normalizeIdentityEmail` (383)
- `normalizeIdentityEmail` (152)
- `normalizeIdentityEmail` (139)
- `normalizeIdentityEmail` (114)
- `(anonymous)` (96)
- `(anonymous)` (75)
- `normalizeIdentityEmail` (59)
- `slimThreadListItem` (50)
- `(anonymous)` (47)
- `(anonymous)` (41)
- `_collapseAtSpacing` (32)
- `normalizeIdentityEmail` (26)
- `normalizeIdentityEmail` (24)
- `normalizeIdentityEmail` (21)
- `normalizeIdentityEmail` (17)
- `(anonymous)` (14)
- `(anonymous)` (13)
- `binary` (10)
- `_collapseAtSpacing` (9)
- `_joinAtSpacing` (9)
- `_collapseAtSpacing` (9)
- `async (anonymous)` (8)
- `(anonymous)` (7)
- `(anonymous)` (7)
- `(anonymous)` (7)
- `normalizeIdentityEmail` (6)
- `(anonymous)` (6)
- `getCodec` (5)
- `(anonymous)` (5)
- `(anonymous)` (5)
- `(anonymous)` (4)
- `(anonymous)` (4)
- `(anonymous)` (4)
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `trim` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `parseRowValues` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `_collapseAtSpacing` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `trim` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `parseAddressEmails`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:25` | Self: 0.6% (246.0ms) | Total: 0.6% (252.0ms) | Samples: 207

**Called by:**
- `isOwnAddress` (176)
- `(anonymous)` (16)
- `flatIntoArrayWithCallback` (14)
- `(anonymous)` (6)

**Calls:**
- `/[\x00-\x08\x0a-\x1f\x7f]/` (5)

### `normalizeIdentityEmail`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:12` | Self: 0.6% (243.0ms) | Total: 0.6% (243.0ms) | Samples: 206

**Called by:**
- `(anonymous)` (76)
- `(anonymous)` (66)
- `map` (59)
- `(anonymous)` (5)

### `part`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts:42` | Self: 0.5% (212.5ms) | Total: 0.5% (213.8ms) | Samples: 185

**Called by:**
- `displayDayNumber` (186)

**Calls:**
- `find` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testAuthHarness.ts` | Self: 0.4% (182.1ms) | Total: 0.4% (182.1ms) | Samples: 1

**Called by:**
- `async withDbWriteRetry` (1)

### `getEnvVar`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/env-impl.mjs:41` | Self: 0.4% (174.1ms) | Total: 0.4% (174.1ms) | Samples: 3

**Called by:**
- `getColorDepth` (1)
- `getColorDepth` (1)
- `getColorDepth` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:106` | Self: 0.4% (161.6ms) | Total: 0.4% (161.6ms) | Samples: 1

**Called by:**
- `async transformInput` (1)

### `cached`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts:13` | Self: 0.4% (161.2ms) | Total: 0.4% (161.2ms) | Samples: 138

**Called by:**
- `displayDayNumber` (138)

### `freeze`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/object-utils.js:63` | Self: 0.4% (160.8ms) | Total: 0.4% (160.8ms) | Samples: 1

**Called by:**
- `cloneWithSelections` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:266` | Self: 0.4% (160.8ms) | Total: 0.4% (160.8ms) | Samples: 1

### `tokenize`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:836` | Self: 0.4% (150.3ms) | Total: 2.1% (789.4ms) | Samples: 131

**Called by:**
- `_parseAddressList` (673)

**Calls:**
- `checkChar` (497)
- `checkChar` (22)
- `checkChar` (19)
- `checkChar` (3)
- `charAt` (1)

### `normalizeIdentityEmail`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:7` | Self: 0.3% (134.5ms) | Total: 0.3% (134.5ms) | Samples: 76

**Called by:**
- `(anonymous)` (35)
- `map` (21)
- `(anonymous)` (18)
- `(anonymous)` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:16` | Self: 0.3% (114.0ms) | Total: 0.3% (140.2ms) | Samples: 100

**Called by:**
- `every` (123)

**Calls:**
- `/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/` (23)

### `parseAddressEmails`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:42` | Self: 0.2% (98.8ms) | Total: 0.2% (98.8ms) | Samples: 77

**Called by:**
- `isOwnAddress` (52)
- `flatIntoArrayWithCallback` (12)
- `(anonymous)` (11)
- `(anonymous)` (2)

### `_collectAddressParts`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:561` | Self: 0.2% (94.3ms) | Total: 0.2% (94.3ms) | Samples: 80

**Called by:**
- `_handleAddress` (80)

### `buildTimeGroupKey`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageGrouping.ts:44` | Self: 0.2% (93.2ms) | Total: 2.2% (816.2ms) | Samples: 76

**Called by:**
- `buildMessageGroupKey` (686)
- `(anonymous)` (18)

**Calls:**
- `displayDayNumber` (478)
- `displayDayNumber` (90)
- `displayDayNumber` (57)
- `displayDayNumber` (3)

### `Tokenizer`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` | Self: 0.2% (88.7ms) | Total: 0.2% (88.7ms) | Samples: 74

**Called by:**
- `_parseAddressList` (74)

### `json`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:92` | Self: 0.2% (87.4ms) | Total: 0.2% (92.4ms) | Samples: 77

**Called by:**
- `async (anonymous)` (81)

**Calls:**
- `NextResponse` (3)
- `NextResponse` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:62` | Self: 0.2% (79.2ms) | Total: 0.2% (80.4ms) | Samples: 68

**Called by:**
- `some` (69)

**Calls:**
- `parseAddressEmails` (1)

### `forEach`
`[native code]` | Self: 0.2% (75.8ms) | Total: 60.4% (22.38s) | Samples: 65

**Called by:**
- `getTopicSuggestionSignalsForThreadsFromDb` (4148)
- `insertThreadSignalsFromMessageRows` (2787)
- `upsertBatch` (1840)
- `flush` (1797)
- `collectTopicSignalEntries` (896)
- `getTopicSuggestionsForThreadSignalBatch` (242)
- `getTopicSuggestionsForThreadSignalBatch` (111)
- `(anonymous)` (110)
- `(anonymous)` (79)
- `getTopicSuggestionSignalsForThreadsFromDb` (31)
- `async listThreads` (21)
- `(anonymous)` (18)
- `getTopicSuggestionsForThreadSignalBatch` (7)
- `extractJiraProjectKeys` (6)
- `forwardAuthHeaders` (6)
- `walkAddressList` (4)
- `convertWhereClause` (3)
- `setWeights` (2)
- `topicSuggestionSignalsFromEntries` (2)
- `(anonymous)` (1)
- `compile` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(module)` (1)
- `sortGroupsForGroupBy` (1)
- `_interopNamespaceDefault` (1)
- `(module)` (1)

**Calls:**
- `(anonymous)` (4074)
- `(anonymous)` (2785)
- `(anonymous)` (1795)
- `(anonymous)` (714)
- `(anonymous)` (479)
- `(anonymous)` (331)
- `(anonymous)` (264)
- `(anonymous)` (254)
- `(anonymous)` (203)
- `(anonymous)` (177)
- `(anonymous)` (160)
- `(anonymous)` (79)
- `(anonymous)` (63)
- `(anonymous)` (62)
- `(anonymous)` (61)
- `(anonymous)` (59)
- `(anonymous)` (53)
- `(anonymous)` (46)
- `(anonymous)` (39)
- `(anonymous)` (32)
- `(anonymous)` (29)
- `(anonymous)` (27)
- `(anonymous)` (24)
- `(anonymous)` (23)
- `(anonymous)` (22)
- `(anonymous)` (21)
- `(anonymous)` (17)
- `(anonymous)` (15)
- `(anonymous)` (14)
- `(anonymous)` (9)
- `(anonymous)` (8)
- `(anonymous)` (7)
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
- `(anonymous)` (3)
- `(anonymous)` (3)
- `(anonymous)` (3)
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
- `add` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:215` | Self: 0.1% (72.1ms) | Total: 0.1% (72.1ms) | Samples: 61

**Called by:**
- `forEach` (61)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:570` | Self: 0.1% (71.0ms) | Total: 0.1% (71.0ms) | Samples: 62

**Called by:**
- `forEach` (62)

### `normalizeIdentityEmail`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:6` | Self: 0.1% (70.7ms) | Total: 0.2% (89.6ms) | Samples: 56

**Called by:**
- `(anonymous)` (28)
- `(anonymous)` (22)
- `map` (17)
- `(anonymous)` (6)

**Calls:**
- `/[\x00-\x1f\x7f]/` (17)

### `Boolean`
`[native code]` | Self: 0.1% (66.0ms) | Total: 0.1% (66.0ms) | Samples: 9

**Called by:**
- `filter` (8)
- `(anonymous)` (1)

### `importModule`
`[native code]` | Self: 0.1% (65.5ms) | Total: 0.1% (65.5ms) | Samples: 55

**Called by:**
- `async ensureCalendarEventRuntimeData` (39)
- `loadServerDb` (14)
- `async buildFixture` (1)
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2645` | Self: 0.1% (65.2ms) | Total: 0.2% (109.8ms) | Samples: 56

**Called by:**
- `map` (96)

**Calls:**
- `copyDataProperties` (38)
- `hydrateIdentityMetadata` (2)

### `displayDayNumber`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts:43` | Self: 0.1% (64.6ms) | Total: 0.8% (328.7ms) | Samples: 55

**Called by:**
- `buildTimeGroupKey` (99)
- `buildMessageGroupKey` (96)
- `buildTimeGroupKey` (90)

**Calls:**
- `part` (186)
- `UTC` (43)
- `part` (1)

### `normalizeIdentityEmail`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:11` | Self: 0.1% (63.0ms) | Total: 0.2% (97.1ms) | Samples: 56

**Called by:**
- `(anonymous)` (39)
- `map` (26)
- `(anonymous)` (19)
- `(anonymous)` (1)

**Calls:**
- ``/^[A-Za-z0-9.!#$%&'*+\/=?^_`{\|}~-]+$/`` (29)

### `copyDataProperties`
`[native code]` | Self: 0.1% (62.3ms) | Total: 0.1% (62.3ms) | Samples: 46

**Called by:**
- `(anonymous)` (38)
- `async (anonymous)` (4)
- `async (anonymous)` (2)
- `(anonymous)` (1)
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:566` | Self: 0.1% (60.7ms) | Total: 0.1% (60.7ms) | Samples: 53

**Called by:**
- `forEach` (53)

### `entries`
`[native code]` | Self: 0.1% (60.0ms) | Total: 0.1% (60.0ms) | Samples: 34

**Called by:**
- `transformJoinClause` (12)
- `(module)` (8)
- `filterOutputFields` (5)
- `filterOutputFields` (3)
- `async (anonymous)` (3)
- `transformJoinClause` (2)
- `getEnumValues` (1)

### `normalizeEmailAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/senderIdentity.ts:61` | Self: 0.1% (58.2ms) | Total: 0.1% (58.2ms) | Samples: 50

**Called by:**
- `isFreeMailDomain` (50)

### `getColorDepth`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs` | Self: 0.1% (57.9ms) | Total: 0.1% (57.9ms) | Samples: 1

**Called by:**
- `createLogger` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2666` | Self: 0.1% (55.3ms) | Total: 0.1% (55.3ms) | Samples: 47

**Called by:**
- `map` (47)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:565` | Self: 0.1% (53.5ms) | Total: 0.1% (54.5ms) | Samples: 45

**Called by:**
- `forEach` (46)

**Calls:**
- `add` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:165` | Self: 0.1% (53.1ms) | Total: 12.3% (4.56s) | Samples: 47

**Called by:**
- `flatIntoArrayWithCallback` (3969)

**Calls:**
- `shouldIgnoreTopicSuggestionSignal` (2321)
- `shouldIgnoreTopicSuggestionSignal` (1273)
- `shouldIgnoreTopicSuggestionSignal` (182)
- `shouldIgnoreTopicSuggestionSignal` (68)
- `shouldIgnoreTopicSuggestionSignal` (32)
- `shouldIgnoreTopicSuggestionSignal` (28)
- `shouldIgnoreTopicSuggestionSignal` (18)

### `getTopicSuggestionWeight`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:68` | Self: 0.1% (51.3ms) | Total: 0.1% (51.3ms) | Samples: 44

**Called by:**
- `(anonymous)` (44)

### `_collapseAtSpacing`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:273` | Self: 0.1% (51.0ms) | Total: 0.1% (51.0ms) | Samples: 42

**Called by:**
- `map` (32)
- `_recoverAddrSpec` (10)

### `async enrichMessagesWithThreadTopics`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts:50` | Self: 0.1% (50.3ms) | Total: 0.1% (50.3ms) | Samples: 41

### `cloneObject`
`[native code]` | Self: 0.1% (49.8ms) | Total: 0.1% (49.8ms) | Samples: 43

**Called by:**
- `slimThreadListItem` (22)
- `async (anonymous)` (12)
- `(anonymous)` (5)
- `async getAccountById` (3)
- `(module)` (1)

### `UTC`
`[native code]` | Self: 0.1% (49.3ms) | Total: 0.1% (49.3ms) | Samples: 43

**Called by:**
- `displayDayNumber` (43)

### `flatMap`
`[native code]` | Self: 0.1% (49.1ms) | Total: 16.5% (6.11s) | Samples: 43

**Called by:**
- `topicSuggestionEntriesFromThreadSignalRows` (3376)
- `ownAddressList` (1134)
- `parseAddressEmails` (661)
- `extractEmailAddresses` (96)
- `(anonymous)` (1)

**Calls:**
- `flatIntoArrayWithCallback` (5224)
- `reverse` (1)

### `createExpressionBuilder`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:32` | Self: 0.1% (47.7ms) | Total: 0.1% (50.0ms) | Samples: 17

**Called by:**
- `parseAliasedExpression` (14)
- `parseExpression` (5)

**Calls:**
- `assign` (2)

### `addressparser`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1199` | Self: 0.1% (46.7ms) | Total: 4.0% (1.49s) | Samples: 40

**Called by:**
- `parseAddressEmails` (1246)

**Calls:**
- `_parseAddressList` (795)
- `_parseAddressList` (397)
- `reverse` (10)
- `_parseAddressList` (3)
- `_mergeNameFragments` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts:29` | Self: 0.1% (46.4ms) | Total: 0.1% (46.4ms) | Samples: 41

**Called by:**
- `map` (41)

### `normalizeIdentityEmail`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:10` | Self: 0.1% (42.9ms) | Total: 0.2% (85.4ms) | Samples: 38

**Called by:**
- `(anonymous)` (28)
- `map` (24)
- `(anonymous)` (19)
- `(anonymous)` (4)

**Calls:**
- `/^[\p{L}\p{M}\p{N}.-]+$/u` (37)

### `_recoverAddrSpec`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:368` | Self: 0.1% (42.6ms) | Total: 0.1% (45.0ms) | Samples: 33

**Called by:**
- `_handleAddress` (35)

**Calls:**
- `/\s/` (2)

### `/^[\p{L}\p{M}\p{N}.-]+$/u`
`[native code]` | Self: 0.1% (42.5ms) | Total: 0.1% (42.5ms) | Samples: 37

**Called by:**
- `normalizeIdentityEmail` (37)

### `Date`
`[native code]` | Self: 0.1% (42.1ms) | Total: 0.1% (42.1ms) | Samples: 37

**Called by:**
- `buildTimeGroupKey` (22)
- `buildMessageGroupKey` (11)
- `async (anonymous)` (2)
- `onUpdate` (1)
- `async getThreadGroupCounts` (1)

### `isFreeMailDomain`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/senderIdentity.ts:272` | Self: 0.1% (40.3ms) | Total: 0.1% (40.3ms) | Samples: 36

**Called by:**
- `shouldIgnoreTopicSuggestionSignal` (22)
- `shouldIgnoreTopicSuggestionSignal` (14)

### `flush`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:205` | Self: 0.1% (39.2ms) | Total: 0.1% (39.2ms) | Samples: 34

**Called by:**
- `(anonymous)` (34)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadCollab.ts:8` | Self: 0.1% (38.0ms) | Total: 0.1% (38.0ms) | Samples: 33

**Called by:**
- `filter` (33)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:46` | Self: 0.1% (37.9ms) | Total: 2.1% (792.6ms) | Samples: 32

**Called by:**
- `flatIntoArrayWithCallback` (662)

**Calls:**
- `normalizeIdentityEmail` (241)
- `normalizeIdentityEmail` (93)
- `normalizeIdentityEmail` (81)
- `normalizeIdentityEmail` (71)
- `normalizeIdentityEmail` (66)
- `normalizeIdentityEmail` (22)
- `normalizeIdentityEmail` (19)
- `normalizeIdentityEmail` (19)
- `normalizeIdentityEmail` (18)

### `shouldIgnoreTopicSuggestionSignal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:126` | Self: 0.0% (36.9ms) | Total: 0.0% (36.9ms) | Samples: 32

**Called by:**
- `(anonymous)` (32)

### `freeze`
`[native code]` | Self: 0.0% (35.9ms) | Total: 0.0% (35.9ms) | Samples: 26

**Called by:**
- `create` (24)
- `async execute` (1)
- `parseValueBinaryOperation` (1)

### `Map`
`[native code]` | Self: 0.0% (34.6ms) | Total: 0.0% (34.6ms) | Samples: 31

**Called by:**
- `getThreadCollabStates` (17)
- `async (anonymous)` (4)
- `(anonymous)` (3)
- `async (anonymous)` (2)
- `ResponseCookies` (2)
- `async (anonymous)` (1)
- `sortGroupsForGroupBy` (1)
- `(anonymous)` (1)

### `async enrichMessagesWithThreadCollab`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadCollab.ts:14` | Self: 0.0% (34.5ms) | Total: 0.0% (35.7ms) | Samples: 26

**Calls:**
- `trim` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:78` | Self: 0.0% (34.4ms) | Total: 0.0% (34.4ms) | Samples: 10

### `getChunkedCookie`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/session-store.mjs:138` | Self: 0.0% (34.3ms) | Total: 0.0% (34.3ms) | Samples: 5

**Called by:**
- `async (anonymous)` (5)

### `filter`
`[native code]` | Self: 0.0% (34.2ms) | Total: 1.3% (511.3ms) | Samples: 24

**Called by:**
- `(anonymous)` (264)
- `async enrichMessagesWithThreadCollab` (36)
- `async getMessageCalendarInviteDataByMessageId` (6)
- `isOwnAddress` (6)
- `async enrichMessagesWithThreadTopics` (4)
- `async getTopicSuggestionsForThreads` (3)
- `async enrichMessagesWithThreadTopics` (3)
- `async (anonymous)` (2)
- `transformJoinClause` (2)
- `normalizeThreadIds` (1)
- `normalizeThreadIds` (1)
- `transformJoinClause` (1)
- `isInstalledControlPlane` (1)
- `normalizeDef` (1)
- `getOwnAddresses` (1)
- `getTopicSuggestionSignalsForThreadsFromDb` (1)
- `filterOutputFields` (1)
- `filterOutputFields` (1)

**Calls:**
- `(anonymous)` (260)
- `(anonymous)` (33)
- `Boolean` (8)
- `(anonymous)` (4)
- `(anonymous)` (2)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

### ``/^[A-Za-z0-9.!#$%&'*+\/=?^_`{\|}~-]+$/``
`[native code]` | Self: 0.0% (34.1ms) | Total: 0.0% (34.1ms) | Samples: 29

**Called by:**
- `normalizeIdentityEmail` (29)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:162` | Self: 0.0% (33.1ms) | Total: 0.0% (33.1ms) | Samples: 29

**Called by:**
- `flatIntoArrayWithCallback` (29)

### `slimThreadListItem`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:32` | Self: 0.0% (31.9ms) | Total: 0.1% (56.3ms) | Samples: 28

**Called by:**
- `map` (50)

**Calls:**
- `cloneObject` (22)

### `shouldIgnoreTopicSuggestionSignal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:118` | Self: 0.0% (31.1ms) | Total: 0.0% (31.1ms) | Samples: 28

**Called by:**
- `(anonymous)` (28)

### `(anonymous)`
`[native code]` | Self: 0.0% (29.6ms) | Total: 0.2% (79.9ms) | Samples: 11

**Called by:**
- `(anonymous)` (12)
- `require` (12)
- `decodeSecret` (9)
- `decryptPayload` (5)
- `(anonymous)` (2)
- `(anonymous)` (1)

**Calls:**
- `Buffer` (12)
- `(anonymous)` (12)
- `(module)` (2)
- `(module)` (1)
- `WriteStream` (1)
- `get WriteStream` (1)
- `(module)` (1)

### `_handleAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:776` | Self: 0.0% (28.3ms) | Total: 0.0% (28.3ms) | Samples: 25

**Called by:**
- `_parseAddressList` (25)

### `_handleAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:743` | Self: 0.0% (28.2ms) | Total: 0.0% (28.2ms) | Samples: 25

**Called by:**
- `_parseAddressList` (25)

### `node:dns`
`node:dns:2` | Self: 0.0% (28.2ms) | Total: 0.0% (28.2ms) | Samples: 1

### `/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/`
`[native code]` | Self: 0.0% (26.2ms) | Total: 0.0% (26.2ms) | Samples: 23

**Called by:**
- `(anonymous)` (23)

### `_handleAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:697` | Self: 0.0% (25.2ms) | Total: 0.0% (30.0ms) | Samples: 21

**Called by:**
- `_parseAddressList` (24)

**Calls:**
- `(unknown)` (2)
- `splice` (1)

### `normalizeIdentityEmail`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:15` | Self: 0.0% (25.1ms) | Total: 0.0% (25.1ms) | Samples: 22

**Called by:**
- `(anonymous)` (14)
- `map` (6)
- `(anonymous)` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2523` | Self: 0.0% (24.9ms) | Total: 0.0% (24.9ms) | Samples: 21

**Called by:**
- `forEach` (21)

### `_joinAtSpacing`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` | Self: 0.0% (24.3ms) | Total: 0.0% (24.3ms) | Samples: 6

**Called by:**
- `_recoverAddrSpec` (6)

### `checkChar`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1003` | Self: 0.0% (24.2ms) | Total: 0.0% (24.2ms) | Samples: 22

**Called by:**
- `tokenize` (22)

### `displayDayNumber`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts:41` | Self: 0.0% (23.6ms) | Total: 4.9% (1.82s) | Samples: 21

**Called by:**
- `buildTimeGroupKey` (550)
- `buildMessageGroupKey` (547)
- `buildTimeGroupKey` (478)

**Calls:**
- `formatToParts` (1554)

### `Cipher`
`[native code]` | Self: 0.0% (23.5ms) | Total: 0.0% (23.5ms) | Samples: 16

**Called by:**
- `Decipheriv2` (16)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:334` | Self: 0.0% (23.2ms) | Total: 0.0% (23.2ms) | Samples: 3

**Called by:**
- `async findSession` (2)

### `_parseAddressList`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1155` | Self: 0.0% (23.1ms) | Total: 2.5% (935.1ms) | Samples: 20

**Called by:**
- `addressparser` (795)

**Calls:**
- `tokenize` (673)
- `Tokenizer` (74)
- `Tokenizer` (21)
- `Tokenizer` (5)
- `tokenize` (2)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:82` | Self: 0.0% (23.1ms) | Total: 57.2% (21.19s) | Samples: 10

**Called by:**
- `async listThreads` (2483)
- `async listThreads` (2181)
- `async getThreadGroupCounts` (1812)
- `(anonymous)` (1789)
- `async listThreads` (1471)
- `async listThreads` (886)
- `(anonymous)` (709)
- `async getTotalCount` (590)
- `getTopicSuggestionSignalsForThreadsFromDb` (331)
- `(anonymous)` (327)
- `insert` (275)
- `async recomputeThreadsForAccountInternal` (216)
- `insert` (187)
- `async recomputeThreadsForAccountInternal` (152)
- `async getMessageCalendarInviteDataByMessageId` (127)
- `getThreadCollabStates` (94)
- `async getAccountById` (82)
- `rebuildThreadSignalsForThreadIdsInternal` (74)
- `listSenderIdentityRows` (71)
- `(anonymous)` (56)
- `(anonymous)` (55)
- `executeQuery` (54)
- `rebuildThreadSignalsForThreadIdsInternal` (43)
- `getTopicSuggestionsForThreadSignalBatch` (38)
- `(anonymous)` (33)
- `(anonymous)` (26)
- `lookup` (24)
- `(anonymous)` (22)
- `(anonymous)` (21)
- `rebuildAllThreadSignalsForAccountInternal` (18)
- `executeQuery` (15)
- `async assertAccountFolder` (12)
- `(anonymous)` (12)
- `async recomputeThreadsForAccountInternal` (12)
- `readUserById` (10)
- `async getAccountOwnAddresses` (10)
- `resolveAccountRoleRow` (9)
- `async recomputeThreadsForAccountInternal` (9)
- `async withDbWriteRetry` (7)
- `(anonymous)` (5)
- `upsertTopicLearningSignalsForThreadIds` (5)
- `async resolveAccountDbPath` (5)
- `loadManualCategoryStatesForMessageIds` (4)
- `enrollmentState` (4)
- `pruneThreadTopicsWithoutMessages` (3)
- `async buildFixture` (2)
- `shardWriterGuardsInstalled` (2)
- `async requireActiveUserSession` (2)
- `initMasterSchema` (1)
- `ensureThreadCollabRuntimeSchema` (1)
- `initMasterSchema` (1)
- `backfillCalendarReminderEventUidKeys` (1)
- `initMasterSchema` (1)
- `initMasterSchema` (1)
- `async reconcileProvisioning` (1)
- `initMasterSchema` (1)
- `async requireActiveUserSession` (1)
- `initMasterSchema` (1)
- `schemaSql` (1)
- `initMasterSchema` (1)
- `initMasterSchema` (1)
- `(anonymous)` (1)
- `initMasterSchema` (1)
- `(anonymous)` (1)
- `initMasterSchema` (1)
- `async (anonymous)` (1)
- `scopedTables` (1)
- `ensureTableColumns` (1)
- `async requireActiveUserSession` (1)
- `initMasterSchema` (1)
- `createAdminInvite` (1)
- `assertSupportedShardFormat` (1)
- `ftsIdentitySchemaInstalled` (1)
- `initMasterSchema` (1)

**Calls:**
- `all` (7383)
- `#run` (3657)
- `get` (3314)
- `#runNoArgs` (26)
- `#all` (4)
- `#get` (3)
- `#run` (3)
- `#get` (1)

### `structuredClone`
`[native code]` | Self: 0.0% (22.9ms) | Total: 0.0% (22.9ms) | Samples: 14

**Called by:**
- `filterOutputFields` (14)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:187` | Self: 0.0% (22.9ms) | Total: 0.0% (32.5ms) | Samples: 19

**Called by:**
- `forEach` (27)

**Calls:**
- `topicSuggestionSignalsFromEntries` (6)
- `topicSuggestionSignalsFromEntries` (2)

### `AsyncLocalStorage`
`node:async_hooks` | Self: 0.0% (20.9ms) | Total: 0.0% (20.9ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:628` | Self: 0.0% (20.6ms) | Total: 0.1% (73.1ms) | Samples: 18

**Called by:**
- `forEach` (63)

**Calls:**
- `getTopicSuggestionWeight` (44)
- `slice` (1)

### `checkChar`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1019` | Self: 0.0% (20.1ms) | Total: 0.0% (22.3ms) | Samples: 17

**Called by:**
- `tokenize` (19)

**Calls:**
- `push` (2)

### `createFunctionModule`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/function-module.js:19` | Self: 0.0% (19.8ms) | Total: 0.0% (19.8ms) | Samples: 3

**Called by:**
- `createExpressionBuilder` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:164` | Self: 0.0% (19.4ms) | Total: 0.0% (19.4ms) | Samples: 16

**Called by:**
- `flatIntoArrayWithCallback` (16)

### `text`
`[native code]` | Self: 0.0% (18.9ms) | Total: 0.0% (36.6ms) | Samples: 16

**Called by:**
- `(module)` (16)
- `text` (15)

**Calls:**
- `text` (15)

### `/[\x00-\x1f\x7f]/`
`[native code]` | Self: 0.0% (18.8ms) | Total: 0.0% (18.8ms) | Samples: 17

**Called by:**
- `normalizeIdentityEmail` (17)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:95` | Self: 0.0% (18.8ms) | Total: 0.0% (18.8ms) | Samples: 6

**Called by:**
- `executeQuery` (3)
- `async getMessageCalendarInviteDataByMessageId` (1)
- `async getTotalCount` (1)
- `async listThreads` (1)

### `displayDayNumber`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts:39` | Self: 0.0% (18.6ms) | Total: 0.5% (189.1ms) | Samples: 16

**Called by:**
- `buildTimeGroupKey` (57)
- `buildTimeGroupKey` (57)
- `buildMessageGroupKey` (48)

**Calls:**
- `cached` (138)
- `cached` (8)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:370` | Self: 0.0% (18.4ms) | Total: 0.0% (18.4ms) | Samples: 15

**Called by:**
- `forEach` (15)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/esm/mimetypes.js:3` | Self: 0.0% (18.2ms) | Total: 0.0% (18.2ms) | Samples: 6

### `stringify`
`[native code]` | Self: 0.0% (18.1ms) | Total: 0.0% (18.1ms) | Samples: 15

**Called by:**
- `normalizeAccountSettings` (11)
- `(module)` (4)

### `flatIntoArrayWithCallback`
`[native code]` | Self: 0.0% (17.9ms) | Total: 19.2% (7.11s) | Samples: 15

**Called by:**
- `flatMap` (5224)
- `flush` (669)
- `getOwnAddresses` (77)
- `extractEmailAddresses` (51)
- `ownAddressList` (46)
- `isOwnAddress` (11)
- `getHooks` (6)
- `flatIntoArrayWithCallback` (4)
- `(anonymous)` (4)
- `(anonymous)` (3)
- `(anonymous)` (1)
- `async findSchemaProblems` (1)
- `getHooks` (1)

**Calls:**
- `(anonymous)` (3969)
- `(anonymous)` (1158)
- `(anonymous)` (662)
- `parseAddressEmails` (107)
- `(anonymous)` (76)
- `(anonymous)` (29)
- `(anonymous)` (16)
- `parseAddressEmails` (14)
- `(anonymous)` (13)
- `parseAddressEmails` (12)
- `flatIntoArray` (6)
- `flatIntoArrayWithCallback` (4)
- `(anonymous)` (4)
- `(anonymous)` (4)
- `(anonymous)` (3)
- `(anonymous)` (2)
- `map` (2)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `compileQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:21` | Self: 0.0% (17.5ms) | Total: 0.0% (17.5ms) | Samples: 5

**Called by:**
- `async execute` (5)

### `_handleAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:660` | Self: 0.0% (17.4ms) | Total: 0.3% (117.1ms) | Samples: 14

**Called by:**
- `_parseAddressList` (99)

**Calls:**
- `_collectAddressParts` (80)
- `_collectAddressParts` (4)
- `_collectAddressParts` (1)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:83` | Self: 0.0% (16.3ms) | Total: 0.0% (17.3ms) | Samples: 14

**Called by:**
- `(anonymous)` (2)
- `(anonymous)` (2)
- `insert` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `lookup` (1)
- `(anonymous)` (1)
- `insert` (1)

**Calls:**
- `#run` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts` | Self: 0.0% (16.1ms) | Total: 0.0% (16.1ms) | Samples: 14

**Called by:**
- `map` (14)

### `parse`
`[native code]` | Self: 0.0% (15.8ms) | Total: 0.0% (15.8ms) | Samples: 12

**Called by:**
- `safeParseJson` (8)
- `(module)` (4)

### `_collapseAtSpacing`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:272` | Self: 0.0% (15.3ms) | Total: 0.0% (15.3ms) | Samples: 13

**Called by:**
- `map` (9)
- `_recoverAddrSpec` (4)

### `async acquireConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs` | Self: 0.0% (15.3ms) | Total: 0.0% (15.3ms) | Samples: 3

**Called by:**
- `async acquireConnection` (2)
- `async acquireConnection` (1)

### `isOwnAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:61` | Self: 0.0% (15.0ms) | Total: 3.5% (1.31s) | Samples: 11

**Called by:**
- `shouldIgnoreTopicSuggestionSignal` (853)
- `(anonymous)` (108)
- `(anonymous)` (100)
- `shouldIgnoreTopicSuggestionSignal` (57)

**Calls:**
- `map` (984)
- `Set` (117)
- `filter` (6)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:163` | Self: 0.0% (14.9ms) | Total: 0.0% (14.9ms) | Samples: 13

**Called by:**
- `flatIntoArrayWithCallback` (13)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:165` | Self: 0.0% (14.9ms) | Total: 0.0% (14.9ms) | Samples: 13

**Called by:**
- `map` (13)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:355` | Self: 0.0% (14.9ms) | Total: 0.9% (336.1ms) | Samples: 1

**Called by:**
- `async findSession` (2)

**Calls:**
- `async findOne` (129)
- `async getCurrentAdapter` (1)
- `async getCurrentAdapter` (1)

### `buildMessageGroupKey`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageGrouping.ts:71` | Self: 0.0% (14.7ms) | Total: 2.2% (833.1ms) | Samples: 13

**Called by:**
- `buildGroupKey` (627)
- `(anonymous)` (92)

**Calls:**
- `displayDayNumber` (547)
- `displayDayNumber` (96)
- `displayDayNumber` (48)
- `Date` (11)
- `displayDayNumber` (2)
- `displayDayNumber` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:346` | Self: 0.0% (14.2ms) | Total: 0.0% (14.2ms) | Samples: 3

**Called by:**
- `async handleFallbackJoin` (3)

### `_handleAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:698` | Self: 0.0% (14.2ms) | Total: 0.0% (14.2ms) | Samples: 12

**Called by:**
- `_parseAddressList` (12)

### `_parseAddressList`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1181` | Self: 0.0% (13.7ms) | Total: 1.3% (490.7ms) | Samples: 12

**Called by:**
- `addressparser` (397)

**Calls:**
- `_handleAddress` (114)
- `_handleAddress` (99)
- `_handleAddress` (58)
- `_handleAddress` (25)
- `_handleAddress` (25)
- `_handleAddress` (24)
- `_handleAddress` (12)
- `_handleAddress` (10)
- `_handleAddress` (8)
- `_handleAddress` (5)
- `_handleAddress` (3)
- `_handleAddress` (1)
- `_handleAddress` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:25` | Self: 0.0% (13.6ms) | Total: 0.0% (13.6ms) | Samples: 8

### `reverse`
`[native code]` | Self: 0.0% (13.5ms) | Total: 0.0% (13.5ms) | Samples: 12

**Called by:**
- `addressparser` (10)
- `addressparser` (1)
- `flatMap` (1)

### `visitSelectQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:80` | Self: 0.0% (13.4ms) | Total: 0.0% (28.8ms) | Samples: 3

**Called by:**
- `bound visitSelectQuery` (8)

**Calls:**
- `visitNode` (5)

### `Buffer`
`[native code]` | Self: 0.0% (13.2ms) | Total: 0.0% (13.2ms) | Samples: 12

**Called by:**
- `(anonymous)` (12)

### `cloneWithSelections`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/select-query-node.js:30` | Self: 0.0% (13.0ms) | Total: 0.0% (13.0ms) | Samples: 2

**Called by:**
- `selectAll` (2)

### `topicSuggestionSignalsFromEntries`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:75` | Self: 0.0% (13.0ms) | Total: 0.0% (13.0ms) | Samples: 11

**Called by:**
- `(anonymous)` (6)
- `flush` (5)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:84` | Self: 0.0% (12.9ms) | Total: 0.0% (34.3ms) | Samples: 8

**Calls:**
- `cloneObject` (12)
- `async internalHandler` (7)

### `displayDayNumber`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts:38` | Self: 0.0% (12.8ms) | Total: 0.0% (12.8ms) | Samples: 11

**Called by:**
- `buildTimeGroupKey` (6)
- `buildTimeGroupKey` (3)
- `buildMessageGroupKey` (2)

### `verify`
`[native code]` | Self: 0.0% (12.7ms) | Total: 0.0% (12.7ms) | Samples: 11

**Called by:**
- `async (anonymous)` (11)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:506` | Self: 0.0% (12.4ms) | Total: 0.1% (46.4ms) | Samples: 1

**Called by:**
- `parseAliasedExpression` (25)

**Calls:**
- `selectFrom` (24)

### `ownAddressList`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:68` | Self: 0.0% (12.1ms) | Total: 0.5% (202.1ms) | Samples: 11

**Called by:**
- `shouldIgnoreTopicSuggestionSignal` (165)
- `collectTopicSignalEntries` (9)

**Calls:**
- `Set` (163)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-field-name.mjs` | Self: 0.0% (12.0ms) | Total: 0.0% (12.0ms) | Samples: 2

**Called by:**
- `async (anonymous)` (1)
- `getFieldName` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-id-field.mjs:43` | Self: 0.0% (11.9ms) | Total: 0.0% (11.9ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `_collapseAtSpacing`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:262` | Self: 0.0% (11.8ms) | Total: 0.0% (11.8ms) | Samples: 10

**Called by:**
- `map` (9)
- `_recoverAddrSpec` (1)

### `encodeURIComponent`
`[native code]` | Self: 0.0% (11.5ms) | Total: 0.0% (11.5ms) | Samples: 10

**Called by:**
- `(anonymous)` (6)
- `(anonymous)` (4)

### `_handleAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:699` | Self: 0.0% (11.5ms) | Total: 0.0% (11.5ms) | Samples: 10

**Called by:**
- `_parseAddressList` (10)

### `visitSelectQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:36` | Self: 0.0% (11.4ms) | Total: 0.0% (11.4ms) | Samples: 2

**Called by:**
- `bound visitSelectQuery` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:69` | Self: 0.0% (11.1ms) | Total: 3.6% (1.33s) | Samples: 9

**Called by:**
- `flatIntoArrayWithCallback` (1158)

**Calls:**
- `normalizeIdentityEmail` (455)
- `normalizeIdentityEmail` (186)
- `normalizeIdentityEmail` (176)
- `normalizeIdentityEmail` (112)
- `normalizeIdentityEmail` (76)
- `normalizeIdentityEmail` (39)
- `normalizeIdentityEmail` (35)
- `normalizeIdentityEmail` (28)
- `normalizeIdentityEmail` (28)
- `normalizeIdentityEmail` (14)

### `toString`
`[native code]` | Self: 0.0% (10.9ms) | Total: 0.0% (10.9ms) | Samples: 9

**Called by:**
- `decodeSecret` (9)

### `performIteration`
`[native code]` | Self: 0.0% (10.8ms) | Total: 0.0% (15.9ms) | Samples: 1

**Called by:**
- `cloneWithSelections` (4)
- `header` (1)
- `shardWriterGuardsInstalled` (1)

**Calls:**
- `values` (3)
- `next` (2)

### `async runAfterHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:119` | Self: 0.0% (10.7ms) | Total: 0.0% (10.7ms) | Samples: 1

**Called by:**
- `async runAfterHooks` (1)

### `formatTransactionId`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:865` | Self: 0.0% (10.6ms) | Total: 0.5% (190.6ms) | Samples: 1

**Called by:**
- `async (anonymous)` (4)
- `async (anonymous)` (4)

**Calls:**
- `getColorDepth` (2)
- `getColorDepth` (2)
- `getColorDepth` (1)
- `getColorDepth` (1)
- `getColorDepth` (1)

### `_joinAtSpacing`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:239` | Self: 0.0% (10.4ms) | Total: 0.0% (10.4ms) | Samples: 9

**Called by:**
- `map` (9)

### `visitNode`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/operation-node-visitor.js:111` | Self: 0.0% (10.4ms) | Total: 0.0% (10.4ms) | Samples: 2

**Called by:**
- `visitWhere` (1)
- `visitReference` (1)

### `wrapStatement`
`/tmp/spike-switch-server/sqlcounter.ts:75` | Self: 0.0% (10.3ms) | Total: 0.0% (10.3ms) | Samples: 9

**Called by:**
- `async getAccountById` (2)
- `getDbTableColumns` (1)
- `readUserById` (1)
- `async listThreads` (1)
- `async getMessageCalendarInviteDataByMessageId` (1)
- `async getThreadGroupCounts` (1)
- `executeQuery` (1)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:77` | Self: 0.0% (10.2ms) | Total: 0.0% (10.2ms) | Samples: 4

**Called by:**
- `forEach` (4)

### `isReadonlyArray`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/object-utils.js` | Self: 0.0% (10.1ms) | Total: 0.0% (10.1ms) | Samples: 1

**Called by:**
- `and` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js` | Self: 0.0% (10.1ms) | Total: 0.0% (10.1ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:697` | Self: 0.0% (9.9ms) | Total: 0.0% (19.0ms) | Samples: 9

**Called by:**
- `forEach` (17)

**Calls:**
- `install` (5)
- `install` (2)
- `get` (1)

### `parseSelectArg`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/select-parser.js:10` | Self: 0.0% (9.8ms) | Total: 0.0% (9.8ms) | Samples: 1

**Called by:**
- `select` (1)

### `insert`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/ftsIdentity.ts:87` | Self: 0.0% (9.6ms) | Total: 0.6% (239.9ms) | Samples: 8

**Called by:**
- `(anonymous)` (198)

**Calls:**
- `(anonymous)` (187)
- `(anonymous)` (2)
- `(anonymous)` (1)

### `TokenList`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:25` | Self: 0.0% (9.6ms) | Total: 0.0% (9.6ms) | Samples: 9

**Called by:**
- `Tokenizer` (9)

### `isOwnAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:62` | Self: 0.0% (9.4ms) | Total: 6.0% (2.24s) | Samples: 8

**Called by:**
- `shouldIgnoreTopicSuggestionSignal` (1468)
- `(anonymous)` (159)
- `(anonymous)` (144)
- `shouldIgnoreTopicSuggestionSignal` (125)

**Calls:**
- `parseAddressEmails` (1578)
- `parseAddressEmails` (176)
- `some` (70)
- `parseAddressEmails` (52)
- `flatIntoArrayWithCallback` (11)
- `parseAddressEmails` (1)

### `create`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/where-node.js:13` | Self: 0.0% (9.3ms) | Total: 0.0% (9.3ms) | Samples: 1

**Called by:**
- `cloneWithWhere` (1)

### `DateTimeFormat`
`[native code]` | Self: 0.0% (9.2ms) | Total: 0.0% (9.2ms) | Samples: 8

**Called by:**
- `(anonymous)` (8)

### `defineProperty`
`[native code]` | Self: 0.0% (9.2ms) | Total: 0.0% (9.2ms) | Samples: 7

**Called by:**
- `(anonymous)` (2)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `own` (1)
- `get` (1)
- `(anonymous)` (1)

### `_handleAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:744` | Self: 0.0% (9.1ms) | Total: 0.0% (9.1ms) | Samples: 8

**Called by:**
- `_parseAddressList` (8)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-field-name.mjs:19` | Self: 0.0% (9.0ms) | Total: 0.0% (9.0ms) | Samples: 4

**Called by:**
- `(anonymous)` (2)
- `(anonymous)` (1)
- `getFieldName` (1)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:81` | Self: 0.0% (8.7ms) | Total: 0.0% (8.7ms) | Samples: 7

**Called by:**
- `(anonymous)` (3)
- `insert` (2)
- `(anonymous)` (1)
- `lookup` (1)

### `flatIntoArray`
`[native code]` | Self: 0.0% (8.6ms) | Total: 0.0% (8.6ms) | Samples: 6

**Called by:**
- `flatIntoArrayWithCallback` (6)

### `_mergeNameFragments`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1127` | Self: 0.0% (8.3ms) | Total: 0.0% (8.3ms) | Samples: 4

**Called by:**
- `_parseAddressList` (3)
- `addressparser` (1)

### `parseValueBinaryOperationOrExpression`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/binary-operation-parser.js` | Self: 0.0% (8.1ms) | Total: 0.0% (8.1ms) | Samples: 2

**Called by:**
- `where` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2615` | Self: 0.0% (8.0ms) | Total: 0.0% (8.0ms) | Samples: 7

**Called by:**
- `map` (7)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts` | Self: 0.0% (8.0ms) | Total: 0.0% (8.0ms) | Samples: 7

**Called by:**
- `async resolveAccountDbPath` (2)
- `lookup` (1)
- `insert` (1)
- `listSenderIdentityRows` (1)
- `async getMessageCalendarInviteDataByMessageId` (1)
- `(anonymous)` (1)

### `join`
`[native code]` | Self: 0.0% (7.9ms) | Total: 0.0% (7.9ms) | Samples: 6

**Called by:**
- `rebuildThreadSignalsForThreadIdsInternal` (1)
- `getTopicSuggestionSignalsForThreadsFromDb` (1)
- `async getMessageCalendarInviteDataByMessageId` (1)
- `getThreadCollabStates` (1)
- `async listThreads` (1)
- `async listThreads` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:257` | Self: 0.0% (7.7ms) | Total: 0.0% (7.7ms) | Samples: 1

**Called by:**
- `map` (1)

### `parseAliasedExpression`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/expression-parser.js:16` | Self: 0.0% (7.5ms) | Total: 0.0% (7.5ms) | Samples: 2

**Called by:**
- `parseTableExpressionOrList` (2)

### `wrapStatement`
`/tmp/spike-switch-server/sqlcounter.ts:76` | Self: 0.0% (7.4ms) | Total: 0.0% (7.4ms) | Samples: 6

**Called by:**
- `async getAccountById` (3)
- `async requireActiveUserSession` (3)

### `add`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:69` | Self: 0.0% (7.4ms) | Total: 0.0% (7.4ms) | Samples: 3

**Called by:**
- `(anonymous)` (3)

### `Statement`
`bun:sqlite:108` | Self: 0.0% (7.4ms) | Total: 0.0% (7.4ms) | Samples: 5

**Called by:**
- `prepare` (5)

### `Request`
`[native code]` | Self: 0.0% (7.3ms) | Total: 0.0% (7.3ms) | Samples: 6

**Called by:**
- `get` (6)

### `async GET`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:48` | Self: 0.0% (7.1ms) | Total: 0.0% (9.3ms) | Samples: 6

**Called by:**
- `async GET` (7)

**Calls:**
- `URL` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:218` | Self: 0.0% (7.1ms) | Total: 12.6% (4.69s) | Samples: 6

**Called by:**
- `forEach` (4074)

**Calls:**
- `flush` (4022)
- `flush` (34)
- `flush` (12)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:84` | Self: 0.0% (7.0ms) | Total: 0.0% (8.3ms) | Samples: 6

**Called by:**
- `(anonymous)` (3)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

**Calls:**
- `fireTriggers` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/he/he.js` | Self: 0.0% (7.0ms) | Total: 0.0% (7.0ms) | Samples: 4

**Called by:**
- `(anonymous)` (4)

### `TokenList`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:24` | Self: 0.0% (7.0ms) | Total: 0.0% (7.0ms) | Samples: 5

**Called by:**
- `Tokenizer` (5)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:211` | Self: 0.0% (7.0ms) | Total: 0.0% (24.2ms) | Samples: 3

**Calls:**
- `async transformSingleOutput` (13)

### `topicSuggestionSignalsFromEntries`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:84` | Self: 0.0% (6.9ms) | Total: 0.0% (9.4ms) | Samples: 6

**Called by:**
- `flush` (6)
- `(anonymous)` (2)

**Calls:**
- `forEach` (2)

### `TokenList`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` | Self: 0.0% (6.9ms) | Total: 0.0% (6.9ms) | Samples: 6

**Called by:**
- `Tokenizer` (6)

### `arrayFromFastWithoutMapFn`
`[native code]` | Self: 0.0% (6.9ms) | Total: 0.0% (6.9ms) | Samples: 4

**Called by:**
- `from` (4)

### `bound visitTable`
`[native code]` | Self: 0.0% (6.6ms) | Total: 0.0% (11.8ms) | Samples: 1

**Called by:**
- `visitNode` (3)

**Calls:**
- `visitTable` (2)

### `importKey`
`[native code]` | Self: 0.0% (6.5ms) | Total: 0.0% (6.5ms) | Samples: 6

**Called by:**
- `async (anonymous)` (6)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadCollab.ts:9` | Self: 0.0% (6.5ms) | Total: 0.0% (6.5ms) | Samples: 6

**Called by:**
- `map` (6)

### `Tokenizer`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:794` | Self: 0.0% (6.4ms) | Total: 0.0% (6.4ms) | Samples: 5

**Called by:**
- `_parseAddressList` (5)

### `transformJoinClause`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:287` | Self: 0.0% (6.4ms) | Total: 0.0% (6.4ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `update`
`[native code]` | Self: 0.0% (6.4ms) | Total: 0.0% (6.4ms) | Samples: 5

**Called by:**
- `update` (5)

### `topicSuggestionSignalKey`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:535` | Self: 0.0% (6.3ms) | Total: 0.0% (6.3ms) | Samples: 5

**Called by:**
- `(anonymous)` (5)

### `_handleAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:662` | Self: 0.0% (6.3ms) | Total: 0.0% (6.3ms) | Samples: 5

**Called by:**
- `_parseAddressList` (5)

### `visitNode`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/operation-node-visitor.js` | Self: 0.0% (6.3ms) | Total: 0.0% (6.3ms) | Samples: 3

**Called by:**
- `visitSchemableIdentifier` (1)
- `visitWhere` (1)
- `compileQuery` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:629` | Self: 0.0% (6.1ms) | Total: 0.0% (6.1ms) | Samples: 5

**Called by:**
- `forEach` (5)

### `defaultThreadCollabState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts:54` | Self: 0.0% (6.1ms) | Total: 0.0% (6.1ms) | Samples: 5

**Called by:**
- `(anonymous)` (5)

### `toISOString`
`[native code]` | Self: 0.0% (6.1ms) | Total: 0.0% (6.1ms) | Samples: 6

**Called by:**
- `async buildFixture` (6)

### `/[\x00-\x08\x0a-\x1f\x7f]/`
`[native code]` | Self: 0.0% (6.0ms) | Total: 0.0% (6.0ms) | Samples: 5

**Called by:**
- `parseAddressEmails` (5)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:23` | Self: 0.0% (6.0ms) | Total: 0.0% (6.0ms) | Samples: 3

**Called by:**
- `get` (3)

### `(module)`
`/tmp/spike-switch-server/inspect.ts:19` | Self: 0.0% (5.9ms) | Total: 0.0% (20.0ms) | Samples: 5

**Calls:**
- `entries` (8)
- `stringify` (4)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts` | Self: 0.0% (5.8ms) | Total: 0.0% (5.8ms) | Samples: 5

**Called by:**
- `forEach` (4)
- `flatIntoArrayWithCallback` (1)

### `set`
`[native code]` | Self: 0.0% (5.8ms) | Total: 0.0% (5.8ms) | Samples: 5

**Called by:**
- `(anonymous)` (2)
- `getThreadCollabStates` (2)
- `setHeader` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2671` | Self: 0.0% (5.7ms) | Total: 6.7% (2.50s) | Samples: 5

**Called by:**
- `map` (2164)

**Calls:**
- `buildGroupKey` (1920)
- `buildMessageGroupKey` (107)
- `buildMessageGroupKey` (92)
- `buildTimeGroupKey` (21)
- `buildTimeGroupKey` (18)
- `buildTimeGroupKey` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:59` | Self: 0.0% (5.7ms) | Total: 0.0% (5.7ms) | Samples: 5

**Called by:**
- `async (anonymous)` (4)

### `async enrichMessagesWithThreadTopics`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts:52` | Self: 0.0% (5.7ms) | Total: 0.0% (5.7ms) | Samples: 5

### `add`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:68` | Self: 0.0% (5.7ms) | Total: 0.0% (5.7ms) | Samples: 4

**Called by:**
- `(anonymous)` (3)
- `(anonymous)` (1)

### `install`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/storage.ts:258` | Self: 0.0% (5.6ms) | Total: 0.0% (5.6ms) | Samples: 5

**Called by:**
- `(anonymous)` (5)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:403` | Self: 0.0% (5.5ms) | Total: 0.0% (5.5ms) | Samples: 5

**Called by:**
- `forEach` (5)

### `async executeQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:35` | Self: 0.0% (5.5ms) | Total: 0.0% (5.5ms) | Samples: 2

**Called by:**
- `async executeQuery` (2)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:97` | Self: 0.0% (5.5ms) | Total: 0.0% (5.5ms) | Samples: 5

**Called by:**
- `async getAccountById` (2)
- `loadManualCategoryStatesForMessageIds` (1)
- `async getAccountOwnAddresses` (1)
- `async listThreads` (1)

### `topicSuggestionSignalEntries`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:107` | Self: 0.0% (5.4ms) | Total: 0.0% (20.7ms) | Samples: 5

**Called by:**
- `(anonymous)` (18)

**Calls:**
- `map` (13)

### `async requireActiveUserSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts` | Self: 0.0% (5.4ms) | Total: 0.0% (5.4ms) | Samples: 1

**Called by:**
- `async POST` (1)

### `async getDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:327` | Self: 0.0% (5.4ms) | Total: 0.0% (10.9ms) | Samples: 4

**Called by:**
- `async resolveAccountDbPath` (7)
- `async requireActiveUserSession` (1)
- `async getAccountOwnAddresses` (1)

**Calls:**
- `async getDb` (3)
- `async getDb` (2)

### `async resolveAccountRole`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/accountAccess.ts:12` | Self: 0.0% (5.3ms) | Total: 0.0% (17.2ms) | Samples: 4

**Called by:**
- `async requireAccountContext` (4)

**Calls:**
- `resolveAccountRoleRow` (9)
- `resolveAccountRoleRow` (1)

### `RegExp`
`[native code]` | Self: 0.0% (5.3ms) | Total: 0.0% (5.3ms) | Samples: 5

**Called by:**
- `compile` (1)
- `compile` (1)
- `compile` (1)
- `compile` (1)
- `compile` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2660` | Self: 0.0% (5.3ms) | Total: 0.0% (5.3ms) | Samples: 5

**Called by:**
- `map` (5)

### `throwForMissingRequestStore`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/work-unit-async-storage.external.js:88` | Self: 0.0% (5.2ms) | Total: 0.0% (6.5ms) | Samples: 5

**Called by:**
- `headers` (6)

**Calls:**
- `Error` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:39` | Self: 0.0% (5.2ms) | Total: 0.0% (5.2ms) | Samples: 1

**Called by:**
- `async getSignedCookie` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:166` | Self: 0.0% (5.2ms) | Total: 0.0% (7.6ms) | Samples: 3

**Called by:**
- `async transformSingleOutput` (5)

**Calls:**
- `Date` (2)

### `async runAfterHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs` | Self: 0.0% (5.2ms) | Total: 0.0% (5.2ms) | Samples: 2

**Called by:**
- `async runAfterHooks` (2)

### `defineProperties`
`[native code]` | Self: 0.0% (5.1ms) | Total: 0.0% (5.1ms) | Samples: 1

**Called by:**
- `strict` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1207` | Self: 0.0% (5.1ms) | Total: 0.0% (5.1ms) | Samples: 2

**Called by:**
- `forEach` (2)

### `visitSelectQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:71` | Self: 0.0% (5.1ms) | Total: 0.0% (5.1ms) | Samples: 1

**Called by:**
- `bound visitSelectQuery` (1)

### `looksLikeJiraMessage`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:31` | Self: 0.0% (5.0ms) | Total: 0.0% (5.0ms) | Samples: 4

**Called by:**
- `(anonymous)` (4)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:646` | Self: 0.0% (4.8ms) | Total: 0.0% (25.5ms) | Samples: 4

**Called by:**
- `forEach` (22)

**Calls:**
- `forEach` (18)

### `#all`
`bun:sqlite:177` | Self: 0.0% (4.8ms) | Total: 0.0% (4.8ms) | Samples: 4

**Called by:**
- `(anonymous)` (4)

### `addressparser`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1200` | Self: 0.0% (4.8ms) | Total: 0.0% (6.0ms) | Samples: 4

**Called by:**
- `parseAddressEmails` (5)

**Calls:**
- `reverse` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:15` | Self: 0.0% (4.8ms) | Total: 0.0% (4.8ms) | Samples: 3

### `async validateAccountFolders`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/folderAccount.ts:11` | Self: 0.0% (4.7ms) | Total: 0.0% (4.7ms) | Samples: 4

**Called by:**
- `async validateAccountFolders` (4)

### `async enrichMessagesWithThreadCollab`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadCollab.ts:9` | Self: 0.0% (4.7ms) | Total: 0.0% (25.7ms) | Samples: 4

**Called by:**
- `async enrichMessagesWithThreadCollab` (23)

**Calls:**
- `Set` (10)
- `map` (9)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:578` | Self: 0.0% (4.7ms) | Total: 0.0% (4.7ms) | Samples: 4

**Called by:**
- `forEach` (4)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:49` | Self: 0.0% (4.7ms) | Total: 0.0% (4.7ms) | Samples: 4

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:8` | Self: 0.0% (4.7ms) | Total: 0.0% (7.1ms) | Samples: 3

**Called by:**
- `async createInternalContext` (5)

**Calls:**
- `Headers` (2)

### `getThreadCollabStates`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts:76` | Self: 0.0% (4.6ms) | Total: 0.3% (112.3ms) | Samples: 4

**Called by:**
- `async getThreadCollabStates` (99)

**Calls:**
- `(anonymous)` (94)
- `join` (1)

### `wrapStatement`
`/tmp/spike-switch-server/sqlcounter.ts:74` | Self: 0.0% (4.6ms) | Total: 0.0% (4.6ms) | Samples: 4

**Called by:**
- `listSenderIdentityRows` (2)
- `async getAccountOwnAddresses` (1)
- `async getAccountById` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:47` | Self: 0.0% (4.5ms) | Total: 0.0% (4.5ms) | Samples: 4

**Called by:**
- `flatIntoArrayWithCallback` (4)

### `formatTransactionId`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` | Self: 0.0% (4.4ms) | Total: 0.0% (4.4ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts` | Self: 0.0% (4.4ms) | Total: 0.0% (4.4ms) | Samples: 4

**Called by:**
- `filter` (4)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:684` | Self: 0.0% (4.4ms) | Total: 0.0% (5.5ms) | Samples: 4

**Called by:**
- `forEach` (5)

**Calls:**
- `forEach` (1)

### `parseSearchInput`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:667` | Self: 0.0% (4.4ms) | Total: 0.0% (4.4ms) | Samples: 3

**Called by:**
- `async listThreads` (3)

### `async getUserById`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/serverDb.ts:150` | Self: 0.0% (4.4ms) | Total: 0.0% (4.4ms) | Samples: 2

**Called by:**
- `async requireActiveUserSession` (2)

### `concat`
`[native code]` | Self: 0.0% (4.3ms) | Total: 0.0% (4.3ms) | Samples: 3

**Called by:**
- `decryptPayload` (3)

### `_collectAddressParts`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` | Self: 0.0% (4.3ms) | Total: 0.0% (4.3ms) | Samples: 4

**Called by:**
- `_handleAddress` (4)

### `atob`
`[native code]` | Self: 0.0% (4.3ms) | Total: 0.0% (4.3ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:621` | Self: 0.0% (4.3ms) | Total: 0.0% (4.3ms) | Samples: 4

**Called by:**
- `forEach` (4)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:168` | Self: 0.0% (4.3ms) | Total: 0.0% (4.3ms) | Samples: 4

**Called by:**
- `flatIntoArrayWithCallback` (4)

### `some`
`[native code]` | Self: 0.0% (4.3ms) | Total: 0.2% (87.0ms) | Samples: 4

**Called by:**
- `isOwnAddress` (70)
- `async (anonymous)` (2)
- `deriveSystemFlagState` (1)
- `parse` (1)
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (69)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:209` | Self: 0.0% (4.3ms) | Total: 0.0% (20.3ms) | Samples: 2

**Called by:**
- `async (anonymous)` (12)

**Calls:**
- `getHooks` (7)
- `getHooks` (2)
- `getHooks` (1)
- `getHooks` (1)
- `getHooks` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:181` | Self: 0.0% (4.2ms) | Total: 0.0% (4.2ms) | Samples: 4

**Called by:**
- `map` (4)

### `visitSelectQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:42` | Self: 0.0% (4.1ms) | Total: 0.0% (4.1ms) | Samples: 2

**Called by:**
- `bound visitSelectQuery` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:567` | Self: 0.0% (4.1ms) | Total: 0.0% (4.1ms) | Samples: 4

**Called by:**
- `forEach` (4)

### `sanitizeIdentifier`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js` | Self: 0.0% (4.0ms) | Total: 0.0% (4.0ms) | Samples: 1

**Called by:**
- `compileUnwrappedIdentifier` (1)

### `values`
`[native code]` | Self: 0.0% (4.0ms) | Total: 0.0% (4.0ms) | Samples: 4

**Called by:**
- `performIteration` (3)
- `(module)` (1)

### `async runAfterHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:114` | Self: 0.0% (4.0ms) | Total: 0.0% (10.5ms) | Samples: 4

**Called by:**
- `async runAfterHooks` (8)

**Calls:**
- `(anonymous)` (3)
- `(anonymous)` (1)

### `convertWhereClause`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:365` | Self: 0.0% (4.0ms) | Total: 0.0% (4.0ms) | Samples: 2

**Called by:**
- `async findOne` (2)

### `async ensureCalendarEventRuntimeData`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts` | Self: 0.0% (3.9ms) | Total: 0.0% (3.9ms) | Samples: 4

**Called by:**
- `async ensureCalendarEventRuntimeData` (3)
- `async getAccountDb` (1)

### `_handleAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:696` | Self: 0.0% (3.8ms) | Total: 0.0% (3.8ms) | Samples: 3

**Called by:**
- `_parseAddressList` (3)

### `async setCookieCache`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/index.mjs:122` | Self: 0.0% (3.8ms) | Total: 0.0% (3.8ms) | Samples: 2

**Called by:**
- `async (anonymous)` (2)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/dialect/pglite/pglite-driver.js:12` | Self: 0.0% (3.8ms) | Total: 0.0% (3.8ms) | Samples: 1

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` | Self: 0.0% (3.6ms) | Total: 0.0% (3.6ms) | Samples: 3

**Called by:**
- `map` (2)
- `forEach` (1)

### `assertCredentialMode`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/secret.ts:8` | Self: 0.0% (3.6ms) | Total: 0.0% (3.6ms) | Samples: 3

**Called by:**
- `decodeSecret` (3)

### `checkChar`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` | Self: 0.0% (3.6ms) | Total: 0.0% (3.6ms) | Samples: 3

**Called by:**
- `tokenize` (3)

### `subarray`
`[native code]` | Self: 0.0% (3.6ms) | Total: 0.0% (3.6ms) | Samples: 3

**Called by:**
- `decryptPayload` (3)

### `async ensureAsyncStorage`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/transaction.mjs` | Self: 0.0% (3.6ms) | Total: 0.0% (3.6ms) | Samples: 1

**Called by:**
- `async getCurrentAdapter` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs` | Self: 0.0% (3.6ms) | Total: 0.0% (3.6ms) | Samples: 2

**Called by:**
- `async ensureAsyncStorage` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:375` | Self: 0.0% (3.6ms) | Total: 0.0% (34.7ms) | Samples: 3

**Called by:**
- `forEach` (29)

**Calls:**
- `(anonymous)` (26)

### `init`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:64` | Self: 0.0% (3.6ms) | Total: 0.0% (3.6ms) | Samples: 1

**Called by:**
- `ZodEmail` (1)

### `deriveSystemFlagState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:324` | Self: 0.0% (3.5ms) | Total: 0.0% (4.6ms) | Samples: 3

**Called by:**
- `(anonymous)` (4)

**Calls:**
- `hasFlag` (1)

### `async getMessageCalendarInviteDataByMessageId`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:192` | Self: 0.0% (3.5ms) | Total: 0.3% (147.8ms) | Samples: 3

**Called by:**
- `async listThreads` (130)

**Calls:**
- `(anonymous)` (127)

### `decryptPayload`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/secret.ts:62` | Self: 0.0% (3.5ms) | Total: 0.0% (16.7ms) | Samples: 3

**Called by:**
- `decodeSecret` (13)

**Calls:**
- `update` (6)
- `concat` (3)
- `final` (1)

### `async getAccountById`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accounts.ts:85` | Self: 0.0% (3.5ms) | Total: 0.6% (223.4ms) | Samples: 3

**Called by:**
- `async ensureCalendarEventRuntimeData` (2)

**Calls:**
- `listSenderIdentityRows` (64)
- `getOwnAddresses` (51)
- `listSenderIdentityRows` (9)
- `getOwnAddresses` (9)
- `map` (7)
- `getOwnAddresses` (4)
- `cloneObject` (3)
- `listSenderIdentityRows` (1)

### `query`
`bun:sqlite:382` | Self: 0.0% (3.5ms) | Total: 0.0% (3.5ms) | Samples: 3

**Called by:**
- `(anonymous)` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/topics.ts:3` | Self: 0.0% (3.5ms) | Total: 0.0% (3.5ms) | Samples: 3

**Called by:**
- `map` (3)

### `__`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js` | Self: 0.0% (3.5ms) | Total: 0.0% (3.5ms) | Samples: 1

**Called by:**
- `__extends` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:303` | Self: 0.0% (3.5ms) | Total: 0.0% (3.5ms) | Samples: 3

**Called by:**
- `map` (3)

### `has`
`[native code]` | Self: 0.0% (3.5ms) | Total: 0.0% (3.5ms) | Samples: 3

**Called by:**
- `async getAccountDb` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:602` | Self: 0.0% (3.5ms) | Total: 0.0% (36.1ms) | Samples: 3

**Called by:**
- `forEach` (32)

**Calls:**
- `lookup` (28)
- `lookup` (1)

### `assign`
`[native code]` | Self: 0.0% (3.5ms) | Total: 0.0% (3.5ms) | Samples: 3

**Called by:**
- `createExpressionBuilder` (2)
- `resolveDatabaseSchemaIndexes` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:603` | Self: 0.0% (3.4ms) | Total: 0.1% (67.9ms) | Samples: 3

**Called by:**
- `forEach` (59)

**Calls:**
- `(anonymous)` (55)
- `(anonymous)` (1)

### `#run`
`bun:sqlite` | Self: 0.0% (3.4ms) | Total: 0.0% (3.4ms) | Samples: 3

**Called by:**
- `(anonymous)` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2648` | Self: 0.0% (3.4ms) | Total: 0.0% (4.4ms) | Samples: 3

**Called by:**
- `map` (4)

**Calls:**
- `Boolean` (1)

### `slice`
`[native code]` | Self: 0.0% (3.4ms) | Total: 0.0% (3.4ms) | Samples: 3

**Called by:**
- `getTopicSuggestionsForThreadSignalBatch` (1)
- `(anonymous)` (1)
- `decodeSecret` (1)

### `getHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:161` | Self: 0.0% (3.4ms) | Total: 0.0% (4.3ms) | Samples: 1

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `flatIntoArrayWithCallback` (1)

### `trim`
`[native code]` | Self: 0.0% (3.3ms) | Total: 0.0% (3.3ms) | Samples: 3

**Called by:**
- `map` (2)
- `async enrichMessagesWithThreadCollab` (1)

### `async requireAccountContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/accountContext.ts:64` | Self: 0.0% (3.3ms) | Total: 0.0% (3.3ms) | Samples: 3

### `#run`
`bun:sqlite:195` | Self: 0.0% (3.3ms) | Total: 22.9% (8.50s) | Samples: 3

**Called by:**
- `(anonymous)` (3657)
- `(anonymous)` (1)

**Calls:**
- `run` (3655)

### `async enrichMessagesWithThreadTopics`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts:54` | Self: 0.0% (3.3ms) | Total: 0.2% (74.9ms) | Samples: 3

**Called by:**
- `async (anonymous)` (64)

**Calls:**
- `async enrichMessagesWithThreadTopics` (58)
- `async enrichMessagesWithThreadTopics` (3)
- `get` (1)
- `async enrichMessagesWithThreadTopics` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:618` | Self: 0.0% (3.3ms) | Total: 0.0% (3.3ms) | Samples: 3

**Called by:**
- `forEach` (3)

### `decodeSecret`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/secret.ts:73` | Self: 0.0% (3.3ms) | Total: 0.2% (79.1ms) | Samples: 3

**Called by:**
- `mapAccountRow` (33)
- `mapAccountRow` (19)
- `mapAccountRow` (10)

**Calls:**
- `decryptPayload` (24)
- `decryptPayload` (13)
- `(anonymous)` (9)
- `toString` (9)
- `decryptPayload` (3)
- `slice` (1)

### `getOwnAddresses`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:55` | Self: 0.0% (3.3ms) | Total: 0.0% (16.2ms) | Samples: 3

**Called by:**
- `async getAccountById` (9)
- `async (anonymous)` (2)
- `async ensureCalendarEventRuntimeData` (2)
- `async getAccountOwnAddresses` (1)

**Calls:**
- `Set` (11)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/core.ts:200` | Self: 0.0% (3.3ms) | Total: 0.1% (64.7ms) | Samples: 3

**Called by:**
- `async withAccountDb` (59)

**Calls:**
- `(anonymous)` (56)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:101` | Self: 0.0% (3.3ms) | Total: 0.0% (4.6ms) | Samples: 3

**Called by:**
- `listSenderIdentityRows` (3)
- `async resolveAccountDbPath` (1)

**Calls:**
- `now` (1)

### `addressparser`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1201` | Self: 0.0% (3.2ms) | Total: 0.0% (3.2ms) | Samples: 2

**Called by:**
- `parseAddressEmails` (2)

### `query`
`bun:sqlite:384` | Self: 0.0% (3.2ms) | Total: 0.0% (3.2ms) | Samples: 3

**Called by:**
- `(anonymous)` (3)

### `#get`
`bun:sqlite` | Self: 0.0% (3.2ms) | Total: 0.0% (3.2ms) | Samples: 3

**Called by:**
- `(anonymous)` (3)

### `createFunctionModule`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/function-module.js` | Self: 0.0% (3.2ms) | Total: 0.0% (3.2ms) | Samples: 2

**Called by:**
- `createExpressionBuilder` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/index.mjs` | Self: 0.0% (3.1ms) | Total: 0.0% (3.1ms) | Samples: 1

**Called by:**
- `map` (1)

### `async getDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts` | Self: 0.0% (3.1ms) | Total: 0.0% (3.1ms) | Samples: 3

**Called by:**
- `async getDb` (2)
- `async requireActiveUserSession` (1)

### `async get`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:39` | Self: 0.0% (3.1ms) | Total: 0.0% (3.1ms) | Samples: 2

**Called by:**
- `async (anonymous)` (2)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2504` | Self: 0.0% (3.1ms) | Total: 0.0% (5.1ms) | Samples: 3

**Calls:**
- `map` (1)
- `join` (1)

### `normalizeRouteParamValue`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/accountContext.ts` | Self: 0.0% (3.1ms) | Total: 0.0% (3.1ms) | Samples: 1

**Called by:**
- `async getAccountIdFromParams` (1)

### `getTopicSuggestionsForThreadSignalBatch`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:601` | Self: 0.0% (3.0ms) | Total: 0.1% (47.4ms) | Samples: 3

**Called by:**
- `async withAccountDb` (41)

**Calls:**
- `(anonymous)` (38)

### `async acquireAuthLifetimeLock`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authLifetimeLock.ts` | Self: 0.0% (3.0ms) | Total: 0.0% (3.0ms) | Samples: 1

**Called by:**
- `async acquireAuthLifetimeLock` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:590` | Self: 0.0% (3.0ms) | Total: 0.0% (7.8ms) | Samples: 3

**Called by:**
- `forEach` (7)

**Calls:**
- `encodeURIComponent` (4)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2587` | Self: 0.0% (3.0ms) | Total: 6.7% (2.51s) | Samples: 3

**Calls:**
- `(anonymous)` (2181)
- `wrapStatement` (1)

### `async enrichMessagesWithThreadTopics`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts:49` | Self: 0.0% (3.0ms) | Total: 0.0% (3.0ms) | Samples: 3

**Called by:**
- `async enrichMessagesWithThreadTopics` (1)

### `(unknown)`
`[native code]` | Self: 0.0% (3.0ms) | Total: 0.0% (3.0ms) | Samples: 2

**Called by:**
- `_handleAddress` (2)

### `close`
`[native code]` | Self: 0.0% (3.0ms) | Total: 0.0% (3.0ms) | Samples: 1

**Called by:**
- `closeAccountDbConnection` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js` | Self: 0.0% (2.9ms) | Total: 0.0% (2.9ms) | Samples: 1

**Called by:**
- `init` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs` | Self: 0.0% (2.9ms) | Total: 0.0% (2.9ms) | Samples: 3

**Called by:**
- `flatIntoArrayWithCallback` (3)

### `combineMiddleware`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:59` | Self: 0.0% (2.9ms) | Total: 0.0% (2.9ms) | Samples: 1

**Called by:**
- `createConfiguredEndpoint` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs` | Self: 0.0% (2.8ms) | Total: 0.0% (2.8ms) | Samples: 1

**Called by:**
- `async getCryptoKey` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:236` | Self: 0.0% (2.8ms) | Total: 0.0% (24.3ms) | Samples: 1

**Called by:**
- `map` (5)

**Calls:**
- `(anonymous)` (2)
- `(anonymous)` (2)

### `escapeSqlLiteral`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:921` | Self: 0.0% (2.8ms) | Total: 0.0% (2.8ms) | Samples: 2

**Called by:**
- `(anonymous)` (2)

### `async execute`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:319` | Self: 0.0% (2.8ms) | Total: 0.3% (125.7ms) | Samples: 1

**Called by:**
- `async findOne` (38)
- `async (anonymous)` (6)
- `async getTables` (1)

**Calls:**
- `async execute` (33)
- `async execute` (11)

### `wrapStatement`
`/tmp/spike-switch-server/sqlcounter.ts:79` | Self: 0.0% (2.7ms) | Total: 0.0% (2.7ms) | Samples: 2

**Called by:**
- `async requireActiveUserSession` (1)
- `async getAccountById` (1)

### `createFunctionModule`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/function-module.js:20` | Self: 0.0% (2.7ms) | Total: 0.0% (2.7ms) | Samples: 1

**Called by:**
- `createExpressionBuilder` (1)

### `async enrollTestTotp`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testAuthHarness.ts:197` | Self: 0.0% (2.7ms) | Total: 0.0% (2.7ms) | Samples: 1

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs:11` | Self: 0.0% (2.6ms) | Total: 0.0% (2.6ms) | Samples: 2

**Called by:**
- `reduce` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:229` | Self: 0.0% (2.6ms) | Total: 0.0% (2.6ms) | Samples: 1

### `columnNames`
`bun:sqlite:198` | Self: 0.0% (2.6ms) | Total: 0.0% (2.6ms) | Samples: 2

**Called by:**
- `executeQuery` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:177` | Self: 0.0% (2.6ms) | Total: 0.0% (2.6ms) | Samples: 2

**Called by:**
- `async transformSingleOutput` (2)

### `info`
`[native code]` | Self: 0.0% (2.6ms) | Total: 0.0% (2.6ms) | Samples: 1

**Called by:**
- `async getDb` (1)

### `checkSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema-check.mjs:72` | Self: 0.0% (2.6ms) | Total: 0.0% (2.6ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `deriveSystemFlagState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:320` | Self: 0.0% (2.6ms) | Total: 0.0% (2.6ms) | Samples: 2

**Called by:**
- `(anonymous)` (2)

### `push`
`[native code]` | Self: 0.0% (2.5ms) | Total: 0.0% (2.5ms) | Samples: 2

**Called by:**
- `async buildFixture` (1)
- `rebuildThreadSignalsForThreadIdsInternal` (1)

### `parseStringReferenceWithTable`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js:88` | Self: 0.0% (2.5ms) | Total: 0.0% (2.5ms) | Samples: 2

**Called by:**
- `parseValueBinaryOperation` (2)

### `normalizeImapFlags`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageFlags.ts:172` | Self: 0.0% (2.5ms) | Total: 0.0% (2.5ms) | Samples: 2

**Called by:**
- `(anonymous)` (2)

### `prepareAccountShardConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts` | Self: 0.0% (2.5ms) | Total: 0.0% (2.5ms) | Samples: 1

**Called by:**
- `configureAccountDb` (1)

### `run`
`node:async_hooks:144` | Self: 0.0% (2.5ms) | Total: 0.1% (54.9ms) | Samples: 2

**Called by:**
- `async runWithEndpointContext` (39)
- `async createAuthenticatedTestSession` (1)

**Calls:**
- `async (anonymous)` (18)
- `async (anonymous)` (9)
- `(anonymous)` (6)
- `async (anonymous)` (2)
- `async (anonymous)` (2)
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2662` | Self: 0.0% (2.5ms) | Total: 0.0% (2.5ms) | Samples: 2

**Called by:**
- `map` (2)

### `async runValidation`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/validator.mjs` | Self: 0.0% (2.5ms) | Total: 0.0% (2.5ms) | Samples: 2

**Called by:**
- `async runValidation` (2)

### `twoFactor`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/index.mjs` | Self: 0.0% (2.5ms) | Total: 0.0% (2.5ms) | Samples: 1

**Called by:**
- `noctuaAuthOptions` (1)

### `async getMessageCalendarInviteDataByMessageId`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:189` | Self: 0.0% (2.5ms) | Total: 0.0% (5.8ms) | Samples: 2

**Called by:**
- `async listThreads` (5)

**Calls:**
- `map` (2)
- `join` (1)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:96` | Self: 0.0% (2.5ms) | Total: 3.1% (1.16s) | Samples: 2

**Called by:**
- `async getAccountById` (146)
- `async getMessageCalendarInviteDataByMessageId` (129)
- `getTopicSuggestionsForThreadSignalBatch` (99)
- `async listThreads` (88)
- `executeQuery` (53)
- `(anonymous)` (50)
- `async listThreads` (40)
- `getTopicSuggestionSignalsForThreadsFromDb` (38)
- `async getThreadGroupCounts` (34)
- `getThreadCollabStates` (31)
- `async getAccountOwnAddresses` (29)
- `readUserById` (28)
- `async listThreads` (27)
- `async listThreads` (17)
- `async getTotalCount` (13)
- `async assertAccountFolder` (10)
- `async recomputeThreadsForAccountInternal` (9)
- `async requireActiveUserSession` (9)
- `enrollmentState` (8)
- `async requireActiveUserSession` (7)
- `loadManualCategoryStatesForMessageIds` (6)
- `rebuildThreadSignalsForThreadIdsInternal` (5)
- `async requireActiveUserSession` (5)
- `rebuildThreadSignalsForThreadIdsInternal` (4)
- `async recomputeThreadsForAccountInternal` (3)
- `async (anonymous)` (2)
- `backfillEmailCalendarEventParticipation` (1)
- `async recomputeThreadsForAccountInternal` (1)
- `upsertTopicLearningSignalsForThreadIds` (1)
- `async (anonymous)` (1)
- `(anonymous)` (1)
- `async (anonymous)` (1)
- `insertThreadSignalsFromMessageRows` (1)
- `ensureTableColumns` (1)
- `(anonymous)` (1)
- `backfillCalendarReminderEventUidKeys` (1)
- `pruneThreadTopicsWithoutMessages` (1)

**Calls:**
- `prepare` (899)

### `getOwnAddresses`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:57` | Self: 0.0% (2.4ms) | Total: 0.3% (136.3ms) | Samples: 2

**Called by:**
- `async getAccountById` (51)
- `async ensureCalendarEventRuntimeData` (13)
- `async (anonymous)` (9)
- `async getAccountOwnAddresses` (6)

**Calls:**
- `flatIntoArrayWithCallback` (77)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/senderIdentities.ts:13` | Self: 0.0% (2.4ms) | Total: 0.0% (7.7ms) | Samples: 2

**Called by:**
- `map` (7)

**Calls:**
- `cloneObject` (5)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv6.js` | Self: 0.0% (2.4ms) | Total: 0.0% (2.4ms) | Samples: 2

**Called by:**
- `map` (1)
- `(anonymous)` (1)

### `ensureSenderIdentityMessageRuntimeSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts` | Self: 0.0% (2.4ms) | Total: 0.0% (2.4ms) | Samples: 2

**Called by:**
- `async getAccountDb` (2)

### `visitSelectQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:72` | Self: 0.0% (2.4ms) | Total: 0.0% (36.5ms) | Samples: 2

**Called by:**
- `bound visitSelectQuery` (13)

**Calls:**
- `visitNode` (11)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:52` | Self: 0.0% (2.4ms) | Total: 0.0% (2.4ms) | Samples: 2

### `tokenize`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` | Self: 0.0% (2.4ms) | Total: 0.0% (2.4ms) | Samples: 2

**Called by:**
- `_parseAddressList` (2)

### `extractJiraProjectKeys`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:51` | Self: 0.0% (2.4ms) | Total: 0.0% (2.4ms) | Samples: 2

**Called by:**
- `collectTopicSignalEntries` (2)

### `HashMD`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/_md.js:77` | Self: 0.0% (2.4ms) | Total: 0.0% (2.4ms) | Samples: 1

**Called by:**
- `SHA2_64B` (1)

### `includes`
`[native code]` | Self: 0.0% (2.4ms) | Total: 0.0% (2.4ms) | Samples: 2

**Called by:**
- `applyBadgeFilters` (2)

### `assertPasswordNotTooLong`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/utils/password.mjs:13` | Self: 0.0% (2.4ms) | Total: 0.0% (2.4ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:19` | Self: 0.0% (2.4ms) | Total: 0.0% (2.4ms) | Samples: 2

### `async resolveAccountDbPath`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:343` | Self: 0.0% (2.4ms) | Total: 0.0% (2.4ms) | Samples: 2

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/ua-parser-js/ua-parser.js` | Self: 0.0% (2.4ms) | Total: 0.0% (2.4ms) | Samples: 2

**Called by:**
- `943` (2)

### `topicSuggestionSignalEntries`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:103` | Self: 0.0% (2.4ms) | Total: 0.0% (17.9ms) | Samples: 2

**Called by:**
- `(anonymous)` (16)

**Calls:**
- `map` (14)

### `async getUserById`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/users.ts:72` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 1

**Called by:**
- `async getUserById` (1)

### `mapUserRow`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:61` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 1

**Called by:**
- `async getUserById` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:159` | Self: 0.0% (2.3ms) | Total: 0.0% (6.3ms) | Samples: 2

**Called by:**
- `async transformSingleOutput` (5)

**Calls:**
- `entries` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:705` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `map` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:371` | Self: 0.0% (2.3ms) | Total: 0.1% (45.4ms) | Samples: 2

**Called by:**
- `forEach` (39)

**Calls:**
- `(anonymous)` (33)
- `(anonymous)` (2)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `genShake`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha3.js` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `Log`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/log.js` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 1

**Called by:**
- `Kysely` (1)

### `async getDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:293` | Self: 0.0% (2.3ms) | Total: 0.0% (3.4ms) | Samples: 2

**Called by:**
- `async getDb` (3)

**Calls:**
- `registerDbShutdownHooks` (1)

### `Headers`
`[native code]` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `async (anonymous)` (2)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:80` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `persistAccountRow` (1)
- `lookup` (1)

### `mapAccountRow`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:153` | Self: 0.0% (2.3ms) | Total: 0.0% (24.6ms) | Samples: 2

**Called by:**
- `async getAccountById` (22)

**Calls:**
- `decodeSecret` (19)
- `decodeSecret` (1)

### `listSenderIdentityRows`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/senderIdentities.ts` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `async getAccountOwnAddresses` (1)
- `async getAccountById` (1)

### `async createInternalContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:7` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `async (anonymous)` (2)

### `async findOne`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:504` | Self: 0.0% (2.3ms) | Total: 0.0% (8.3ms) | Samples: 2

**Called by:**
- `async findOne` (6)

**Calls:**
- `convertWhereClause` (2)
- `convertWhereClause` (2)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2249` | Self: 0.0% (2.3ms) | Total: 0.0% (3.6ms) | Samples: 2

**Calls:**
- `normalizeSearchTermList` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:242` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `(anonymous)` (2)

### `Decipheriv2`
`node:crypto:313` | Self: 0.0% (2.3ms) | Total: 0.0% (25.9ms) | Samples: 2

**Called by:**
- `createDecipheriv` (18)

**Calls:**
- `Cipher` (16)

### `/\s/`
`[native code]` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `_recoverAddrSpec` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:13` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `init` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:288` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `filter` (2)

### `open`
`[native code]` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 1

**Called by:**
- `Database` (1)

### `insert`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/ftsIdentity.ts:88` | Self: 0.0% (2.3ms) | Total: 0.8% (330.8ms) | Samples: 2

**Called by:**
- `(anonymous)` (280)

**Calls:**
- `(anonymous)` (275)
- `(anonymous)` (2)
- `(anonymous)` (1)

### `walkAddressList`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1203` | Self: 0.0% (2.3ms) | Total: 0.0% (9.7ms) | Samples: 2

**Called by:**
- `addressparser` (6)

**Calls:**
- `forEach` (4)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:79` | Self: 0.0% (2.3ms) | Total: 0.0% (3.4ms) | Samples: 2

**Called by:**
- `forEach` (3)

**Calls:**
- `add` (1)

### `ensureCalendarEventOptionalColumns`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:444` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 1

**Called by:**
- `async ensureCalendarEventRuntimeData` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2293` | Self: 0.0% (2.3ms) | Total: 0.0% (3.3ms) | Samples: 2

**Calls:**
- `applySearchQueryFilters` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:157` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `flatIntoArrayWithCallback` (2)

### `displayDayNumber`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts` | Self: 0.0% (2.3ms) | Total: 0.0% (2.3ms) | Samples: 2

**Called by:**
- `buildMessageGroupKey` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/well-known/index.js:11` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:366` | Self: 0.0% (2.2ms) | Total: 0.0% (4.4ms) | Samples: 2

**Called by:**
- `forEach` (4)

**Calls:**
- `get` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:578` | Self: 0.0% (2.2ms) | Total: 1.1% (412.9ms) | Samples: 2

**Called by:**
- `async findOne` (98)

**Calls:**
- `(anonymous)` (96)

### `async runBeforeHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:79` | Self: 0.0% (2.2ms) | Total: 0.0% (7.0ms) | Samples: 2

**Called by:**
- `async runBeforeHooks` (6)

**Calls:**
- `(anonymous)` (4)

### `init`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:52` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 1

**Called by:**
- `ZodObject` (1)

### `Statement`
`bun:sqlite:109` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 2

**Called by:**
- `prepare` (2)

### `_getEnv`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/env-impl.mjs` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 1

**Called by:**
- `has` (1)

### `getOwnAddresses`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:56` | Self: 0.0% (2.2ms) | Total: 0.0% (5.8ms) | Samples: 2

**Called by:**
- `async getAccountById` (4)
- `async getAccountOwnAddresses` (1)

**Calls:**
- `map` (2)
- `filter` (1)

### `install`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/storage.ts` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 2

**Called by:**
- `(anonymous)` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:589` | Self: 0.0% (2.2ms) | Total: 0.0% (8.9ms) | Samples: 2

**Called by:**
- `forEach` (8)

**Calls:**
- `encodeURIComponent` (6)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:23` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 2

**Called by:**
- `map` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:560` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 2

**Called by:**
- `forEach` (2)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:394` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 2

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2224` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 2

**Called by:**
- `async listThreads` (1)

### `async ensureCalendarEventRuntimeData`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:663` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 2

### `async enrichMessagesWithThreadCollab`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadCollab.ts:8` | Self: 0.0% (2.2ms) | Total: 0.1% (43.9ms) | Samples: 2

**Called by:**
- `async enrichMessagesWithThreadCollab` (37)

**Calls:**
- `filter` (36)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:442` | Self: 0.0% (2.2ms) | Total: 0.0% (5.6ms) | Samples: 2

**Called by:**
- `forEach` (5)

**Calls:**
- `Map` (3)

### `push`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` | Self: 0.0% (2.2ms) | Total: 0.0% (2.2ms) | Samples: 2

**Called by:**
- `checkChar` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:57` | Self: 0.0% (2.2ms) | Total: 0.3% (132.7ms) | Samples: 2

**Called by:**
- `flatIntoArrayWithCallback` (76)

**Calls:**
- `normalizeIdentityEmail` (31)
- `normalizeIdentityEmail` (9)
- `normalizeIdentityEmail` (8)
- `normalizeIdentityEmail` (6)
- `normalizeIdentityEmail` (5)
- `normalizeIdentityEmail` (5)
- `normalizeIdentityEmail` (4)
- `normalizeIdentityEmail` (2)
- `normalizeIdentityEmail` (2)
- `normalizeIdentityEmail` (1)
- `normalizeIdentityEmail` (1)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:103` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 2

**Called by:**
- `async resolveAccountDbPath` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:821` | Self: 0.0% (2.1ms) | Total: 0.0% (7.9ms) | Samples: 1

**Calls:**
- `pruneThreadTopicsWithoutMessages` (3)
- `pruneThreadTopicsWithoutMessages` (1)
- `pruneThreadTopicsWithoutMessages` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:458` | Self: 0.0% (2.1ms) | Total: 0.0% (3.5ms) | Samples: 2

**Called by:**
- `forEach` (3)

**Calls:**
- `map` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/tracer.mjs:37` | Self: 0.0% (2.1ms) | Total: 1.3% (516.8ms) | Samples: 2

**Called by:**
- `async (anonymous)` (96)
- `async (anonymous)` (30)
- `run` (6)
- `async runBeforeHooks` (4)
- `async runAfterHooks` (3)
- `async (anonymous)` (2)
- `async (anonymous)` (1)
- `async (anonymous)` (1)
- `async (anonymous)` (1)
- `async (anonymous)` (1)

**Calls:**
- `async findOne` (126)
- `async internalHandler` (6)
- `async internalHandler` (5)
- `async findMany` (2)
- `async update` (2)
- `async delete` (1)
- `async create` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:147` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 2

**Called by:**
- `async transformSingleOutput` (2)

### `_recoverAddrSpec`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:367` | Self: 0.0% (2.1ms) | Total: 0.1% (45.4ms) | Samples: 2

**Called by:**
- `_handleAddress` (23)

**Calls:**
- `_collapseAtSpacing` (10)
- `_joinAtSpacing` (6)
- `_collapseAtSpacing` (4)
- `_collapseAtSpacing` (1)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 1

**Called by:**
- `async buildFixture` (1)

### `fsyncSync`
`[native code]` | Self: 0.0% (2.1ms) | Total: 0.0% (4.3ms) | Samples: 2

**Called by:**
- `fsyncSync` (2)
- `release` (1)
- `async acquireAuthLifetimeLock` (1)

**Calls:**
- `fsyncSync` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:5` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 2

**Called by:**
- `async ensureAsyncStorage` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2661` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 2

**Called by:**
- `map` (2)

### `bound require`
`[native code]` | Self: 0.0% (2.1ms) | Total: 2.4% (901.8ms) | Samples: 2

**Called by:**
- `(anonymous)` (41)
- `(anonymous)` (35)
- `(anonymous)` (21)
- `(anonymous)` (21)
- `(anonymous)` (19)
- `(anonymous)` (17)
- `(anonymous)` (16)
- `(anonymous)` (15)
- `(anonymous)` (13)
- `(anonymous)` (12)
- `(anonymous)` (12)
- `(anonymous)` (12)
- `(anonymous)` (11)
- `(anonymous)` (10)
- `(anonymous)` (9)
- `(anonymous)` (9)
- `(anonymous)` (9)
- `(anonymous)` (8)
- `(anonymous)` (8)
- `(anonymous)` (8)
- `(anonymous)` (8)
- `(anonymous)` (8)
- `(anonymous)` (8)
- `(anonymous)` (8)
- `(anonymous)` (7)
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
- `(anonymous)` (6)
- `(anonymous)` (5)
- `getCodec` (5)
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
- `require` (704)
- `anonymous` (5)

### `sqliteIntegerPrimaryKeyColumn`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:20` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 2

**Called by:**
- `async sqliteGeneratedPrimaryKeyColumn` (2)

### `roleAtLeast`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/accountRole.ts:5` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 2

**Called by:**
- `async requireAccountContext` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:164` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 2

**Called by:**
- `async transformSingleOutput` (2)

### `buildTimeGroupKey`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageGrouping.ts:42` | Self: 0.0% (2.1ms) | Total: 0.0% (27.7ms) | Samples: 2

**Called by:**
- `buildMessageGroupKey` (23)
- `(anonymous)` (1)

**Calls:**
- `Date` (22)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 2

**Called by:**
- `map` (1)
- `some` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authPolicyHandler.ts:289` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async getThreadGroupCounts`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1402` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 2

**Called by:**
- `async listThreads` (2)

### `get`
`/tmp/spike-switch-server/inspect.ts` | Self: 0.0% (2.1ms) | Total: 0.0% (2.1ms) | Samples: 2

**Called by:**
- `(module)` (2)

### `sortGroupsForGroupBy`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageGrouping.ts:96` | Self: 0.0% (2.0ms) | Total: 0.0% (2.0ms) | Samples: 2

**Called by:**
- `async getThreadGroupCounts` (2)

### `async deleteWithHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/with-hooks.mjs` | Self: 0.0% (2.0ms) | Total: 0.0% (2.0ms) | Samples: 1

**Called by:**
- `async deleteWithHooks` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/tracer.mjs:38` | Self: 0.0% (2.0ms) | Total: 0.0% (3.1ms) | Samples: 1

**Called by:**
- `async dispatchAuthEndpoint` (1)
- `async runAfterHooks` (1)

**Calls:**
- `async (anonymous)` (1)

### `custom`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js` | Self: 0.0% (2.0ms) | Total: 0.0% (2.0ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `getSharedDbHarnessState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testDbHarness.ts` | Self: 0.0% (2.0ms) | Total: 0.0% (2.0ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `next`
`[native code]` | Self: 0.0% (2.0ms) | Total: 0.0% (2.0ms) | Samples: 2

**Called by:**
- `performIteration` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:83` | Self: 0.0% (2.0ms) | Total: 0.0% (2.0ms) | Samples: 2

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:77` | Self: 0.0% (1.9ms) | Total: 0.0% (1.9ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `transformJoinClause`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:296` | Self: 0.0% (1.9ms) | Total: 0.0% (1.9ms) | Samples: 2

**Called by:**
- `async (anonymous)` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:604` | Self: 0.0% (1.9ms) | Total: 2.2% (851.8ms) | Samples: 2

**Called by:**
- `forEach` (714)

**Calls:**
- `(anonymous)` (709)
- `(anonymous)` (2)
- `(anonymous)` (1)

### `applyBadgeFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:855` | Self: 0.0% (1.9ms) | Total: 0.0% (1.9ms) | Samples: 2

**Called by:**
- `async listThreads` (2)

### `hydrateIdentityMetadata`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/identityMetadata.ts:8` | Self: 0.0% (1.9ms) | Total: 0.0% (1.9ms) | Samples: 2

**Called by:**
- `(anonymous)` (2)

### `header`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testAuthHarness.ts:79` | Self: 0.0% (1.9ms) | Total: 0.0% (2.9ms) | Samples: 2

**Called by:**
- `get` (3)

**Calls:**
- `performIteration` (1)

### `resolve`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-model-name.mjs:17` | Self: 0.0% (1.9ms) | Total: 0.0% (1.9ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authPolicyHandler.ts` | Self: 0.0% (1.9ms) | Total: 0.0% (1.9ms) | Samples: 2

**Called by:**
- `async (anonymous)` (1)
- `async (anonymous)` (1)

### `LocalBaseBlock`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:201` | Self: 0.0% (1.9ms) | Total: 0.0% (1.9ms) | Samples: 2

**Called by:**
- `ValueBlock` (2)

### `getAuthTablesWithResolvedIndexes`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/get-tables.mjs:289` | Self: 0.0% (1.7ms) | Total: 0.0% (2.9ms) | Samples: 1

**Called by:**
- `getAuthTables` (1)
- `buildSchema` (1)

**Calls:**
- `resolveDatabaseSchemaIndexes` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/transaction.mjs:7` | Self: 0.0% (1.7ms) | Total: 0.0% (1.7ms) | Samples: 1

**Called by:**
- `async ensureAsyncStorage` (1)

### `async lock`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:81` | Self: 0.0% (1.7ms) | Total: 0.0% (2.9ms) | Samples: 1

**Called by:**
- `async acquireConnection` (2)

**Calls:**
- `async lock` (1)

### `async stageMessageFiles`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/storage.ts:233` | Self: 0.0% (1.7ms) | Total: 0.0% (1.7ms) | Samples: 1

**Called by:**
- `async stageMessageFiles` (1)

### `splice`
`[native code]` | Self: 0.0% (1.7ms) | Total: 0.0% (1.7ms) | Samples: 1

**Called by:**
- `_handleAddress` (1)

### `async provideConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/default-connection-provider.js:13` | Self: 0.0% (1.6ms) | Total: 0.0% (24.5ms) | Samples: 1

**Called by:**
- `async executeQuery` (8)

**Calls:**
- `async provideConnection` (7)
- `async releaseConnection` (2)

### `ZodDate`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:95` | Self: 0.0% (1.5ms) | Total: 0.0% (1.5ms) | Samples: 1

**Called by:**
- `_date` (1)

### `create`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/binary-operation-node.js:11` | Self: 0.0% (1.5ms) | Total: 0.0% (1.5ms) | Samples: 1

**Called by:**
- `binary` (1)

### `getTopicSuggestionSignalsForThreadsFromDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:181` | Self: 0.0% (1.5ms) | Total: 0.0% (20.8ms) | Samples: 1

**Called by:**
- `(anonymous)` (18)

**Calls:**
- `Set` (10)
- `map` (6)
- `filter` (1)

### `getOwnPropertyDescriptor`
`[native code]` | Self: 0.0% (1.5ms) | Total: 0.0% (1.5ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `async #transformResult`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js` | Self: 0.0% (1.4ms) | Total: 0.0% (1.4ms) | Samples: 1

**Called by:**
- `async #transformResult` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/oauth-popup/index.mjs:98` | Self: 0.0% (1.4ms) | Total: 0.0% (1.4ms) | Samples: 1

### `applySearchQueryFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:717` | Self: 0.0% (1.4ms) | Total: 0.0% (1.4ms) | Samples: 1

**Called by:**
- `async getTotalCount` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:31` | Self: 0.0% (1.4ms) | Total: 0.0% (1.4ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/checks.js:9` | Self: 0.0% (1.4ms) | Total: 0.0% (1.4ms) | Samples: 1

**Called by:**
- `init` (1)

### `async findOne`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` | Self: 0.0% (1.4ms) | Total: 0.0% (1.4ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `initAccountSchemaBody`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts` | Self: 0.0% (1.4ms) | Total: 0.0% (1.4ms) | Samples: 1

**Called by:**
- `transaction` (1)

### `async migrateAuthSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts` | Self: 0.0% (1.4ms) | Total: 0.0% (1.4ms) | Samples: 1

**Called by:**
- `async migrateAuthSchema` (1)

### `async validateAccountFolders`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/folderAccount.ts:12` | Self: 0.0% (1.4ms) | Total: 0.0% (3.4ms) | Samples: 1

**Called by:**
- `async validateAccountFolders` (3)

**Calls:**
- `async assertAccountFolder` (2)

### `transformJoinClause`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:282` | Self: 0.0% (1.4ms) | Total: 0.0% (1.4ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `append`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:1332` | Self: 0.0% (1.4ms) | Total: 0.0% (1.4ms) | Samples: 1

**Called by:**
- `visitOperator` (1)

### `async executeQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js` | Self: 0.0% (1.4ms) | Total: 0.0% (1.4ms) | Samples: 1

**Called by:**
- `async executeQuery` (1)

### `chachaCore`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:102` | Self: 0.0% (1.4ms) | Total: 0.0% (2.4ms) | Samples: 1

**Called by:**
- `hchacha` (1)
- `runCipher` (1)

**Calls:**
- `rotl` (1)

### `getHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:165` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `ValidationError`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/error.mjs` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `finalize`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_poly1305.js` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `digestInto` (1)

### `charAt`
`[native code]` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `tokenize` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:93` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

### `rmSync`
`[native code]` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `now`
`[native code]` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `normalizeIdentityEmail`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/memoizer.js` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `ZodObject` (1)

### `deriveSystemFlagState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:322` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:22` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

### `async getCurrentRequestState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:19` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

### `async stageMessageFiles`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/storage.ts:230` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async stageMessageFiles` (1)

### `NextResponse`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:42` | Self: 0.0% (1.3ms) | Total: 0.0% (3.8ms) | Samples: 1

**Called by:**
- `json` (3)

**Calls:**
- `ResponseCookies` (2)

### `chachaCore`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:75` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `hchacha` (1)

### `normalizeSearchTermList`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:525` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async listThreads` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/react/cjs/react.development.js` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `extractEmailAddresses`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:22` | Self: 0.0% (1.3ms) | Total: 0.5% (199.4ms) | Samples: 1

**Called by:**
- `(anonymous)` (160)

**Calls:**
- `flatMap` (96)
- `flatIntoArrayWithCallback` (51)
- `Set` (12)

### `async getAccountIdFromParams`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/accountContext.ts` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async getAccountIdFromParams` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:277` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `map` (1)

### `visitSelectQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:110` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `bound visitSelectQuery` (1)

### `normalizeAccountSettings`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/accountSettings.ts:5` | Self: 0.0% (1.3ms) | Total: 0.0% (14.7ms) | Samples: 1

**Called by:**
- `mapAccountRow` (12)

**Calls:**
- `stringify` (11)

### `find`
`[native code]` | Self: 0.0% (1.3ms) | Total: 0.0% (2.5ms) | Samples: 1

**Called by:**
- `part` (1)
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `async verifyTwoFactor`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/verify-two-factor.mjs` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async verifyTwoFactor` (1)

### `getOwnAddresses`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async ensureCalendarEventRuntimeData` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sanitize-html/node_modules/htmlparser2/node_modules/domutils/node_modules/dom-serializer/dist/foreign-names.js:14` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `map` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:231` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

### `getAuthTablesWithResolvedIndexes`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/get-tables.mjs` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `buildSchema` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/dom-serializer/node_modules/entities/lib/esm/generated/decode-data-html.js:6` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `map` (1)

### `__getBetterAuthGlobal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/global.mjs` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `getBetterAuthVersion` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:161` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async transformSingleOutput` (1)

### `looksLikeJiraMessage`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:30` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `async getMigrations`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async getMigrations` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/mail/categorization/linearModel.ts:53` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `parseTable`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/table-parser.js:39` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `parseTableExpressionOrList` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:572` | Self: 0.0% (1.3ms) | Total: 0.0% (16.4ms) | Samples: 1

**Called by:**
- `async findOne` (6)

**Calls:**
- `formatTransactionId` (4)
- `debugLog` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:56` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `filter` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:75` | Self: 0.0% (1.3ms) | Total: 0.8% (319.2ms) | Samples: 1

**Called by:**
- `forEach` (254)

**Calls:**
- `isOwnAddress` (144)
- `isOwnAddress` (108)
- `some` (1)

### `addColumn`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/schema/create-table-builder.js` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async getMigrations` (1)

### `init`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:74` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js:2` | Self: 0.0% (1.3ms) | Total: 0.0% (19.9ms) | Samples: 1

**Calls:**
- `bound require` (7)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:151` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async transformSingleOutput` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/index.mjs` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async updateWithHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/with-hooks.mjs` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `parseCookies`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:35` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `applyExcludedFolderFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:908` | Self: 0.0% (1.2ms) | Total: 0.0% (3.7ms) | Samples: 1

**Called by:**
- `async getTotalCount` (2)
- `async listThreads` (1)

**Calls:**
- `Set` (2)

### `WeakReference`
`[native code]` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `set` (1)

### `normalizeAccountSettings`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/accountSettings.ts` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `mapAccountRow` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/parse5/dist/common/foreign-content.js` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `map` (1)

### `create`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/operator-node.js:116` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `parseValueBinaryOperation` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:69` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

### `async acquireConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:43` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async acquireConnection` (1)

### `mapAccountRow`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:179` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async getAccountById` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2326` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

### `parseStringReference`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js:48` | Self: 0.0% (1.2ms) | Total: 0.0% (2.4ms) | Samples: 1

**Called by:**
- `parseValueBinaryOperation` (2)

**Calls:**
- `map` (1)

### `deepmergeIntoFastUnsafeCustom`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/deepmerge-ts/dist/index.mjs` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `parseCookies`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:26` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `NameIdentifier`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:253` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `flatIntoArrayWithCallback` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `filter` (1)

### `flush`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:208` | Self: 0.0% (1.2ms) | Total: 12.5% (4.65s) | Samples: 1

**Called by:**
- `(anonymous)` (4022)
- `getTopicSuggestionSignalsForThreadsFromDb` (24)

**Calls:**
- `topicSuggestionEntriesFromThreadSignalRows` (3376)
- `flatIntoArrayWithCallback` (669)

### `sortGroupsForGroupBy`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageGrouping.ts:107` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async getThreadGroupCounts` (1)

### `async runWithRequestState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:24` | Self: 0.0% (1.2ms) | Total: 0.0% (2.3ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `run` (1)

### `createWithSpan`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/tracer.mjs` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async dispatchAuthEndpoint` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/core.ts:194` | Self: 0.0% (1.2ms) | Total: 0.1% (57.8ms) | Samples: 1

**Called by:**
- `async withAccountDb` (51)

**Calls:**
- `(anonymous)` (50)

### `add`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:65` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `unlock`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:87` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async releaseConnection` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:18` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

### `async assertAccountFolder`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/folderAccountGuard.ts:6` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

### `update`
`node:crypto:338` | Self: 0.0% (1.2ms) | Total: 0.0% (7.6ms) | Samples: 1

**Called by:**
- `decryptPayload` (6)

**Calls:**
- `update` (5)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/htmlparser2/node_modules/entities/dist/esm/decode.js` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs:41` | Self: 0.0% (1.2ms) | Total: 0.0% (3.9ms) | Samples: 1

**Calls:**
- `checkSchema` (1)

### `async ensureCalendarEventRuntimeData`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:661` | Self: 0.0% (1.2ms) | Total: 0.0% (3.6ms) | Samples: 1

**Calls:**
- `async getAccountById` (2)

### `keys`
`[native code]` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `_defu` (1)

### `async getThreadCollabStates`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/threadCollab.ts:42` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async getThreadCollabStates` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-field-name.mjs:21` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `parseValueBinaryOperation`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/binary-operation-parser.js:22` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `binary` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:103` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `map` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:158` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async transformSingleOutput` (1)

### `applyVisibleMessageFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async getTotalCount` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2320` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

### `prepareFtsIdentityWriter`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/ftsIdentity.ts:75` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-attributes.mjs:24` | Self: 0.0% (1.2ms) | Total: 0.0% (5.7ms) | Samples: 1

**Called by:**
- `(anonymous)` (2)

**Calls:**
- `(anonymous)` (1)

### `Error`
`[native code]` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `throwForMissingRequestStore` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/middleware.mjs` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async internalHandler` (1)

### `u8to16`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_poly1305.js` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `Poly1305` (1)

### `normalizeAccountSettings`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/accountSettings.ts:16` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `mapAccountRow` (1)

### `object`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:904` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `selectFrom`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-creator.js:135` | Self: 0.0% (1.2ms) | Total: 0.9% (351.7ms) | Samples: 1

**Called by:**
- `async findOne` (73)
- `async findMany` (2)
- `async (anonymous)` (2)

**Calls:**
- `parseTableExpressionOrList` (75)
- `createFrom` (1)

### `bound visitSelectQuery`
`[native code]` | Self: 0.0% (1.2ms) | Total: 0.2% (106.2ms) | Samples: 1

**Called by:**
- `visitNode` (36)

**Calls:**
- `visitSelectQuery` (13)
- `visitSelectQuery` (8)
- `visitSelectQuery` (6)
- `visitSelectQuery` (2)
- `visitSelectQuery` (2)
- `visitSelectQuery` (1)
- `visitSelectQuery` (1)
- `visitSelectQuery` (1)
- `visitSelectQuery` (1)

### `fireTriggers`
`/tmp/spike-switch-server/sqlcounter.ts` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `setName`
`node:fs:675` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `node:fs` (1)

### `getTopicSuggestionSignalsForThreadsFromDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:180` | Self: 0.0% (1.2ms) | Total: 0.0% (2.4ms) | Samples: 1

**Called by:**
- `(anonymous)` (2)

**Calls:**
- `from` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/tools.js:30` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `anonymous` (1)

### `expireLegacyCookie`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authCookies.ts:3` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async requireActiveUserSession` (1)

### `Libmime`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/libmime.js` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `cloneWithSelections`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/select-query-node.js:31` | Self: 0.0% (1.2ms) | Total: 0.0% (15.1ms) | Samples: 1

**Called by:**
- `select` (5)

**Calls:**
- `performIteration` (4)

### `getColorDepth`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs:49` | Self: 0.0% (1.2ms) | Total: 0.0% (2.4ms) | Samples: 1

**Called by:**
- `formatTransactionId` (2)

**Calls:**
- `getEnvVar` (1)

### `getHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `createSelectAll`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/reference-node.js` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `createSelectAllFromTable` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/doc.js:27` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `map` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `find` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:591` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `async getTopicSuggestionsForThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:682` | Self: 0.0% (1.2ms) | Total: 0.0% (13.6ms) | Samples: 1

**Called by:**
- `async enrichMessagesWithThreadTopics` (12)

**Calls:**
- `Set` (6)
- `filter` (3)
- `map` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:714` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `map` (1)

### `flush`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:43` | Self: 0.0% (1.2ms) | Total: 3.5% (1.29s) | Samples: 1

**Called by:**
- `(anonymous)` (989)
- `insertThreadSignalsFromMessageRows` (1)

**Calls:**
- `collectTopicSignalEntries` (896)
- `collectTopicSignalEntries` (83)
- `collectTopicSignalEntries` (9)
- `collectTopicSignalEntries` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/he/he.js:31` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `checkEndpointConflicts`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/index.mjs:51` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async createAuthContext` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:664` | Self: 0.0% (1.2ms) | Total: 0.0% (2.3ms) | Samples: 1

**Called by:**
- `forEach` (2)

**Calls:**
- `normalizeCalendarEventUids` (1)

### `async getThreadGroupCounts`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1380` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async listThreads` (1)

### `mapAccountRow`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:185` | Self: 0.0% (1.2ms) | Total: 0.1% (50.9ms) | Samples: 1

**Called by:**
- `async getAccountById` (37)

**Calls:**
- `decodeSecret` (33)
- `decodeSecret` (2)
- `decodeSecret` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:404` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:38` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

### `async handleFallbackJoin`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:345` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs:52` | Self: 0.0% (1.2ms) | Total: 0.0% (10.6ms) | Samples: 1

**Called by:**
- `async requireActiveUserSession` (5)
- `async withDbWriteRetry` (1)

**Calls:**
- `async (anonymous)` (4)
- `async (anonymous)` (1)
- `async runWithRequestState` (1)
- `async runWithRequestState` (1)

### `readNgramReferences`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/internal/decode-shared.js` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `decodeTrieDict` (1)

### `has`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/env-impl.mjs:9` | Self: 0.0% (1.2ms) | Total: 0.0% (3.4ms) | Samples: 1

**Called by:**
- `performProxyObjectHas` (2)

**Calls:**
- `_getEnv` (1)

### `toASN`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js:45` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `serialize` (1)

### `create`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/value-node.js` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `parseValueBinaryOperation` (1)

### `async getTopicsForThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/core.ts:191` | Self: 0.0% (1.2ms) | Total: 0.0% (3.5ms) | Samples: 1

**Called by:**
- `async enrichMessagesWithThreadTopics` (3)

**Calls:**
- `async withAccountDb` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@zone-eu/mailsplit/lib/message-splitter.js:86` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `anonymous` (1)

### `toOperationNode`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `toOperationNode` (1)

### `async getMessageCalendarInviteDataByMessageId`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async listThreads` (1)

### `getStore`
`node:async_hooks:168` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:687` | Self: 0.0% (1.2ms) | Total: 14.3% (5.30s) | Samples: 1

**Called by:**
- `async withAccountDb` (4597)

**Calls:**
- `getTopicSuggestionSignalsForThreadsFromDb` (4149)
- `getTopicSuggestionSignalsForThreadsFromDb` (332)
- `getTopicSuggestionSignalsForThreadsFromDb` (38)
- `getTopicSuggestionSignalsForThreadsFromDb` (31)
- `getTopicSuggestionSignalsForThreadsFromDb` (24)
- `getTopicSuggestionSignalsForThreadsFromDb` (18)
- `getTopicSuggestionSignalsForThreadsFromDb` (2)
- `getTopicSuggestionSignalsForThreadsFromDb` (2)

### `async getMessageCalendarInviteDataByMessageId`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:201` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async listThreads` (1)

### `headers`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/headers.js:90` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `isObject`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `isPlainObject` (1)

### `topicSuggestionSignalEntries`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `parseSearchInput`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:601` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async listThreads` (1)

### `toOperationNode`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:385` | Self: 0.0% (1.2ms) | Total: 0.0% (2.4ms) | Samples: 1

**Called by:**
- `parseTableExpressionOrList` (2)

**Calls:**
- `toOperationNode` (1)

### `fromBER`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `localFromBER` (1)

### `reduce`
`[native code]` | Self: 0.0% (1.2ms) | Total: 0.0% (7.5ms) | Samples: 1

**Called by:**
- `async (anonymous)` (3)
- `async (anonymous)` (2)
- `async (anonymous)` (1)

**Calls:**
- `(anonymous)` (2)
- `_defu` (1)
- `_defu` (1)
- `(anonymous)` (1)

### `TextEncoder`
`[native code]` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `getTime`
`[native code]` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async getThreadGroupCounts` (1)

### `toLowerCase`
`[native code]` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `applyBadgeFilters` (1)

### `createAuthEndpoint`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/api/index.mjs` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `applyBadgeFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:877` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async getTotalCount` (1)

### `getFieldName`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-name.mjs:26` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `transformJoinClause` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2601` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

### `async validateAccountFolders`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/folderAccount.ts:17` | Self: 0.0% (1.2ms) | Total: 0.0% (9.4ms) | Samples: 1

**Called by:**
- `async (anonymous)` (8)

**Calls:**
- `async validateAccountFolders` (4)
- `async validateAccountFolders` (3)

### `getKey`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/secret.ts` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `decryptPayload` (1)

### `Libmime`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/esm/libmime.js` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `async #transformResult`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:164` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async #transformResult` (1)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async getTotalCount` (1)

### `get`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/index.js:8` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `shouldSearchAttachmentFilenames`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `parseSearchInput` (1)

### `getTopicSuggestionSignalsForThreadsFromDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:214` | Self: 0.0% (1.2ms) | Total: 12.9% (4.77s) | Samples: 1

**Called by:**
- `(anonymous)` (4149)

**Calls:**
- `forEach` (4148)

### `WriteStream`
`internal:fs/streams` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `applyBadgeFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:847` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `async getTotalCount` (1)

### `defineRequestState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `async getDatabaseIndexMap`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async getDatabaseIndexMap` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/core.ts:203` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async withAccountDb` (1)

### `collectTopicSignalEntries`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:60` | Self: 0.0% (1.1ms) | Total: 0.2% (99.9ms) | Samples: 1

**Called by:**
- `flush` (83)

**Calls:**
- `ownAddressList` (73)
- `ownAddressList` (9)

### `resolvePromiseWithFirstResolvingFunctionCallCheck`
`[native code]` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `restoreDiff`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/dom-serializer/node_modules/entities/lib/esm/generated/encode-html.js` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `parseAliasedExpression` (1)

### `guards`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `installShardWriterGuards` (1)

### `Uint8Array`
`[native code]` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async getThreadGroupCounts`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async listThreads` (1)

### `parseCookies`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:28` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `flush`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:45` | Self: 0.0% (1.1ms) | Total: 16.4% (6.08s) | Samples: 1

**Called by:**
- `(anonymous)` (1795)
- `insertThreadSignalsFromMessageRows` (3)

**Calls:**
- `forEach` (1797)

### `async transformOutput`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:145` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async runWithRequestState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:201` | Self: 0.0% (1.1ms) | Total: 0.7% (284.5ms) | Samples: 1

**Called by:**
- `async (anonymous)` (45)

**Calls:**
- `async (anonymous)` (45)
- `async (anonymous)` (44)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:243` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async releaseConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async releaseConnection` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/libmime.js` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `clampThreadListPageSize`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:21` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:105` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `some` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `ahead`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/peberminta/lib/core.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `Statement`
`bun:sqlite` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `prepare` (1)

### `upsertBatch`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:365` | Self: 0.0% (1.1ms) | Total: 5.9% (2.19s) | Samples: 1

**Called by:**
- `(anonymous)` (1841)

**Calls:**
- `forEach` (1840)

### `visitSelectQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `bound visitSelectQuery` (1)

### `visitSelectQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:38` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `bound visitSelectQuery` (1)

### `Tokenizer`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:806` | Self: 0.0% (1.1ms) | Total: 0.0% (24.8ms) | Samples: 1

**Called by:**
- `_parseAddressList` (21)

**Calls:**
- `TokenList` (9)
- `TokenList` (6)
- `TokenList` (5)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:30` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `ZodDate` (1)

### `from`
`[native code]` | Self: 0.0% (1.1ms) | Total: 0.0% (8.0ms) | Samples: 1

**Called by:**
- `async getMessageCalendarInviteDataByMessageId` (2)
- `pruneThreadTopicsWithoutMessages` (1)
- `parseRowValues` (1)
- `getTopicSuggestionSignalsForThreadsFromDb` (1)

**Calls:**
- `arrayFromFastWithoutMapFn` (4)

### `flush`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `NextResponse`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:40` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `json` (1)

### `async createInternalContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `looksLikeJiraMessage`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:27` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `clean`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/utils.js` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `hchacha` (1)

### `isPlainObject`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/defu/dist/defu.mjs:12` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `_defu` (1)

### `mapUserRow`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async getUserById` (1)

### `topicSuggestionSignalEntries`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:105` | Self: 0.0% (1.1ms) | Total: 0.0% (4.8ms) | Samples: 1

**Called by:**
- `(anonymous)` (4)

**Calls:**
- `map` (3)

### `ownAddressList`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:69` | Self: 0.0% (1.1ms) | Total: 3.6% (1.36s) | Samples: 1

**Called by:**
- `shouldIgnoreTopicSuggestionSignal` (1108)
- `collectTopicSignalEntries` (73)

**Calls:**
- `flatMap` (1134)
- `flatIntoArrayWithCallback` (46)

### `toOperationNode`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/raw-builder/raw-builder.js:36` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `toOperationNode` (1)

### `removeUser`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `admin` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:158` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `map` (1)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1360` | Self: 0.0% (1.1ms) | Total: 0.0% (3.5ms) | Samples: 1

**Called by:**
- `async listThreads` (3)

**Calls:**
- `async getTotalCount` (1)
- `async getTotalCount` (1)

### `migrate`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accountKeys.ts` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `ensureAccountKeySchema` (1)

### `createExpressionBuilder`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:25` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `parseAliasedExpression` (1)

### `bound check`
`[native code]` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `bound max` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/defu/dist/defu.mjs:52` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `parseCookies`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:34` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `trim`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js:92` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `map` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/defu/dist/defu.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `reduce` (1)

### `encode`
`[native code]` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:13` | Self: 0.0% (1.1ms) | Total: 0.0% (5.4ms) | Samples: 1

**Called by:**
- `async verifySignature` (2)

**Calls:**
- `atob` (1)

### `async lock`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async lock` (1)

### `getCookie`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `getChunkedCookie` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:152` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async transformSingleOutput` (1)

### `ExpressionWrapper`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-wrapper.js:11` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `binary` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:200` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `charCodeAt`
`[native code]` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `trimOWS` (1)

### `parseExpression`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/expression-parser.js:7` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `where` (1)

### `async requireAccountContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/accountContext.ts:55` | Self: 0.0% (1.1ms) | Total: 0.0% (6.5ms) | Samples: 1

**Calls:**
- `async resolveAccountRole` (4)

### `async getThreadGroupCounts`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1394` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async listThreads` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1009` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `init` (1)

### `bound optional`
`[native code]` | Self: 0.0% (1.1ms) | Total: 0.0% (2.2ms) | Samples: 1

**Called by:**
- `(module)` (1)
- `(module)` (1)

**Calls:**
- `optional` (1)

### `mapAccountRow`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:190` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async getAccountById` (1)

### `query`
`bun:sqlite` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `#get`
`bun:sqlite:174` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:50` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

### `decodeSecret`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/secret.ts:69` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `mapAccountRow` (1)

### `async executeQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:38` | Self: 0.0% (1.1ms) | Total: 0.0% (23.2ms) | Samples: 1

**Called by:**
- `async executeQuery` (9)

**Calls:**
- `async provideConnection` (8)

### `mapAccountRow`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:151` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async getAccountById` (1)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:119` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `startActiveSpan`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/noop.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async dispatchAuthEndpoint` (1)

### `_collapseAtSpacing`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:276` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `map` (1)

### `async getAccountOwnAddresses`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/senderIdentities.ts:22` | Self: 0.0% (1.1ms) | Total: 0.0% (23.7ms) | Samples: 1

**Called by:**
- `async listThreads` (2)

**Calls:**
- `listSenderIdentityRows` (8)
- `getOwnAddresses` (6)
- `getOwnAddresses` (1)
- `listSenderIdentityRows` (1)
- `map` (1)
- `async getAccountOwnAddresses` (1)
- `getOwnAddresses` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:272` | Self: 0.0% (1.1ms) | Total: 0.0% (24.1ms) | Samples: 1

**Called by:**
- `run` (18)
- `(anonymous)` (1)

**Calls:**
- `async (anonymous)` (12)
- `async (anonymous)` (6)

### `create`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/reference-node.js:12` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `parseValueBinaryOperation` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2614` | Self: 0.0% (1.1ms) | Total: 7.3% (2.71s) | Samples: 1

**Calls:**
- `map` (2339)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:539` | Self: 0.0% (1.1ms) | Total: 0.0% (10.7ms) | Samples: 1

**Called by:**
- `forEach` (9)

**Calls:**
- `deriveSystemFlagState` (4)
- `deriveSystemFlagState` (2)
- `deriveSystemFlagState` (1)
- `deriveSystemFlagState` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `map` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2476` | Self: 0.0% (1.1ms) | Total: 4.5% (1.68s) | Samples: 1

**Calls:**
- `(anonymous)` (1471)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:153` | Self: 0.0% (1.1ms) | Total: 0.0% (24.5ms) | Samples: 1

**Calls:**
- `async findSession` (4)

### `compileQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:23` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async execute` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async createUser` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:3136` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `final`
`[native code]` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `final` (1)

### `async getThreadGroupCounts`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1398` | Self: 0.0% (1.1ms) | Total: 5.6% (2.07s) | Samples: 1

**Called by:**
- `async listThreads` (1813)

**Calls:**
- `(anonymous)` (1812)

### `internal:streams/state`
`internal:streams/state` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `anonymous` (1)

### `async readAuthJson`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/readAuthJson.ts:10` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async readAuthJson` (1)

### `compileList`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:134` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `visitSelectQuery` (1)

### `async getDatabaseColumnBounds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async getDatabaseColumnBounds` (1)

### `applyAddressSearchFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:565` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async getTotalCount` (1)

### `normalizeShardSql`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/ftsIdentity.ts:2` | Self: 0.0% (1.1ms) | Total: 0.0% (3.0ms) | Samples: 1

**Called by:**
- `(anonymous)` (3)

**Calls:**
- `replace` (1)
- `/[\s";]+/g` (1)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts` | Self: 0.0% (1.1ms) | Total: 0.0% (1.1ms) | Samples: 1

**Called by:**
- `async withAccountDb` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:225` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

### `run`
`node:async_hooks` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async runWithRequestState` (1)

### `bound visitCreateTable`
`[native code]` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `visitNode` (1)

### `readGap`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/encode.js:41` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `node:crypto`
`node:crypto:98` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/senderIdentities.ts` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `map` (1)

### `getTopicSuggestionSignalsForThreadsFromDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:198` | Self: 0.0% (1.0ms) | Total: 1.0% (388.9ms) | Samples: 1

**Called by:**
- `(anonymous)` (332)

**Calls:**
- `(anonymous)` (331)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:2107` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `init` (1)

### `visitNode`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/operation-node-visitor.js:113` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `visitWhere` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-field-name.mjs:22` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `getHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:138` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `applyExcludedFolderFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async getTotalCount` (1)

### `async withAuthResponse`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:51` | Self: 0.0% (1.0ms) | Total: 0.0% (8.0ms) | Samples: 1

**Calls:**
- `forwardAuthHeaders` (6)

### `sqliteIntegerPrimaryKeyColumn`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async sqliteGeneratedPrimaryKeyColumn` (1)

### `loadNextHeadersModule`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:27` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `scheduleAccountDbIdleClose`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:253` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async getAccountDb` (1)

### `requireJsonSameOrigin`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/requestOrigin.ts:20` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async POST` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:588` | Self: 0.0% (1.0ms) | Total: 0.4% (182.0ms) | Samples: 1

**Calls:**
- `formatTransactionId` (4)
- `formatTransactionId` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:372` | Self: 0.0% (1.0ms) | Total: 0.0% (2.4ms) | Samples: 1

**Called by:**
- `forEach` (2)

**Calls:**
- `find` (1)

### `normalizeImapFlags`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageFlags.ts` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/update-user.mjs:95` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

### `async get`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `registerDbShutdownHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:285` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async getDb` (1)

### `topicSuggestionSignalEntries`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:104` | Self: 0.0% (1.0ms) | Total: 0.0% (16.7ms) | Samples: 1

**Called by:**
- `(anonymous)` (15)

**Calls:**
- `map` (14)

### `unquoteCookieValue`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/cookie-utils.mjs:125` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `parseCookies` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:88` | Self: 0.0% (1.0ms) | Total: 1.9% (727.8ms) | Samples: 1

**Called by:**
- `forEach` (264)
- `filter` (260)

**Calls:**
- `filter` (264)
- `isOwnAddress` (159)
- `isOwnAddress` (100)

### `normalizeCalendarEventUidKeys`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/calendarEventUids.ts` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `applyInviteUidQueryFilters` (1)

### `Statement`
`bun:sqlite:115` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `prepare` (1)

### `applyAddressSearchFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:542` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async getTotalCount` (1)

### `topicSuggestionSignalsFromEntries`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `flush` (1)

### `getColorDepth`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs:59` | Self: 0.0% (1.0ms) | Total: 0.0% (2.3ms) | Samples: 1

**Called by:**
- `formatTransactionId` (2)

**Calls:**
- `performProxyObjectHas` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2626` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `map` (1)

### `createAccessControl`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/access/access.mjs` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `rotl`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_arx.js:65` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `chachaCore` (1)

### `isRecursive`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/memoizer.js:66` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `wrapped` (1)

### `cloneWithWhere`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/query-node.js` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `where` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:423` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `parseCookies`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:36` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `normalizeCalendarEventUids`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/calendarEventUids.ts:18` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `utilToBase`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pvutils/build/utils.js:89` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `toBER` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2530` | Self: 0.0% (1.0ms) | Total: 0.0% (2.1ms) | Samples: 1

**Calls:**
- `applyExcludedFolderFilters` (1)

### `members`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:740` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `init` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/signed_data.js:25` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `anonymous` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2465` | Self: 0.0% (1.0ms) | Total: 7.7% (2.86s) | Samples: 1

**Calls:**
- `(anonymous)` (2483)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-model-name.mjs` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `getFieldName` (1)

### `createRandomStringGenerator`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/utils/dist/random.mjs:12` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `generateId` (1)

### `applySearchQueryFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:713` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async listThreads` (1)

### `runtimeSchemaCheckFor`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema-check.mjs` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async createAuthContext` (1)

### `require`
`[native code]` | Self: 0.0% (1.0ms) | Total: 2.4% (894.1ms) | Samples: 1

**Called by:**
- `bound require` (704)

**Calls:**
- `anonymous` (690)
- `(anonymous)` (12)
- `get` (1)

### `defaultThreadCollabState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1274` | Self: 0.0% (1.0ms) | Total: 0.0% (2.0ms) | Samples: 1

**Calls:**
- `async getAccountOwnAddresses` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authPolicyHandler.ts:287` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async createAuthContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/create-context.mjs` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async createAuthContext` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/mail/categorization/linearModel.ts` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/utf8-to-jis-table.js:6` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `anonymous` (1)

### `getThreadCollabStates`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts:78` | Self: 0.0% (1.0ms) | Total: 0.0% (3.3ms) | Samples: 1

**Called by:**
- `async getThreadCollabStates` (3)

**Calls:**
- `set` (2)

### `write`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `toBER` (1)

### `getTopicSuggestionsForThreadSignalBatch`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:581` | Self: 0.0% (1.0ms) | Total: 0.3% (116.2ms) | Samples: 1

**Called by:**
- `async withAccountDb` (100)

**Calls:**
- `(anonymous)` (99)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:17` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `transaction` (1)

### `quote`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:45` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `guardSql` (1)

### `hasFlag`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:316` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `deriveSystemFlagState` (1)

### `decodeTrieDict`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/internal/decode-shared.js:175` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/sign-in.mjs` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async findOne`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:526` | Self: 0.0% (1.0ms) | Total: 1.3% (491.8ms) | Samples: 1

**Called by:**
- `(anonymous)` (126)

**Calls:**
- `async findOne` (73)
- `async findOne` (38)
- `async findOne` (6)
- `async findOne` (6)
- `async findOne` (2)

### `internal:streams/writable`
`internal:streams/writable:14` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `anonymous` (1)

### `applyAddressSearchFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:548` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async listThreads` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:74` | Self: 0.0% (1.0ms) | Total: 0.7% (269.8ms) | Samples: 1

**Called by:**
- `forEach` (203)

**Calls:**
- `parseAddressEmails` (172)
- `parseAddressEmails` (16)
- `parseAddressEmails` (11)
- `flatIntoArrayWithCallback` (3)

### `getThreadCollabStates`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts:73` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async getThreadCollabStates` (1)

### `installLazyProp`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:847` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:655` | Self: 0.0% (1.0ms) | Total: 1.5% (571.8ms) | Samples: 1

**Called by:**
- `forEach` (479)

**Calls:**
- `insert` (280)
- `insert` (198)

### `node:_http_server`
`node:_http_server:3` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `anonymous` (1)

### `toArrayBuffer`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pvtsutils/build/index.js:34` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `toBER` (1)

### `async transformInput`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/api/index.mjs` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `parseAddressEmails`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:35` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `isOwnAddress` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/core.ts` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async withAccountDb` (1)

### `async assertAccountFolder`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/folderAccountGuard.ts` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async assertAccountFolder` (1)

### `getHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:157` | Self: 0.0% (1.0ms) | Total: 0.0% (7.8ms) | Samples: 1

**Called by:**
- `async (anonymous)` (7)

**Calls:**
- `flatIntoArrayWithCallback` (6)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accounts.ts` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:160` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async transformSingleOutput` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:553` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

### `(anonymous)`
`/tmp/spike-switch-server/fixture.ts:60` | Self: 0.0% (1.0ms) | Total: 0.0% (6.3ms) | Samples: 1

**Called by:**
- `transaction` (6)

**Calls:**
- `(anonymous)` (5)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:102` | Self: 0.0% (1.0ms) | Total: 0.0% (10.3ms) | Samples: 1

**Called by:**
- `listSenderIdentityRows` (4)
- `async resolveAccountDbPath` (3)
- `accountRuntimeProbesSettled` (1)
- `resolveAccountRoleRow` (1)

**Calls:**
- `query` (3)
- `query` (3)
- `query` (1)
- `query` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:543` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `async withAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:413` | Self: 0.0% (1.0ms) | Total: 16.2% (6.01s) | Samples: 1

**Called by:**
- `async getTopicsForThreads` (2)
- `async getTopicSuggestionsForThreads` (1)

**Calls:**
- `(anonymous)` (4597)
- `getTopicSuggestionsForThreadSignalBatch` (242)
- `getTopicSuggestionsForThreadSignalBatch` (111)
- `getTopicSuggestionsForThreadSignalBatch` (100)
- `(anonymous)` (59)
- `(anonymous)` (51)
- `getTopicSuggestionsForThreadSignalBatch` (41)
- `getTopicSuggestionsForThreadSignalBatch` (7)
- `async withAccountDb` (3)
- `getTopicSuggestionsForThreadSignalBatch` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:13` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2507` | Self: 0.0% (1.0ms) | Total: 2.7% (1.01s) | Samples: 1

**Calls:**
- `(anonymous)` (886)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:193` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `_collectAddressParts`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:562` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `_handleAddress` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:51` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `forEach` (1)

### `async update`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async update` (1)

### `_isAddrSpec`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `_handleAddress` (1)

### `async getCurrentAdapter`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/transaction.mjs:27` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `bound visitParens`
`[native code]` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `visitNode` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/decorators.js:50` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `DecorateProperty` (1)

### `extractJiraProjectKeys`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `collectTopicSignalEntries` (1)

### `bun:sqlite`
`bun:sqlite:228` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

### `cookies`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/cookies.js` | Self: 0.0% (999us) | Total: 0.0% (999us) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `dlopen`
`[native code]` | Self: 0.0% (998us) | Total: 0.0% (998us) | Samples: 1

**Called by:**
- `dlopen` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:563` | Self: 0.0% (998us) | Total: 0.5% (203.9ms) | Samples: 1

**Called by:**
- `forEach` (177)

**Calls:**
- `forEach` (110)
- `topicSuggestionSignalEntries` (18)
- `topicSuggestionSignalEntries` (16)
- `topicSuggestionSignalEntries` (15)
- `topicSuggestionSignalEntries` (12)
- `topicSuggestionSignalEntries` (4)
- `topicSuggestionSignalEntries` (1)

### `add`
`[native code]` | Self: 0.0% (994us) | Total: 0.0% (994us) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:157` | Self: 0.0% (993us) | Total: 0.0% (993us) | Samples: 1

**Called by:**
- `async transformSingleOutput` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:535` | Self: 0.0% (992us) | Total: 0.0% (992us) | Samples: 1

**Called by:**
- `forEach` (1)

### `async getSignedCookie`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:48` | Self: 0.0% (992us) | Total: 0.0% (12.8ms) | Samples: 1

**Called by:**
- `async (anonymous)` (7)
- `async (anonymous)` (1)

**Calls:**
- `async (anonymous)` (6)
- `async (anonymous)` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts` | Self: 0.0% (991us) | Total: 0.0% (991us) | Samples: 1

**Called by:**
- `async listThreads` (1)

### `async upsertMessages`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts` | Self: 0.0% (991us) | Total: 0.0% (991us) | Samples: 1

**Called by:**
- `async buildFixture` (1)

### `ensureThreadRuntimeSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts` | Self: 0.0% (989us) | Total: 0.0% (989us) | Samples: 1

**Called by:**
- `async getAccountDb` (1)

### `managedNonce`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/utils.js` | Self: 0.0% (988us) | Total: 0.0% (988us) | Samples: 1

**Called by:**
- `async rawEncrypt` (1)

### `parseCookies`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:38` | Self: 0.0% (987us) | Total: 0.0% (987us) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `get source`
`[native code]` | Self: 0.0% (981us) | Total: 0.0% (981us) | Samples: 1

**Called by:**
- `compile` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:704` | Self: 0.0% (981us) | Total: 0.2% (86.5ms) | Samples: 1

**Called by:**
- `map` (75)

**Calls:**
- `parseAddressEmails` (62)
- `parseAddressEmails` (6)
- `flatIntoArrayWithCallback` (4)
- `parseAddressEmails` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:378` | Self: 0.0% (981us) | Total: 0.0% (981us) | Samples: 1

**Called by:**
- `forEach` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:166` | Self: 0.0% (979us) | Total: 0.0% (979us) | Samples: 1

**Called by:**
- `DBCSCodec` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:619` | Self: 0.0% (978us) | Total: 0.0% (978us) | Samples: 1

**Called by:**
- `forEach` (1)

### `async ensureCalendarEventRuntimeData`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:660` | Self: 0.0% (978us) | Total: 0.1% (45.7ms) | Samples: 1

**Called by:**
- `async ensureCalendarEventRuntimeData` (40)

**Calls:**
- `importModule` (39)

### `debugLog`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` | Self: 0.0% (976us) | Total: 0.0% (976us) | Samples: 1

**Called by:**
- `async (anonymous)` (1)

### `CreateTableBuilder`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/schema/create-table-builder.js:26` | Self: 0.0% (974us) | Total: 0.0% (974us) | Samples: 1

**Called by:**
- `addColumn` (1)

### `collectTopicSignalEntries`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:64` | Self: 0.0% (973us) | Total: 0.0% (973us) | Samples: 1

**Called by:**
- `flush` (1)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1288` | Self: 0.0% (972us) | Total: 0.0% (2.8ms) | Samples: 1

**Calls:**
- `parseSearchInput` (1)
- `parseSearchInput` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:662` | Self: 0.0% (972us) | Total: 0.0% (972us) | Samples: 1

**Called by:**
- `forEach` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2583` | Self: 0.0% (971us) | Total: 0.0% (3.1ms) | Samples: 1

**Calls:**
- `map` (1)
- `join` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:2118` | Self: 0.0% (971us) | Total: 0.0% (971us) | Samples: 1

**Called by:**
- `validate` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/parse5/dist/common/token.js` | Self: 0.0% (971us) | Total: 0.0% (971us) | Samples: 1

**Called by:**
- `(module)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:148` | Self: 0.0% (970us) | Total: 0.0% (970us) | Samples: 1

**Called by:**
- `async transformSingleOutput` (1)

### `/[\s";]+/g`
`[native code]` | Self: 0.0% (970us) | Total: 0.0% (970us) | Samples: 1

**Called by:**
- `normalizeShardSql` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs` | Self: 0.0% (966us) | Total: 0.0% (966us) | Samples: 1

**Called by:**
- `async createInternalContext` (1)

### `async acquireConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:53` | Self: 0.0% (966us) | Total: 0.0% (19.1ms) | Samples: 1

**Called by:**
- `async acquireConnection` (6)

**Calls:**
- `async acquireConnection` (3)
- `async acquireConnection` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:71` | Self: 0.0% (965us) | Total: 0.0% (5.0ms) | Samples: 1

**Called by:**
- `every` (5)

**Calls:**
- `normalizeShardSql` (3)
- `guardSql` (1)

### `async getAccountOwnAddresses`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/senderIdentities.ts` | Self: 0.0% (964us) | Total: 0.0% (964us) | Samples: 1

**Called by:**
- `async getTotalCount` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:350` | Self: 0.0% (958us) | Total: 0.0% (11.8ms) | Samples: 1

**Called by:**
- `async handleFallbackJoin` (2)

**Calls:**
- `(anonymous)` (1)

### `parseSearchInput`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts` | Self: 0.0% (958us) | Total: 0.0% (958us) | Samples: 1

**Called by:**
- `async listThreads` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2243` | Self: 0.0% (956us) | Total: 0.0% (8.7ms) | Samples: 1

**Calls:**
- `parseSearchInput` (3)
- `parseSearchInput` (1)
- `parseSearchInput` (1)
- `parseSearchInput` (1)

### `async requireAccountContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/accountContext.ts:63` | Self: 0.0% (953us) | Total: 0.0% (953us) | Samples: 1

### `replace`
`[native code]` | Self: 0.0% (953us) | Total: 0.0% (953us) | Samples: 1

**Called by:**
- `normalizeShardSql` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:46` | Self: 0.0% (953us) | Total: 16.4% (6.08s) | Samples: 1

**Called by:**
- `forEach` (1795)

**Calls:**
- `(anonymous)` (1789)
- `(anonymous)` (3)
- `(anonymous)` (2)

### `async getUserById`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/users.ts` | Self: 0.0% (953us) | Total: 0.0% (953us) | Samples: 1

**Called by:**
- `async getUserById` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/middleware.mjs:7` | Self: 0.0% (953us) | Total: 0.0% (953us) | Samples: 1

### `parseCookies`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/cookie-utils.mjs:159` | Self: 0.0% (951us) | Total: 0.0% (951us) | Samples: 1

**Called by:**
- `getChunkedCookie` (1)

### `AsnType`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/decorators.js:8` | Self: 0.0% (949us) | Total: 0.0% (949us) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts:72` | Self: 0.0% (948us) | Total: 0.0% (8.1ms) | Samples: 1

**Called by:**
- `map` (7)

**Calls:**
- `defaultThreadCollabState` (5)
- `defaultThreadCollabState` (1)

### `_handleAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:768` | Self: 0.0% (948us) | Total: 0.0% (948us) | Samples: 1

**Called by:**
- `_parseAddressList` (1)

### `parseSearchInput`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:657` | Self: 0.0% (940us) | Total: 0.0% (940us) | Samples: 1

**Called by:**
- `async getTotalCount` (1)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1344` | Self: 0.0% (938us) | Total: 0.0% (938us) | Samples: 1

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2708` | Self: 0.0% (937us) | Total: 0.0% (2.8ms) | Samples: 1

**Called by:**
- `async (anonymous)` (3)

**Calls:**
- `async listThreads` (1)
- `async listThreads` (1)

### `lookup`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/ftsIdentity.ts` | Self: 0.0% (934us) | Total: 0.0% (934us) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `mapAccountRow`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:177` | Self: 0.0% (934us) | Total: 0.0% (29.3ms) | Samples: 1

**Called by:**
- `async getAccountById` (23)

**Calls:**
- `normalizeAccountSettings` (12)
- `safeParseJson` (8)
- `normalizeAccountSettings` (1)
- `normalizeAccountSettings` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:224` | Self: 0.0% (930us) | Total: 0.0% (18.7ms) | Samples: 1

**Calls:**
- `filterOutputFields` (3)
- `filterOutputFields` (3)

### `getFieldName`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-name.mjs` | Self: 0.0% (930us) | Total: 0.0% (930us) | Samples: 1

**Called by:**
- `(anonymous)` (1)

### `buildScopedFtsTokenQueries`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:476` | Self: 0.0% (930us) | Total: 0.0% (930us) | Samples: 1

**Called by:**
- `parseSearchInput` (1)

### `bound visitReference`
`[native code]` | Self: 0.0% (923us) | Total: 0.0% (14.0ms) | Samples: 1

**Called by:**
- `visitNode` (5)

**Calls:**
- `visitReference` (3)
- `visitReference` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/imapflow/dist/esm/charsets.js:275` | Self: 0.0% (919us) | Total: 0.0% (919us) | Samples: 1

**Called by:**
- `forEach` (1)

### `part`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts` | Self: 0.0% (899us) | Total: 0.0% (899us) | Samples: 1

**Called by:**
- `displayDayNumber` (1)

### `_SHA384`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha2.js:325` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `SHA2_64B` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:564` | Self: 0.0% (0us) | Total: 0.0% (6.3ms) | Samples: 0

**Called by:**
- `forEach` (5)

**Calls:**
- `topicSuggestionSignalKey` (5)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:251` | Self: 0.0% (0us) | Total: 0.0% (3.4ms) | Samples: 0

**Called by:**
- `DBCSCodec` (3)

**Calls:**
- `(anonymous)` (2)
- `(anonymous)` (1)

### `and`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:90` | Self: 0.0% (0us) | Total: 0.0% (10.1ms) | Samples: 0

**Called by:**
- `parseExpression` (1)

**Calls:**
- `isReadonlyArray` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:748` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `async getAccountOwnAddresses`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/senderIdentities.ts:20` | Self: 0.0% (0us) | Total: 0.0% (958us) | Samples: 0

**Called by:**
- `async getAccountOwnAddresses` (1)

**Calls:**
- `async getDb` (1)

### `async getMigrations`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:345` | Self: 0.0% (0us) | Total: 0.0% (3.0ms) | Samples: 0

**Called by:**
- `async getMigrations` (2)

**Calls:**
- `buildSchema` (2)

### `(module)`
`/tmp/spike-switch-server/inspect.ts:23` | Self: 0.0% (0us) | Total: 0.1% (40.5ms) | Samples: 0

**Calls:**
- `text` (16)
- `async GET` (8)
- `get` (6)
- `get` (3)
- `get` (2)

### `compileUnwrappedIdentifier`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:305` | Self: 0.0% (0us) | Total: 0.0% (4.0ms) | Samples: 0

**Called by:**
- `visitIdentifier` (1)

**Calls:**
- `sanitizeIdentifier` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:267` | Self: 0.0% (0us) | Total: 0.0% (3.0ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async ensureAuthLifetimeLock` (1)

### `async transformInput`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:143` | Self: 0.0% (0us) | Total: 0.4% (163.7ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)
- `async (anonymous)` (1)

**Calls:**
- `async (anonymous)` (2)
- `async (anonymous)` (1)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:388` | Self: 0.0% (0us) | Total: 0.0% (989us) | Samples: 0

**Calls:**
- `ensureThreadRuntimeSchema` (1)

### `async findMany`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:530` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Called by:**
- `async findMany` (2)

**Calls:**
- `selectFrom` (2)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/senderMessages.ts:91` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `values` (1)

### `selectFrom`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:39` | Self: 0.0% (0us) | Total: 0.0% (33.9ms) | Samples: 0

**Called by:**
- `(anonymous)` (24)

**Calls:**
- `createFrom` (23)
- `parseTableExpressionOrList` (1)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:384` | Self: 0.0% (0us) | Total: 0.1% (42.5ms) | Samples: 0

**Calls:**
- `async withDbWriteRetry` (37)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1302` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Calls:**
- `applyAddressSearchFilters` (1)
- `applyAddressSearchFilters` (1)

### `validate`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:142` | Self: 0.0% (0us) | Total: 0.0% (9.2ms) | Samples: 0

**Called by:**
- `async runValidation` (5)
- `async runValidation` (1)

**Calls:**
- `(anonymous)` (2)
- `(anonymous)` (1)
- `wrapped` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `async execute`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:317` | Self: 0.0% (0us) | Total: 0.2% (94.4ms) | Samples: 0

**Called by:**
- `async execute` (33)

**Calls:**
- `compileQuery` (26)
- `compileQuery` (5)
- `compileQuery` (1)
- `freeze` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (12.1ms) | Samples: 0

**Called by:**
- `anonymous` (11)

**Calls:**
- `bound require` (11)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (17.6ms) | Samples: 0

**Calls:**
- `bound require` (15)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:538` | Self: 0.0% (0us) | Total: 0.0% (3.6ms) | Samples: 0

**Called by:**
- `forEach` (3)

**Calls:**
- `normalizeImapFlags` (2)
- `normalizeImapFlags` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/core.ts:192` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async withAccountDb` (1)

**Calls:**
- `map` (1)

### `ZodEnum`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `clone` (1)

**Calls:**
- `init` (1)

### `pruneThreadTopicsWithoutMessages`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:165` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `from` (1)

### `async releaseConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:67` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `async provideConnection` (2)

**Calls:**
- `async releaseConnection` (1)
- `async releaseConnection` (1)

### `async reconcileProvisioning`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/userProvisioning.ts:86` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async reconcileProvisioning` (1)

**Calls:**
- `(anonymous)` (1)

### `upsertTopicLearningSignalsForThreadIds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/topics.ts:153` | Self: 0.0% (0us) | Total: 0.0% (5.6ms) | Samples: 0

**Called by:**
- `async (anonymous)` (5)

**Calls:**
- `(anonymous)` (5)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/css-syntax-error.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async getThreadGroupCounts`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1404` | Self: 0.0% (0us) | Total: 0.0% (6.9ms) | Samples: 0

**Called by:**
- `async listThreads` (6)

**Calls:**
- `sortGroupsForGroupBy` (2)
- `map` (1)
- `sortGroupsForGroupBy` (1)
- `sortGroupsForGroupBy` (1)
- `sortGroupsForGroupBy` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2499` | Self: 0.0% (0us) | Total: 0.1% (43.7ms) | Samples: 0

**Calls:**
- `(anonymous)` (40)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv6.js:34` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/oauth2/authorization-params.mjs:10` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Calls:**
- `_string` (1)

### `createConfiguredEndpoint`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:67` | Self: 0.0% (0us) | Total: 0.0% (2.9ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `combineMiddleware` (1)

### `mapAccountRow`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:192` | Self: 0.0% (0us) | Total: 0.0% (12.0ms) | Samples: 0

**Called by:**
- `async getAccountById` (10)

**Calls:**
- `decodeSecret` (10)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:735` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `__extends` (1)

### `getChunkedCookie`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/session-store.mjs:137` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `getCookie` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs:322` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `bound meta` (1)

### `ResponseCookies`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/@edge-runtime/cookies/index.js:256` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `NextResponse` (2)

**Calls:**
- `Map` (2)

### `ensureAccountKeySchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accountKeys.ts:164` | Self: 0.0% (0us) | Total: 0.0% (3.1ms) | Samples: 0

**Called by:**
- `async withDbWriteRetry` (3)

**Calls:**
- `every` (2)
- `shardWriterGuardsInstalled` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/totp/index.mjs:213` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Calls:**
- `async deleteSession` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-model-name.mjs:14` | Self: 0.0% (0us) | Total: 0.0% (1.9ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `getFieldName`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-name.mjs:22` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `transformJoinClause` (1)
- `getReferencePath` (1)

**Calls:**
- `(anonymous)` (1)
- `(anonymous)` (1)

### `async createAuthenticatedTestSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testAuthHarness.ts:213` | Self: 0.0% (0us) | Total: 0.0% (3.7ms) | Samples: 0

**Calls:**
- `async withDbWriteRetry` (3)

### `cached`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts:15` | Self: 0.0% (0us) | Total: 0.0% (9.2ms) | Samples: 0

**Called by:**
- `displayDayNumber` (8)

**Calls:**
- `(anonymous)` (8)

### `async getMigrations`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:685` | Self: 0.0% (0us) | Total: 0.0% (4.4ms) | Samples: 0

**Called by:**
- `async migrateAuthSchema` (3)

**Calls:**
- `async getMigrations` (2)
- `async getMigrations` (1)

### `buildGroupKey`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:71` | Self: 0.0% (0us) | Total: 6.0% (2.22s) | Samples: 0

**Called by:**
- `(anonymous)` (1920)

**Calls:**
- `buildMessageGroupKey` (1293)
- `buildMessageGroupKey` (627)

### `async getMigrations`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:404` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `async getDatabaseColumnBounds` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sanitize-html/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (996us) | Samples: 0

**Calls:**
- `bound require` (1)

### `async setSignedCookie`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:58` | Self: 0.0% (0us) | Total: 0.0% (2.8ms) | Samples: 0

**Called by:**
- `async setSessionCookie` (1)

**Calls:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:1236` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:450` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `(anonymous)` (1)

### `generateId`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/id.mjs:4` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `createRandomStringGenerator` (1)

### `async createUser`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:169` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async (anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:185` | Self: 0.0% (0us) | Total: 0.0% (10.9ms) | Samples: 0

**Calls:**
- `map` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:42` | Self: 0.0% (0us) | Total: 0.1% (38.7ms) | Samples: 0

**Calls:**
- `getChunkedCookie` (5)
- `getChunkedCookie` (3)
- `getChunkedCookie` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/headers.js:2` | Self: 0.0% (0us) | Total: 0.0% (2.7ms) | Samples: 0

**Calls:**
- `bound require` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:584` | Self: 0.0% (0us) | Total: 0.0% (8.7ms) | Samples: 0

**Calls:**
- `async findOne` (4)
- `async findOne` (1)

### `resolveDatabaseSchemaIndexes`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/database-index.mjs:135` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `getAuthTablesWithResolvedIndexes` (1)

**Calls:**
- `assign` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:892` | Self: 0.0% (0us) | Total: 0.0% (2.6ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/index.js:16` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:81` | Self: 0.0% (0us) | Total: 0.0% (21.3ms) | Samples: 0

**Called by:**
- `map` (8)

**Calls:**
- `async (anonymous)` (6)
- `async (anonymous)` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-csr/build/cjs/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:75` | Self: 0.0% (0us) | Total: 0.0% (2.8ms) | Samples: 0

**Calls:**
- `async listThreads` (3)

### `ZodObject`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` | Self: 0.0% (0us) | Total: 0.0% (5.5ms) | Samples: 0

**Called by:**
- `object` (4)

**Calls:**
- `init` (3)
- `init` (1)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:79` | Self: 0.0% (0us) | Total: 0.0% (3.4ms) | Samples: 0

**Called by:**
- `(module)` (2)

**Calls:**
- `async buildFixture` (1)
- `async buildFixture` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1018` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `defineProperty` (1)

### `sortGroupsForGroupBy`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageGrouping.ts:104` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async getThreadGroupCounts` (1)

**Calls:**
- `Map` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/mail/imapCancellation.ts:9` | Self: 0.0% (0us) | Total: 0.0% (20.9ms) | Samples: 0

**Calls:**
- `AsyncLocalStorage` (1)

### `_handleAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:695` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `_parseAddressList` (1)

**Calls:**
- `_isAddrSpec` (1)

### `async acquireConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:35` | Self: 0.0% (0us) | Total: 0.0% (4.1ms) | Samples: 0

**Called by:**
- `async acquireConnection` (3)

**Calls:**
- `async acquireConnection` (2)
- `async acquireConnection` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/request.js:25` | Self: 0.0% (0us) | Total: 0.0% (1.6ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async rawDecrypt`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/crypto/index.mjs:39` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Calls:**
- `decrypt` (1)
- `decrypt` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/socks/build/client/socksclient.js:15` | Self: 0.0% (0us) | Total: 0.0% (2.5ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `configureAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:107` | Self: 0.0% (0us) | Total: 0.0% (15.0ms) | Samples: 0

**Called by:**
- `async getAccountDb` (8)

**Calls:**
- `configureDb` (8)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:234` | Self: 0.0% (0us) | Total: 0.0% (9.8ms) | Samples: 0

**Called by:**
- `run` (9)

**Calls:**
- `async (anonymous)` (7)
- `async (anonymous)` (1)
- `async (anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:703` | Self: 0.0% (0us) | Total: 0.2% (93.5ms) | Samples: 0

**Calls:**
- `map` (79)
- `Map` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:110` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Calls:**
- `Kysely` (1)

### `#runNoArgs`
`bun:sqlite:163` | Self: 0.0% (0us) | Total: 1.2% (467.0ms) | Samples: 0

**Called by:**
- `transaction` (173)
- `(anonymous)` (26)

**Calls:**
- `run` (199)

### `ZodDefault`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `_default` (1)

**Calls:**
- `init` (1)

### `createSeededLinearModel`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/mail/categorization/linearModel.ts:141` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `async getCategoryLinearModel` (1)

**Calls:**
- `setWeights` (1)

### `async requireActiveUserSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:84` | Self: 0.0% (0us) | Total: 0.0% (10.3ms) | Samples: 0

**Calls:**
- `(anonymous)` (9)

### `node:tls`
`node:tls:11` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `anonymous` (1)

### `loadManualCategoryStatesForMessageIds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:310` | Self: 0.0% (0us) | Total: 0.0% (8.0ms) | Samples: 0

**Called by:**
- `async (anonymous)` (7)

**Calls:**
- `(anonymous)` (6)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-model-name.mjs:24` | Self: 0.0% (0us) | Total: 0.0% (1.9ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `resolve` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/config.js:2` | Self: 0.0% (0us) | Total: 0.0% (17.4ms) | Samples: 0

**Called by:**
- `anonymous` (16)

**Calls:**
- `bound require` (16)

### `createExpressionBuilder`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:115` | Self: 0.0% (0us) | Total: 0.0% (25.8ms) | Samples: 0

**Called by:**
- `parseAliasedExpression` (5)
- `parseExpression` (1)

**Calls:**
- `createFunctionModule` (3)
- `createFunctionModule` (2)
- `createFunctionModule` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/next-url.js:14` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `generateFastpass`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1129` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `write` (1)

### `exit`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `(module)` (2)

**Calls:**
- `release` (1)
- `(anonymous)` (1)

### `visitNode`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/operation-node-visitor.js:112` | Self: 0.0% (0us) | Total: 0.6% (243.9ms) | Samples: 0

**Called by:**
- `compileQuery` (26)
- `compileList` (16)
- `visitSelectQuery` (11)
- `visitAlias` (11)
- `visitSelection` (5)
- `visitSelectQuery` (5)
- `visitReference` (3)
- `visitTable` (2)
- `visitWhere` (2)
- `visitBinaryOperation` (1)
- `visitSchemableIdentifier` (1)

**Calls:**
- `bound visitSelectQuery` (36)
- `bound visitFrom` (11)
- `bound visitAlias` (11)
- `bound visitReference` (5)
- `bound visitSelection` (5)
- `bound visitWhere` (5)
- `bound visitTable` (3)
- `bound visitSchemableIdentifier` (2)
- `bound visitParens` (1)
- `bound visitBinaryOperation` (1)
- `bound visitCreateTable` (1)
- `bound visitOperator` (1)
- `bound visitIdentifier` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:184` | Self: 0.0% (0us) | Total: 0.0% (11.6ms) | Samples: 0

**Called by:**
- `async transformOutput` (10)

**Calls:**
- `async transformSingleOutput` (10)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:75` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Calls:**
- `async withDbWriteRetry` (1)

### `createFrom`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/select-query-node.js:23` | Self: 0.0% (0us) | Total: 0.0% (33.8ms) | Samples: 0

**Called by:**
- `selectFrom` (23)
- `selectFrom` (1)

**Calls:**
- `create` (24)

### `async requireActiveUserSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:75` | Self: 0.0% (0us) | Total: 0.0% (12.1ms) | Samples: 0

**Calls:**
- `(anonymous)` (7)
- `wrapStatement` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/index.js:12` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `parseSearchInput`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:685` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async listThreads` (1)

**Calls:**
- `shouldSearchAttachmentFilenames` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/password.mjs:133` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `object` (1)

### `node:stream`
`node:stream:2` | Self: 0.0% (0us) | Total: 0.0% (11.9ms) | Samples: 0

**Calls:**
- `anonymous` (1)

### `async getTopicSuggestionsForThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:686` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async enrichMessagesWithThreadTopics` (1)

**Calls:**
- `async withAccountDb` (1)

### `compile`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:155` | Self: 0.0% (0us) | Total: 0.0% (973us) | Samples: 0

**Called by:**
- `tlds` (1)

**Calls:**
- `RegExp` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/index.js:19` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `compile`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:160` | Self: 0.0% (0us) | Total: 0.0% (934us) | Samples: 0

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

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/socks/build/client/socksclient.js:17` | Self: 0.0% (0us) | Total: 0.0% (8.4ms) | Samples: 0

**Called by:**
- `anonymous` (7)

**Calls:**
- `bound require` (7)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:223` | Self: 0.0% (0us) | Total: 0.0% (13.6ms) | Samples: 0

**Calls:**
- `filterOutputFields` (3)
- `filterOutputFields` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1215` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `validate` (1)

**Calls:**
- `(anonymous)` (1)

### `async withAuthResponse`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:50` | Self: 0.0% (0us) | Total: 0.0% (18.6ms) | Samples: 0

**Called by:**
- `async withAuthResponse` (16)

**Calls:**
- `async (anonymous)` (15)
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-attributes.mjs:29` | Self: 0.0% (0us) | Total: 0.0% (15.7ms) | Samples: 0

**Called by:**
- `(anonymous)` (2)

**Calls:**
- `(anonymous)` (1)
- `(anonymous)` (1)

### `rebuildAllThreadSignalsForAccountInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:131` | Self: 0.0% (0us) | Total: 4.9% (1.83s) | Samples: 0

**Called by:**
- `async rebuildAllThreadSignalsForAccount` (958)

**Calls:**
- `insertThreadSignalsFromMessageRows` (957)
- `insertThreadSignalsFromMessageRows` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/index.js:16` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `__exportStar` (1)

### `async provideConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/default-connection-provider.js:10` | Self: 0.0% (0us) | Total: 1.4% (524.3ms) | Samples: 0

**Calls:**
- `async (anonymous)` (129)

### `setWeights`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/mail/categorization/linearModel.ts:52` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `createSeededLinearModel` (1)
- `createSeededLinearModel` (1)

**Calls:**
- `forEach` (2)

### `_handleAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:682` | Self: 0.0% (0us) | Total: 0.3% (135.7ms) | Samples: 0

**Called by:**
- `_parseAddressList` (114)

**Calls:**
- `map` (114)

### `applyBadgeFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:838` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `async getTotalCount` (2)

**Calls:**
- `includes` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/types/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.5ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `visitOperator`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:374` | Self: 0.0% (0us) | Total: 0.0% (1.4ms) | Samples: 0

**Called by:**
- `bound visitOperator` (1)

**Calls:**
- `append` (1)

### `async reconcileProvisioning`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/userProvisioning.ts:87` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async reconcileProvisioning` (1)

### `async recomputeThreadsForAccountInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:356` | Self: 0.0% (0us) | Total: 0.4% (172.9ms) | Samples: 0

**Calls:**
- `(anonymous)` (152)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/next-url.js:12` | Self: 0.0% (0us) | Total: 0.0% (2.7ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/index.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:440` | Self: 0.0% (0us) | Total: 1.0% (403.5ms) | Samples: 0

**Called by:**
- `forEach` (331)

**Calls:**
- `(anonymous)` (327)
- `(anonymous)` (3)
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:707` | Self: 0.0% (0us) | Total: 0.0% (5.2ms) | Samples: 0

**Calls:**
- `map` (2)
- `async stageMessageFiles` (2)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/state/oauth.mjs:3` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `defineRequestState` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/encoding-table.js:3` | Self: 0.0% (0us) | Total: 0.0% (7.3ms) | Samples: 0

**Called by:**
- `anonymous` (7)

**Calls:**
- `bound require` (7)

### `webpackUniversalModuleDefinition`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:3` | Self: 0.0% (0us) | Total: 0.0% (4.6ms) | Samples: 0

**Called by:**
- `(anonymous)` (2)

**Calls:**
- `(anonymous)` (2)

### `node:worker_threads`
`node:worker_threads:205` | Self: 0.0% (0us) | Total: 0.0% (940us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `anonymous` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/attribute_certificate.js:7` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authPolicyHandler.ts:285` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `resolvePromiseWithFirstResolvingFunctionCallCheck` (1)
- `async (anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:809` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Calls:**
- `Set` (2)

### `getColorDepth`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs:65` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `formatTransactionId` (1)

**Calls:**
- `performProxyObjectHas` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/input.js:5` | Self: 0.0% (0us) | Total: 0.0% (4.9ms) | Samples: 0

**Called by:**
- `anonymous` (4)

**Calls:**
- `bound require` (4)

### `node:crypto`
`node:crypto:2` | Self: 0.0% (0us) | Total: 0.0% (8.3ms) | Samples: 0

**Calls:**
- `anonymous` (5)

### `node:tls`
`node:tls:2` | Self: 0.0% (0us) | Total: 0.2% (99.1ms) | Samples: 0

**Calls:**
- `anonymous` (3)

### `toASN`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js:53` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Called by:**
- `serialize` (2)

**Calls:**
- `toAsnItem` (2)

### `getFieldName`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-name.mjs:21` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/request.js:24` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `getThreadCollabStates`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts:72` | Self: 0.0% (0us) | Total: 0.0% (29.9ms) | Samples: 0

**Called by:**
- `async getThreadCollabStates` (27)

**Calls:**
- `Map` (17)
- `map` (10)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/certificate_choices.js:8` | Self: 0.0% (0us) | Total: 0.0% (8.6ms) | Samples: 0

**Called by:**
- `anonymous` (7)

**Calls:**
- `bound require` (7)

### `async updateUser`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:627` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async (anonymous)` (1)

### `binary`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js:27` | Self: 0.0% (0us) | Total: 0.0% (12.4ms) | Samples: 0

**Called by:**
- `map` (10)

**Calls:**
- `parseValueBinaryOperation` (7)
- `parseValueBinaryOperation` (1)
- `ExpressionWrapper` (1)
- `create` (1)

### `release`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authLifetimeLock.ts:61` | Self: 0.0% (0us) | Total: 0.0% (995us) | Samples: 0

**Called by:**
- `exit` (1)

**Calls:**
- `fsyncSync` (1)

### `accountRuntimeProbesSettled`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:171` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `async getAccountDb` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/node.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/account.mjs:120` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `bound optional` (1)

### `bound clone`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `meta` (1)

**Calls:**
- `clone` (1)

### `toBER`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1511` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `toBER` (2)

**Calls:**
- `toBER` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/middleware.mjs:15` | Self: 0.0% (0us) | Total: 0.0% (11.8ms) | Samples: 0

**Calls:**
- `async (anonymous)` (2)
- `async (anonymous)` (2)
- `async (anonymous)` (1)
- `async (anonymous)` (1)
- `async (anonymous)` (1)
- `async (anonymous)` (1)
- `async (anonymous)` (1)

### `getTopicSuggestionSignalsForThreadsFromDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:192` | Self: 0.0% (0us) | Total: 0.1% (43.3ms) | Samples: 0

**Called by:**
- `(anonymous)` (38)

**Calls:**
- `(anonymous)` (38)

### `async dispatchAuthEndpoint`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:187` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `createWithSpan` (1)

### `initAccountSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:992` | Self: 0.0% (0us) | Total: 0.0% (31.6ms) | Samples: 0

**Called by:**
- `async withDbWriteRetry` (27)

**Calls:**
- `transaction` (25)
- `transaction` (2)

### `headers`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/headers.js:110` | Self: 0.0% (0us) | Total: 0.0% (6.5ms) | Samples: 0

**Called by:**
- `async (anonymous)` (6)

**Calls:**
- `throwForMissingRequestStore` (6)

### `rebuildThreadSignalsForThreadIdsInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:85` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async rebuildThreadSignalsForThreadIds` (1)

**Calls:**
- `join` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/factories/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async rebuildThreadSignalsForThreadIds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:114` | Self: 0.0% (0us) | Total: 15.6% (5.79s) | Samples: 0

**Calls:**
- `rebuildThreadSignalsForThreadIdsInternal` (1834)
- `rebuildThreadSignalsForThreadIdsInternal` (74)
- `rebuildThreadSignalsForThreadIdsInternal` (43)
- `rebuildThreadSignalsForThreadIdsInternal` (5)
- `rebuildThreadSignalsForThreadIdsInternal` (4)
- `rebuildThreadSignalsForThreadIdsInternal` (3)
- `rebuildThreadSignalsForThreadIdsInternal` (1)
- `rebuildThreadSignalsForThreadIdsInternal` (1)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:53` | Self: 0.0% (0us) | Total: 0.0% (7.6ms) | Samples: 0

**Calls:**
- `get` (3)
- `push` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/input.js:3` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:3800` | Self: 0.0% (0us) | Total: 0.0% (4.6ms) | Samples: 0

**Called by:**
- `webpackUniversalModuleDefinition` (2)

**Calls:**
- `(anonymous)` (1)
- `(anonymous)` (1)

### `bound visitSchemableIdentifier`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (5.1ms) | Samples: 0

**Called by:**
- `visitNode` (2)

**Calls:**
- `visitSchemableIdentifier` (2)

### `createBetterAuth`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/auth/base.mjs:21` | Self: 0.0% (0us) | Total: 0.0% (3.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `getEndpoints` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/kek_recipient_info.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:220` | Self: 0.0% (0us) | Total: 0.0% (4.7ms) | Samples: 0

**Calls:**
- `reduce` (3)
- `(anonymous)` (1)

### `extractJiraProjectKeys`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:40` | Self: 0.0% (0us) | Total: 0.0% (7.5ms) | Samples: 0

**Called by:**
- `collectTopicSignalEntries` (6)

**Calls:**
- `forEach` (6)

### `async delete`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:599` | Self: 0.0% (0us) | Total: 0.0% (981us) | Samples: 0

**Called by:**
- `async delete` (1)

**Calls:**
- `convertWhereClause` (1)

### `getCodec`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/lib/index.js:102` | Self: 0.0% (0us) | Total: 0.0% (5.5ms) | Samples: 0

**Called by:**
- `(anonymous)` (5)

**Calls:**
- `DBCSCodec` (3)
- `DBCSCodec` (1)
- `DBCSCodec` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:364` | Self: 0.0% (0us) | Total: 0.0% (4.3ms) | Samples: 0

**Calls:**
- `copyDataProperties` (2)

### `rebuildThreadSignalsForThreadIdsInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:86` | Self: 0.0% (0us) | Total: 0.4% (165.5ms) | Samples: 0

**Called by:**
- `async rebuildThreadSignalsForThreadIds` (74)

**Calls:**
- `(anonymous)` (74)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:35` | Self: 0.0% (0us) | Total: 0.0% (10.6ms) | Samples: 0

**Calls:**
- `bound require` (9)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testAuthHarness.ts:166` | Self: 0.0% (0us) | Total: 0.4% (182.1ms) | Samples: 0

**Calls:**
- `async withDbWriteRetry` (1)

### `toBER`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:953` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `write` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:713` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `internal:streams/duplex`
`internal:streams/duplex:2` | Self: 0.0% (0us) | Total: 0.0% (8.3ms) | Samples: 0

**Called by:**
- `anonymous` (5)

**Calls:**
- `anonymous` (5)

### `node:_http_agent`
`node:_http_agent:8` | Self: 0.0% (0us) | Total: 0.0% (7.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `anonymous` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/key_agree_recipient_info.js:10` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@zone-eu/mailsplit/index.js:3` | Self: 0.0% (0us) | Total: 0.0% (3.7ms) | Samples: 0

**Calls:**
- `bound require` (2)

### `runCipher`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_arx.js:113` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `chachaCore` (1)

### `async findMany`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:654` | Self: 0.0% (0us) | Total: 0.0% (967us) | Samples: 0

**Called by:**
- `async deleteWithHooks` (1)

**Calls:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async requireActiveUserSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:68` | Self: 0.0% (0us) | Total: 0.0% (5.6ms) | Samples: 0

**Calls:**
- `async (anonymous)` (5)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/terminal-highlight.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async getMessageCalendarInviteDataByMessageId`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:165` | Self: 0.0% (0us) | Total: 0.0% (32.8ms) | Samples: 0

**Called by:**
- `async listThreads` (29)

**Calls:**
- `map` (14)
- `Set` (9)
- `filter` (6)

### `async enrichMessagesWithThreadTopics`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts:40` | Self: 0.0% (0us) | Total: 0.0% (4.4ms) | Samples: 0

**Calls:**
- `filter` (4)

### `applyInviteUidQueryFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:786` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async listThreads` (1)

**Calls:**
- `normalizeCalendarEventUidKeys` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2468` | Self: 0.0% (0us) | Total: 0.0% (31.0ms) | Samples: 0

**Calls:**
- `(anonymous)` (27)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/outboundWrite.ts:28` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/source-map-js/source-map.js:8` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `bound visitFrom`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (34.1ms) | Samples: 0

**Called by:**
- `visitNode` (11)

**Calls:**
- `visitFrom` (11)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accounts.ts:116` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async withDbWriteRetry` (1)

**Calls:**
- `async (anonymous)` (1)

### `dlopen`
`bun:ffi:155` | Self: 0.0% (0us) | Total: 0.0% (998us) | Samples: 0

**Called by:**
- `async acquireAuthLifetimeLock` (1)

**Calls:**
- `dlopen` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:89` | Self: 0.0% (0us) | Total: 0.1% (72.5ms) | Samples: 0

**Calls:**
- `async enrichMessagesWithThreadTopics` (64)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/lazy-result.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `every`
`[native code]` | Self: 0.0% (0us) | Total: 0.4% (148.8ms) | Samples: 0

**Called by:**
- `normalizeIdentityEmail` (123)
- `shardWriterGuardsInstalled` (2)
- `migrate` (2)
- `ensureAccountKeySchema` (2)
- `ensureThreadCollabRuntimeSchema` (1)
- `assertCompleteShardFormat` (1)

**Calls:**
- `(anonymous)` (123)
- `(anonymous)` (5)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `RsaSaPssParams`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/rsassa_pss.js:17` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `async createAuthContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/create-context.mjs:133` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Calls:**
- `getBetterAuthVersion` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:846` | Self: 0.0% (0us) | Total: 0.0% (3.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (2)

**Calls:**
- `ensureMasterTeamColumns` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/picocolors/picocolors.js:4` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `(anonymous)` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:208` | Self: 0.0% (0us) | Total: 0.0% (1.5ms) | Samples: 0

**Called by:**
- `__importStar` (1)

**Calls:**
- `getOwnPropertyDescriptor` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:22` | Self: 0.0% (0us) | Total: 0.0% (2.8ms) | Samples: 0

**Called by:**
- `async makeSignature` (1)

**Calls:**
- `async getCryptoKey` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:29` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (23.0ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `parseCookies`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/cookie-utils.mjs:163` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `getChunkedCookie` (1)

**Calls:**
- `trimOWS` (1)

### `rebuildAllThreadSignalsForAccountInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:130` | Self: 0.0% (0us) | Total: 0.0% (20.3ms) | Samples: 0

**Called by:**
- `async rebuildAllThreadSignalsForAccount` (18)

**Calls:**
- `(anonymous)` (18)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/converters.js:9` | Self: 0.0% (0us) | Total: 0.0% (2.7ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/ua-parser-js/ua-parser.js:1` | Self: 0.0% (0us) | Total: 0.0% (4.8ms) | Samples: 0

**Called by:**
- `anonymous` (2)
- `(anonymous)` (2)

**Calls:**
- `__nccwpck_require__` (2)
- `(anonymous)` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/recipient_info.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/index.js:7` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:2159` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:14` | Self: 0.0% (0us) | Total: 0.0% (6.9ms) | Samples: 0

**Calls:**
- `parseCookies` (1)
- `parseCookies` (1)
- `parseCookies` (1)
- `parseCookies` (1)
- `parseCookies` (1)
- `parseCookies` (1)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1346` | Self: 0.0% (0us) | Total: 0.0% (3.6ms) | Samples: 0

**Calls:**
- `applyExcludedFolderFilters` (2)
- `applyExcludedFolderFilters` (1)

### `internal:validators`
`internal:validators:2` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `anonymous` (1)

### `async readAuthJson`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/readAuthJson.ts:30` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async readAuthJson` (1)

### `admin`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/admin.mjs:81` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `noctuaAuthOptions` (1)

**Calls:**
- `removeUser` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/storage.js:4` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `setHeader`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:27` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `set` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/fromJSON.js:6` | Self: 0.0% (0us) | Total: 0.0% (7.3ms) | Samples: 0

**Called by:**
- `anonymous` (6)

**Calls:**
- `bound require` (6)

### `visitBinaryOperation`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:1151` | Self: 0.0% (0us) | Total: 0.0% (1.4ms) | Samples: 0

**Called by:**
- `bound visitBinaryOperation` (1)

**Calls:**
- `visitNode` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/originator_info.js:7` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-id-field.mjs:56` | Self: 0.0% (0us) | Total: 0.0% (3.7ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `copyDataProperties` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/socks/build/index.js:17` | Self: 0.0% (0us) | Total: 0.0% (11.0ms) | Samples: 0

**Calls:**
- `bound require` (8)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:182` | Self: 0.0% (0us) | Total: 0.0% (4.2ms) | Samples: 0

**Calls:**
- `async get` (2)
- `async get` (1)

### `rebuildThreadSignalsForThreadIdsInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:101` | Self: 0.0% (0us) | Total: 0.1% (50.6ms) | Samples: 0

**Called by:**
- `async rebuildThreadSignalsForThreadIds` (43)

**Calls:**
- `(anonymous)` (43)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv4.js:599` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `map` (1)

**Calls:**
- `Address4` (1)

### `LinkifyIt`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:341` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `LinkifyIt` (1)

### `topicSuggestionEntriesFromThreadSignalRows`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:161` | Self: 0.0% (0us) | Total: 10.5% (3.89s) | Samples: 0

**Called by:**
- `flush` (3376)

**Calls:**
- `flatMap` (3376)

### `visitSelectQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:68` | Self: 0.0% (0us) | Total: 0.0% (15.1ms) | Samples: 0

**Called by:**
- `bound visitSelectQuery` (6)

**Calls:**
- `compileList` (5)
- `compileList` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:40` | Self: 0.0% (0us) | Total: 0.0% (7.5ms) | Samples: 0

**Called by:**
- `async (anonymous)` (7)

**Calls:**
- `async getSignedCookie` (7)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_arx.js:210` | Self: 0.0% (0us) | Total: 0.0% (3.9ms) | Samples: 0

**Called by:**
- `computeTag` (2)
- `encrypt` (1)

**Calls:**
- `hchacha` (2)
- `hchacha` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/session-store.mjs:174` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `object` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/lib/index.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `__exportStar`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:203` | Self: 0.0% (0us) | Total: 0.0% (2.6ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:162` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `rebuildThreadSignalsForThreadIdsInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:105` | Self: 0.0% (0us) | Total: 15.0% (5.56s) | Samples: 0

**Called by:**
- `async rebuildThreadSignalsForThreadIds` (1834)

**Calls:**
- `insertThreadSignalsFromMessageRows` (1830)
- `insertThreadSignalsFromMessageRows` (4)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:228` | Self: 0.0% (0us) | Total: 0.0% (6.0ms) | Samples: 0

**Called by:**
- `map` (4)

**Calls:**
- `(anonymous)` (2)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:866` | Self: 0.0% (0us) | Total: 0.0% (1.8ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `ensureInviteIssuerSchema` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/certificate_list.js:7` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1359` | Self: 0.0% (0us) | Total: 1.8% (683.9ms) | Samples: 0

**Calls:**
- `(anonymous)` (590)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/lazy-result.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:387` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Calls:**
- `ensureSenderIdentityMessageRuntimeSchema` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/index.js:14` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `bound visitAlias`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (34.1ms) | Samples: 0

**Called by:**
- `visitNode` (11)

**Calls:**
- `visitAlias` (11)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/after/after.js:11` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/rsaes_oaep.js:28` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `__decorate` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/rsaes_oaep.js:44` | Self: 0.0% (0us) | Total: 0.0% (4.2ms) | Samples: 0

**Called by:**
- `anonymous` (4)

**Calls:**
- `serialize` (4)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-ecc/build/cjs/index.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:45` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `forEach` (1)

**Calls:**
- `defineProperty` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/converters.js:7` | Self: 0.0% (0us) | Total: 0.0% (9.3ms) | Samples: 0

**Called by:**
- `anonymous` (8)

**Calls:**
- `bound require` (8)

### `async recomputeThreadsForAccountInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:318` | Self: 0.0% (0us) | Total: 0.7% (279.8ms) | Samples: 0

**Calls:**
- `(anonymous)` (216)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2258` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `applyAddressSearchFilters` (1)

### `createSelectAllFromTable`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/selection-node.js:27` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `parseSelectAll` (1)

**Calls:**
- `createSelectAll` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2455` | Self: 0.0% (0us) | Total: 0.0% (20.3ms) | Samples: 0

**Calls:**
- `(anonymous)` (17)
- `(anonymous)` (1)

### `async verifyTwoFactor`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/verify-two-factor.mjs:115` | Self: 0.0% (0us) | Total: 0.0% (4.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `async verifyTwoFactor` (1)
- `async verifyTwoFactor` (1)

### `getTopicSuggestionsForThreadSignalBatch`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:617` | Self: 0.0% (0us) | Total: 0.3% (129.3ms) | Samples: 0

**Called by:**
- `async withAccountDb` (111)

**Calls:**
- `forEach` (111)

### `buildSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-schema.mjs:10` | Self: 0.0% (0us) | Total: 0.0% (3.0ms) | Samples: 0

**Called by:**
- `async getMigrations` (2)

**Calls:**
- `getAuthTablesWithResolvedIndexes` (1)
- `getAuthTablesWithResolvedIndexes` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:51` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `loadNextHeadersModule` (1)

### `convertWhereClause`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:373` | Self: 0.0% (0us) | Total: 0.0% (2.9ms) | Samples: 0

**Called by:**
- `async findOne` (2)
- `async delete` (1)

**Calls:**
- `forEach` (3)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/generated/decode-data-html.js:4` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (2)

**Calls:**
- `decodeTrieDict` (1)
- `decodeTrieDict` (1)

### `async runMigrations`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:669` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async runMigrations` (1)

**Calls:**
- `async execute` (1)

### `loadServerDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/serverDb.ts:7` | Self: 0.0% (0us) | Total: 0.0% (18.3ms) | Samples: 0

**Called by:**
- `async getAccountById` (9)
- `async getUserById` (5)

**Calls:**
- `importModule` (14)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema/shared.mjs:4` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `_string` (1)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:55` | Self: 0.0% (0us) | Total: 0.0% (991us) | Samples: 0

**Calls:**
- `async upsertMessages` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/rsaes_oaep.js:8` | Self: 0.0% (0us) | Total: 0.0% (3.1ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `bound require` (3)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:593` | Self: 0.0% (0us) | Total: 0.0% (12.8ms) | Samples: 0

**Calls:**
- `async transformOutput` (10)
- `async transformOutput` (1)

### `Channel`
`node:diagnostics_channel:108` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `channel` (1)

**Calls:**
- `set` (1)

### `isFreeMailDomain`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/senderIdentity.ts:271` | Self: 0.0% (0us) | Total: 0.1% (58.2ms) | Samples: 0

**Called by:**
- `shouldIgnoreTopicSuggestionSignal` (46)
- `shouldIgnoreTopicSuggestionSignal` (4)

**Calls:**
- `normalizeEmailAddress` (50)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/react/cjs/react.development.js:1329` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/ftsIdentity.ts:20` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `every` (1)

**Calls:**
- `(anonymous)` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:886` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:158` | Self: 0.0% (0us) | Total: 0.0% (1.9ms) | Samples: 0

**Called by:**
- `transaction` (1)

**Calls:**
- `ensureTableColumns` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema/shared.mjs:3` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Calls:**
- `object` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:9` | Self: 0.0% (0us) | Total: 0.0% (6.5ms) | Samples: 0

**Called by:**
- `async getCryptoKey` (6)

**Calls:**
- `importKey` (6)

### `async ensureCalendarEventRuntimeData`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:668` | Self: 0.0% (0us) | Total: 0.0% (3.4ms) | Samples: 0

**Calls:**
- `ensureCalendarEventOptionalColumns` (1)
- `ensureCalendarEventOptionalColumns` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/authority_information_access.js:7` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async acquireConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:34` | Self: 0.0% (0us) | Total: 0.0% (2.9ms) | Samples: 0

**Called by:**
- `async acquireConnection` (2)

**Calls:**
- `async lock` (2)

### `visitReference`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:291` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `bound visitReference` (1)

**Calls:**
- `visitNode` (1)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1301` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `applyVisibleMessageFilters` (1)

### `internal:streams/lazy_transform`
`internal:streams/lazy_transform:2` | Self: 0.0% (0us) | Total: 0.0% (8.3ms) | Samples: 0

**Called by:**
- `anonymous` (5)

**Calls:**
- `anonymous` (5)

### `where`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:38` | Self: 0.0% (0us) | Total: 0.1% (51.4ms) | Samples: 0

**Called by:**
- `(anonymous)` (21)
- `(anonymous)` (1)
- `async getTables` (1)

**Calls:**
- `parseExpression` (17)
- `parseValueBinaryOperationOrExpression` (2)
- `cloneWithWhere` (1)
- `parseExpression` (1)
- `parseValueBinaryOperation` (1)
- `cloneWithWhere` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/tbs_certificate.js:10` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async findMany`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:570` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (2)

**Calls:**
- `async findMany` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/mailboxSummary.ts:50` | Self: 0.0% (0us) | Total: 0.0% (9.9ms) | Samples: 0

**Calls:**
- `(anonymous)` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema/account.mjs:4` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `bound extend` (1)

### `where`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/update-query-builder.js:25` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async update` (1)

**Calls:**
- `parseExpression` (1)

### `own`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:745` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `defineProperty` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv6.js:1454` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `map` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/index.js:16` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `async releaseConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:66` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async releaseConnection` (1)

**Calls:**
- `async releaseConnection` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/tools.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async rebuildAllThreadSignalsForAccount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:136` | Self: 0.0% (0us) | Total: 4.9% (1.85s) | Samples: 0

**Calls:**
- `rebuildAllThreadSignalsForAccountInternal` (958)
- `rebuildAllThreadSignalsForAccountInternal` (18)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:152` | Self: 0.0% (0us) | Total: 0.0% (993us) | Samples: 0

**Calls:**
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:496` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `async deleteSession` (1)

**Calls:**
- `async deleteWithHooks` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/encode.js:103` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1352` | Self: 0.0% (0us) | Total: 0.0% (17.8ms) | Samples: 0

**Calls:**
- `(anonymous)` (13)
- `(anonymous)` (1)

### `initAccountSchemaBody`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:1377` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `transaction` (2)

**Calls:**
- `(anonymous)` (2)

### `ensureTableColumns`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:147` | Self: 0.0% (0us) | Total: 0.0% (2.9ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@zone-eu/mailsplit/lib/flowed-decoder.js:6` | Self: 0.0% (0us) | Total: 0.1% (52.0ms) | Samples: 0

**Calls:**
- `bound require` (41)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:105` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `some` (2)

### `applyBadgeFilters`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:837` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async getTotalCount` (1)

**Calls:**
- `toLowerCase` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/source-map-js/source-map.js:7` | Self: 0.0% (0us) | Total: 0.0% (1.6ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/providers/index.js:3` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/tools.js:8` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `bound require` (3)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sanitize-html/node_modules/htmlparser2/node_modules/domutils/node_modules/dom-serializer/dist/foreign-names.js:14` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `map` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js:8` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Calls:**
- `bound require` (2)

### `getColorDepth`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs:57` | Self: 0.0% (0us) | Total: 0.0% (11.5ms) | Samples: 0

**Called by:**
- `formatTransactionId` (1)

**Calls:**
- `getEnvVar` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:152` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:155` | Self: 0.0% (0us) | Total: 0.0% (3.2ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `bound require` (3)

### `listSenderIdentityRows`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/senderIdentities.ts:12` | Self: 0.0% (0us) | Total: 0.2% (88.1ms) | Samples: 0

**Called by:**
- `async getAccountById` (64)
- `async getAccountOwnAddresses` (8)

**Calls:**
- `(anonymous)` (71)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:376` | Self: 0.0% (0us) | Total: 0.0% (1.9ms) | Samples: 0

**Called by:**
- `forEach` (2)

**Calls:**
- `getFieldName` (1)
- `getFieldName` (1)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:403` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Calls:**
- `accountRuntimeProbesSettled` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:70` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `async (anonymous)` (1)
- `async (anonymous)` (1)

### `backfillCalendarReminderEventUidKeys`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:1440` | Self: 0.0% (0us) | Total: 0.0% (945us) | Samples: 0

**Called by:**
- `ensureCalendarReminderOptionalColumns` (1)

**Calls:**
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs:51` | Self: 0.0% (0us) | Total: 0.0% (5.8ms) | Samples: 0

**Called by:**
- `async (anonymous)` (4)

**Calls:**
- `async hasRequestState` (4)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:245` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `async deleteWithHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/with-hooks.mjs:137` | Self: 0.0% (0us) | Total: 0.0% (2.7ms) | Samples: 0

**Calls:**
- `async delete` (1)
- `async getCurrentAdapter` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/postcss.js:3` | Self: 0.0% (0us) | Total: 0.0% (9.9ms) | Samples: 0

**Called by:**
- `anonymous` (8)

**Calls:**
- `bound require` (8)

### `getColorDepth`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs:66` | Self: 0.0% (0us) | Total: 0.4% (161.4ms) | Samples: 0

**Called by:**
- `formatTransactionId` (1)

**Calls:**
- `getEnvVar` (1)

### `async createAuthContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/create-context.mjs:90` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async createAuthContext` (1)

**Calls:**
- `checkEndpointConflicts` (1)

### `buildTimeGroupKey`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageGrouping.ts:43` | Self: 0.0% (0us) | Total: 2.2% (825.5ms) | Samples: 0

**Called by:**
- `buildMessageGroupKey` (691)
- `(anonymous)` (21)

**Calls:**
- `displayDayNumber` (550)
- `displayDayNumber` (99)
- `displayDayNumber` (57)
- `displayDayNumber` (6)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:158` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/lib/index.js:3` | Self: 0.0% (0us) | Total: 0.0% (940us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async signCookieValue`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:30` | Self: 0.0% (0us) | Total: 0.0% (2.8ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async (anonymous)` (1)

### `async runMigrations`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:671` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async migrateAuthSchema` (1)

**Calls:**
- `async runMigrations` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/source-map-js/lib/source-map-generator.js:10` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/pino.js:4` | Self: 0.0% (0us) | Total: 0.0% (3.2ms) | Samples: 0

**Calls:**
- `bound require` (2)

### `async getThreadCollabStates`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/threadCollab.ts:44` | Self: 0.0% (0us) | Total: 0.5% (209.1ms) | Samples: 0

**Called by:**
- `async enrichMessagesWithThreadCollab` (4)
- `async getThreadCollabStates` (3)

**Calls:**
- `getThreadCollabStates` (99)
- `getThreadCollabStates` (31)
- `getThreadCollabStates` (27)
- `getThreadCollabStates` (15)
- `async getAccountDb` (3)
- `async getThreadCollabStates` (3)
- `getThreadCollabStates` (3)
- `async getThreadCollabStates` (1)
- `getThreadCollabStates` (1)

### `transformJoinClause`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:288` | Self: 0.0% (0us) | Total: 0.0% (18.0ms) | Samples: 0

**Called by:**
- `async (anonymous)` (14)

**Calls:**
- `entries` (12)
- `filter` (2)

### `async POST`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/auth/switch-account/route.ts:8` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async POST` (1)

**Calls:**
- `requireJsonSameOrigin` (1)

### `createHasher`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/utils.js:632` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `(anonymous)` (1)

### `getThreadCollabStates`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts:75` | Self: 0.0% (0us) | Total: 0.1% (37.2ms) | Samples: 0

**Called by:**
- `async getThreadCollabStates` (31)

**Calls:**
- `(anonymous)` (31)

### `async getDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:313` | Self: 0.0% (0us) | Total: 0.2% (102.6ms) | Samples: 0

**Calls:**
- `async withDbWriteRetry` (35)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/headers.js:11` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/index.js:10` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:8` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async getDatabaseIndexMap`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:239` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async getMigrations` (1)

**Calls:**
- `async getDatabaseIndexMap` (1)

### `channel`
`node:diagnostics_channel:141` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `node:_http_client` (1)

**Calls:**
- `Channel` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2495` | Self: 0.0% (0us) | Total: 0.0% (4.4ms) | Samples: 0

**Calls:**
- `map` (4)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1088` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `init` (2)

**Calls:**
- `init` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/parser.js:9` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `loadManualCategoryStatesForMessageIds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:303` | Self: 0.0% (0us) | Total: 0.0% (5.8ms) | Samples: 0

**Called by:**
- `async (anonymous)` (5)

**Calls:**
- `map` (3)
- `Set` (2)

### `buildMeaningfulAttachmentExistsSql`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:954` | Self: 0.0% (0us) | Total: 0.0% (4.1ms) | Samples: 0

**Called by:**
- `async listThreads` (3)

**Calls:**
- `buildMeaningfulAttachmentPredicateSql` (2)
- `buildMeaningfulAttachmentPredicateSql` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/legacy/index.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/mailparser/dist/esm/mail-parser.js:40` | Self: 0.0% (0us) | Total: 0.0% (1.9ms) | Samples: 0

**Calls:**
- `tlds` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/rsassa_pss.js:13` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `RsaSaPssParams` (1)

**Calls:**
- `serialize` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/authPolicy.ts:249` | Self: 0.0% (0us) | Total: 0.0% (972us) | Samples: 0

**Called by:**
- `transaction` (1)

**Calls:**
- `(anonymous)` (1)

### `ensureThreadCollabRuntimeSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:919` | Self: 0.0% (0us) | Total: 0.0% (944us) | Samples: 0

**Called by:**
- `initAccountSchemaBody` (1)

**Calls:**
- `(anonymous)` (1)

### `get`
`/tmp/spike-switch-server/inspect.ts:11` | Self: 0.0% (0us) | Total: 0.0% (7.3ms) | Samples: 0

**Called by:**
- `(module)` (6)

**Calls:**
- `Request` (6)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/checks.js:290` | Self: 0.0% (0us) | Total: 0.0% (1.4ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:360` | Self: 0.0% (0us) | Total: 0.0% (2.9ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/charset.js:28` | Self: 0.0% (0us) | Total: 0.0% (5.6ms) | Samples: 0

**Called by:**
- `anonymous` (5)

**Calls:**
- `map` (5)

### `visitSelection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:123` | Self: 0.0% (0us) | Total: 0.0% (14.0ms) | Samples: 0

**Called by:**
- `bound visitSelection` (5)

**Calls:**
- `visitNode` (5)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/at-rule.js:3` | Self: 0.0% (0us) | Total: 0.0% (8.1ms) | Samples: 0

**Called by:**
- `anonymous` (7)

**Calls:**
- `bound require` (7)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1200` | Self: 0.0% (0us) | Total: 0.0% (969us) | Samples: 0

**Called by:**
- `validate` (1)

**Calls:**
- `get value` (1)

### `digest`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_poly1305.js:296` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `computeTag` (1)

**Calls:**
- `digestInto` (1)

### `parse`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv4.js:116` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `Address4` (1)

**Calls:**
- `some` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:837` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `compile`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:247` | Self: 0.0% (0us) | Total: 0.0% (981us) | Samples: 0

**Called by:**
- `tlds` (1)

**Calls:**
- `get source` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:52` | Self: 0.0% (0us) | Total: 0.0% (7.7ms) | Samples: 0

**Calls:**
- `headers` (6)
- `headers` (1)

### `createLogger`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/logger.mjs:59` | Self: 0.0% (0us) | Total: 0.1% (57.9ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `getColorDepth` (1)

### `async ensureCalendarEventRuntimeData`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:672` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `backfillEmailCalendarEventParticipation` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/dom-serializer/node_modules/entities/lib/esm/generated/encode-html.js:9` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `restoreDiff` (1)

### `getDbTableColumns`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:110` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `ensureCalendarEventOptionalColumns` (1)

**Calls:**
- `wrapStatement` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/index.js:8` | Self: 0.0% (0us) | Total: 0.0% (1.7ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:620` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `forEach` (1)

**Calls:**
- `get` (1)

### `compile`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:154` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `tlds` (1)

**Calls:**
- `RegExp` (1)

### `async findSchemaProblems`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:253` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async findSchemaProblems` (1)

**Calls:**
- `flatIntoArrayWithCallback` (1)

### `localFromBER`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1438` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `localFromBERWithChildContext` (1)
- `toASN` (1)

**Calls:**
- `fromBER` (1)
- `fromBER` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:245` | Self: 0.0% (0us) | Total: 0.0% (26.4ms) | Samples: 0

**Calls:**
- `async runAfterHooks` (11)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/dependency-container.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_arx.js:237` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `decrypt` (1)

**Calls:**
- `runCipher` (1)

### `assertCompleteShardFormat`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:76` | Self: 0.0% (0us) | Total: 0.0% (5.7ms) | Samples: 0

**Called by:**
- `ensureAccountKeySchema` (3)
- `initAccountSchema` (2)

**Calls:**
- `shardWriterGuardsInstalled` (2)
- `shardWriterGuardsInstalled` (1)
- `shardWriterGuardsInstalled` (1)
- `every` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/mailparser/dist/esm/mail-parser.js:38` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `LinkifyIt` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2304` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `applyInviteUidQueryFilters` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:513` | Self: 0.0% (0us) | Total: 0.4% (170.2ms) | Samples: 0

**Called by:**
- `parseAliasedExpression` (2)

**Calls:**
- `selectAll` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:256` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `prepareFtsIdentityWriter` (1)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:71` | Self: 0.0% (0us) | Total: 0.0% (4.7ms) | Samples: 0

**Calls:**
- `async withDbWriteRetry` (2)

### `pruneThreadTopicsWithoutMessages`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:181` | Self: 0.0% (0us) | Total: 0.0% (3.6ms) | Samples: 0

**Called by:**
- `async (anonymous)` (3)

**Calls:**
- `(anonymous)` (3)

### `async enrichMessagesWithThreadTopics`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts:44` | Self: 0.0% (0us) | Total: 0.0% (14.6ms) | Samples: 0

**Calls:**
- `async getTopicSuggestionsForThreads` (12)
- `async getTopicSuggestionsForThreads` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:850` | Self: 0.0% (0us) | Total: 0.0% (3.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `initAccountSchemaBody`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:1004` | Self: 0.0% (0us) | Total: 0.0% (5.8ms) | Samples: 0

**Called by:**
- `transaction` (5)

**Calls:**
- `(anonymous)` (5)

### `fromString`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:2411` | Self: 0.0% (0us) | Total: 0.0% (968us) | Samples: 0

**Called by:**
- `LocalObjectIdentifierValueBlock` (1)

**Calls:**
- `LocalSidValueBlock` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/mailparser/dist/esm/mail-parser.js:53` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `add` (1)

### `buildMeaningfulAttachmentPredicateSql`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:942` | Self: 0.0% (0us) | Total: 0.0% (1.4ms) | Samples: 0

**Called by:**
- `buildMeaningfulAttachmentExistsSql` (1)

**Calls:**
- `buildSqlContainsAny` (1)

### `toASN`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js:27` | Self: 0.0% (0us) | Total: 0.0% (975us) | Samples: 0

**Called by:**
- `serialize` (1)

**Calls:**
- `cache` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:10` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `ensureThreadCollabRuntimeSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:921` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `initAccountSchemaBody` (1)

**Calls:**
- `every` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/index.js:22` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/source-map-js/source-map.js:6` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:2009` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `getEnumValues` (1)

### `async setSessionCookie`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/index.mjs:172` | Self: 0.0% (0us) | Total: 0.0% (2.8ms) | Samples: 0

**Calls:**
- `async setSignedCookie` (1)

### `async handleFallbackJoin`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:395` | Self: 0.0% (0us) | Total: 0.3% (139.8ms) | Samples: 0

**Called by:**
- `async (anonymous)` (43)

**Calls:**
- `async (anonymous)` (30)
- `async (anonymous)` (6)
- `async (anonymous)` (3)
- `async (anonymous)` (2)
- `async (anonymous)` (1)
- `async (anonymous)` (1)

### `cloneWithWhere`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/query-node.js:37` | Self: 0.0% (0us) | Total: 0.0% (9.3ms) | Samples: 0

**Called by:**
- `where` (1)

**Calls:**
- `create` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:565` | Self: 0.0% (0us) | Total: 0.0% (33.4ms) | Samples: 0

**Called by:**
- `async findOne` (23)

**Calls:**
- `transformJoinClause` (14)
- `transformJoinClause` (3)
- `transformJoinClause` (2)
- `transformJoinClause` (2)
- `transformJoinClause` (1)
- `transformJoinClause` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/next-url.js:11` | Self: 0.0% (0us) | Total: 0.0% (1.4ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/transport.js:10` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async recomputeThreadsForAccountInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:283` | Self: 0.0% (0us) | Total: 0.2% (100.3ms) | Samples: 0

**Calls:**
- `(anonymous)` (12)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/api/index.mjs:59` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async (anonymous)` (1)

### `async createWithHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/with-hooks.mjs:26` | Self: 0.0% (0us) | Total: 0.4% (163.7ms) | Samples: 0

**Calls:**
- `async create` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:41` | Self: 0.0% (0us) | Total: 0.0% (7.5ms) | Samples: 0

**Called by:**
- `forEach` (6)

**Calls:**
- `looksLikeJiraMessage` (4)
- `looksLikeJiraMessage` (1)
- `looksLikeJiraMessage` (1)

### `query`
`bun:sqlite:386` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `[prepareOwned]` (1)

### `parseSearchInput`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:686` | Self: 0.0% (0us) | Total: 0.0% (930us) | Samples: 0

**Called by:**
- `async getTotalCount` (1)

**Calls:**
- `buildScopedFtsTokenQueries` (1)

### `async stageMessageFiles`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/storage.ts:264` | Self: 0.0% (0us) | Total: 0.0% (3.0ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `async stageMessageFiles` (1)
- `async stageMessageFiles` (1)

### `resolveAccountRoleRow`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accountAccess.ts:11` | Self: 0.0% (0us) | Total: 0.0% (10.7ms) | Samples: 0

**Called by:**
- `async resolveAccountRole` (9)

**Calls:**
- `(anonymous)` (9)

### `internal:streams/compose`
`internal:streams/compose:2` | Self: 0.0% (0us) | Total: 0.0% (11.9ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `anonymous` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/source-map-js/lib/source-map-generator.js:8` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/index.js:9` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/converters.js:6` | Self: 0.0% (0us) | Total: 0.0% (5.6ms) | Samples: 0

**Called by:**
- `anonymous` (5)

**Calls:**
- `bound require` (5)

### `compileQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:24` | Self: 0.0% (0us) | Total: 0.2% (75.6ms) | Samples: 0

**Called by:**
- `async execute` (26)
- `async execute` (1)

**Calls:**
- `visitNode` (26)
- `visitNode` (1)

### `parseAliasedExpression`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/expression-parser.js:20` | Self: 0.0% (0us) | Total: 0.9% (338.1ms) | Samples: 0

**Called by:**
- `parseTableExpressionOrList` (70)

**Calls:**
- `(anonymous)` (25)
- `(anonymous)` (21)
- `createExpressionBuilder` (14)
- `createExpressionBuilder` (5)
- `(anonymous)` (2)
- `(anonymous)` (1)
- `createExpressionBuilder` (1)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sanitize-html/index.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:315` | Self: 0.0% (0us) | Total: 0.2% (102.6ms) | Samples: 0

**Called by:**
- `async withDbWriteRetry` (35)

**Calls:**
- `initMasterSchema` (18)
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
- `initMasterSchema` (1)

### `(module)`
`/tmp/spike-switch-server/inspect.ts:17` | Self: 0.0% (0us) | Total: 0.0% (4.7ms) | Samples: 0

**Calls:**
- `parse` (4)

### `tlds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:607` | Self: 0.0% (0us) | Total: 0.0% (1.9ms) | Samples: 0

**Called by:**
- `(module)` (2)

**Calls:**
- `compile` (1)
- `compile` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/certificate_policies.js:33` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `get` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/pino.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-ecc/build/cjs/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/auth/switch-account/route.ts:13` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async readAuthJson` (1)

### `async recomputeThreadsForAccountInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:321` | Self: 0.0% (0us) | Total: 0.0% (10.7ms) | Samples: 0

**Calls:**
- `(anonymous)` (9)

### `getTopicSuggestionSignalsForThreadsFromDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:186` | Self: 0.0% (0us) | Total: 0.1% (37.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (31)

**Calls:**
- `forEach` (31)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:56` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `_interopNamespaceDefault` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:16` | Self: 0.0% (0us) | Total: 0.0% (15.1ms) | Samples: 0

**Called by:**
- `async verifySignature` (13)

**Calls:**
- `verify` (11)
- `TextEncoder` (1)
- `encode` (1)

### `ensureAccountKeySchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accountKeys.ts:162` | Self: 0.0% (0us) | Total: 0.0% (3.3ms) | Samples: 0

**Called by:**
- `async withDbWriteRetry` (3)

**Calls:**
- `assertCompleteShardFormat` (3)

### `persistAccountRow`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:283` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `configureAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:106` | Self: 0.0% (0us) | Total: 0.0% (2.5ms) | Samples: 0

**Called by:**
- `async getAccountDb` (1)

**Calls:**
- `prepareAccountShardConnection` (1)

### `resolveAccountRoleRow`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accountAccess.ts:5` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async resolveAccountRole` (1)

**Calls:**
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:445` | Self: 0.0% (0us) | Total: 0.4% (163.7ms) | Samples: 0

**Called by:**
- `async create` (3)

**Calls:**
- `async transformInput` (2)
- `async transformInput` (1)

### `compile`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:156` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `LinkifyIt` (1)

**Calls:**
- `RegExp` (1)

### `async getMigrations`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:361` | Self: 0.0% (0us) | Total: 0.0% (2.6ms) | Samples: 0

**Calls:**
- `async getTables` (2)

### `isInstalledControlPlane`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/authPolicy.ts:222` | Self: 0.0% (0us) | Total: 0.0% (2.6ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `filter` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:273` | Self: 0.0% (0us) | Total: 0.0% (4.8ms) | Samples: 0

**Calls:**
- `noctuaAuthOptions` (2)
- `noctuaAuthOptions` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:34` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `setHeader` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/adapter-kysely.mjs:13` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/source-map-js/lib/base64-vlq.js:38` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:253` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `init` (2)

**Calls:**
- `init` (2)

### `async getAccountById`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/serverDb.ts:26` | Self: 0.0% (0us) | Total: 0.0% (10.9ms) | Samples: 0

**Called by:**
- `async requireAccountContext` (9)

**Calls:**
- `async getAccountById` (9)

### `assertSupportedShardFormat`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:9` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `shardWriterGuardsInstalled` (1)

**Calls:**
- `(anonymous)` (1)

### `compile`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:157` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `add` (1)

**Calls:**
- `RegExp` (1)

### `async execute`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/raw-builder/raw-builder.js:43` | Self: 0.0% (0us) | Total: 0.0% (1.6ms) | Samples: 0

**Called by:**
- `async sqliteGeneratedPrimaryKeyColumn` (1)

**Calls:**
- `async executeQuery` (1)

### `async internalHandler`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:52` | Self: 0.0% (0us) | Total: 0.0% (9.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (6)

**Calls:**
- `async (anonymous)` (6)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:279` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `importModule` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/decorators/index.js:17` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async findOne`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:522` | Self: 0.0% (0us) | Total: 0.2% (105.4ms) | Samples: 0

**Called by:**
- `async findOne` (38)

**Calls:**
- `async execute` (38)

### `async POST`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/auth/switch-account/route.ts:12` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `async withAuthResponse` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/organization/routes/crud-org.mjs:13` | Self: 0.0% (0us) | Total: 0.0% (1.4ms) | Samples: 0

**Calls:**
- `bound min` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/shared/lib/router/utils/get-next-pathname-info.js:11` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sonic-boom/index.js:8` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

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

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:99` | Self: 0.0% (0us) | Total: 0.0% (1.9ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/pino.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv4.js:29` | Self: 0.0% (0us) | Total: 0.0% (1.4ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/bags/index.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/charset.js:141` | Self: 0.0% (0us) | Total: 0.0% (5.5ms) | Samples: 0

**Called by:**
- `anonymous` (5)

**Calls:**
- `getCodec` (5)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/transaction.mjs:24` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `getStore` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_poly1305.js:318` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `wrapMacConstructor` (1)

**Calls:**
- `Poly1305` (1)

### `async createAuthContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/create-context.mjs:233` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `async createAuthContext` (1)
- `async createAuthContext` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:724` | Self: 0.0% (0us) | Total: 0.1% (43.3ms) | Samples: 0

**Called by:**
- `(anonymous)` (18)

**Calls:**
- `(anonymous)` (18)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:156` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `performProxyObjectHas`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (3.4ms) | Samples: 0

**Called by:**
- `getColorDepth` (1)
- `getColorDepth` (1)

**Calls:**
- `has` (2)

### `rebuildThreadSignalsForThreadIdsInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:82` | Self: 0.0% (0us) | Total: 0.0% (9.3ms) | Samples: 0

**Called by:**
- `async rebuildThreadSignalsForThreadIds` (5)

**Calls:**
- `(anonymous)` (5)

### `decryptPayload`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/secret.ts:57` | Self: 0.0% (0us) | Total: 0.0% (3.6ms) | Samples: 0

**Called by:**
- `decodeSecret` (3)

**Calls:**
- `subarray` (3)

### `visitAlias`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:282` | Self: 0.0% (0us) | Total: 0.0% (34.1ms) | Samples: 0

**Called by:**
- `bound visitAlias` (11)

**Calls:**
- `visitNode` (11)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/launder/index.js:1` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async acquireAuthLifetimeLock`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authLifetimeLock.ts:57` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `fsyncSync` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/account.mjs:314` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `_string` (1)

### `selectAll`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:128` | Self: 0.0% (0us) | Total: 0.4% (175.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (2)
- `async findOne` (2)

**Calls:**
- `cloneWithSelections` (2)
- `parseSelectAll` (1)
- `cloneWithSelections` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pkcs8/build/cjs/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `initAccountSchemaBody`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:1003` | Self: 0.0% (0us) | Total: 0.0% (4.2ms) | Samples: 0

**Called by:**
- `async withDbWriteRetry` (2)
- `transaction` (1)

**Calls:**
- `ensureThreadCollabRuntimeSchema` (1)
- `ensureThreadCollabRuntimeSchema` (1)
- `ensureThreadCollabRuntimeSchema` (1)

### `create`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/from-node.js:13` | Self: 0.0% (0us) | Total: 0.0% (33.8ms) | Samples: 0

**Called by:**
- `createFrom` (24)

**Calls:**
- `freeze` (24)

### `async runAfterHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:135` | Self: 0.0% (0us) | Total: 0.0% (26.4ms) | Samples: 0

**Called by:**
- `async (anonymous)` (11)

**Calls:**
- `async runAfterHooks` (8)
- `async runAfterHooks` (2)
- `async runAfterHooks` (1)

### `async getMessageCalendarInviteDataByMessageId`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:178` | Self: 0.0% (0us) | Total: 0.4% (150.1ms) | Samples: 0

**Called by:**
- `async listThreads` (132)

**Calls:**
- `(anonymous)` (129)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `wrapStatement` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/node.js:3` | Self: 0.0% (0us) | Total: 0.0% (4.8ms) | Samples: 0

**Called by:**
- `anonymous` (4)

**Calls:**
- `bound require` (4)

### `async serializeSignedCookie`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:84` | Self: 0.0% (0us) | Total: 0.0% (2.8ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async (anonymous)` (1)

### `Some`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:146` | Self: 0.0% (0us) | Total: 0.0% (968us) | Samples: 0

**Called by:**
- `LocalSidValueBlock` (1)

**Calls:**
- `ValueBlock` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/one-tap/index.mjs:22` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `bound optional` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2305` | Self: 0.0% (0us) | Total: 0.0% (1.9ms) | Samples: 0

**Calls:**
- `applyBadgeFilters` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/schema.js:7` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async getTables`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:70` | Self: 0.0% (0us) | Total: 0.0% (21.3ms) | Samples: 0

**Calls:**
- `map` (8)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/tbs_certificate.js:8` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/encoding-table.js:4` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `run`
`bun:sqlite:318` | Self: 0.0% (0us) | Total: 0.2% (88.8ms) | Samples: 0

**Called by:**
- `(anonymous)` (48)

**Calls:**
- `run` (48)

### `parseAddressEmails`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts:45` | Self: 0.0% (0us) | Total: 6.2% (2.30s) | Samples: 0

**Called by:**
- `isOwnAddress` (1578)
- `(anonymous)` (172)
- `flatIntoArrayWithCallback` (107)
- `(anonymous)` (62)
- `(anonymous)` (1)

**Calls:**
- `addressparser` (1246)
- `flatMap` (661)
- `addressparser` (6)
- `addressparser` (5)
- `addressparser` (2)

### `bound visitIdentifier`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (4.0ms) | Samples: 0

**Called by:**
- `visitNode` (1)

**Calls:**
- `visitIdentifier` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/encoding-convert.js:4` | Self: 0.0% (0us) | Total: 0.0% (991us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `getTopicSuggestionSignalsForThreadsFromDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:225` | Self: 0.0% (0us) | Total: 0.0% (27.3ms) | Samples: 0

**Called by:**
- `(anonymous)` (24)

**Calls:**
- `flush` (24)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:24` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async sqliteGeneratedPrimaryKeyColumn`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:30` | Self: 0.0% (0us) | Total: 0.0% (4.8ms) | Samples: 0

**Called by:**
- `async (anonymous)` (4)

**Calls:**
- `async sqliteGeneratedPrimaryKeyColumn` (3)
- `async sqliteGeneratedPrimaryKeyColumn` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/signer_identifier.js:4` | Self: 0.0% (0us) | Total: 0.0% (987us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async acquireAuthLifetimeLock`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authLifetimeLock.ts:36` | Self: 0.0% (0us) | Total: 0.0% (998us) | Samples: 0

**Calls:**
- `dlopen` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/index.js:10` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `executeQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:60` | Self: 0.0% (0us) | Total: 0.4% (166.5ms) | Samples: 0

**Called by:**
- `async (anonymous)` (57)

**Calls:**
- `(anonymous)` (53)
- `(anonymous)` (3)
- `wrapStatement` (1)

### `parseTableExpressionOrList`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/table-parser.js:13` | Self: 0.0% (0us) | Total: 0.9% (350.6ms) | Samples: 0

**Called by:**
- `selectFrom` (75)
- `selectFrom` (1)

**Calls:**
- `parseAliasedExpression` (70)
- `toOperationNode` (2)
- `parseAliasedExpression` (2)
- `parseTable` (1)
- `toOperationNode` (1)

### `async create`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:468` | Self: 0.0% (0us) | Total: 0.4% (163.7ms) | Samples: 0

**Called by:**
- `async createWithHooks` (3)

**Calls:**
- `async (anonymous)` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/decorators/inject-with-transform.js:3` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:37` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `getAuthTables` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/imapflow/dist/esm/charsets.js:272` | Self: 0.0% (0us) | Total: 0.0% (919us) | Samples: 0

**Calls:**
- `forEach` (1)

### `internal:fs/streams`
`internal:fs/streams:2` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `anonymous` (1)

### `getCodec`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/lib/index.js:65` | Self: 0.0% (0us) | Total: 0.0% (5.6ms) | Samples: 0

**Called by:**
- `map` (5)

**Calls:**
- `bound require` (5)

### `async requireAccountContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/accountContext.ts:59` | Self: 0.0% (0us) | Total: 0.0% (10.9ms) | Samples: 0

**Calls:**
- `async getAccountById` (9)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts:39` | Self: 0.0% (0us) | Total: 0.0% (9.2ms) | Samples: 0

**Called by:**
- `cached` (8)

**Calls:**
- `DateTimeFormat` (8)

### `migrate`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accountKeys.ts:227` | Self: 0.0% (0us) | Total: 0.0% (4.3ms) | Samples: 0

**Called by:**
- `ensureAccountKeySchema` (4)

**Calls:**
- `shardWriterGuardsInstalled` (2)
- `every` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/he/he.js:342` | Self: 0.0% (0us) | Total: 0.0% (8.3ms) | Samples: 0

**Calls:**
- `(anonymous)` (4)
- `(anonymous)` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:889` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `prepare`
`bun:sqlite:366` | Self: 0.0% (0us) | Total: 3.1% (1.16s) | Samples: 0

**Called by:**
- `(anonymous)` (899)

**Calls:**
- `prepare` (890)
- `Statement` (5)
- `Statement` (2)
- `Statement` (1)
- `Statement` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:179` | Self: 0.0% (0us) | Total: 0.0% (2.9ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:39` | Self: 0.0% (0us) | Total: 2.8% (1.03s) | Samples: 0

**Called by:**
- `async provideConnection` (129)
- `async (anonymous)` (128)

**Calls:**
- `async (anonymous)` (128)
- `executeQuery` (57)
- `executeQuery` (56)
- `executeQuery` (15)
- `async (anonymous)` (1)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:98` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async getThreadGroupCounts` (1)

**Calls:**
- `wrapStatement` (1)

### `async getSessionFromCtx`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:275` | Self: 0.0% (0us) | Total: 0.0% (2.9ms) | Samples: 0

**Called by:**
- `async verifyTwoFactor` (1)

**Calls:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/enveloped_data.js:10` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `ensureAccountKeySchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accountKeys.ts:230` | Self: 0.0% (0us) | Total: 0.0% (16.6ms) | Samples: 0

**Called by:**
- `transaction` (15)

**Calls:**
- `migrate` (8)
- `migrate` (4)
- `migrate` (2)
- `migrate` (1)

### `guardSql`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:52` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `quote` (1)

### `getThreadCollabStates`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts:71` | Self: 0.0% (0us) | Total: 0.0% (16.9ms) | Samples: 0

**Called by:**
- `async getThreadCollabStates` (15)

**Calls:**
- `Set` (15)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/index.js:10` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/css-syntax-error.js:3` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `bound require` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:1097` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:51` | Self: 0.0% (0us) | Total: 0.0% (6.1ms) | Samples: 0

**Calls:**
- `toISOString` (6)

### `async enrichMessagesWithThreadTopics`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts:29` | Self: 0.0% (0us) | Total: 0.1% (65.8ms) | Samples: 0

**Called by:**
- `async enrichMessagesWithThreadTopics` (58)

**Calls:**
- `map` (42)
- `Set` (13)
- `filter` (3)

### `getReferencePath`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:570` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `getFieldName` (1)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1337` | Self: 0.0% (0us) | Total: 0.0% (1.4ms) | Samples: 0

**Calls:**
- `applySearchQueryFilters` (1)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:60` | Self: 0.0% (0us) | Total: 0.1% (40.1ms) | Samples: 0

**Calls:**
- `transaction` (6)
- `transaction` (5)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/after/after.js:12` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `ensureCalendarReminderOptionalColumns`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:262` | Self: 0.0% (0us) | Total: 0.0% (3.6ms) | Samples: 0

**Called by:**
- `initAccountSchemaBody` (1)
- `ensureCalendarReminderRuntimeSchema` (1)

**Calls:**
- `backfillCalendarReminderEventUidKeys` (1)
- `backfillCalendarReminderEventUidKeys` (1)

### `transformJoinClause`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:317` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `getFieldName` (1)
- `getFieldName` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:36` | Self: 0.0% (0us) | Total: 0.0% (8.6ms) | Samples: 0

**Calls:**
- `bound require` (7)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/config.js:1` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `filterOutputFields`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs:8` | Self: 0.0% (0us) | Total: 0.0% (12.4ms) | Samples: 0

**Called by:**
- `async (anonymous)` (3)
- `async (anonymous)` (3)
- `async (anonymous)` (1)

**Calls:**
- `entries` (5)
- `map` (1)
- `filter` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/recipient_info.js:8` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:95` | Self: 0.0% (0us) | Total: 0.1% (73.3ms) | Samples: 0

**Calls:**
- `async enrichMessagesWithThreadCollab` (64)

### `min`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:219` | Self: 0.0% (0us) | Total: 0.0% (1.4ms) | Samples: 0

**Called by:**
- `bound min` (1)

**Calls:**
- `_minLength` (1)

### `async createAuthenticatedTestSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testAuthHarness.ts:208` | Self: 0.0% (0us) | Total: 0.0% (2.5ms) | Samples: 0

**Calls:**
- `run` (1)

### `LocalObjectIdentifierValueBlock`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:2342` | Self: 0.0% (0us) | Total: 0.0% (968us) | Samples: 0

**Called by:**
- `BaseBlock` (1)

**Calls:**
- `fromString` (1)

### `rebuildThreadSignalsForThreadIdsInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:102` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async rebuildThreadSignalsForThreadIds` (1)

**Calls:**
- `push` (1)

### `closeAccountDbConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:194` | Self: 0.0% (0us) | Total: 0.0% (3.0ms) | Samples: 0

**Called by:**
- `async buildFixture` (1)

**Calls:**
- `close` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:16` | Self: 0.0% (0us) | Total: 0.0% (10.4ms) | Samples: 0

**Calls:**
- `copyDataProperties` (4)

### `async verifyTwoFactor`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/verify-two-factor.mjs:14` | Self: 0.0% (0us) | Total: 0.0% (2.9ms) | Samples: 0

**Called by:**
- `async verifyTwoFactor` (1)

**Calls:**
- `async getSessionFromCtx` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/index.js:7` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:720` | Self: 0.0% (0us) | Total: 6.7% (2.51s) | Samples: 0

**Calls:**
- `transaction` (1842)
- `transaction` (160)
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs:44` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Calls:**
- `async dispatchAuthEndpoint` (2)
- `async dispatchAuthEndpoint` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/index.js:1` | Self: 0.0% (0us) | Total: 0.0% (18.6ms) | Samples: 0

**Called by:**
- `anonymous` (17)

**Calls:**
- `bound require` (17)

### `visitReference`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:288` | Self: 0.0% (0us) | Total: 0.0% (11.8ms) | Samples: 0

**Called by:**
- `bound visitReference` (3)

**Calls:**
- `visitNode` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/authPolicy.ts:287` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `transaction` (1)

**Calls:**
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accounts.ts:111` | Self: 0.0% (0us) | Total: 0.0% (4.1ms) | Samples: 0

**Calls:**
- `transaction` (2)
- `transaction` (1)

### `wrapMacConstructor`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/utils.js:632` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:212` | Self: 0.0% (0us) | Total: 0.0% (2.6ms) | Samples: 0

**Called by:**
- `__exportStar` (2)

**Calls:**
- `defineProperty` (2)

### `async getTables`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:67` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async getTables` (1)

**Calls:**
- `where` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:27` | Self: 0.0% (0us) | Total: 0.0% (8.9ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:391` | Self: 0.0% (0us) | Total: 0.0% (2.7ms) | Samples: 0

**Calls:**
- `ensureCalendarReminderRuntimeSchema` (1)

### `async getCategoryLinearModel`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/categories.ts:89` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Calls:**
- `createSeededLinearModel` (1)
- `createSeededLinearModel` (1)

### `async assertAccountFolder`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/folderAccountGuard.ts:9` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `async validateAccountFolders` (2)

**Calls:**
- `async assertAccountFolder` (1)
- `async assertAccountFolder` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (13.1ms) | Samples: 0

**Calls:**
- `bound require` (12)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accounts.ts:110` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `transaction` (1)

**Calls:**
- `persistAccountRow` (1)

### `executeQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:62` | Self: 0.0% (0us) | Total: 0.7% (290.8ms) | Samples: 0

**Called by:**
- `async (anonymous)` (56)

**Calls:**
- `(anonymous)` (54)
- `columnNames` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:486` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async update` (1)

**Calls:**
- `async transformInput` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:62` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `every` (1)

**Calls:**
- `get` (1)

### `async requireActiveUserSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:69` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `expireLegacyCookie` (1)

### `parseCookies`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/cookie-utils.mjs:164` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `getChunkedCookie` (1)

**Calls:**
- `unquoteCookieValue` (1)

### `bound default`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `twoFactor` (1)

**Calls:**
- `_default` (1)

### `bound visitBinaryOperation`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (1.4ms) | Samples: 0

**Called by:**
- `visitNode` (1)

**Calls:**
- `visitBinaryOperation` (1)

### `shardWriterGuardsInstalled`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:68` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `assertCompleteShardFormat` (1)

**Calls:**
- `performIteration` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/index.js:7` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Calls:**
- `bound require` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/processor.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.7ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/algorithms.js:25` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `toBER` (1)
- `serialize` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:367` | Self: 0.0% (0us) | Total: 0.2% (81.2ms) | Samples: 0

**Called by:**
- `async handleFallbackJoin` (30)

**Calls:**
- `(anonymous)` (30)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:98` | Self: 0.0% (0us) | Total: 0.1% (61.2ms) | Samples: 0

**Calls:**
- `map` (54)

### `initAccountSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:978` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `async withDbWriteRetry` (2)

**Calls:**
- `assertCompleteShardFormat` (2)

### `async recomputeThreadsForAccountInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:284` | Self: 0.0% (0us) | Total: 0.0% (13.7ms) | Samples: 0

**Calls:**
- `(anonymous)` (9)

### `decodeSecret`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/secret.ts:68` | Self: 0.0% (0us) | Total: 0.0% (3.6ms) | Samples: 0

**Called by:**
- `mapAccountRow` (2)
- `mapAccountRow` (1)

**Calls:**
- `assertCredentialMode` (3)

### `bound visitWhere`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (15.3ms) | Samples: 0

**Called by:**
- `visitNode` (5)

**Calls:**
- `visitWhere` (5)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/container.js:3` | Self: 0.0% (0us) | Total: 0.0% (6.9ms) | Samples: 0

**Called by:**
- `anonymous` (6)

**Calls:**
- `bound require` (6)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/decorators/index.js:8` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `defineProperty` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/decorators/auto-injectable.js:4` | Self: 0.0% (0us) | Total: 0.0% (3.8ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `bound require` (3)

### `async getTables`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:81` | Self: 0.0% (0us) | Total: 0.0% (2.6ms) | Samples: 0

**Called by:**
- `async getMigrations` (2)

**Calls:**
- `async getTables` (1)
- `async getTables` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/passkey/dist/index.mjs:583` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Calls:**
- `object` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:922` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `every` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:548` | Self: 0.0% (0us) | Total: 0.0% (1.9ms) | Samples: 0

**Called by:**
- `parseExpression` (1)
- `parseAliasedExpression` (1)

**Calls:**
- `map` (1)
- `where` (1)

### `_default`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:1283` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `bound default` (1)

**Calls:**
- `ZodDefault` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (4.2ms) | Samples: 0

**Called by:**
- `anonymous` (4)

**Calls:**
- `bound require` (4)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:895` | Self: 0.0% (0us) | Total: 0.0% (15.3ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `async findOne`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:515` | Self: 0.0% (0us) | Total: 0.0% (4.9ms) | Samples: 0

**Called by:**
- `async findOne` (2)

**Calls:**
- `selectAll` (2)

### `createAdminInvite`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:691` | Self: 0.0% (0us) | Total: 0.0% (6.7ms) | Samples: 0

**Called by:**
- `initMasterSchema` (1)

**Calls:**
- `(anonymous)` (1)

### `getTopicSuggestionsForThreadSignalBatch`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:575` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async withAccountDb` (1)

**Calls:**
- `slice` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2578` | Self: 0.0% (0us) | Total: 0.0% (4.1ms) | Samples: 0

**Calls:**
- `buildMeaningfulAttachmentExistsSql` (3)

### `transformJoinClause`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:291` | Self: 0.0% (0us) | Total: 0.0% (3.3ms) | Samples: 0

**Called by:**
- `async (anonymous)` (3)

**Calls:**
- `entries` (2)
- `filter` (1)

### `async verifySignature`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:18` | Self: 0.0% (0us) | Total: 0.0% (21.8ms) | Samples: 0

**Called by:**
- `async (anonymous)` (16)

**Calls:**
- `async (anonymous)` (13)
- `async (anonymous)` (2)
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/index.js:7` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/encode.js:56` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `readGap` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/postcss.js:8` | Self: 0.0% (0us) | Total: 0.0% (1.6ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `insertThreadSignalsFromMessageRows`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:35` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `rebuildAllThreadSignalsForAccountInternal` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `upsertTopicLearningSignalsForThreadIds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/topics.ts:128` | Self: 0.0% (0us) | Total: 0.0% (4.6ms) | Samples: 0

**Called by:**
- `async (anonymous)` (4)

**Calls:**
- `normalizeThreadIds` (4)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@zone-eu/mailsplit/index.js:8` | Self: 0.0% (0us) | Total: 0.0% (983us) | Samples: 0

**Calls:**
- `bound require` (1)

### `async #transformResult`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:167` | Self: 0.0% (0us) | Total: 0.0% (2.6ms) | Samples: 0

**Called by:**
- `async executeQuery` (2)

**Calls:**
- `async #transformResult` (1)
- `async #transformResult` (1)

### `async recomputeThreadsForAccountInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:281` | Self: 0.0% (0us) | Total: 0.0% (3.0ms) | Samples: 0

**Calls:**
- `(anonymous)` (3)

### `async deleteWithHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/with-hooks.mjs:151` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async deleteWithHooks` (1)

### `async isMfaEnrollmentComplete`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authPolicy.ts:21` | Self: 0.0% (0us) | Total: 0.0% (16.2ms) | Samples: 0

**Calls:**
- `enrollmentState` (8)
- `enrollmentState` (4)

### `safeParseJson`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts:22` | Self: 0.0% (0us) | Total: 0.0% (11.0ms) | Samples: 0

**Called by:**
- `mapAccountRow` (8)

**Calls:**
- `parse` (8)

### `decrypt`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:360` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `async rawDecrypt` (1)

**Calls:**
- `computeTag` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/charset.js:16` | Self: 0.0% (0us) | Total: 0.0% (23.5ms) | Samples: 0

**Called by:**
- `anonymous` (21)

**Calls:**
- `bound require` (21)

### `compileList`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:136` | Self: 0.0% (0us) | Total: 0.1% (48.1ms) | Samples: 0

**Called by:**
- `visitFrom` (11)
- `visitSelectQuery` (5)

**Calls:**
- `visitNode` (16)

### `toASN`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js:50` | Self: 0.0% (0us) | Total: 0.0% (4.2ms) | Samples: 0

**Called by:**
- `serialize` (4)

**Calls:**
- `toBER` (2)
- `serialize` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/work-async-storage.external.js:11` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/esm/libmime.js:1077` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `Libmime` (1)

### `async POST`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/auth/switch-account/route.ts:10` | Self: 0.0% (0us) | Total: 0.0% (5.4ms) | Samples: 0

**Called by:**
- `async POST` (1)

**Calls:**
- `async requireActiveUserSession` (1)

### `async getAccountById`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accounts.ts:84` | Self: 0.0% (0us) | Total: 0.3% (120.5ms) | Samples: 0

**Calls:**
- `mapAccountRow` (37)
- `mapAccountRow` (23)
- `mapAccountRow` (22)
- `mapAccountRow` (10)
- `mapAccountRow` (1)
- `mapAccountRow` (1)
- `mapAccountRow` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:533` | Self: 0.0% (0us) | Total: 0.0% (27.9ms) | Samples: 0

**Called by:**
- `forEach` (24)

**Calls:**
- `(anonymous)` (22)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/charset.js:15` | Self: 0.0% (0us) | Total: 0.0% (1.9ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `buildMessageGroupKey`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageGrouping.ts:74` | Self: 0.0% (0us) | Total: 4.3% (1.62s) | Samples: 0

**Called by:**
- `buildGroupKey` (1293)
- `(anonymous)` (107)

**Calls:**
- `buildTimeGroupKey` (691)
- `buildTimeGroupKey` (686)
- `buildTimeGroupKey` (23)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/tools.js:28` | Self: 0.0% (0us) | Total: 0.0% (1.9ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/attribute_certificate_info.js:7` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `ZodOptional`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `optional` (1)

**Calls:**
- `init` (1)

### `encrypt`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/utils.js:875` | Self: 0.0% (0us) | Total: 0.0% (3.9ms) | Samples: 0

**Called by:**
- `async rawEncrypt` (3)

**Calls:**
- `encrypt` (2)
- `encrypt` (1)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:392` | Self: 0.0% (0us) | Total: 0.1% (49.7ms) | Samples: 0

**Calls:**
- `async ensureCalendarEventRuntimeData` (43)
- `async ensureCalendarEventRuntimeData` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/parse5/dist/common/token.js:11` | Self: 0.0% (0us) | Total: 0.0% (971us) | Samples: 0

**Calls:**
- `(anonymous)` (1)

### `async rawEncrypt`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/crypto/index.mjs:33` | Self: 0.0% (0us) | Total: 0.0% (4.9ms) | Samples: 0

**Calls:**
- `encrypt` (3)
- `managedNonce` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/index.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async getThreadGroupCounts`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1381` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Called by:**
- `async listThreads` (2)

**Calls:**
- `Date` (1)
- `getTime` (1)

### `serialize`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js:16` | Self: 0.0% (0us) | Total: 0.0% (8.6ms) | Samples: 0

**Called by:**
- `(anonymous)` (4)
- `toASN` (2)
- `(anonymous)` (1)
- `(anonymous)` (1)

**Calls:**
- `toASN` (4)
- `toASN` (2)
- `toASN` (1)
- `toASN` (1)

### `async getSharedTestAuthHarness`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testAuthHarness.ts:150` | Self: 0.0% (0us) | Total: 0.0% (3.0ms) | Samples: 0

**Calls:**
- `getAuth` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/from-json-schema.js:7` | Self: 0.0% (0us) | Total: 0.0% (3.3ms) | Samples: 0

**Calls:**
- `cloneObject` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:274` | Self: 0.0% (0us) | Total: 0.0% (5.8ms) | Samples: 0

**Calls:**
- `async migrateAuthSchema` (4)

### `get`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:816` | Self: 0.0% (0us) | Total: 0.0% (969us) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `defineProperty` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (885us) | Samples: 0

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:104` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async resolveAccountDbPath` (1)

**Calls:**
- `has` (1)

### `ZodString`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Called by:**
- `_string` (3)

**Calls:**
- `init` (3)

### `shardWriterGuardsInstalled`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:62` | Self: 0.0% (0us) | Total: 0.0% (3.7ms) | Samples: 0

**Called by:**
- `migrate` (2)
- `assertCompleteShardFormat` (1)

**Calls:**
- `every` (2)
- `ftsIdentitySchemaInstalled` (1)

### `decrypt`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:369` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async rawDecrypt` (1)

**Calls:**
- `(anonymous)` (1)

### `enrollmentState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/authPolicy.ts:379` | Self: 0.0% (0us) | Total: 0.0% (5.0ms) | Samples: 0

**Called by:**
- `async isMfaEnrollmentComplete` (4)

**Calls:**
- `(anonymous)` (4)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/rsassa_pss.js:52` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `RsaSaPssParams` (1)

### `LocalObjectIdentifierValueBlock`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:2339` | Self: 0.0% (0us) | Total: 0.0% (975us) | Samples: 0

**Called by:**
- `BaseBlock` (1)

**Calls:**
- `ValueBlock` (1)

### `set`
`node:diagnostics_channel:22` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `Channel` (1)

**Calls:**
- `WeakReference` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:196` | Self: 0.0% (0us) | Total: 0.3% (141.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (44)

**Calls:**
- `async handleFallbackJoin` (43)
- `async handleFallbackJoin` (1)

### `async getThreadGroupCounts`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1383` | Self: 0.0% (0us) | Total: 0.1% (40.9ms) | Samples: 0

**Called by:**
- `async listThreads` (36)

**Calls:**
- `(anonymous)` (34)
- `wrapStatement` (1)
- `(anonymous)` (1)

### `async createAuthContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/create-context.mjs:231` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `runtimeSchemaCheckFor` (1)

### `insertThreadSignalsFromMessageRows`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:67` | Self: 0.0% (0us) | Total: 0.0% (4.4ms) | Samples: 0

**Called by:**
- `rebuildThreadSignalsForThreadIdsInternal` (4)

**Calls:**
- `flush` (3)
- `flush` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:78` | Self: 0.0% (0us) | Total: 0.0% (18.8ms) | Samples: 0

**Called by:**
- `async (anonymous)` (6)

**Calls:**
- `async execute` (6)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:34` | Self: 0.0% (0us) | Total: 0.0% (13.9ms) | Samples: 0

**Calls:**
- `bound require` (12)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:208` | Self: 0.0% (0us) | Total: 0.0% (2.9ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `async recomputeThreadsForAccountInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:322` | Self: 0.0% (0us) | Total: 0.0% (1.4ms) | Samples: 0

**Calls:**
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:97` | Self: 0.0% (0us) | Total: 1.8% (690.9ms) | Samples: 0

**Calls:**
- `json` (514)
- `json` (81)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:841` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `cache`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/schema.js:26` | Self: 0.0% (0us) | Total: 0.0% (975us) | Samples: 0

**Called by:**
- `toASN` (1)

**Calls:**
- `create` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/index.js:21` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/totp/index.mjs:172` | Self: 0.0% (0us) | Total: 0.0% (4.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `async verifyTwoFactor` (2)

### `noctuaAuthOptions`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:150` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `admin` (1)

### `async withAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:412` | Self: 0.0% (0us) | Total: 0.0% (3.4ms) | Samples: 0

**Called by:**
- `async withAccountDb` (3)

**Calls:**
- `async getAccountDb` (2)
- `async getAccountDb` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/dynamic-rendering-utils.js:100` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ip-address.js:27` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `bound require` (3)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs:14` | Self: 0.0% (0us) | Total: 0.0% (9.2ms) | Samples: 0

**Called by:**
- `async internalHandler` (6)

**Calls:**
- `async createInternalContext` (6)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2608` | Self: 0.0% (0us) | Total: 0.9% (343.7ms) | Samples: 0

**Calls:**
- `async getMessageCalendarInviteDataByMessageId` (132)
- `async getMessageCalendarInviteDataByMessageId` (130)
- `async getMessageCalendarInviteDataByMessageId` (29)
- `async getMessageCalendarInviteDataByMessageId` (5)
- `async getMessageCalendarInviteDataByMessageId` (2)
- `async getMessageCalendarInviteDataByMessageId` (1)
- `async getMessageCalendarInviteDataByMessageId` (1)

### `async getMigrations`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:631` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Calls:**
- `addColumn` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:277` | Self: 0.0% (0us) | Total: 0.0% (3.1ms) | Samples: 0

**Calls:**
- `createBetterAuth` (1)

### `async ensureCalendarEventRuntimeData`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:675` | Self: 0.0% (0us) | Total: 0.1% (48.6ms) | Samples: 0

**Called by:**
- `async getAccountDb` (43)

**Calls:**
- `async ensureCalendarEventRuntimeData` (40)
- `async ensureCalendarEventRuntimeData` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/lazy-result.js:7` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `json`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js:91` | Self: 0.0% (0us) | Total: 1.6% (598.4ms) | Samples: 0

**Called by:**
- `async (anonymous)` (514)

**Calls:**
- `json` (514)

### `ValueBlock`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (1.9ms) | Samples: 0

**Called by:**
- `LocalObjectIdentifierValueBlock` (1)
- `Some` (1)

**Calls:**
- `LocalBaseBlock` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:507` | Self: 0.0% (0us) | Total: 0.1% (62.8ms) | Samples: 0

**Called by:**
- `parseAliasedExpression` (21)
- `parseExpression` (10)

**Calls:**
- `where` (21)
- `map` (10)

### `add`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:373` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Called by:**
- `(module)` (1)
- `(module)` (1)

**Calls:**
- `compile` (1)
- `compile` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:629` | Self: 0.0% (0us) | Total: 0.0% (967us) | Samples: 0

**Called by:**
- `async findMany` (1)

**Calls:**
- `(anonymous)` (1)

### `ZodEmail`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` | Self: 0.0% (0us) | Total: 0.0% (6.5ms) | Samples: 0

**Called by:**
- `_email` (2)

**Calls:**
- `init` (1)
- `init` (1)

### `visitTable`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:377` | Self: 0.0% (0us) | Total: 0.0% (5.1ms) | Samples: 0

**Called by:**
- `bound visitTable` (2)

**Calls:**
- `visitNode` (2)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:877` | Self: 0.0% (0us) | Total: 0.0% (2.7ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/encoding/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `bound max`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `bound check` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-android/build/cjs/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:91` | Self: 0.0% (0us) | Total: 0.0% (12.4ms) | Samples: 0

**Calls:**
- `getOwnAddresses` (9)
- `getOwnAddresses` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:820` | Self: 0.0% (0us) | Total: 0.0% (11.4ms) | Samples: 0

**Calls:**
- `upsertTopicLearningSignalsForThreadIds` (5)
- `upsertTopicLearningSignalsForThreadIds` (4)
- `upsertTopicLearningSignalsForThreadIds` (1)

### `async delete`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:603` | Self: 0.0% (0us) | Total: 0.0% (981us) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `async delete` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/init.mjs:10` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Calls:**
- `async createAuthContext` (2)

### `async getDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:302` | Self: 0.0% (0us) | Total: 0.0% (2.6ms) | Samples: 0

**Calls:**
- `info` (1)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:375` | Self: 0.0% (0us) | Total: 0.0% (17.6ms) | Samples: 0

**Calls:**
- `configureAccountDb` (8)
- `configureAccountDb` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:377` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `createAuthEndpoint` (1)

### `toAsnItem`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js:131` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Called by:**
- `toASN` (2)

**Calls:**
- `toASN` (1)
- `toASN` (1)

### `ensureMasterTeamColumns`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:167` | Self: 0.0% (0us) | Total: 0.0% (3.1ms) | Samples: 0

**Called by:**
- `initMasterSchema` (2)

**Calls:**
- `transaction` (1)
- `transaction` (1)

### `values`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/insert-query-builder.js:200` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async create` (1)

**Calls:**
- `parseInsertColumnsAndValues` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/shared/lib/router/utils/format-next-pathname-info.js:14` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `transaction`
`bun:sqlite:451` | Self: 0.0% (0us) | Total: 0.9% (366.4ms) | Samples: 0

**Called by:**
- `async (anonymous)` (160)
- `async buildFixture` (5)
- `async (anonymous)` (2)
- `initAccountSchema` (2)
- `ensureMasterTeamColumns` (1)
- `ensureInviteIssuerSchema` (1)
- `normalizeUserEmails` (1)
- `installAuthControlPlane` (1)

**Calls:**
- `#runNoArgs` (173)

### `async getMigrations`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:646` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Calls:**
- `addColumn` (1)
- `addColumn` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/totp/index.mjs:225` | Self: 0.0% (0us) | Total: 0.0% (4.2ms) | Samples: 0

**Called by:**
- `run` (2)

**Calls:**
- `async (anonymous)` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:56` | Self: 0.0% (0us) | Total: 0.0% (2.8ms) | Samples: 0

**Called by:**
- `async setSignedCookie` (1)

**Calls:**
- `async serializeSignedCookie` (1)

### `async withDbWriteRetry`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/dbWriteRetry.ts:66` | Self: 0.0% (0us) | Total: 0.9% (346.3ms) | Samples: 0

**Called by:**
- `async withDbWriteRetry` (83)

**Calls:**
- `(anonymous)` (35)
- `initAccountSchema` (27)
- `(anonymous)` (7)
- `ensureAccountKeySchema` (3)
- `ensureAccountKeySchema` (3)
- `initAccountSchemaBody` (2)
- `initAccountSchema` (2)
- `async (anonymous)` (1)
- `(anonymous)` (1)
- `async (anonymous)` (1)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:1214` | Self: 0.0% (0us) | Total: 0.0% (4.9ms) | Samples: 0

**Called by:**
- `validate` (2)

**Calls:**
- `generateFastpass` (1)
- `anonymous` (1)

### `encrypt`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:351` | Self: 0.0% (0us) | Total: 0.0% (2.7ms) | Samples: 0

**Called by:**
- `encrypt` (2)

**Calls:**
- `computeTag` (1)
- `computeTag` (1)

### `internal:streams/destroy`
`internal:streams/destroy:2` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `anonymous` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:883` | Self: 0.0% (0us) | Total: 0.0% (3.6ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `getTopicSuggestionsForThreadSignalBatch`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:559` | Self: 0.0% (0us) | Total: 0.7% (278.3ms) | Samples: 0

**Called by:**
- `async withAccountDb` (242)

**Calls:**
- `forEach` (242)

### `async acquireAuthLifetimeLock`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authLifetimeLock.ts:64` | Self: 0.0% (0us) | Total: 0.0% (3.0ms) | Samples: 0

**Called by:**
- `async ensureAuthLifetimeLock` (1)

**Calls:**
- `async acquireAuthLifetimeLock` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:153` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:851` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `init` (2)

**Calls:**
- `init` (2)

### `normalizeThreadIds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/topics.ts:3` | Self: 0.0% (0us) | Total: 0.0% (4.6ms) | Samples: 0

**Called by:**
- `upsertTopicLearningSignalsForThreadIds` (4)

**Calls:**
- `map` (3)
- `filter` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/connection.js:16` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/after/index.js:6` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/index.js:9` | Self: 0.0% (0us) | Total: 0.0% (7.4ms) | Samples: 0

**Called by:**
- `anonymous` (6)

**Calls:**
- `bound require` (6)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-rsa/build/cjs/parameters/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (9.6ms) | Samples: 0

**Called by:**
- `anonymous` (9)

**Calls:**
- `bound require` (9)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/access/statement.mjs:23` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `createAccessControl` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:27` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:880` | Self: 0.0% (0us) | Total: 0.0% (3.4ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv6.js:29` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/index.js:6` | Self: 0.0% (0us) | Total: 0.0% (9.7ms) | Samples: 0

**Called by:**
- `anonymous` (8)

**Calls:**
- `bound require` (8)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:33` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `async upsertAccount` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/request.js:23` | Self: 0.0% (0us) | Total: 0.0% (5.3ms) | Samples: 0

**Called by:**
- `anonymous` (4)

**Calls:**
- `bound require` (4)

### `internal:errors`
`internal:errors:2` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `anonymous` (1)

### `table`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-data.js:92` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `DBCSCodec` (1)

**Calls:**
- `bound require` (1)

### `async withAuthResponse`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:57` | Self: 0.0% (0us) | Total: 0.0% (18.6ms) | Samples: 0

**Called by:**
- `async GET` (15)
- `async POST` (1)

**Calls:**
- `async withAuthResponse` (16)

### `write`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/doc.js:27` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `generateFastpass` (1)

**Calls:**
- `map` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema/verification.mjs:6` | Self: 0.0% (0us) | Total: 0.0% (1.5ms) | Samples: 0

**Calls:**
- `_date` (1)

### `async transformOutput`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:216` | Self: 0.0% (0us) | Total: 0.0% (11.6ms) | Samples: 0

**Called by:**
- `async (anonymous)` (10)

**Calls:**
- `async (anonymous)` (10)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/mailparser/dist/esm/tlds.cjs:8` | Self: 0.0% (0us) | Total: 0.0% (4.9ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `collectTopicSignalEntries`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:92` | Self: 0.0% (0us) | Total: 0.0% (10.9ms) | Samples: 0

**Called by:**
- `flush` (9)

**Calls:**
- `extractJiraProjectKeys` (6)
- `extractJiraProjectKeys` (2)
- `extractJiraProjectKeys` (1)

### `async migrateAuthSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:212` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `async runMigrations` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:18` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async deleteSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:499` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async (anonymous)` (1)

### `internal:stream`
`internal:stream:2` | Self: 0.0% (0us) | Total: 0.0% (11.9ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `anonymous` (1)

### `topicSuggestionSignalEntries`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:106` | Self: 0.0% (0us) | Total: 0.0% (13.5ms) | Samples: 0

**Called by:**
- `(anonymous)` (12)

**Calls:**
- `map` (12)

### `async getAccountOwnAddresses`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/senderIdentities.ts:21` | Self: 0.0% (0us) | Total: 0.1% (48.2ms) | Samples: 0

**Calls:**
- `(anonymous)` (29)
- `(anonymous)` (10)
- `wrapStatement` (1)
- `(anonymous)` (1)

### `toBER`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:2286` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `toBER` (1)

**Calls:**
- `utilToBase` (1)

### `async findOne`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:521` | Self: 0.0% (0us) | Total: 0.0% (24.9ms) | Samples: 0

**Called by:**
- `async findOne` (6)

**Calls:**
- `select` (6)

### `async getUserById`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/serverDb.ts:151` | Self: 0.0% (0us) | Total: 0.0% (18.1ms) | Samples: 0

**Called by:**
- `async requireActiveUserSession` (5)
- `async getUserById` (5)

**Calls:**
- `loadServerDb` (5)
- `async getUserById` (5)
- `async getUserById` (2)

### `internal:streams/transform`
`internal:streams/transform:2` | Self: 0.0% (0us) | Total: 0.0% (8.3ms) | Samples: 0

**Called by:**
- `anonymous` (5)

**Calls:**
- `anonymous` (5)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/index.js:9` | Self: 0.0% (0us) | Total: 0.0% (2.6ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `rebuildThreadSignalsForThreadIdsInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:76` | Self: 0.0% (0us) | Total: 0.0% (3.4ms) | Samples: 0

**Called by:**
- `async rebuildThreadSignalsForThreadIds` (3)

**Calls:**
- `normalizeThreadIds` (3)

### `cloneWithSelections`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/select-query-node.js:32` | Self: 0.0% (0us) | Total: 0.4% (160.8ms) | Samples: 0

**Called by:**
- `selectAll` (1)

**Calls:**
- `freeze` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testDbHarness.ts:49` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Calls:**
- `getSharedDbHarnessState` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs:196` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `async createUser` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (3.1ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `bound require` (3)

### `init`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:76` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `members` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:36` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `forEach` (1)

**Calls:**
- `has` (1)

### `node:fs`
`node:fs:728` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `setName` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:285` | Self: 0.0% (0us) | Total: 0.0% (3.0ms) | Samples: 0

**Called by:**
- `getAuth` (1)

**Calls:**
- `async (anonymous)` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:874` | Self: 0.0% (0us) | Total: 0.0% (3.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:927` | Self: 0.0% (0us) | Total: 0.0% (2.8ms) | Samples: 0

**Called by:**
- `map` (2)

**Calls:**
- `escapeSqlLiteral` (2)

### `async delete`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:678` | Self: 0.0% (0us) | Total: 0.0% (981us) | Samples: 0

**Called by:**
- `async deleteWithHooks` (1)

**Calls:**
- `async (anonymous)` (1)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:370` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `has` (1)

### `async resolveAccountDbPath`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:365` | Self: 0.0% (0us) | Total: 0.0% (7.9ms) | Samples: 0

**Called by:**
- `async getAccountDb` (7)

**Calls:**
- `async resolveAccountDbPath` (7)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/sign-in.mjs:316` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `assertPasswordNotTooLong` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:79` | Self: 0.0% (0us) | Total: 0.0% (4.8ms) | Samples: 0

**Calls:**
- `async sqliteGeneratedPrimaryKeyColumn` (4)

### `async update`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:578` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (2)

**Calls:**
- `async update` (1)
- `async update` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/libmime.js:45` | Self: 0.0% (0us) | Total: 0.0% (3.2ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `bound require` (3)

### `(module)`
`/tmp/spike-switch-server/inspect.ts:15` | Self: 0.0% (0us) | Total: 0.0% (6.5ms) | Samples: 0

**Calls:**
- `async POST` (2)

### `node:http`
`node:http:2` | Self: 0.0% (0us) | Total: 0.0% (13.2ms) | Samples: 0

**Calls:**
- `anonymous` (6)

### `async enrichMessagesWithThreadTopics`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts:37` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Called by:**
- `async enrichMessagesWithThreadTopics` (3)

**Calls:**
- `async getTopicsForThreads` (3)

### `async requireActiveUserSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:72` | Self: 0.0% (0us) | Total: 0.0% (11.8ms) | Samples: 0

**Calls:**
- `async getUserById` (5)
- `async getUserById` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/parse.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async createInternalContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:97` | Self: 0.0% (0us) | Total: 0.0% (19.8ms) | Samples: 0

**Called by:**
- `async (anonymous)` (8)
- `async (anonymous)` (6)

**Calls:**
- `async (anonymous)` (8)
- `async (anonymous)` (5)
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/extended_key_usage.js:17` | Self: 0.0% (0us) | Total: 0.0% (949us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `AsnType` (1)

### `computeTag`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:328` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `encrypt` (1)

**Calls:**
- `digest` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:1276` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:9` | Self: 0.0% (0us) | Total: 0.0% (4.6ms) | Samples: 0

**Calls:**
- `webpackUniversalModuleDefinition` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv4.js:598` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `map` (1)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1259` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async getTotalCount` (1)

**Calls:**
- `async getAccountDb` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/types/octet_string.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.5ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `__importStar` (1)

### `ensureCalendarReminderRuntimeSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:273` | Self: 0.0% (0us) | Total: 0.0% (2.7ms) | Samples: 0

**Called by:**
- `async getAccountDb` (1)

**Calls:**
- `ensureCalendarReminderOptionalColumns` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:339` | Self: 0.0% (0us) | Total: 0.0% (18.7ms) | Samples: 0

**Calls:**
- `loadManualCategoryStatesForMessageIds` (7)
- `loadManualCategoryStatesForMessageIds` (5)
- `loadManualCategoryStatesForMessageIds` (4)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/encoding-table.js:1` | Self: 0.0% (0us) | Total: 0.0% (8.8ms) | Samples: 0

**Called by:**
- `anonymous` (8)

**Calls:**
- `bound require` (8)

### `toBER`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:2366` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `toBER` (2)

**Calls:**
- `toBER` (1)
- `toArrayBuffer` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/enveloped_data.js:9` | Self: 0.0% (0us) | Total: 0.0% (3.3ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `bound require` (3)

### `async provideConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/default-connection-provider.js:8` | Self: 0.0% (0us) | Total: 0.0% (20.4ms) | Samples: 0

**Called by:**
- `async provideConnection` (7)

**Calls:**
- `async acquireConnection` (7)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:254` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `init` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/general_name.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async requireActiveUserSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:85` | Self: 0.0% (0us) | Total: 0.0% (983us) | Samples: 0

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/levels.js:12` | Self: 0.0% (0us) | Total: 0.0% (8.8ms) | Samples: 0

**Called by:**
- `anonymous` (8)

**Calls:**
- `bound require` (8)

### `__nccwpck_require__`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/ua-parser-js/ua-parser.js:1` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `(anonymous)` (2)

**Calls:**
- `943` (2)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:408` | Self: 0.0% (0us) | Total: 0.0% (7.9ms) | Samples: 0

**Called by:**
- `async getThreadCollabStates` (3)
- `async withAccountDb` (2)
- `async getTotalCount` (1)
- `async assertAccountFolder` (1)

**Calls:**
- `async getAccountDb` (7)

### `async resolveAccountDbPath`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:335` | Self: 0.0% (0us) | Total: 0.0% (7.9ms) | Samples: 0

**Called by:**
- `async resolveAccountDbPath` (7)

**Calls:**
- `async getDb` (7)

### `async findOne`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:598` | Self: 0.0% (0us) | Total: 1.3% (485.7ms) | Samples: 0

**Called by:**
- `async (anonymous)` (129)
- `async (anonymous)` (4)
- `async (anonymous)` (1)
- `async (anonymous)` (1)

**Calls:**
- `async (anonymous)` (98)
- `async (anonymous)` (23)
- `async (anonymous)` (8)
- `async (anonymous)` (6)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/index.js:10` | Self: 0.0% (0us) | Total: 0.0% (4.6ms) | Samples: 0

**Called by:**
- `anonymous` (4)

**Calls:**
- `bound require` (4)

### `migrate`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accountKeys.ts:225` | Self: 0.0% (0us) | Total: 0.0% (8.8ms) | Samples: 0

**Called by:**
- `ensureAccountKeySchema` (8)

**Calls:**
- `installShardWriterGuards` (8)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/signer_info.js:8` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/deepmerge-ts/dist/index.mjs:1632` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `deepmergeIntoFastUnsafeCustom` (1)

### `sortGroupsForGroupBy`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageGrouping.ts:105` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async getThreadGroupCounts` (1)

**Calls:**
- `forEach` (1)

### `getEndpoints`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/index.mjs:92` | Self: 0.0% (0us) | Total: 0.0% (3.1ms) | Samples: 0

**Called by:**
- `createBetterAuth` (1)

**Calls:**
- `map` (1)

### `shouldIgnoreTopicSuggestionSignal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:131` | Self: 0.0% (0us) | Total: 0.0% (20.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (18)

**Calls:**
- `isFreeMailDomain` (14)
- `isFreeMailDomain` (4)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/sign-out.mjs:5` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `object` (1)

### `async findSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:369` | Self: 0.0% (0us) | Total: 0.0% (23.4ms) | Samples: 0

**Called by:**
- `async (anonymous)` (4)

**Calls:**
- `async (anonymous)` (2)
- `async (anonymous)` (2)

### `async GET`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:55` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `async GET` (1)

**Calls:**
- `async getAccountIdFromParams` (1)

### `async requireActiveUserSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:74` | Self: 0.0% (0us) | Total: 0.0% (13.2ms) | Samples: 0

**Calls:**
- `(anonymous)` (5)
- `wrapStatement` (3)
- `(anonymous)` (2)

### `async sqliteGeneratedPrimaryKeyColumn`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:25` | Self: 0.0% (0us) | Total: 0.0% (3.2ms) | Samples: 0

**Called by:**
- `async sqliteGeneratedPrimaryKeyColumn` (3)

**Calls:**
- `sqliteIntegerPrimaryKeyColumn` (2)
- `sqliteIntegerPrimaryKeyColumn` (1)

### `get value`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:41` | Self: 0.0% (0us) | Total: 0.0% (969us) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `normalizeDef` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/decorators/index.js:3` | Self: 0.0% (0us) | Total: 0.0% (4.9ms) | Samples: 0

**Called by:**
- `anonymous` (4)

**Calls:**
- `bound require` (4)

### `bound extend`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `extend` (1)

### `extend`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:450` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `bound extend` (1)

**Calls:**
- `isPlainObject` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/fromJSON.js:9` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async POST`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/auth/switch-account/route.ts:28` | Self: 0.0% (0us) | Total: 0.0% (6.5ms) | Samples: 0

**Called by:**
- `(module)` (2)

**Calls:**
- `async POST` (1)
- `async POST` (1)

### `async execute`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:318` | Self: 0.0% (0us) | Total: 0.0% (28.5ms) | Samples: 0

**Called by:**
- `async execute` (11)

**Calls:**
- `async executeQuery` (11)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/postcss.js:15` | Self: 0.0% (0us) | Total: 0.0% (1.7ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/adapters/request-cookies.js:50` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `select`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js:62` | Self: 0.0% (0us) | Total: 0.0% (24.9ms) | Samples: 0

**Called by:**
- `async findOne` (6)

**Calls:**
- `cloneWithSelections` (5)
- `parseSelectArg` (1)

### `node:_http_client`
`node:_http_client:10` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `anonymous` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:212` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `copyDataProperties` (1)

### `bound min`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (1.4ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `min` (1)

### `localFromBERWithChildContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1218` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `fromBER` (1)

**Calls:**
- `localFromBER` (1)

### `optional`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:58` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `bound optional` (1)

**Calls:**
- `optional` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2512` | Self: 0.0% (0us) | Total: 0.0% (6.8ms) | Samples: 0

**Calls:**
- `map` (6)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `LinkifyIt`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:361` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `LinkifyIt` (1)

**Calls:**
- `compile` (1)

### `ZodDate`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:100` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `_date` (1)

**Calls:**
- `(anonymous)` (1)

### `configureDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:89` | Self: 0.0% (0us) | Total: 0.0% (24.1ms) | Samples: 0

**Called by:**
- `configureAccountDb` (8)
- `async getDb` (4)

**Calls:**
- `(anonymous)` (12)

### `digestInto`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_poly1305.js:287` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `digest` (1)

**Calls:**
- `finalize` (1)

### `addressparser`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1210` | Self: 0.0% (0us) | Total: 0.0% (9.7ms) | Samples: 0

**Called by:**
- `parseAddressEmails` (6)

**Calls:**
- `walkAddressList` (6)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:900` | Self: 0.0% (0us) | Total: 0.0% (6.7ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `createAdminInvite` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/well-known/index.js:3` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Calls:**
- `forEach` (1)

### `node:assert`
`node:assert:2` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `anonymous` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/segment-config/ensure-static.js:27` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:668` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `async findOne` (1)

### `buildFtsIdentity`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/ftsIdentity.ts:38` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `migrate` (2)

**Calls:**
- `(anonymous)` (2)

### `noctuaAuthOptions`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:78` | Self: 0.0% (0us) | Total: 0.0% (3.6ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `twoFactor` (1)
- `twoFactor` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_poly1305.js:318` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `wrapMacConstructor` (1)

### `twoFactor`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/index.mjs:39` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `noctuaAuthOptions` (1)

**Calls:**
- `bound default` (1)

### `visitFrom`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:120` | Self: 0.0% (0us) | Total: 0.0% (34.1ms) | Samples: 0

**Called by:**
- `bound visitFrom` (11)

**Calls:**
- `compileList` (11)

### `_defu`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/defu/dist/defu.mjs:23` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `reduce` (1)

**Calls:**
- `keys` (1)

### `filterOutputFields`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs:9` | Self: 0.0% (0us) | Total: 0.1% (46.5ms) | Samples: 0

**Called by:**
- `async (anonymous)` (8)
- `async (anonymous)` (4)
- `async (anonymous)` (3)
- `async (anonymous)` (3)

**Calls:**
- `structuredClone` (14)
- `entries` (3)
- `filter` (1)

### `_email`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/api.js:20` | Self: 0.0% (0us) | Total: 0.0% (6.5ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `ZodEmail` (2)

### `shardWriterGuardsInstalled`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:60` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `assertCompleteShardFormat` (2)

**Calls:**
- `(anonymous)` (2)

### `_string`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/api.js:12` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Called by:**
- `(module)` (1)
- `(module)` (1)
- `(module)` (1)

**Calls:**
- `ZodString` (3)

### `lookup`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/ftsIdentity.ts:82` | Self: 0.0% (0us) | Total: 0.0% (31.7ms) | Samples: 0

**Called by:**
- `(anonymous)` (28)

**Calls:**
- `(anonymous)` (24)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:865` | Self: 0.0% (0us) | Total: 0.0% (2.5ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:557` | Self: 0.0% (0us) | Total: 0.0% (22.8ms) | Samples: 0

**Called by:**
- `async findOne` (8)

**Calls:**
- `map` (8)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/dependency-container.js:11` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `decodeTrieDict`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/internal/decode-shared.js:151` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `readNgramReferences` (1)

### `Kysely`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/kysely.js:70` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `Log` (1)

### `visitSchemableIdentifier`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:384` | Self: 0.0% (0us) | Total: 0.0% (5.1ms) | Samples: 0

**Called by:**
- `bound visitSchemableIdentifier` (2)

**Calls:**
- `visitNode` (1)
- `visitNode` (1)

### `compile`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:174` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `add` (1)

**Calls:**
- `forEach` (1)

### `bound visitOperator`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (1.4ms) | Samples: 0

**Called by:**
- `visitNode` (1)

**Calls:**
- `visitOperator` (1)

### `backfillEmailCalendarEventParticipation`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:563` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async ensureCalendarEventRuntimeData` (1)

**Calls:**
- `(anonymous)` (1)

### `async getDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:299` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Calls:**
- `Database` (1)

### `tlds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs:618` | Self: 0.0% (0us) | Total: 0.0% (1.9ms) | Samples: 0

**Called by:**
- `(module)` (2)

**Calls:**
- `compile` (1)
- `compile` (1)

### `(anonymous)`
`/tmp/spike-switch-server/sqlcounter.ts:112` | Self: 0.0% (0us) | Total: 0.2% (88.8ms) | Samples: 0

**Called by:**
- `initMasterSchema` (18)
- `configureDb` (12)
- `installShardWriterGuards` (6)
- `initAccountSchemaBody` (5)
- `initAccountSchemaBody` (2)
- `buildFtsIdentity` (2)
- `(anonymous)` (1)
- `install` (1)
- `(anonymous)` (1)

**Calls:**
- `run` (48)

### `async findOne`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:505` | Self: 0.0% (0us) | Total: 0.9% (347.1ms) | Samples: 0

**Called by:**
- `async findOne` (73)

**Calls:**
- `selectFrom` (73)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/sign-in.mjs:368` | Self: 0.0% (0us) | Total: 0.0% (3.4ms) | Samples: 0

**Called by:**
- `run` (2)

**Calls:**
- `async (anonymous)` (1)
- `async (anonymous)` (1)

### `toASN`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/converters.js:47` | Self: 0.0% (0us) | Total: 0.0% (968us) | Samples: 0

**Called by:**
- `toAsnItem` (1)

**Calls:**
- `ObjectIdentifier` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:87` | Self: 0.0% (0us) | Total: 0.5% (199.4ms) | Samples: 0

**Called by:**
- `forEach` (160)

**Calls:**
- `extractEmailAddresses` (160)

### `__importStar`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:327` | Self: 0.0% (0us) | Total: 0.0% (1.5ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/index.js:6` | Self: 0.0% (0us) | Total: 0.0% (4.7ms) | Samples: 0

**Called by:**
- `anonymous` (4)

**Calls:**
- `bound require` (4)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:37` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/headers.js:1` | Self: 0.0% (0us) | Total: 0.0% (3.3ms) | Samples: 0

**Calls:**
- `bound require` (2)

### `flush`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:207` | Self: 0.0% (0us) | Total: 0.0% (13.9ms) | Samples: 0

**Called by:**
- `(anonymous)` (12)

**Calls:**
- `topicSuggestionSignalsFromEntries` (6)
- `topicSuggestionSignalsFromEntries` (5)
- `topicSuggestionSignalsFromEntries` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/adminMailbox.ts:13` | Self: 0.0% (0us) | Total: 0.0% (5.1ms) | Samples: 0

**Calls:**
- `bound strict` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-android/build/cjs/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (919us) | Samples: 0

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testAuthHarness.ts:161` | Self: 0.0% (0us) | Total: 0.0% (2.5ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async withDbWriteRetry` (1)

### `async requireActiveUserSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:76` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `(anonymous)` (1)

### `upsertTopicLearningSignalsForThreadIds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/topics.ts:145` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `async migrateAuthSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:219` | Self: 0.0% (0us) | Total: 0.0% (5.8ms) | Samples: 0

**Called by:**
- `async (anonymous)` (4)

**Calls:**
- `async migrateAuthSchema` (3)
- `async migrateAuthSchema` (1)

### `async getTotalCount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:1345` | Self: 0.0% (0us) | Total: 0.0% (6.0ms) | Samples: 0

**Calls:**
- `applyBadgeFilters` (2)
- `applyBadgeFilters` (1)
- `applyBadgeFilters` (1)
- `applyBadgeFilters` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:60` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `get` (1)
- `clampThreadListPageSize` (1)

### `async getAccountById`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accounts.ts:82` | Self: 0.0% (0us) | Total: 0.7% (295.1ms) | Samples: 0

**Calls:**
- `(anonymous)` (146)
- `(anonymous)` (82)
- `wrapStatement` (3)
- `(anonymous)` (2)
- `wrapStatement` (2)
- `wrapStatement` (1)
- `wrapStatement` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/pino.js:8` | Self: 0.0% (0us) | Total: 0.0% (10.0ms) | Samples: 0

**Calls:**
- `bound require` (9)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/device-authorization/index.mjs:19` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `object` (1)

### `async updateWithHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/with-hooks.mjs:63` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `async update` (1)

### `bound strict`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (5.1ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `strict` (1)

### `async ensureAsyncStorage`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:10` | Self: 0.0% (0us) | Total: 0.0% (5.8ms) | Samples: 0

**Called by:**
- `async hasRequestState` (4)

**Calls:**
- `async (anonymous)` (2)
- `async (anonymous)` (2)

### `_defu`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/defu/dist/defu.mjs:19` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `reduce` (1)

**Calls:**
- `isPlainObject` (1)

### `_handleAddress`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:765` | Self: 0.0% (0us) | Total: 0.2% (90.4ms) | Samples: 0

**Called by:**
- `_parseAddressList` (58)

**Calls:**
- `_recoverAddrSpec` (35)
- `_recoverAddrSpec` (23)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/attributes/counter_signature.js:6` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `internal:streams/readable`
`internal:streams/readable:2` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `anonymous` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/index.mjs:125` | Self: 0.0% (0us) | Total: 0.4% (160.8ms) | Samples: 0

**Calls:**
- `async findOne` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async getCurrentAdapter`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/transaction.mjs:23` | Self: 0.0% (0us) | Total: 0.0% (5.4ms) | Samples: 0

**Called by:**
- `async deleteWithHooks` (1)
- `async (anonymous)` (1)

**Calls:**
- `async ensureAsyncStorage` (1)
- `async ensureAsyncStorage` (1)

### `async getTables`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:69` | Self: 0.0% (0us) | Total: 0.0% (1.4ms) | Samples: 0

**Called by:**
- `async getTables` (1)

**Calls:**
- `async execute` (1)

### `parseSelectAll`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/select-parser.js:39` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `selectAll` (1)

**Calls:**
- `createSelectAllFromTable` (1)

### `getTopicSuggestionsForThreadSignalBatch`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:577` | Self: 0.0% (0us) | Total: 0.0% (8.6ms) | Samples: 0

**Called by:**
- `async withAccountDb` (7)

**Calls:**
- `forEach` (7)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:51` | Self: 0.0% (0us) | Total: 0.0% (5.2ms) | Samples: 0

**Calls:**
- `async getSignedCookie` (1)

### `Poly1305`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_poly1305.js:57` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `u8to16` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:10` | Self: 0.0% (0us) | Total: 0.0% (11.7ms) | Samples: 0

**Called by:**
- `async createInternalContext` (8)

**Calls:**
- `async runValidation` (8)

### `async resolveAccountDbPath`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:338` | Self: 0.0% (0us) | Total: 0.0% (16.0ms) | Samples: 0

**Calls:**
- `(anonymous)` (5)
- `(anonymous)` (3)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `DBCSCodec`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:26` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `getCodec` (1)

**Calls:**
- `table` (1)

### `async update`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:576` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async update` (1)

**Calls:**
- `where` (1)

### `executeQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:63` | Self: 0.0% (0us) | Total: 0.1% (56.9ms) | Samples: 0

**Called by:**
- `async (anonymous)` (15)

**Calls:**
- `(anonymous)` (15)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:709` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Called by:**
- `map` (2)

**Calls:**
- `flatIntoArrayWithCallback` (1)
- `flatMap` (1)

### `__decorate`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tslib/tslib.js:106` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `decorate` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:54` | Self: 0.0% (0us) | Total: 19.9% (7.38s) | Samples: 0

**Called by:**
- `forEach` (2785)

**Calls:**
- `flush` (1795)
- `flush` (989)
- `flush` (1)

### `async executeQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:41` | Self: 0.0% (0us) | Total: 0.0% (2.6ms) | Samples: 0

**Calls:**
- `async #transformResult` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ip-address.js:29` | Self: 0.0% (0us) | Total: 0.0% (3.6ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `bound require` (3)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/dom-serializer/node_modules/entities/lib/esm/generated/decode-data-html.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Calls:**
- `map` (1)

### `ensureThreadCollabRuntimeSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:969` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Called by:**
- `initAccountSchemaBody` (1)

**Calls:**
- `install` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/htmlparser2/node_modules/entities/dist/esm/decode.js:58` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:76` | Self: 0.0% (0us) | Total: 0.0% (11.9ms) | Samples: 0

**Called by:**
- `forEach` (6)

**Calls:**
- `add` (3)
- `add` (3)

### `async execute`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/schema/create-table-builder.js:463` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Called by:**
- `async runMigrations` (1)
- `async execute` (1)

**Calls:**
- `async execute` (1)
- `compileQuery` (1)

### `get WriteStream`
`node:fs:644` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `anonymous` (1)

### `toASN`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/converters.js:16` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `toAsnItem` (1)

**Calls:**
- `localFromBER` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/pino.js:10` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha3.js:433` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Calls:**
- `genShake` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:810` | Self: 0.0% (0us) | Total: 0.1% (58.9ms) | Samples: 0

**Calls:**
- `filter` (2)

### `trimOWS`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/cookie-utils.mjs:144` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `parseCookies` (1)

**Calls:**
- `charCodeAt` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/cookies.js:18` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/dynamic-rendering-utils.js:101` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `SHA2_64B`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha2.js:189` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `_SHA384` (1)

**Calls:**
- `HashMD` (1)

### `async recomputeThreadsForAccountInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:278` | Self: 0.0% (0us) | Total: 0.0% (988us) | Samples: 0

**Calls:**
- `normalizeThreadIds` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/encrypted_content_info.js:4` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:27` | Self: 0.0% (0us) | Total: 0.0% (2.8ms) | Samples: 0

**Called by:**
- `async signCookieValue` (1)

**Calls:**
- `async makeSignature` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/index.js:13` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/mailparser/dist/esm/mail-parser.js:41` | Self: 0.0% (0us) | Total: 0.0% (1.9ms) | Samples: 0

**Calls:**
- `tlds` (2)

### `async GET`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:104` | Self: 0.0% (0us) | Total: 0.0% (9.3ms) | Samples: 0

**Called by:**
- `(module)` (8)

**Calls:**
- `async GET` (7)
- `async GET` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/utils.js:28` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `Database`
`bun:sqlite:268` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `async getDb` (1)

**Calls:**
- `open` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/postcss.js:11` | Self: 0.0% (0us) | Total: 0.0% (4.4ms) | Samples: 0

**Called by:**
- `anonymous` (4)

**Calls:**
- `bound require` (4)

### `async getMigrations`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:403` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `async getDatabaseIndexMap` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:356` | Self: 0.0% (0us) | Total: 0.0% (29.3ms) | Samples: 0

**Called by:**
- `async handleFallbackJoin` (6)

**Calls:**
- `map` (6)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/index.js:6` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (1)
- `__exportStar` (1)

### `initAccountSchemaBody`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:1429` | Self: 0.0% (0us) | Total: 0.0% (945us) | Samples: 0

**Called by:**
- `transaction` (1)

**Calls:**
- `ensureCalendarReminderOptionalColumns` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/libmime.js:42` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/imapflow/node_modules/iconv-lite/lib/index.js:6` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:19` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async buildFixture` (1)

**Calls:**
- `importModule` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2480` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Calls:**
- `async getTotalCount` (3)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:124` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Called by:**
- `async transformInput` (2)

**Calls:**
- `onUpdate` (1)
- `generateId` (1)

### `buildMeaningfulAttachmentPredicateSql`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:941` | Self: 0.0% (0us) | Total: 0.0% (2.6ms) | Samples: 0

**Called by:**
- `buildMeaningfulAttachmentExistsSql` (2)

**Calls:**
- `buildSqlContainsAny` (2)

### `async sqliteGeneratedPrimaryKeyColumn`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:29` | Self: 0.0% (0us) | Total: 0.0% (1.6ms) | Samples: 0

**Called by:**
- `async sqliteGeneratedPrimaryKeyColumn` (1)

**Calls:**
- `async execute` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs:83` | Self: 0.0% (0us) | Total: 0.0% (2.8ms) | Samples: 0

**Called by:**
- `async serializeSignedCookie` (1)

**Calls:**
- `async signCookieValue` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/authPolicy.ts:272` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `transaction` (1)

**Calls:**
- `(anonymous)` (1)

### `collectTopicSignalEntries`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:73` | Self: 0.0% (0us) | Total: 3.1% (1.18s) | Samples: 0

**Called by:**
- `flush` (896)

**Calls:**
- `forEach` (896)

### `getBetterAuthVersion`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/global.mjs:36` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `async createAuthContext` (1)

**Calls:**
- `__getBetterAuthGlobal` (1)

### `async requireAccountContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/accountContext.ts:58` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Calls:**
- `roleAtLeast` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:11` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Calls:**
- `ValidationError` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:824` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `async (anonymous)` (2)

### `migrate`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accountKeys.ts:219` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `ensureAccountKeySchema` (2)

**Calls:**
- `buildFtsIdentity` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:156` | Self: 0.0% (0us) | Total: 0.0% (5.4ms) | Samples: 0

**Called by:**
- `init` (3)

**Calls:**
- `init` (2)
- `init` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/libmime.js:1117` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `Libmime` (1)

### `async runValidation`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/validator.mjs:12` | Self: 0.0% (0us) | Total: 0.0% (8.2ms) | Samples: 0

**Called by:**
- `async runValidation` (5)

**Calls:**
- `validate` (5)

### `toPhysicalSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:190` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async getMigrations` (1)

**Calls:**
- `sentIdentifiers` (1)

### `shouldIgnoreTopicSuggestionSignal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:134` | Self: 0.0% (0us) | Total: 0.5% (211.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (182)

**Calls:**
- `isOwnAddress` (125)
- `isOwnAddress` (57)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/signer_info.js:7` | Self: 0.0% (0us) | Total: 0.0% (987us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `getAuth`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:285` | Self: 0.0% (0us) | Total: 0.0% (3.0ms) | Samples: 0

**Called by:**
- `async getSharedTestAuthHarness` (1)

**Calls:**
- `async (anonymous)` (1)

### `BaseBlock`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:924` | Self: 0.0% (0us) | Total: 0.0% (1.9ms) | Samples: 0

**Called by:**
- `ObjectIdentifier` (2)

**Calls:**
- `LocalObjectIdentifierValueBlock` (1)
- `LocalObjectIdentifierValueBlock` (1)

### `943`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/ua-parser-js/ua-parser.js:1` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `__nccwpck_require__` (2)

**Calls:**
- `(anonymous)` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/cookies.js:11` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/connection.js:13` | Self: 0.0% (0us) | Total: 0.0% (11.7ms) | Samples: 0

**Called by:**
- `anonymous` (10)

**Calls:**
- `bound require` (10)

### `createSeededLinearModel`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/mail/categorization/linearModel.ts:147` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async getCategoryLinearModel` (1)

**Calls:**
- `setWeights` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/index.js:10` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/well-known/index.js:10` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `forEach` (1)

**Calls:**
- `forEach` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:715` | Self: 0.0% (0us) | Total: 0.0% (951us) | Samples: 0

**Calls:**
- `Map` (1)

### `ensureCalendarEventOptionalColumns`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:406` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async ensureCalendarEventRuntimeData` (1)

**Calls:**
- `getDbTableColumns` (1)

### `async migrateAuthSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:211` | Self: 0.0% (0us) | Total: 0.0% (4.4ms) | Samples: 0

**Called by:**
- `async migrateAuthSchema` (3)

**Calls:**
- `async getMigrations` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testAuthHarness.ts:179` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async withDbWriteRetry` (1)

**Calls:**
- `(anonymous)` (1)

### `async getMessageCalendarInviteDataByMessageId`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:164` | Self: 0.0% (0us) | Total: 0.0% (4.6ms) | Samples: 0

**Called by:**
- `async listThreads` (2)

**Calls:**
- `from` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sonic-boom/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:222` | Self: 0.0% (0us) | Total: 0.0% (3.8ms) | Samples: 0

**Calls:**
- `async setCookieCache` (2)

### `create`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/schema.js:54` | Self: 0.0% (0us) | Total: 0.0% (975us) | Samples: 0

**Called by:**
- `cache` (1)

**Calls:**
- `ObjectIdentifier` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/utils.js:30` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `visitWhere`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:144` | Self: 0.0% (0us) | Total: 0.0% (15.3ms) | Samples: 0

**Called by:**
- `bound visitWhere` (5)

**Calls:**
- `visitNode` (2)
- `visitNode` (1)
- `visitNode` (1)
- `visitNode` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha2.js:417` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Calls:**
- `createHasher` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino-std-serializers/index.js:3` | Self: 0.0% (0us) | Total: 0.0% (986us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:627` | Self: 0.0% (0us) | Total: 0.2% (92.8ms) | Samples: 0

**Called by:**
- `forEach` (79)

**Calls:**
- `forEach` (79)

### `ZodObject`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:100` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `object` (1)

**Calls:**
- `(anonymous)` (1)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:407` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Calls:**
- `scheduleAccountDbIdleClose` (1)

### `$ZodCheckMinLength`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:96` | Self: 0.0% (0us) | Total: 0.0% (1.4ms) | Samples: 0

**Called by:**
- `_minLength` (1)

**Calls:**
- `init` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:33` | Self: 0.0% (0us) | Total: 0.0% (2.5ms) | Samples: 0

**Calls:**
- `bound require` (2)

### `async getCryptoKey`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:9` | Self: 0.0% (0us) | Total: 0.0% (9.4ms) | Samples: 0

**Called by:**
- `async (anonymous)` (6)
- `async (anonymous)` (1)

**Calls:**
- `async (anonymous)` (6)
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/bags/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `toBER`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:960` | Self: 0.0% (0us) | Total: 0.0% (4.1ms) | Samples: 0

**Called by:**
- `toASN` (2)
- `toBER` (2)

**Calls:**
- `toBER` (2)
- `toBER` (2)

### `shouldIgnoreTopicSuggestionSignal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:123` | Self: 0.0% (0us) | Total: 7.2% (2.67s) | Samples: 0

**Called by:**
- `(anonymous)` (2321)

**Calls:**
- `isOwnAddress` (1468)
- `isOwnAddress` (853)

### `wrapped`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/memoizer.js:233` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `validate` (1)

**Calls:**
- `isRecursive` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/proto.js:40` | Self: 0.0% (0us) | Total: 0.0% (8.8ms) | Samples: 0

**Called by:**
- `anonymous` (8)

**Calls:**
- `bound require` (8)

### `clone`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:334` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `bound clone` (1)

**Calls:**
- `ZodEnum` (1)

### `buildSqlContainsAny`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:927` | Self: 0.0% (0us) | Total: 0.0% (4.1ms) | Samples: 0

**Called by:**
- `buildMeaningfulAttachmentPredicateSql` (2)
- `buildMeaningfulAttachmentPredicateSql` (1)

**Calls:**
- `map` (3)

### `normalizeThreadIds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:23` | Self: 0.0% (0us) | Total: 0.0% (4.4ms) | Samples: 0

**Called by:**
- `rebuildThreadSignalsForThreadIdsInternal` (3)
- `async recomputeThreadsForAccountInternal` (1)

**Calls:**
- `map` (3)
- `filter` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/libmime.js:44` | Self: 0.0% (0us) | Total: 0.1% (39.0ms) | Samples: 0

**Called by:**
- `anonymous` (35)

**Calls:**
- `bound require` (35)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js:15` | Self: 0.0% (0us) | Total: 0.0% (15.1ms) | Samples: 0

**Calls:**
- `bound require` (13)

### `async runValidation`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/validator.mjs:20` | Self: 0.0% (0us) | Total: 0.0% (971us) | Samples: 0

**Called by:**
- `async runValidation` (1)

**Calls:**
- `validate` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha2.js:417` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `createHasher` (1)

**Calls:**
- `_SHA384` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts:89` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `forEach` (1)

**Calls:**
- `forEach` (1)

### `encrypt`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:350` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `encrypt` (1)

**Calls:**
- `(anonymous)` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/senderIdentities.ts:16` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `bound max` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:62` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `get` (1)

### `optional`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:1242` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `optional` (1)

**Calls:**
- `ZodOptional` (1)

### `async getMigrations`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:405` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `toPhysicalSchema` (1)

### `shardWriterGuardsInstalled`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:59` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `ensureAccountKeySchema` (1)

**Calls:**
- `assertSupportedShardFormat` (1)

### `async getAccountIdFromParams`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/accountContext.ts:39` | Self: 0.0% (0us) | Total: 0.0% (4.4ms) | Samples: 0

**Called by:**
- `async GET` (1)

**Calls:**
- `async getAccountIdFromParams` (1)
- `normalizeRouteParamValue` (1)

### `initMasterSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:851` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `normalizeUserEmails` (1)

### `async runBeforeHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:106` | Self: 0.0% (0us) | Total: 0.0% (7.0ms) | Samples: 0

**Called by:**
- `async (anonymous)` (6)

**Calls:**
- `async runBeforeHooks` (6)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2540` | Self: 0.0% (0us) | Total: 0.2% (98.1ms) | Samples: 0

**Calls:**
- `(anonymous)` (88)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509-attr/build/cjs/attr_cert_issuer.js:7` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async acquireConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js:63` | Self: 0.0% (0us) | Total: 0.0% (20.4ms) | Samples: 0

**Called by:**
- `async provideConnection` (7)

**Calls:**
- `async acquireConnection` (6)
- `async acquireConnection` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/result.js:3` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `fromBER`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1484` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `fromBER` (1)

**Calls:**
- `localFromBERWithChildContext` (1)

### `async runValidation`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/validator.mjs:44` | Self: 0.0% (0us) | Total: 0.0% (11.7ms) | Samples: 0

**Called by:**
- `async (anonymous)` (8)

**Calls:**
- `async runValidation` (5)
- `async runValidation` (2)
- `async runValidation` (1)

### `shouldIgnoreTopicSuggestionSignal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:127` | Self: 0.0% (0us) | Total: 0.2% (78.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (68)

**Calls:**
- `isFreeMailDomain` (46)
- `isFreeMailDomain` (22)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2514` | Self: 0.0% (0us) | Total: 0.0% (24.9ms) | Samples: 0

**Calls:**
- `forEach` (21)

### `async create`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:501` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `async create` (1)
- `(anonymous)` (1)

**Calls:**
- `values` (1)
- `async create` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:37` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema/session.mjs:6` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `_date` (1)

### `loadManualCategoryStatesForMessageIds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:317` | Self: 0.0% (0us) | Total: 0.0% (4.8ms) | Samples: 0

**Called by:**
- `async (anonymous)` (4)

**Calls:**
- `(anonymous)` (4)

### `(module)`
`/tmp/spike-switch-server/inspect.ts:7` | Self: 0.0% (0us) | Total: 0.0% (3.4ms) | Samples: 0

**Calls:**
- `async buildFixture` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs:248` | Self: 0.0% (0us) | Total: 0.0% (2.9ms) | Samples: 0

**Called by:**
- `async getSessionFromCtx` (1)

**Calls:**
- `createConfiguredEndpoint` (1)

### `get`
`/tmp/spike-switch-server/inspect.ts:12` | Self: 0.0% (0us) | Total: 0.0% (2.9ms) | Samples: 0

**Called by:**
- `(module)` (3)

**Calls:**
- `header` (3)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/parse5/dist/common/foreign-content.js:121` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `map` (1)

### `async upsertAccount`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accounts.ts:104` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async buildFixture` (1)

**Calls:**
- `async withDbWriteRetry` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:72` | Self: 0.0% (0us) | Total: 0.0% (9.4ms) | Samples: 0

**Called by:**
- `async (anonymous)` (8)

**Calls:**
- `async validateAccountFolders` (8)

### `readUserById`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/users.ts:32` | Self: 0.0% (0us) | Total: 0.2% (74.1ms) | Samples: 0

**Called by:**
- `async getUserById` (39)

**Calls:**
- `(anonymous)` (28)
- `(anonymous)` (10)
- `wrapStatement` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/attributes/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (3.1ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `bound require` (3)

### `parseValueBinaryOperation`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/binary-operation-parser.js:25` | Self: 0.0% (0us) | Total: 0.0% (9.6ms) | Samples: 0

**Called by:**
- `binary` (7)
- `where` (1)

**Calls:**
- `parseStringReferenceWithTable` (2)
- `parseStringReference` (2)
- `create` (1)
- `freeze` (1)
- `create` (1)
- `create` (1)

### `normalizeUserEmails`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:240` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `initMasterSchema` (1)

**Calls:**
- `transaction` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/tools.js:29` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino-std-serializers/lib/err.js:6` | Self: 0.0% (0us) | Total: 0.0% (986us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async ensureCalendarEventRuntimeData`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:662` | Self: 0.0% (0us) | Total: 0.0% (18.9ms) | Samples: 0

**Calls:**
- `getOwnAddresses` (13)
- `getOwnAddresses` (2)
- `getOwnAddresses` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:670` | Self: 0.0% (0us) | Total: 0.0% (981us) | Samples: 0

**Called by:**
- `async delete` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/authPolicy.ts:265` | Self: 0.0% (0us) | Total: 0.0% (952us) | Samples: 0

**Called by:**
- `transaction` (1)

**Calls:**
- `ensureTableColumns` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/index.js:8` | Self: 0.0% (0us) | Total: 0.0% (952us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `getAuthTables`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/get-tables.mjs:297` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `getAuthTablesWithResolvedIndexes` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:667` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `NameIdentifier` (1)

### `installShardWriterGuards`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:85` | Self: 0.0% (0us) | Total: 0.0% (8.8ms) | Samples: 0

**Called by:**
- `migrate` (8)

**Calls:**
- `(anonymous)` (6)
- `guards` (1)
- `guards` (1)

### `enrollmentState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/authPolicy.ts:376` | Self: 0.0% (0us) | Total: 0.0% (11.1ms) | Samples: 0

**Called by:**
- `async isMfaEnrollmentComplete` (8)

**Calls:**
- `(anonymous)` (8)

### `async assertAccountFolder`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/folderAccountGuard.ts:8` | Self: 0.0% (0us) | Total: 0.0% (26.5ms) | Samples: 0

**Calls:**
- `(anonymous)` (12)
- `(anonymous)` (10)

### `async GET`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:58` | Self: 0.0% (0us) | Total: 0.0% (17.5ms) | Samples: 0

**Calls:**
- `async withAuthResponse` (15)

### `bound meta`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `meta` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:281` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `async reconcileProvisioning` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/shared/lib/router/utils/parse-loader-tree.js:11` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/bags/index.js:8` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:21` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `ensureInviteIssuerSchema`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:127` | Self: 0.0% (0us) | Total: 0.0% (1.8ms) | Samples: 0

**Called by:**
- `initMasterSchema` (1)

**Calls:**
- `transaction` (1)

### `DecorateProperty`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:561` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `decorate` (1)

**Calls:**
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/middleware.mjs:9` | Self: 0.0% (0us) | Total: 0.0% (14.1ms) | Samples: 0

**Called by:**
- `async internalHandler` (11)

**Calls:**
- `async createInternalContext` (8)
- `async createInternalContext` (2)
- `async createInternalContext` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/attributes/index.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `object`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:906` | Self: 0.0% (0us) | Total: 0.0% (6.9ms) | Samples: 0

**Called by:**
- `(module)` (1)
- `(module)` (1)
- `(module)` (1)
- `(module)` (1)
- `(module)` (1)

**Calls:**
- `ZodObject` (4)
- `ZodObject` (1)

### `DBCSCodec`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:116` | Self: 0.0% (0us) | Total: 0.0% (3.4ms) | Samples: 0

**Called by:**
- `getCodec` (3)

**Calls:**
- `(anonymous)` (3)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2611` | Self: 0.0% (0us) | Total: 0.0% (8.8ms) | Samples: 0

**Calls:**
- `map` (8)

### `meta`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:108` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `bound meta` (1)

**Calls:**
- `bound clone` (1)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:70` | Self: 0.0% (0us) | Total: 0.0% (4.7ms) | Samples: 0

**Calls:**
- `async withDbWriteRetry` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/totp/index.mjs:208` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Calls:**
- `async updateUser` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:173` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Calls:**
- `(anonymous)` (2)

### `async findSchemaProblems`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:262` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `async findSchemaProblems` (1)

### `normalizeDef`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js:940` | Self: 0.0% (0us) | Total: 0.0% (969us) | Samples: 0

**Called by:**
- `get value` (1)

**Calls:**
- `filter` (1)

### `async runWithEndpointContext`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/endpoint-context.mjs:45` | Self: 0.0% (0us) | Total: 0.1% (52.3ms) | Samples: 0

**Calls:**
- `run` (39)

### `pruneThreadTopicsWithoutMessages`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:171` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `addColumn`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/schema/create-table-builder.js:124` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async getMigrations` (1)

**Calls:**
- `(anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:377` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async handleFallbackJoin` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/redaction.js:4` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `_minLength`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/api.js:604` | Self: 0.0% (0us) | Total: 0.0% (1.4ms) | Samples: 0

**Called by:**
- `min` (1)

**Calls:**
- `$ZodCheckMinLength` (1)

### `async enrichMessagesWithThreadCollab`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadCollab.ts:12` | Self: 0.0% (0us) | Total: 0.0% (4.7ms) | Samples: 0

**Called by:**
- `async enrichMessagesWithThreadCollab` (4)

**Calls:**
- `async getThreadCollabStates` (4)

### `LocalSidValueBlock`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:2208` | Self: 0.0% (0us) | Total: 0.0% (968us) | Samples: 0

**Called by:**
- `fromString` (1)

**Calls:**
- `Some` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:32` | Self: 0.0% (0us) | Total: 0.0% (21.8ms) | Samples: 0

**Calls:**
- `bound require` (19)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/postcss.js:9` | Self: 0.0% (0us) | Total: 0.0% (8.6ms) | Samples: 0

**Called by:**
- `anonymous` (7)

**Calls:**
- `bound require` (7)

### `async assertAccountFolder`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/folderAccountGuard.ts:7` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async assertAccountFolder` (1)

**Calls:**
- `async getAccountDb` (1)

### `async transformSingleOutput`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:180` | Self: 0.0% (0us) | Total: 0.0% (28.9ms) | Samples: 0

**Called by:**
- `async (anonymous)` (13)
- `async (anonymous)` (10)

**Calls:**
- `async (anonymous)` (5)
- `async (anonymous)` (5)
- `async (anonymous)` (2)
- `async (anonymous)` (2)
- `async (anonymous)` (2)
- `async (anonymous)` (1)
- `async (anonymous)` (1)
- `async (anonymous)` (1)
- `async (anonymous)` (1)
- `async (anonymous)` (1)
- `async (anonymous)` (1)
- `async (anonymous)` (1)

### `forwardAuthHeaders`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:30` | Self: 0.0% (0us) | Total: 0.0% (6.9ms) | Samples: 0

**Called by:**
- `async withAuthResponse` (6)

**Calls:**
- `forEach` (6)

### `__extends`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js:506` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `__` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:28` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sanitize-html/index.js:1` | Self: 0.0% (0us) | Total: 0.0% (29.9ms) | Samples: 0

**Calls:**
- `bound require` (12)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/socks/build/common/helpers.js:11` | Self: 0.0% (0us) | Total: 0.0% (7.2ms) | Samples: 0

**Called by:**
- `anonymous` (6)

**Calls:**
- `bound require` (6)

### `parseRowValues`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/insert-values-parser.js:39` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `map` (1)

**Calls:**
- `from` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js:14` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Calls:**
- `bound require` (3)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/parseley/lib/parseley.mjs:123` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `ahead` (1)

### `_interopNamespaceDefault`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js:42` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `forEach` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/auth/switch-account/route.ts:28` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async withAuthResponse` (1)

**Calls:**
- `async (anonymous)` (1)

### `visitIdentifier`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js:298` | Self: 0.0% (0us) | Total: 0.0% (4.0ms) | Samples: 0

**Called by:**
- `bound visitIdentifier` (1)

**Calls:**
- `compileUnwrappedIdentifier` (1)

### `async getDatabaseColumnBounds`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:279` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async getMigrations` (1)

**Calls:**
- `async getDatabaseColumnBounds` (1)

### `init`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js:65` | Self: 0.0% (0us) | Total: 0.1% (41.6ms) | Samples: 0

**Called by:**
- `ZodString` (3)
- `ZodObject` (3)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (2)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `ZodEnum` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `ZodOptional` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `ZodDefault` (1)
- `$ZodCheckMinLength` (1)
- `ZodEmail` (1)
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (3)
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

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/tsyringe/dist/cjs/dependency-container.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async releaseConnection`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs:47` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `async releaseConnection` (1)

**Calls:**
- `unlock` (1)

### `async getAccountById`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/serverDb.ts:25` | Self: 0.0% (0us) | Total: 0.0% (10.9ms) | Samples: 0

**Called by:**
- `async getAccountById` (9)

**Calls:**
- `loadServerDb` (9)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/certificate.js:7` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `node:fs`
`node:fs:8` | Self: 0.0% (0us) | Total: 0.0% (3.5ms) | Samples: 0

**Calls:**
- `anonymous` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pfx/build/cjs/bags/key_bag.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/authPolicy.ts:222` | Self: 0.0% (0us) | Total: 0.0% (2.6ms) | Samples: 0

**Called by:**
- `filter` (1)

**Calls:**
- `schemaSql` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/mailparser/dist/esm/mail-parser.js:43` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Calls:**
- `add` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/recipient_infos.js:7` | Self: 0.0% (0us) | Total: 0.0% (3.3ms) | Samples: 0

**Called by:**
- `anonymous` (3)

**Calls:**
- `bound require` (3)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/utils.js:35` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async withDbWriteRetry`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/dbWriteRetry.ts:117` | Self: 0.0% (0us) | Total: 0.9% (346.3ms) | Samples: 0

**Called by:**
- `async getAccountDb` (37)
- `async getDb` (35)
- `async createAuthenticatedTestSession` (3)
- `async buildFixture` (2)
- `async buildFixture` (2)
- `async buildFixture` (1)
- `async (anonymous)` (1)
- `async upsertAccount` (1)
- `async (anonymous)` (1)

**Calls:**
- `async withDbWriteRetry` (83)

### `addColumn`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/schema/create-table-builder.js:125` | Self: 0.0% (0us) | Total: 0.0% (974us) | Samples: 0

**Called by:**
- `async getMigrations` (1)

**Calls:**
- `CreateTableBuilder` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/index.js:7` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/authPolicy.ts:243` | Self: 0.0% (0us) | Total: 0.0% (2.6ms) | Samples: 0

**Called by:**
- `transaction` (1)

**Calls:**
- `isInstalledControlPlane` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/bytes/index.js:17` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/decorators.js:7` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `isPlainObject`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:237` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `extend` (1)

**Calls:**
- `isObject` (1)

### `async requireActiveUserSession`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:71` | Self: 0.0% (0us) | Total: 0.0% (3.1ms) | Samples: 0

**Calls:**
- `async getDb` (1)
- `async getDb` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/comment.js:3` | Self: 0.0% (0us) | Total: 0.0% (6.9ms) | Samples: 0

**Called by:**
- `anonymous` (6)

**Calls:**
- `bound require` (6)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs:193` | Self: 0.0% (0us) | Total: 0.0% (6.5ms) | Samples: 0

**Calls:**
- `_email` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:617` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `async updateUser` (1)

**Calls:**
- `async updateWithHooks` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts:104` | Self: 0.0% (0us) | Total: 0.0% (17.5ms) | Samples: 0

**Called by:**
- `async withAuthResponse` (15)

**Calls:**
- `async (anonymous)` (8)
- `async (anonymous)` (4)
- `async (anonymous)` (2)
- `async (anonymous)` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:48` | Self: 0.0% (0us) | Total: 0.0% (28.3ms) | Samples: 0

**Called by:**
- `async getSignedCookie` (6)

**Calls:**
- `async verifySignature` (16)
- `async getCryptoKey` (6)

### `guards`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:47` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `installShardWriterGuards` (1)

**Calls:**
- `scopedTables` (1)

### `schemaSql`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/authPolicy.ts:134` | Self: 0.0% (0us) | Total: 0.0% (2.6ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `(anonymous)` (1)

### `async dispatchAuthEndpoint`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:205` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `startActiveSpan` (1)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs:648` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `addColumn` (1)

**Calls:**
- `getReferencePath` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:751` | Self: 0.0% (0us) | Total: 5.9% (2.19s) | Samples: 0

**Called by:**
- `transaction` (1841)

**Calls:**
- `upsertBatch` (1841)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/postcss/lib/input.js:9` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/outboundWrite.ts:27` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Calls:**
- `async (anonymous)` (2)

### `parseExpression`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/expression-parser.js:11` | Self: 0.0% (0us) | Total: 0.0% (31.7ms) | Samples: 0

**Called by:**
- `where` (17)
- `where` (1)

**Calls:**
- `(anonymous)` (10)
- `createExpressionBuilder` (5)
- `(anonymous)` (1)
- `and` (1)
- `createExpressionBuilder` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:397` | Self: 0.0% (0us) | Total: 0.0% (969us) | Samples: 0

**Called by:**
- `filter` (1)

**Calls:**
- `get` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs:71` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `async (anonymous)` (2)

**Calls:**
- `selectFrom` (2)

### `DBCSCodec`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js:44` | Self: 0.0% (0us) | Total: 0.0% (979us) | Samples: 0

**Called by:**
- `getCodec` (1)

**Calls:**
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sanitize-html/index.js:5` | Self: 0.0% (0us) | Total: 0.0% (26.4ms) | Samples: 0

**Calls:**
- `bound require` (21)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testAuthHarness.ts:171` | Self: 0.0% (0us) | Total: 0.0% (2.5ms) | Samples: 0

**Called by:**
- `run` (1)

**Calls:**
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1638` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `(anonymous)` (1)

### `async ensureAuthLifetimeLock`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authLifetimeLock.ts:75` | Self: 0.0% (0us) | Total: 0.0% (3.0ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async acquireAuthLifetimeLock` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:14` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `async verifySignature` (1)

**Calls:**
- `Uint8Array` (1)

### `final`
`node:crypto:344` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `decryptPayload` (1)

**Calls:**
- `final` (1)

### `transaction`
`bun:sqlite:447` | Self: 0.0% (0us) | Total: 6.0% (2.23s) | Samples: 0

**Called by:**
- `async (anonymous)` (1842)
- `initAccountSchema` (25)
- `async buildFixture` (6)
- `installAuthControlPlane` (5)
- `async (anonymous)` (1)
- `ensureMasterTeamColumns` (1)

**Calls:**
- `(anonymous)` (1841)
- `ensureAccountKeySchema` (15)
- `(anonymous)` (6)
- `initAccountSchemaBody` (5)
- `initAccountSchemaBody` (2)
- `initAccountSchemaBody` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `initAccountSchemaBody` (1)
- `(anonymous)` (1)
- `(anonymous)` (1)
- `initAccountSchemaBody` (1)
- `(anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/segment-config/ensure-static.js:28` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/device-authorization/index.mjs:10` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Calls:**
- `custom` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/react/index.js:6` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `[prepareOwned]`
`bun:sqlite:369` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `query` (1)

**Calls:**
- `prepare` (1)

### `async internalHandler`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/middleware.mjs:29` | Self: 0.0% (0us) | Total: 0.0% (15.3ms) | Samples: 0

**Called by:**
- `async (anonymous)` (7)
- `(anonymous)` (5)

**Calls:**
- `async (anonymous)` (11)
- `async (anonymous)` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/encoding/index.js:8` | Self: 0.0% (0us) | Total: 0.0% (983us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2684` | Self: 0.0% (0us) | Total: 5.7% (2.13s) | Samples: 0

**Calls:**
- `async getThreadGroupCounts` (1813)
- `async getThreadGroupCounts` (36)
- `async getThreadGroupCounts` (6)
- `async getThreadGroupCounts` (2)
- `async getThreadGroupCounts` (2)
- `async getThreadGroupCounts` (1)
- `async getThreadGroupCounts` (1)
- `async getThreadGroupCounts` (1)

### `computeTag`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:318` | Self: 0.0% (0us) | Total: 0.0% (2.7ms) | Samples: 0

**Called by:**
- `decrypt` (1)
- `encrypt` (1)

**Calls:**
- `(anonymous)` (2)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:38` | Self: 0.0% (0us) | Total: 0.0% (2.5ms) | Samples: 0

**Calls:**
- `(anonymous)` (2)

### `async getDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:300` | Self: 0.0% (0us) | Total: 0.0% (9.0ms) | Samples: 0

**Calls:**
- `configureDb` (4)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-pkcs9/build/cjs/index.js:9` | Self: 0.0% (0us) | Total: 0.0% (7.2ms) | Samples: 0

**Called by:**
- `anonymous` (6)

**Calls:**
- `bound require` (6)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:153` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `async makeSignature`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs:24` | Self: 0.0% (0us) | Total: 0.0% (2.8ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `async (anonymous)` (1)

### `async executeQuery`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js:99` | Self: 0.0% (0us) | Total: 0.0% (30.1ms) | Samples: 0

**Called by:**
- `async execute` (11)
- `async execute` (1)

**Calls:**
- `async executeQuery` (9)
- `async executeQuery` (2)
- `async executeQuery` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:714` | Self: 0.0% (0us) | Total: 0.0% (7.3ms) | Samples: 0

**Calls:**
- `Map` (4)
- `map` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/index.js:8` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Calls:**
- `bound require` (1)

### `scopedTables`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts:31` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `guards` (1)

**Calls:**
- `(anonymous)` (1)

### `async update`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:510` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async updateWithHooks` (1)

**Calls:**
- `async (anonymous)` (1)

### `async ensureAsyncStorage`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/transaction.mjs:12` | Self: 0.0% (0us) | Total: 0.0% (1.7ms) | Samples: 0

**Called by:**
- `async getCurrentAdapter` (1)

**Calls:**
- `async (anonymous)` (1)

### `(module)`
`/tmp/spike-switch-server/inspect.ts:27` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Calls:**
- `exit` (2)

### `rebuildThreadSignalsForThreadIdsInternal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:94` | Self: 0.0% (0us) | Total: 0.0% (4.4ms) | Samples: 0

**Called by:**
- `async rebuildThreadSignalsForThreadIds` (4)

**Calls:**
- `(anonymous)` (4)

### `hchacha`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:154` | Self: 0.0% (0us) | Total: 0.0% (2.7ms) | Samples: 0

**Called by:**
- `(anonymous)` (2)

**Calls:**
- `chachaCore` (1)
- `chachaCore` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/converters/index.js:4` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:444` | Self: 0.0% (0us) | Total: 0.0% (15.9ms) | Samples: 0

**Called by:**
- `forEach` (14)

**Calls:**
- `(anonymous)` (12)
- `(anonymous)` (1)
- `(anonymous)` (1)

### `bound visitSelection`
`[native code]` | Self: 0.0% (0us) | Total: 0.0% (14.0ms) | Samples: 0

**Called by:**
- `visitNode` (5)

**Calls:**
- `visitSelection` (5)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:368` | Self: 0.0% (0us) | Total: 0.0% (5.7ms) | Samples: 0

**Calls:**
- `filterOutputFields` (4)
- `reduce` (1)

### `async getUserById`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/users.ts:73` | Self: 0.0% (0us) | Total: 0.2% (81.0ms) | Samples: 0

**Called by:**
- `async getUserById` (2)

**Calls:**
- `readUserById` (39)
- `mapUserRow` (1)
- `async getUserById` (1)
- `async getUserById` (1)
- `mapUserRow` (1)

### `async buildFixture`
`/tmp/spike-switch-server/fixture.ts:78` | Self: 0.0% (0us) | Total: 0.0% (3.0ms) | Samples: 0

**Calls:**
- `closeAccountDbConnection` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts:275` | Self: 0.0% (0us) | Total: 0.0% (8.1ms) | Samples: 0

**Calls:**
- `installAuthControlPlane` (6)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/charset.js:42` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `Map` (1)

### `ObjectIdentifier`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:2473` | Self: 0.0% (0us) | Total: 0.0% (1.9ms) | Samples: 0

**Called by:**
- `toASN` (1)
- `create` (1)

**Calls:**
- `BaseBlock` (2)

### `sentIdentifiers`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs:221` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `toPhysicalSchema` (1)

**Calls:**
- `map` (1)

### `installAuthControlPlane`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/authPolicy.ts:308` | Self: 0.0% (0us) | Total: 0.0% (8.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (6)

**Calls:**
- `transaction` (5)
- `transaction` (1)

### `Address4`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv4.js:87` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `parse` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/authority_information_access.js:8` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/crl_issuing_distribution_point.js:5` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `strict`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:870` | Self: 0.0% (0us) | Total: 0.0% (5.1ms) | Samples: 0

**Called by:**
- `bound strict` (1)

**Calls:**
- `defineProperties` (1)

### `shouldIgnoreTopicSuggestionSignal`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:117` | Self: 0.0% (0us) | Total: 3.9% (1.46s) | Samples: 0

**Called by:**
- `(anonymous)` (1273)

**Calls:**
- `ownAddressList` (1108)
- `ownAddressList` (165)

### `ftsIdentitySchemaInstalled`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/ftsIdentity.ts:17` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `shardWriterGuardsInstalled` (1)

**Calls:**
- `(anonymous)` (1)

### `decorate`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/reflect-metadata/Reflect.js:136` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `__decorate` (1)

**Calls:**
- `DecorateProperty` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:491` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Calls:**
- `(anonymous)` (2)

### `listSenderIdentityRows`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/senderIdentities.ts:11` | Self: 0.0% (0us) | Total: 0.0% (10.2ms) | Samples: 0

**Called by:**
- `async getAccountById` (9)

**Calls:**
- `(anonymous)` (4)
- `(anonymous)` (3)
- `wrapStatement` (2)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs:86` | Self: 0.0% (0us) | Total: 0.0% (999us) | Samples: 0

**Calls:**
- `cookies` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/social-providers/index.mjs:78` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Calls:**
- `own` (1)

### `getChunkedCookie`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/session-store.mjs:142` | Self: 0.0% (0us) | Total: 0.0% (3.1ms) | Samples: 0

**Called by:**
- `async (anonymous)` (3)

**Calls:**
- `parseCookies` (1)
- `parseCookies` (1)
- `parseCookies` (1)

### `decryptPayload`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/secret.ts:60` | Self: 0.0% (0us) | Total: 0.0% (32.7ms) | Samples: 0

**Called by:**
- `decodeSecret` (24)

**Calls:**
- `createDecipheriv` (18)
- `(anonymous)` (5)
- `getKey` (1)

### `hchacha`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js:167` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `clean` (1)

### `_date`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/api.js:480` | Self: 0.0% (0us) | Total: 0.0% (2.7ms) | Samples: 0

**Called by:**
- `(module)` (1)
- `(module)` (1)

**Calls:**
- `ZodDate` (1)
- `ZodDate` (1)

### `async listThreads`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts:2227` | Self: 0.0% (0us) | Total: 0.0% (2.0ms) | Samples: 0

**Calls:**
- `async getAccountOwnAddresses` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts:37` | Self: 0.0% (0us) | Total: 0.0% (2.3ms) | Samples: 0

**Called by:**
- `forEach` (2)

**Calls:**
- `set` (2)

### `toOperationNode`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/raw-builder/raw-builder.js:80` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `parseTableExpressionOrList` (1)

**Calls:**
- `toOperationNode` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/user-agent.js:27` | Self: 0.0% (0us) | Total: 0.0% (2.4ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testDbHarness.ts:43` | Self: 0.0% (0us) | Total: 0.0% (1.3ms) | Samples: 0

**Called by:**
- `exit` (1)

**Calls:**
- `rmSync` (1)

### `createDecipheriv`
`node:crypto:362` | Self: 0.0% (0us) | Total: 0.0% (25.9ms) | Samples: 0

**Called by:**
- `decryptPayload` (18)

**Calls:**
- `Decipheriv2` (18)

### `deriveSystemFlagState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts:317` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `some` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts:409` | Self: 0.0% (0us) | Total: 0.0% (25.6ms) | Samples: 0

**Called by:**
- `forEach` (23)

**Calls:**
- `(anonymous)` (21)
- `(anonymous)` (2)

### `async enrichMessagesWithThreadCollab`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadCollab.ts:18` | Self: 0.0% (0us) | Total: 0.1% (73.3ms) | Samples: 0

**Called by:**
- `async (anonymous)` (64)

**Calls:**
- `async enrichMessagesWithThreadCollab` (37)
- `async enrichMessagesWithThreadCollab` (23)
- `async enrichMessagesWithThreadCollab` (4)

### `insertThreadSignalsFromMessageRows`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts:50` | Self: 0.0% (0us) | Total: 19.9% (7.38s) | Samples: 0

**Called by:**
- `rebuildThreadSignalsForThreadIdsInternal` (1830)
- `rebuildAllThreadSignalsForAccountInternal` (957)

**Calls:**
- `forEach` (2787)

### `node:_http_client`
`node:_http_client:16` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `channel` (1)

### `internal:streams/legacy`
`internal:streams/legacy:2` | Self: 0.0% (0us) | Total: 0.0% (3.9ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `anonymous` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js:854` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `init` (1)

**Calls:**
- `installLazyProp` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs:367` | Self: 0.0% (0us) | Total: 0.0% (25.8ms) | Samples: 0

**Calls:**
- `filterOutputFields` (8)
- `filterOutputFields` (3)
- `reduce` (2)

### `onUpdate`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/get-tables.mjs:121` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `async (anonymous)` (1)

**Calls:**
- `Date` (1)

### `async deleteWithHooks`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/with-hooks.mjs:120` | Self: 0.0% (0us) | Total: 0.0% (967us) | Samples: 0

**Calls:**
- `async findMany` (1)

### `async getAccountDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts:369` | Self: 0.0% (0us) | Total: 0.0% (7.9ms) | Samples: 0

**Called by:**
- `async getAccountDb` (7)

**Calls:**
- `async resolveAccountDbPath` (7)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/utils/build/cjs/converters/index.js:17` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:15` | Self: 0.0% (0us) | Total: 0.0% (949us) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `(module)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/logger.mjs:78` | Self: 0.0% (0us) | Total: 0.1% (57.9ms) | Samples: 0

**Calls:**
- `createLogger` (1)

### `getTopicSuggestionSignalsForThreadsFromDb`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts:190` | Self: 0.0% (0us) | Total: 0.0% (3.7ms) | Samples: 0

**Called by:**
- `(anonymous)` (2)

**Calls:**
- `map` (1)
- `join` (1)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs:210` | Self: 0.0% (0us) | Total: 0.0% (7.0ms) | Samples: 0

**Called by:**
- `async (anonymous)` (6)

**Calls:**
- `async runBeforeHooks` (6)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs:348` | Self: 0.0% (0us) | Total: 0.0% (1.9ms) | Samples: 0

**Called by:**
- `async handleFallbackJoin` (1)

**Calls:**
- `(anonymous)` (1)

### `async hasRequestState`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs:16` | Self: 0.0% (0us) | Total: 0.0% (11.6ms) | Samples: 0

**Called by:**
- `async (anonymous)` (4)
- `async hasRequestState` (4)

**Calls:**
- `async hasRequestState` (4)
- `async ensureAsyncStorage` (4)

### `getEnumValues`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js:19` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `entries` (1)

### `backfillCalendarReminderEventUidKeys`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:1446` | Self: 0.0% (0us) | Total: 0.0% (2.7ms) | Samples: 0

**Called by:**
- `ensureCalendarReminderOptionalColumns` (1)

**Calls:**
- `(anonymous)` (1)

### `install`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts:927` | Self: 0.0% (0us) | Total: 0.0% (2.1ms) | Samples: 0

**Called by:**
- `ensureThreadCollabRuntimeSchema` (1)

**Calls:**
- `(anonymous)` (1)

### `_parseAddressList`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js:1196` | Self: 0.0% (0us) | Total: 0.0% (7.0ms) | Samples: 0

**Called by:**
- `addressparser` (3)

**Calls:**
- `_mergeNameFragments` (3)

### `async (anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs:13` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Calls:**
- `get` (2)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/dynamic-rendering.js:151` | Self: 0.0% (0us) | Total: 0.0% (2.6ms) | Samples: 0

**Called by:**
- `anonymous` (2)

**Calls:**
- `bound require` (2)

### `parseInsertColumnsAndValues`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/insert-values-parser.js:22` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `values` (1)

**Calls:**
- `map` (1)

### `(anonymous)`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-x509/build/cjs/extensions/index.js:12` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `anonymous` (1)

**Calls:**
- `bound require` (1)

### `fromBER`
`/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js:1541` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `localFromBER` (1)

**Calls:**
- `fromBER` (1)

## Files

| Self% | Self | File |
|------:|-----:|------|
| 76.6% | 28.37s | `[native code]` |
| 7.4% | 2.77s | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/ownAddresses.ts` |
| 3.8% | 1.42s | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/addressparser/index.js` |
| 1.8% | 686.9ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/suggestions.ts` |
| 1.3% | 498.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/i18n/format.ts` |
| 0.7% | 259.6ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/factory.mjs` |
| 0.6% | 255.9ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/query.ts` |
| 0.5% | 200.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/internal-adapter.mjs` |
| 0.5% | 186.8ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testAuthHarness.ts` |
| 0.4% | 177.6ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/env-impl.mjs` |
| 0.4% | 170.9ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/object-utils.js` |
| 0.3% | 126.6ms | `/tmp/spike-switch-server/sqlcounter.ts` |
| 0.3% | 113.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageGrouping.ts` |
| 0.3% | 113.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadTopics.ts` |
| 0.2% | 98.5ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/senderIdentity.ts` |
| 0.2% | 92.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/context.mjs` |
| 0.2% | 91.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/upsert.ts` |
| 0.2% | 89.9ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/web/spec-extension/response.js` |
| 0.2% | 86.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/enrichMessagesWithThreadCollab.ts` |
| 0.1% | 65.6ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-compiler/default-query-compiler.js` |
| 0.1% | 60.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/env/color-depth.mjs` |
| 0.1% | 48.8ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-builder.js` |
| 0.1% | 47.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/dispatch.mjs` |
| 0.1% | 46.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/accounts/[accountId]/threads/route.ts` |
| 0.1% | 44.9ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topicSignals.ts` |
| 0.1% | 39.6ms | `bun:sqlite` |
| 0.0% | 34.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/session-store.mjs` |
| 0.0% | 32.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/_shared.ts` |
| 0.0% | 28.2ms | `node:dns` |
| 0.0% | 25.8ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/function-module.js` |
| 0.0% | 25.8ms | `node:async_hooks` |
| 0.0% | 24.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/index.mjs` |
| 0.0% | 23.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-field-name.mjs` |
| 0.0% | 20.8ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-executor/query-executor-base.js` |
| 0.0% | 19.9ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/connection.ts` |
| 0.0% | 19.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/bun-sqlite-dialect-DoOVo4ja.mjs` |
| 0.0% | 18.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/esm/mimetypes.js` |
| 0.0% | 17.8ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/operation-node-visitor.js` |
| 0.0% | 16.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threadCollab.ts` |
| 0.0% | 15.6ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/schema.ts` |
| 0.0% | 15.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/ftsIdentity.ts` |
| 0.0% | 15.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/request-state.mjs` |
| 0.0% | 14.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/select-query-node.js` |
| 0.0% | 12.9ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/secret.ts` |
| 0.0% | 11.9ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-id-field.mjs` |
| 0.0% | 11.7ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/shardFormat.ts` |
| 0.0% | 11.6ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/rowParsers.ts` |
| 0.0% | 11.5ms | `/tmp/spike-switch-server/fixture.ts` |
| 0.0% | 10.9ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/storage.ts` |
| 0.0% | 9.9ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/accountContext.ts` |
| 0.0% | 9.8ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/select-parser.js` |
| 0.0% | 9.6ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/schemas.js` |
| 0.0% | 9.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/binary-operation-parser.js` |
| 0.0% | 9.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/where-node.js` |
| 0.0% | 8.7ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/core.js` |
| 0.0% | 8.7ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/expression-parser.js` |
| 0.0% | 8.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/he/he.js` |
| 0.0% | 8.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/topics/core.ts` |
| 0.0% | 8.0ms | `/tmp/spike-switch-server/inspect.ts` |
| 0.0% | 8.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/auth.ts` |
| 0.0% | 8.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/senderIdentities.ts` |
| 0.0% | 7.8ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/threads.ts` |
| 0.0% | 7.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/folderAccount.ts` |
| 0.0% | 6.9ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/cookies.mjs` |
| 0.0% | 6.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/transaction.mjs` |
| 0.0% | 5.5ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/integrations/next-js.mjs` |
| 0.0% | 5.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/tracer.mjs` |
| 0.0% | 5.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/asn1js/build/index.js` |
| 0.0% | 5.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/accountAccess.ts` |
| 0.0% | 5.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/app-render/work-unit-async-storage.external.js` |
| 0.0% | 5.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-builder/select-query-builder.js` |
| 0.0% | 5.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/endpoint.mjs` |
| 0.0% | 5.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authPolicyHandler.ts` |
| 0.0% | 5.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/reference-parser.js` |
| 0.0% | 4.7ms | `node:crypto` |
| 0.0% | 4.6ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/rrule/dist/es5/rrule.js` |
| 0.0% | 4.5ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accounts.ts` |
| 0.0% | 4.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/node_modules/iconv-lite/encodings/dbcs-codec.js` |
| 0.0% | 4.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/serverDb.ts` |
| 0.0% | 4.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/index.mjs` |
| 0.0% | 4.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/session.mjs` |
| 0.0% | 4.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/crypto.mjs` |
| 0.0% | 3.8ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/accountSettings.ts` |
| 0.0% | 3.8ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/index.mjs` |
| 0.0% | 3.8ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/index.mjs` |
| 0.0% | 3.8ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/dialect/pglite/pglite-driver.js` |
| 0.0% | 3.6ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/to-auth-endpoints.mjs` |
| 0.0% | 3.6ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/schema-check.mjs` |
| 0.0% | 3.6ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/messageFlags.ts` |
| 0.0% | 3.6ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/get-migration.mjs` |
| 0.0% | 3.5ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/topics.ts` |
| 0.0% | 3.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/defu/dist/defu.mjs` |
| 0.0% | 3.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/runtime-driver.js` |
| 0.0% | 3.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/db/with-hooks.mjs` |
| 0.0% | 3.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/users.ts` |
| 0.0% | 3.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/util.js` |
| 0.0% | 3.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/classic/schemas.js` |
| 0.0% | 3.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/kysely-adapter/dist/sqlite-introspector-DSCAP82F.mjs` |
| 0.0% | 3.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/get-tables.mjs` |
| 0.0% | 3.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authLifetimeLock.ts` |
| 0.0% | 3.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-default-model-name.mjs` |
| 0.0% | 2.7ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/chacha.js` |
| 0.0% | 2.6ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/utils/db.mjs` |
| 0.0% | 2.6ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_poly1305.js` |
| 0.0% | 2.5ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/validator.mjs` |
| 0.0% | 2.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/ip-address/dist/ipv6.js` |
| 0.0% | 2.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/cjs/libmime.js` |
| 0.0% | 2.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/_md.js` |
| 0.0% | 2.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/utils/password.mjs` |
| 0.0% | 2.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/memoizer.js` |
| 0.0% | 2.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/compiled/ua-parser-js/ua-parser.js` |
| 0.0% | 2.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/reference-node.js` |
| 0.0% | 2.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/hashes/sha3.js` |
| 0.0% | 2.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/util/log.js` |
| 0.0% | 2.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/mail/categorization/linearModel.ts` |
| 0.0% | 2.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/folderAccountGuard.ts` |
| 0.0% | 2.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/nodemailer/dist/esm/well-known/index.js` |
| 0.0% | 2.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/schema/create-table-builder.js` |
| 0.0% | 2.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/internal/decode-shared.js` |
| 0.0% | 2.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/api/index.mjs` |
| 0.0% | 2.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/middleware.mjs` |
| 0.0% | 2.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/utils.js` |
| 0.0% | 2.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/accountRole.ts` |
| 0.0% | 2.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-name.mjs` |
| 0.0% | 2.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/calendarEventUids.ts` |
| 0.0% | 2.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/testDbHarness.ts` |
| 0.0% | 2.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/cookies/cookie-utils.mjs` |
| 0.0% | 1.9ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/messages/identityMetadata.ts` |
| 0.0% | 1.9ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/decorators.js` |
| 0.0% | 1.6ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/driver/default-connection-provider.js` |
| 0.0% | 1.5ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/binary-operation-node.js` |
| 0.0% | 1.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/oauth-popup/index.mjs` |
| 0.0% | 1.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/checks.js` |
| 0.0% | 1.4ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/betterAuth.ts` |
| 0.0% | 1.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-call/dist/error.mjs` |
| 0.0% | 1.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/react/cjs/react.development.js` |
| 0.0% | 1.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/two-factor/verify-two-factor.mjs` |
| 0.0% | 1.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/sanitize-html/node_modules/htmlparser2/node_modules/domutils/node_modules/dom-serializer/dist/foreign-names.js` |
| 0.0% | 1.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/dom-serializer/node_modules/entities/lib/esm/generated/decode-data-html.js` |
| 0.0% | 1.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/context/global.mjs` |
| 0.0% | 1.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/parser/table-parser.js` |
| 0.0% | 1.3ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/server.js` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/parse5/dist/common/foreign-content.js` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/operator-node.js` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/deepmerge-ts/dist/index.mjs` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/x509/build/x509.cjs.js` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/htmlparser2/node_modules/entities/dist/esm/decode.js` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/threadCollab.ts` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/db/adapter/get-field-attributes.mjs` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/query-creator.js` |
| 0.0% | 1.2ms | `node:fs` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pino/lib/tools.js` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/authCookies.ts` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/zod/v4/core/doc.js` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/serializer.js` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/value-node.js` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@zone-eu/mailsplit/lib/message-splitter.js` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/headers.js` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/libmime/dist/esm/libmime.js` |
| 0.0% | 1.2ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-schema/build/cjs/index.js` |
| 0.0% | 1.2ms | `internal:fs/streams` |
| 0.0% | 1.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/dom-serializer/node_modules/entities/lib/esm/generated/encode-html.js` |
| 0.0% | 1.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/peberminta/lib/core.mjs` |
| 0.0% | 1.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/admin/routes.mjs` |
| 0.0% | 1.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/raw-builder/raw-builder.js` |
| 0.0% | 1.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/lib/db/accountKeys.ts` |
| 0.0% | 1.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/expression/expression-wrapper.js` |
| 0.0% | 1.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/core/dist/instrumentation/noop.mjs` |
| 0.0% | 1.1ms | `internal:streams/state` |
| 0.0% | 1.1ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/readAuthJson.ts` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/entities/dist/encode.js` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/app/api/_helpers/requestOrigin.ts` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/update-user.mjs` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/plugins/access/access.mjs` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@noble/ciphers/_arx.js` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/kysely/dist/operation-node/query-node.js` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pvutils/build/utils.js` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@peculiar/asn1-cms/build/cjs/signed_data.js` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/@better-auth/utils/dist/random.mjs` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/encoding-japanese/src/utf8-to-jis-table.js` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/context/create-context.mjs` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/better-auth/dist/api/routes/sign-in.mjs` |
| 0.0% | 1.0ms | `internal:streams/writable` |
| 0.0% | 1.0ms | `node:_http_server` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/pvtsutils/build/index.js` |
| 0.0% | 1.0ms | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/linkify-it/index.mjs` |
| 0.0% | 999us | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/next/dist/server/request/cookies.js` |
| 0.0% | 971us | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/parse5/dist/common/token.js` |
| 0.0% | 919us | `/home/monkey/code/noctua-mail/wt-spike-switch-server/node_modules/imapflow/dist/esm/charsets.js` |
