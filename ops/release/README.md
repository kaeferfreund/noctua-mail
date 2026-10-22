<!-- Purpose: review the release evidence and deployment sequence; runbook §3; REVIEW BEFORE USE. -->
# Release procedure

These scripts default to `--dry-run` and contain no sudo. They have been exercised
with synthetic scratch data; see the 2026-10-22 dry-run note in `ops/README.md`. `build-release.sh` packages **existing verified artifacts**; it
never installs dependencies or runs the application test/build tools. Preparation
is a separate operator step in a clean approved integration checkout, not this docs
worktree. Pin ARM64 Bun 1.4.4. Preserve old tested Bun binaries separately.

Prepare as in runbook §3.1 with synthetic build-only keys and an empty independent
build-data root; production secrets appear only at runtime. Exclude every `.env*`
file (including ignored files) from the three packaged artifact trees. The assembler
never copies or sources checkout-root environment files; a separately supplied synthetic
build-only `.env.local` does not enter the release. Never build with production secrets. Existing
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
symlinks. Next/Turbopack emits dependency symlinks even with the flat layout. Materialize
these explicitly with `cp -aL` in disposable build output before generating the
manifest; the assembler never follows unchecked symlinks silently.
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
`.next/cache → /var/cache/noctua`. `RELEASE_ARTIFACTS.sha256` separately covers
the assembled layout and metadata; activation and rollback verify it, including the
configured cache link, before service changes. To check a package manually, run
`python3 verify-artifacts.py --release RELEASE RELEASE/RELEASE_ARTIFACTS.sha256`. No `app` alias or timestamp ID is used.
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

## Synthetic local harness

`NOCTUA_OPS_ROOT=/absolute/scratch/root` is an explicit **synthetic-only** mode,
not a production relocation option. Create that directory and an empty
`SYNTHETIC_ONLY` marker, plus `releases/`, `data/`, `cache/`, `backups/`, `env/`
and `bin/`. System paths are rejected; root privileges are unnecessary. Supply an
executable Bun 1.4.4 at `bin/bun` (a link to the installed binary is acceptable),
a caller-owned 0600 `env/noctua.env`, and synthetic values only. This selects a
root-local flock and cache; no systemd, Caddy, TLS files or installed ops are touched.
The local adapter starts `bun --no-env-file --bun server.js` with a minimal parsed
environment and records PID, process start time and cwd. It signals only that recorded
process, checks port availability before starting, and refuses HTTP probing after
that process exits. The restricted single-line environment format accepts quoted
values without shell evaluation and rejects duplicate assignments.

Set `PORT` and `BETTER_AUTH_URL=http://127.0.0.1:<PORT>` explicitly, with
`PASSKEY_RP_ID=127.0.0.1` and `NOCTUA_DATA_DIR=<root>/data`. `localhost` RP ID
with a `127.0.0.1` URL is rejected by the supplied application. Watcher and telemetry
are forced off in this harness. Check port allocation on the shared host immediately
before binding; 3822/3823 were assigned for this run. All heavy commands use `nice -n 10`.

For an untouched build checkout with symlinked tracing output, the scratch-only
`NOCTUA_ARTIFACT_ROOT=<root>/artifacts` selects a disposable artifact copy while
SHA/clean-tree checks still refer to CHECKOUT. For example:

```sh
mkdir -p "$NOCTUA_ARTIFACT_ROOT/.next"
nice -n 10 cp -aL "$CHECKOUT/.next/standalone" "$NOCTUA_ARTIFACT_ROOT/.next/"
nice -n 10 cp -a "$CHECKOUT/.next/static" "$NOCTUA_ARTIFACT_ROOT/.next/"
nice -n 10 cp -a "$CHECKOUT/public" "$NOCTUA_ARTIFACT_ROOT/"
# Generate EVIDENCE.artifacts.sha256 from this artifact root, then:
nice -n 10 /path/to/ops/release/build-release.sh --execute "$CHECKOUT" "$SHA" "$EVIDENCE"
```

Use the same root override for activation, rollback, verification, backup and drill.
Backup requires a local `RESTIC_REPOSITORY` inside the scratch root and caller-owned
0600 `RESTIC_PASSWORD_FILE`; it archives only synthetic env/data/release/Bun.
Production keeps the SFTP, root ownership and reviewed-marker requirements. Real
restic must already be installed and the local repository initialized independently.
For a scratch restore, choose a new `<root>/drills/<name>` directory and set
`NOCTUA_OPS_DRILL_PORT` (default 3815; 3823 for this run). It restores/rebases into
that directory and starts/stops an owned local Bun process. This does **not** prove
production systemd network/mount isolation. An injected restic test double on PATH
can exercise archive/control flow when restic is absent; label every result STUB,
never count it as encrypted repository or off-box backup verification.

Evidence rejection is mandatory even in the harness: `test:ci=dry-run: tests not
executed` must fail. A separate file labelled SYNTHETIC may contain passing fields
solely to exercise subsequent gates. It is never go-live approval. The second
synthetic previous release in this run reused the same build with synthetic revision
`0000000000000000000000000000000000000001`; it does not prove cross-version schema
compatibility. Never transfer synthetic attestations into a production release.
