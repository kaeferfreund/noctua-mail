<!-- Purpose: review the release evidence and deployment sequence; runbook §3; REVIEW BEFORE USE. -->
# Release procedure

These scripts default to `--dry-run`, contain no sudo, and were not used to build or
activate anything. `build-release.sh` packages **existing verified artifacts**; it
never installs dependencies or runs the application test/build tools. Preparation
is a separate operator step in a clean approved integration checkout, not this docs
worktree. Pin ARM64 Bun 1.4.4. Preserve old tested Bun binaries separately.

Prepare as in runbook §3.1 with synthetic build-only keys and an empty independent
build-data root; production secrets appear only at runtime. Exclude every `.env*`
file (including ignored files); do not source development environments. Existing
frozen dependencies are a prerequisite. Generate `public/runtime-config.js` with
`build-scripts/generateRuntimeConfig.ts` **before** building/copying public assets;
use `APP_ENV_LABEL=Production`, `ENV_FILE=/dev/null` and synthetic build environment.
Run and retain private results for `bun run test:ci`, `bun run lint`, `bun run build`
and `bun --bun build-scripts/verifyStandaloneWorkerBuild.ts`. Complete the relevant
stress, auth browser, production smoke, tsc baseline and all integration/household
acceptance gates in §3.1. A failing/absent required result is NO-GO.

The assembly script requires a non-executable evidence file outside the checkout,
reviewed by the release operator, with exactly these required lines (replace SHA):

```text
git_sha=<full-40-character-approved-sha>
bun_version=1.4.4
test:ci=pass
lint=pass
build=pass
runtime_config=pass
standalone_workers=pass
go_live_gate=approved
```

Add reviewer, UTC timestamps, exact commands and pointers to logs for additional gates.
Do not put credentials, reset URLs, real mail or test secrets in evidence. The file
is an attestation, not proof by itself. Do not write `approved` until all gates pass.
After those checks, create `EVIDENCE_FILE.artifacts.sha256`, from the build root:

```sh
find .next/standalone .next/static public -type f -print0   | sort -z | xargs -0 sha256sum > '<evidence-absolute-path>.artifacts.sha256'
```

The verifier requires complete matching coverage of all three trees and rejects
symlinks. Packaging Bun dependencies with symlinks requires a separately reviewed
materialization step in the disposable build output; it is not silently followed.
The checksum manifest is private reviewed input, never sourced. It binds artifacts
to the evidence and SHA; the source/build environment still needs trusted provenance.
A clean git tree alone does not prove ignored build outputs belong to HEAD.

```sh
/opt/noctua/ops/release/build-release.sh --dry-run '<checkout>' '<full-sha>' '<evidence>'
# As root after review (still no service changes): repeat with --execute.
```

The assembler copies the **whole flat** `.next/standalone` tree, then replaces its
`.next/static` and `public` exactly as the dev deploy script does. It rejects the
old nested layout. `outputFileTracingRoot` must already be fixed in the integration
build; do not patch another worktree here. The immutable root-owned result is
`/srv/noctua/releases/<sha>` with `server.js` at its root, metadata/evidence, and
`.next/cache → /var/cache/noctua`. No `app` alias or timestamp ID is used.
Runbook lines 149–150/434–474 describe the older layout; this task explicitly
supersedes it. The system unit works from `/srv/noctua/current` directly.

Runtime secrets live at **/srv/noctua/env/noctua.env**, root:root 0600 with parent
0700 (replaces runbook's `/etc/noctua/noctua.env`). `/opt/noctua/bin/bun` and
`/opt/noctua/ops` must be root-owned and immutable to `noctua`; the cache/data roots
must be owned by `noctua`. The systemd manager reads the env before switching user.

Activation/rollback require root, an approved maintenance window, no other writers,
exported backup environment (see backup README), a configured initialized repository,
and all backup paths. They share `/run/lock/noctua-operations.lock` with backups;
manual tools outside these scripts must still be excluded explicitly.

```sh
/opt/noctua/ops/release/activate-release.sh --dry-run '<full-sha>'
# Only later as root, after checking the private backup environment:
/opt/noctua/ops/release/activate-release.sh --execute '<full-sha>' --confirm-no-other-writers
/opt/noctua/ops/release/rollback.sh --dry-run
# Execution additionally requires both --confirm-schema-compatible and --confirm-no-other-writers.
```

First deployment requires a truly empty data directory and uses the candidate release
in the pre-start backup; configuration, keys, release and runtime are still backed up.
Later activation backs up current code/data/keys while stopped before any new schema
initializer can run. Successful pre-deploy backup leaves the app stopped; upload failure
resumes the original app if it was active. Atomic symlink updates store current in
`previous`, then replace `current`. First install has no previous rollback target.

Health polls require **200** from GET `/api/ba/ok`, **401** from unauthenticated GET
`/api/auth/me`, and an active service. These use sanitized canonical proxy headers
on loopback and port 3654; no credential/body is printed. They do not prove TLS, DB
content, MFA, roles, sending or physical devices. A failed new startup is stopped;
no automatic code-only fallback after a potentially irreversible schema migration.

Rollback leaves `previous` as a recovery anchor and backs up the current state first.
Confirm current schema, keys and Bun support the older code. If compatibility is
unknown, stop and restore the matching pre-deploy **data + keys + code + Bun** set
using the signed-off §6 drill, preserving newer collaboration data for reconciliation.
No script rotates keys, restores production data, deletes releases or prunes backups.
Keep at least five approved releases, 30 days and the last restorable schema point;
manual deletion must exclude current, previous and restore-linked versions.
