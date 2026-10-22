#!/usr/bin/env bash
# Purpose: restore into scratch and start only in a network-isolated sandbox; runbook §6.5; REVIEW BEFORE USE.
# Usage: restic-restore-drill.sh [--dry-run|--execute] SNAPSHOT_ID NEW_SCRATCH_DIR --confirm-isolated-host
# Requires root and systemd with PrivateNetwork support; never use a production data path.
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=../lib/operations.sh
source "$SCRIPT_DIR/../lib/operations.sh"
mode=--dry-run
if [[ ${1:-} == --dry-run || ${1:-} == --execute ]]; then mode=$1; shift; fi
[[ $# -ge 2 && $# -le 3 ]] || fail 'Usage: restic-restore-drill.sh [--dry-run|--execute] SNAPSHOT_ID NEW_SCRATCH_DIR --confirm-isolated-host'
[[ $1 =~ ^[0-9a-f]{64}$ ]] || fail 'Select a full immutable restic snapshot ID, never latest.'
snapshot=$1
scratch=$(realpath -m -- "$2")
if [[ $OPS_SCRATCH == 1 ]]; then
    [[ $scratch == "$OPS_ROOT/drills/"* && ! -e $scratch && ! -L $scratch ]] || fail 'Synthetic drill must be a new path under scratch-root/drills/.'
else
    [[ $scratch == /srv/noctua-drills/* && ! -e $scratch && ! -L $scratch ]] || fail 'Scratch must be a new directory below /srv/noctua-drills/.'
fi
if [[ $mode == --dry-run ]]; then
    if [[ $OPS_SCRATCH == 1 ]]; then
        printf 'DRY RUN SYNTHETIC: restore into %s, verify/rebase copies, check owned local server; network isolation is not tested.\n' "$scratch"
        exit 0
    fi
    printf 'DRY RUN: restore selected snapshot into %s, verify/extract/rebase copies; start sandbox with private network and scratch-only filesystem access; check 200/401; stop.\n' "$scratch"
    exit 0
fi
need_root
[[ ${3:-} == --confirm-isolated-host ]] || fail 'Dedicated isolated restore host confirmation required.'
if [[ $OPS_SCRATCH == 1 ]]; then
    [[ ${RESTIC_REPOSITORY:-} == "$OPS_ROOT"/* && -n ${RESTIC_PASSWORD_FILE:-} ]] || fail 'Synthetic drill requires a local repository.'
else
    [[ ${RESTIC_REPOSITORY:-} == sftp:* && -n ${RESTIC_PASSWORD_FILE:-} ]] || fail 'Load private backup connection environment first.'
fi
command -v restic >/dev/null || fail 'restic is not installed; restore not performed.'
umask 077
install -d -m 0700 "$scratch"
restic check --read-data
restic restore "$snapshot" --target "$scratch/download"
mapfile -d '' -t generations < <(find "$scratch/download$OPS_ROOT/backups" -mindepth 1 -maxdepth 1 -type d -print0)
[[ ${#generations[@]} == 1 ]] || fail 'Expected exactly one restored generation.'
generation=${generations[0]}
(cd "$generation" && sha256sum -c SHA256SUMS)
install -d -m 0700 "$scratch/state" "$scratch/config" "$scratch/release" "$scratch/cache"
# Only a trusted, operator-selected backup is accepted. Reject tar escapes and unsafe links.
python3 - "$generation" "$OPS_CACHE" <<'CHECK'
import pathlib
import sys
import tarfile
root = pathlib.Path(sys.argv[1])
for name in ("data.tgz", "config-tls.tgz", "release.tgz"):
    with tarfile.open(root / name) as archive:
        for member in archive.getmembers():
            path = pathlib.PurePosixPath(member.name)
            if path.is_absolute() or ".." in path.parts or not (member.isfile() or member.isdir() or member.issym() or member.islnk()):
                sys.exit("Unsafe archive entry; review privately")
            # GNU tar preserves standalone dependency hardlinks. Accept only links
            # to a regular member in the same archive, with no path traversal.
            if member.islnk():
                target = pathlib.PurePosixPath(member.linkname)
                if target.is_absolute() or ".." in target.parts:
                    sys.exit("Unsafe archive hardlink")
                try:
                    linked = archive.getmember(member.linkname)
                except KeyError:
                    sys.exit("Missing archive hardlink target")
                if not linked.isfile():
                    sys.exit("Archive hardlink target must be a regular file")
            # The only expected absolute link is the known Next cache target; never extract it.
            if member.issym() and not (name == "release.tgz" and member.name.endswith("/.next/cache") and member.linkname == sys.argv[2]):
                sys.exit("Archive links require explicit isolated restore review")
CHECK
tar -xzf "$generation/data.tgz" -C "$scratch/state" --no-same-owner --no-same-permissions
tar -xzf "$generation/config-tls.tgz" -C "$scratch/config" --no-same-owner --no-same-permissions
sha=$(cat "$generation/REVISION")
check_sha "$sha"
tar -xzf "$generation/release.tgz" -C "$scratch/release" --exclude="$sha/.next/cache" --no-same-owner --no-same-permissions
release="$scratch/release/$sha"
[[ -f $release/server.js ]] || fail 'Restored flat server missing.'
ln -s "$scratch/cache" "$release/.next/cache"
python3 "$SCRIPT_DIR/db-manifest.py" restore "$scratch/state/data" "$generation/DB_MANIFEST.json"
env_copy=$scratch/config/srv/noctua/env/noctua.env
if [[ $OPS_SCRATCH == 1 ]]; then env_copy=$scratch/config/env/noctua.env; fi
[[ -f $env_copy ]] || fail 'Matching restored runtime environment missing.'
[[ $("$generation/bun" --version) == $(cat "$generation/BUN_VERSION") ]] || fail 'Restored Bun mismatch.'
if [[ $OPS_SCRATCH == 1 ]]; then
    # Only synthetic inputs are permitted. This is local HTTP, not a network namespace proof.
    runtime=$scratch/state
    mkdir -p "$runtime/releases" "$runtime/env" "$runtime/cache" "$runtime/bin"
    mv "$release" "$runtime/releases/$sha"
    release=$runtime/releases/$sha
    rm "$release/.next/cache"
    ln -s "$runtime/cache" "$release/.next/cache"
    cp "$generation/bun" "$runtime/bin/bun"
    cp "$env_copy" "$runtime/env/noctua.env"
    python3 - "$runtime" "${NOCTUA_OPS_DRILL_PORT:-3815}" <<'ENV'
from pathlib import Path
import sys
root = Path(sys.argv[1])
path = root / 'env/noctua.env'
lines = path.read_text().splitlines()
overrides = {'NOCTUA_DATA_DIR': str(root / 'data'), 'PORT': sys.argv[2],
             'BETTER_AUTH_URL': 'http://127.0.0.1:' + sys.argv[2]}
path.write_text('\n'.join(line for line in lines if line.partition('=')[0] not in overrides)
                + '\n' + ''.join(f'{k}={v}\n' for k, v in overrides.items()))
ENV
    touch "$runtime/SYNTHETIC_ONLY"
    ln -s "$release" "$runtime/current"
    export NOCTUA_OPS_ROOT=$runtime
    # Reload helper paths for the restored synthetic root, without inheriting the original lock.
    source "$SCRIPT_DIR/../lib/operations.sh"
    trap 'service_control stop noctua.service' EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    service_control start noctua.service
    healthcheck || fail 'Restored synthetic startup HTTP gate failed.'
    service_control stop noctua.service
    trap - EXIT INT TERM
    printf 'Synthetic local-only startup checks passed; isolated-host acceptance remains required.\n' > "$scratch/DRILL_AUTOMATED_RESULT"
    exit 0
fi
unit="noctua-restore-drill-$(date +%s)-$$"
trap 'systemctl stop "$unit.service" >/dev/null 2>&1 || true' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# systemd reads the 0600 restored env without displaying values. Inline overrides contain no secrets.
# PrivateNetwork disconnects copied credentials from real IMAP/SMTP/CalDAV; InaccessiblePaths
# also prevents accidentally opening production DBs. Run a passive startup/HTTP probe, no UI login.
systemd-run --quiet --unit="$unit" --property=Type=exec \
    --property=PrivateNetwork=yes --property=PrivateTmp=yes --property=PrivateDevices=yes \
    --property=ProtectSystem=strict --property=ProtectHome=yes --property=NoNewPrivileges=yes \
    --property=CapabilityBoundingSet= --property=RestrictAddressFamilies='AF_INET AF_INET6' \
    --property=InaccessiblePaths='-/srv/noctua /run /var/lib -/etc/noctua -/etc/caddy' \
    --property="ReadWritePaths=$scratch" --property="WorkingDirectory=$release" \
    --property="EnvironmentFile=$scratch/config/srv/noctua/env/noctua.env" \
    --property=StandardOutput=null --property=StandardError=null \
    --setenv=NODE_ENV=production --setenv=HOSTNAME=127.0.0.1 --setenv=PORT=3796 \
    --setenv="NOCTUA_DATA_DIR=$scratch/state/data" --setenv=NOCTUA_MAILBOX_WATCHER=0 \
    "$generation/bun" --bun server.js
pid=
for ((attempt=0; attempt<20; attempt++)); do
    pid=$(systemctl show "$unit.service" -p MainPID --value)
    [[ $pid =~ ^[1-9][0-9]*$ ]] && break
    sleep 1
done
[[ $pid =~ ^[1-9][0-9]*$ ]] || fail 'Isolated startup failed.'
passed=0
for ((attempt=0; attempt<30; attempt++)); do
    ok=$(nsenter --target "$pid" --net -- curl --noproxy '*' -s -o /dev/null -w '%{http_code}' --max-time 3 -H 'Host: mails.monkeymed.de' -H 'X-Forwarded-Host: mails.monkeymed.de' -H 'X-Forwarded-Proto: https' -H 'X-Forwarded-Port: 443' -H 'X-Forwarded-For: 127.0.0.1' http://127.0.0.1:3796/api/ba/ok) || ok=000
    me=$(nsenter --target "$pid" --net -- curl --noproxy '*' -s -o /dev/null -w '%{http_code}' --max-time 3 -H 'Host: mails.monkeymed.de' -H 'X-Forwarded-Host: mails.monkeymed.de' -H 'X-Forwarded-Proto: https' -H 'X-Forwarded-Port: 443' -H 'X-Forwarded-For: 127.0.0.1' http://127.0.0.1:3796/api/auth/me) || me=000
    if [[ $ok == 200 && $me == 401 ]]; then passed=1; break; fi
    sleep 2
done
systemctl stop "$unit.service"
trap - EXIT INT TERM
[[ $passed == 1 ]] || fail 'Restored startup HTTP gate failed.'
printf 'Automated SQLite/startup checks passed at %s; household/data/factor acceptance still REQUIRED.\n' "$(date -u +%FT%TZ)" > "$scratch/DRILL_AUTOMATED_RESULT"
printf 'Isolated startup stopped; private restored files remain at %s. Complete the manual acceptance checklist.\n' "$scratch"
