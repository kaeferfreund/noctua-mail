# Verified spike: Better Auth 1.7.12 on Noctua

Verified 2026-10-22, branch spike/better-auth, based on team-inbox 11c322b. This is an isolated
integration experiment, not a production replacement: the upstream auth routes still exist beside
Better Auth. The actual team implementation must port policy/guards/migration from the design.
No push, deployment, real account or real IMAP service was used. All identities are synthetic.

The inherited claim of 29 library + 5 route tests was independently reproduced (34 pass, 0 fail).
The completed spike has 33 library + 6 route tests, with the additional HTTP-session, idempotence,
freshness and separate-connection evidence below. The randomized suite exposed inherited fixture
order/repetition dependencies; those are fixed, not hidden by reducing the stress checks.

## 1. Versions and source evidence

Installed package.json inspection, not a latest-version assumption:

```
better-auth 1.7.12
@better-auth/core 1.7.12
@better-auth/kysely-adapter 1.7.12
@better-auth/passkey 1.7.12
@better-auth/telemetry 1.7.12
next 16.2.4
react 19.2.5
zod 4.3.6
```

`bun --version` / test runner: 1.4.3 (c6da4a4d3). Better Auth and passkey are pinned exactly in
package.json/bun.lock. Their nested zod is 4.6.7, confirmed by bun.lock's better-auth/zod,
@better-auth/core/zod and @better-auth/passkey/zod entries; top-level Noctua remains 4.3.6.
The custom endpoint schema uses top-level zod and passes through Standard Schema validation.
Production integration can deduplicate deliberately; no unreviewed transitive upgrade was needed.

Authoritative local sources inspected:

- better-auth/dist/plugins/two-factor/index.mjs: sign-in matcher/after-hook, allowPasswordless,
  challenge deletion, trust-device behaviour and encrypted two-factor schema.
- better-auth/dist/api/routes/{session,update-session,update-user,sign-up}.mjs: fresh sessions,
  input:false, password revocation and disabled signup.
- better-auth/dist/plugins/admin/{admin,routes}.mjs: ban hook/revocation, create-user and password reset.
- @better-auth/passkey/dist/index.mjs: registration/authentication hooks and requireUserVerification:false.
- @better-auth/core/dist/db/adapter/factory.mjs: SQLite date conversion; Better Auth db migrations.
- @better-auth/telemetry/dist/node.mjs: createTelemetry (endpoint check and enabled flag).

Current official docs checked against the installed version:
[SQLite](https://better-auth.com/docs/adapters/sqlite),
[plugin extension API](https://better-auth.com/docs/concepts/plugins),
[2FA](https://better-auth.com/docs/plugins/2fa),
[passkeys](https://better-auth.com/docs/plugins/passkey).
The 2FA docs explicitly require custom hook handling for other sign-in methods. The exact
cross-plugin hook reuse here is a version-coupled inference from the installed implementation,
not a promise of a stable documented adapter API.
Advisory inventory is in the provided briefs/better-auth-discover.json; this spike does not claim
a fresh exhaustive dependency advisory audit or blanket absence of vulnerabilities.

## 2. Configuration actually used

See lib/betterAuth.ts for the complete executable options. Relevant excerpt:

```ts
basePath: "/api/ba",
telemetry: { enabled: false },
emailAndPassword: {
  enabled: true, disableSignUp: true,
  minPasswordLength: 10, maxPasswordLength: 256,
  password: {
    hash: password => Bun.password.hash(password, {algorithm: "argon2id"}),
    verify: ({hash, password}) => Bun.password.verify(password, hash)
  }
},
user: {modelName: "auth_user"},
session: {
  modelName: "auth_session",
  additionalFields: {activeAccountId: {type: "string", required: false, input: false}}
},
account: {modelName: "auth_account"},
verification: {modelName: "auth_verification"},
advanced: {cookiePrefix: "noctua", disableOriginCheck: false, disableCSRFCheck: false},
disabledPaths: ["/admin/impersonate-user", "/admin/stop-impersonating"]
```

The actual hasher reaches Bun through the existing globalThis pattern, since the repo has no Bun
global types. Do not throw policy errors inside the hash function: Better Auth also hashes dummy
input for unknown-user timing. Better Auth enforces the normal credential policy at endpoints;
admin createUser requires an additional minimum-length check in production (§6).

Plugins in order: admin with a custom role lacking impersonation; one twoFactor instance
(`issuer:"Noctua", allowPasswordless:true`, table auth_two_factor); passkey (rpID from config or
baseURL hostname, table auth_passkey); custom imapSignIn using that same twoFactor instance's
sign-in after-hook; nextCookies last. No adminUserIds override. No organization/OAuth/MCP plugin.

Spike defaults deliberately differ from the production design: session expiry/update/freshAge are
Better Auth defaults (7d/1d/1d), cookieCache stays off by default, passkey user verification is still
library-default preferred, and there is NO mandatory-MFA/re-auth gate. Installed passkey source
shows authenticatorSelection applies to registration only; authentication options hardcode
userVerification:"preferred". Enforce authentication UV through afterVerification, not an invented
config field. Per-call passkey client fetchOptions reach verification but not options GET; a shared
request hook is needed to attach any production enrollment-proof header to both requests. The draft sets stronger
policy explicitly. The spike only proves passkey option generation, not real WebAuthn ceremonies.
No production claim is made for a passkey without verified user verification.

readAuthEnv requires BETTER_AUTH_SECRET >=32 characters; BETTER_AUTH_URL defaults to
http://localhost:3000 in this experiment. Production must require a fixed validated HTTPS origin
and explicit trustedOrigins/proxy setup. Optional PASSKEY_RP_ID defaults to that URL's hostname.

## 3. HTTP mount, initialization and actual production smoke

app/api/ba/[...all]/route.ts uses:

```ts
export const {GET, POST, PATCH, PUT, DELETE} = toNextJsHandler(async request =>
  (await getAuth()).handler(request)
);
```

/api/ba avoids ambiguity with Noctua /api/auth/{login,logout,me,signup,switch-account}. Next static
routes could coexist with a catch-all on /api/auth, but separate prefixes make clients, 401 handling,
rate rules and migration ownership explicit. Keep this prefix in the production design.

instrumentation.register: initializeMasterDb → getAuth → getAuthDb (dedicated auth connection to
same master file, after Noctua schema) → getMigrations(options).runMigrations → betterAuth(options).
Migrations are additive and programmatic; no auth CLI runs at startup. migrateAuthSchema returns
createdTables/addedColumns/addedIndexes; second start is empty. Constructing Better Auth before
migration starts an asynchronous schema check too early, so migrate first.

Tests: “first start creates only auth_* tables and leaves Noctua tables alone”; “second process
start on the same file plans no migrations”; all six Next route tests. See §4 for mapping.

Reproduced with the final production build, `bun --bun <standalone server.js>` under
NODE_ENV=production, PORT=3785/HOSTNAME=127.0.0.1, synthetic secrets, absolute NOCTUA_DATA_DIR inside
the spike's ignored .tmp, BETTER_AUTH_URL=http://localhost:3785 and BETTER_AUTH_TELEMETRY=0.
The exact child PID was terminated after each run; no pattern-based process killing was used.

```
start 1: GET /api/ba/ok -> 200 {"ok":true}
GET /api/ba/get-session -> (200, 'null')
GET /api/auth/me -> (401, '{"ok":false}')
production IMAP rate limit: [401, 401, 401, 429, 429]
retry header: 10
start 1: migration messages=1, storage opens=2
start 2: GET /api/ba/ok -> 200 {"ok":true}
GET /api/ba/get-session -> (200, 'null')
GET /api/auth/me -> (401, '{"ok":false}')
start 2: migration messages=0, storage opens=2
```

This rate test used a single synthetic X-Forwarded-For value and unknown synthetic user, with no
external IMAP call. It proves the production /sign-in* limiter covers the custom path, not the
correctness of a real TLS proxy's forwarded chain.

Next bundles instrumentation separately from routes. Module-level authPromise/master connection
singletons are per module graph, not guaranteed one instance per OS process. The two storage-open
messages are reproduced above; auth handles are additionally separate by design. The first request
may plan another empty migration check. Do not claim it performs no migration work at all.

Next inferred a workspace root from /home/user/package-lock.json and emitted nested standalone
output: .next/standalone/.t3/scratch/…/wt-spike-better-auth/server.js. Smoke ran that actual file
from its directory with absolute data path. No unrelated lockfile was edited. Pin the project root
in a separate reviewed build change if desired; no serverExternalPackages workaround was required.

## 4. Table mapping and connection choice

Chosen mapping: separate auth_* tables with users.id mirrored from auth_user.id. Auth tables:
auth_user, auth_session, auth_account, auth_verification, auth_two_factor, auth_passkey. Better Auth's
credential account must not be confused with Noctua accounts (mailboxes) or user_accounts (membership).

Evidence:

- “createUser -> signInEmail -> getSession, mirrored into Noctua users”: id/email/role mirror, integer
  profile createdAt. “an existing Noctua user keeps its id when Better Auth creates it”: no changed
  membership/shard references. Creation/update hooks only mirror id/email/role, preserve existing
  profile createdAt, and convert a new auth creation date to unix ms.
- “auth_session carries the activeAccountId column and dates are ISO text”: SQLite date values
  are text, auth_session has nullable TEXT activeAccountId; Boolean values are 0/1 (adapter source).
- Rejected direct users mapping, “a populated users table cannot be migrated: required columns
  without a static default”: captured output from repeating the exact case:

```
BetterAuthError: Cannot add required column "name" to populated table "users": the schema declares no default value, so existing rows have no value to backfill. MySQL accepts this statement instead of rejecting it and fills every existing row with an implicit default for the column type, reporting a successful migration over corrupted data. For a text column, every existing row ends up with the same empty string. Add the column as nullable, backfill a correct value for every row, then make it NOT NULL.
```

This is the unsafe-migration exception; its observable `.name` is BetterAuthError, not the
UnsafeMigrationError label the inherited report quoted. The explanatory MySQL sentence comes
from the package even though this test uses SQLite. Workaround: separate auth_user, or deliberate
users table rebuild/backfill/type migration (unnecessary risk here).

- “an empty users table migrates, but Better Auth writes ISO text into the INTEGER createdAt”:
  typeof(createdAt) is text and Number(createdAt) is NaN. Direct mapping only passes on an empty
  table after columns are added, and still violates Noctua's integer date convention. Admin plugin
  supplies role; unrelated required columns not written by Better Auth also break schema validation.

Trade-off: separate tables require a one-way mirror and coordinated deletion/migration. The spike
only wires create/update mirrors and legacy ID reuse. It does not implement safe public legacy
identity claim, ban mirror, deletion cleanup, audit or provisioning compensation. Production must
not turn the migration hook's e-mail match into public account takeover. Preserve existing roles
explicitly during migration rather than letting a new default overwrite an existing admin.

Connection negative control: “a Noctua write that interleaves with an open Better Auth transaction
shares its fate” proves an unrelated invite insert on the SAME handle rolls back with auth.
That is a real correctness failure, even though the spike test passes by asserting it.

Completed spike now uses getAuthDb: a dedicated handle on the same file. Both master writers set
busy_timeout=0; WAL and foreign_keys stay enabled, shutdown closes auth too. Noctua already uses
withDbWriteRetry (asynchronous delay), so a lock conflict yields the event loop and lets auth finish.
“a separate handle isolates rollback and async retries let the auth writer finish” records:

```
[db-write-retry] retry … code: "SQLITE_BUSY", message: "database is locked"
[db-write-retry] success … retries: 1
```

The Noctua insert then persists, while the auth verification insert rolls back. Route test “auth
uses a dedicated handle on the master file with nonblocking writers” asserts different handles and
both PRAGMA busy_timeout values zero. This replaces the inherited recommendation to keep one handle.

Limit: a dedicated handle alone is insufficient with a synchronous 15-second wait: the waiter can
block the same event loop needed by the other connection's transaction. Auth errors under competing
external writers still need controlled handling; never retry an entire non-idempotent auth request
blindly. Full provisioning/real-flow concurrency is production work. No network I/O in DB hooks.
Explicitly closing all DBs while retaining an already-resolved getAuth singleton is unsupported in
this experiment; production test teardown/reopen must reset that singleton as well.

## 5. Test-backed capability matrix

All names below are exact test titles in lib/betterAuth.test.ts unless marked route.

| Capability | Test title |
|---|---|
| startup order and additive schema | first start creates only auth_* tables and leaves Noctua tables alone |
| second-start idempotence | second process start on the same file plans no migrations |
| active mailbox column/date encoding | auth_session carries the activeAccountId column and dates are ISO text |
| admin create → password login → session/profile | createUser -> signInEmail -> getSession, mirrored into Noctua users |
| disabled public signup/admin boundary | sign-up is disabled and non-admins cannot create users |
| ID continuity for legacy profile | an existing Noctua user keeps its id when Better Auth creates it |
| minimum-policy gap pinned | password policy: changePassword enforces the minimum, but admin createUser skips it |
| TOTP enable/password proof, activation, challenge, wrong code and verifyTOTP | enable requires the password, verify activates, sign-in is challenged, verifyTotp completes |
| backup codes one-use | backup codes complete the challenge once each |
| live session revocation, ban blocks new login, unban | banUser revokes live sessions and blocks sign-in |
| no admin impersonation permission or HTTP path | impersonation is not granted to admins and its routes are disabled |
| WebAuthn registration options, anonymous rejected | generate-register-options returns WebAuthn options for a signed-in user |
| active mailbox server set/get; public write rejected | server-side set, read back via getSession; clients cannot set it |
| password change replaces cookie and revokes others/old caller | revokeOtherSessions kills the other sessions and issues a new one |
| IMAP first-factor success and generic errors | IMAP password creates a normal session; wrong password and unknown user get the same 401 |
| IMAP TOTP integration | with the re-used two-factor hook an IMAP sign-in of a 2FA user is challenged |
| decisive HTTP no-session invariant + recovery | HTTP IMAP challenge removes the provisional DB session and backup code completes it |
| negative control: built-in matcher misses custom path | without that hook the two-factor plugin does NOT intercept a custom sign-in path |
| ban covers IMAP via createSession hook | the admin plugin's ban check also covers the custom sign-in |
| plugin trust-device compatibility (production policy rejects it) | trustDevice from the TOTP step is honoured by the next IMAP sign-in (same hook, same cookie) |
| passwordless disable proof gap guarded | an IMAP-only user must prove the IMAP password to disable 2FA; a password user proves the app password |
| IMAP HTTP origin rejection | over HTTP, /sign-in/imap gets the same origin check as /sign-in/email |
| upgrade pin | upgrade canary: the two-factor plugin exposes exactly one sign-in after-hook |
| telemetry options/test environment | is disabled by config, off under bun test, and has no endpoint to send to |
| mapping negative control | a populated users table cannot be migrated: required columns without a static default |
| mapping/date incompatibility | an empty users table migrates, but Better Auth writes ISO text into the INTEGER createdAt |
| HTTP cookie flags | sign-in from the app origin sets an httpOnly lax noctua.session_token |
| CSRF/origin without cookies | a cross-origin sign-in is rejected even without cookies |
| CSRF/origin with cookie | a cookie-carrying POST without Origin/Referer is rejected |
| HTTPS cookie flags | an https baseURL switches to __Secure- cookies |
| same-handle transaction hazard | a Noctua write that interleaves with an open Better Auth transaction shares its fate |
| separate-handle rollback/retry | a separate handle isolates rollback and async retries let the auth writer finish |
| freshAge trap | passkey registration and listSessions reject an old session with SESSION_NOT_FRESH |
| mounted handler/basic reads | route: GET /api/ba/ok and /api/ba/get-session answer through the Next route |
| graph-local lazy singleton | route: getAuth() is memoised within this module graph |
| cookie round trip | route: POST /api/ba/sign-in/email from the app origin sets the session cookie |
| mounted origin and disabled path | route: a foreign Origin is rejected and the disabled impersonation path is a 404 |
| actual connection isolation | route: auth uses a dedicated handle on the master file with nonblocking writers |
| tables in same file | route: the Better Auth tables live next to Noctua's in the same master DB |

## 6. Decisive first-factor answer, failures and workarounds

Does twoFactor intercept a custom IMAP sign-in automatically? NO. Its matcher is exactly
/sign-in/email, /sign-in/username or /sign-in/phone-number. Negative control returns a normal
session for an already-enrolled IMAP user. There is no customPaths option in the installed type.

Can IMAP + TOTP work without a fork? YES. A normal BetterAuthPlugin endpoint does the credential
check, internalAdapter.createSession and setSessionCookie (sets context.newSession). Its after-hook
reuses the same twoFactor instance's hook handler, with a matcher only for /sign-in/imap. That
handler deletes provisional session/cookie, clears newSession, creates the challenge and returns
twoFactorRedirect. Ordinary verifyTOTP/verifyBackupCode then complete it. Public exported plugin
APIs are used; no private module import, fake password-hash marker or copied MFA challenge code.

This is the cleanest available extension on 1.7.12, NOT an upgrade-independent contract. The
production config throws if after-hook count changes. Canary pins count/matcher; HTTP integration
pins no response token, no session cookie and unchanged zero DB sessions before MFA. A handler
that starts checking its own path could bypass despite the count canary, so the real integration
tests are mandatory at every upgrade. Keep exact versions and disable IMAP if the bridge fails.
An eventual official custom-path option should replace this coupling.

Production recommendation: retain it as OPTIONAL, operator-allowlisted personal login-mailbox
method alongside app password and passkey. Required eligibility is ownerUserId=user.id,
normalized account.email=imap.user=user.email, TLS, allowed hostname, exactly one candidate. The
owner sharing her personal mailbox with a viewer remains eligible; member count is irrelevant.
Shared addresses must not be personal identities. Unknown/empty users must never cause IMAP
bootstrap. Keep admin provider-independent app password, per-user/IP IMAP limiter, write-back only
to that mailbox, SMTP coupling when applicable, and session/token revocation on credential change.
These eligibility/mailprovider/write-back rules are design work, NOT proven by the injected stub.

Other failed assumptions:

- admin createUser with password "abc" succeeds despite minPasswordLength=10. No error is thrown.
  changePassword("short") returns PASSWORD_TOO_SHORT. Validate before createUser, or let invite
  redemption choose/validate the person's password; do not claim the admin endpoint enforces min.
- allowPasswordless lets users without a credential account enroll/disable TOTP with session alone.
  The spike before-hook requires IMAP password for disable (INVALID_PASSWORD on missing/wrong).
  Production must guard ALL new credential enrollment and mandatory-factor removal, including
  server-only setPassword; this experiment does not solve the entire re-auth policy.
- Old session still valid for getSession, but generate-register-options/listSessions return
  SESSION_NOT_FRESH (403). Workaround: new authenticated session, not hiding the library check.
- Initial stress run: 5082 pass / 5 fail. Two beforeAll repeats failed USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL;
  three policy tests failed INVALID_EMAIL_OR_PASSWORD when shuffled before the Alice fixture.
  Seed independent policy/non-admin/negative-control/HTTP users; repeated route setup reuses its
  own synthetic identity. Final stress output is recorded in §8.
- During verification, targeted eslint rejected the route test's direct connection import
  (no-restricted-imports). A single explained test-only suppression is used because the assertion
  examines handle identity/PRAGMAs on the exact auth connection, not barrel CRUD. No broad suppression.

## 7. Cookies, origins, runtime and telemetry gotchas

With prefix noctua: session_token is a signed opaque token cookie (DB token.HMAC), two_factor is
the pending challenge cookie, trust_device exists if enabled, dont_remember is optional, and the
passkey challenge uses noctua.better-auth-passkey (source). Tests check actual session/two-factor/
trust-device names. HTTPS baseURL adds __Secure- and Secure; HttpOnly, Path=/, SameSite=Lax remain.
The old noctua_session is unrelated. No credential payload or cookieCache is configured here.

activeAccountId is session.additionalFields input:false; write with
(await auth.$context).internalAdapter.updateSession(token,{activeAccountId}). Its helper does NOT
check membership: the production switch route must do that. Setting this field never grants access.

HTTP foreign Origin is rejected even without cookies; a cookie POST with no Origin/Referer is
MISSING_OR_NULL_ORIGIN. Both disableOriginCheck and disableCSRFCheck are explicitly false because
NODE_ENV=test otherwise skips important checks. Programmatic auth.api calls do not prove HTTP
origin/rate checks, so wrapper routes need their own checks. Keep exact trusted origins; never infer
an attacker-controlled public origin from Host/XFF. Custom endpoint uses formCsrfMiddleware too.

changePassword requires revokeOtherSessions:true for revocation. banUser deletes existing sessions
and its session.create hook blocks new ones. cookieCache would delay revocation, so keep it off.
Admin setUserPassword does not revoke (installed routes.mjs); production explicitly revokes sessions
and MCP tokens. Password reset also needs revokeSessionsOnPasswordReset:true. MFA-required is an
application gate, not an existing Better Auth option. Passkey sign-in is not TOTP challenged.

SQLite detection accepts a bun:sqlite handle; no CLI or Node SQLite adapter is needed. Better Auth
schema check starts asynchronously at construction; await an auth.api call before closing a test
handle, not merely $context. nextCookies must stay last and is relevant to Server Actions. Wrappers
must forward returned Set-Cookie themselves. The build ran with repo skipLibCheck settings; no claim
is made that all external type declarations pass with skipLibCheck:false.

Telemetry: options.telemetry.enabled=false AND systemd BETTER_AUTH_TELEMETRY=0, with
BETTER_AUTH_TELEMETRY_ENDPOINT unset. Local createTelemetry source first returns a no-op when no
endpoint/customTrack exists. Its enabled expression is envFlag OR configFlag, so setting env=1
can override config false if an endpoint exists. Under bun test isTest disables it independently.
The telemetry test proves options/env-test state; source inspection plus the synthetic production
smoke env establish the deployment recipe. No network-capture claim is made.

## 8. Verification commands and limits

From this worktree (timeouts are actual verification bounds):

```
timeout 300 bun test lib/betterAuth.test.ts app/api/ba
# 39 pass, 0 fail across 2 files

timeout 1200 bun run build
# exit 0, Next 16.2.4; route list includes: ƒ /api/ba/[...all]

timeout 900 bun run test:ci
# 1699 pass, 0 fail across 195 files
# 12 pass, 0 fail across 3 DOM files; exit 0

bunx tsc --noEmit 2>&1 | grep -v bun:test
# Existing unrelated diagnostics remain. Full tsc exits 2; do NOT call it clean.
# Baseline and current each have 331 filtered lines; identical multisets of lines.
# New filtered diagnostics: []; Removed diagnostics: []

bunx eslint lib/betterAuth.ts lib/betterAuthImapSignIn.ts lib/betterAuth.testSupport.ts \
  lib/betterAuth.test.ts 'app/api/ba/[...all]/route.ts' 'app/api/ba/[...all]/route.test.ts' \
  lib/db/connection.ts instrumentation.ts
# exit 0, no warnings
```

The type baseline used git archive HEAD (11c322b) in an ignored .tmp directory inside this spike,
the same installed dependencies and `tsc --noEmit --incremental false`. No checkout outside the
spike was modified. The temporary source copy was removed after comparison. The only diagnostics
in spike test paths before filtering are the existing missing bun:test declarations.

Final post-fixture-fix results (all exit 0 except the explicitly baseline-failing full tsc):

```
timeout 300 bun test lib/betterAuth.test.ts app/api/ba
39 pass / 0 fail / 140 expect() calls / 2 files

timeout 900 bun run test:ci
1699 pass / 0 fail / 195 files
12 pass / 0 fail / 3 DOM files

timeout 900 bun run test:stress
5097 pass / 0 fail / 195 files (random seed 1337, rerun-each=3)

Type baseline/current filtered lines: 331 / 331
New diagnostics: []
Removed diagnostics: []
Targeted eslint: exit 0
```

Production build exit 0 and mounted route were verified after the dedicated-connection runtime
change; subsequent edits only made tests independent/repeatable, clarified comments and updated
this report. The production smoke output is in §3. Full lint of unrelated upstream files was not claimed.

Not verified here: full WebAuthn cryptography/browser/hardware ceremony, UV enforcement of the
proposed production callbacks, real HTTPS/TLS proxy or Tailscale/LAN origin configuration, actual
mailprovider username/LOGIN behaviour, real SMTP password follow-up, mandatory-MFA/re-auth/provisioning/
recovery/admin policy integration, migration of a live install, backup/restore/secret rotation or
Tauri compatibility. Tauri and cookie-only mode are explicitly dropped in the draft, not tested
working here. The injected verifyImap defaults to reject-all in the mounted runtime.
