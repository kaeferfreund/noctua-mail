#!/usr/bin/env bash
# Purpose: shared release/backup lock and CLI helpers; runbook §3/§6; REVIEW BEFORE USE.
# Sourced by reviewed scripts; never source a runtime secret file here.
set -euo pipefail
fail() { printf '%s\n' "$*" >&2; exit 1; }
need_root() { [[ $OPS_SCRATCH == 1 || $EUID -eq 0 ]] || fail 'Execution requires root; no sudo is invoked by these scripts.'; }
# An explicit root selects a synthetic local harness, never a relocated production install.
# shellcheck disable=SC2034 # Path variables are consumed by scripts sourcing this helper.
OPS_SCRATCH=0
OPS_ROOT=/srv/noctua
OPS_CACHE=/var/cache/noctua
OPS_BUN=/opt/noctua/bin/bun
OPS_LOCK=/run/lock/noctua-operations.lock
OPS_HELPERS=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
if [[ -n ${NOCTUA_OPS_ROOT:-} ]]; then
    [[ $NOCTUA_OPS_ROOT == /* && -d $NOCTUA_OPS_ROOT && ! -L $NOCTUA_OPS_ROOT ]] || fail 'Scratch root must be an existing absolute directory.'
    OPS_ROOT=$(realpath -e -- "$NOCTUA_OPS_ROOT")
    case $OPS_ROOT in /|/srv|/srv/*|/opt|/opt/*|/etc|/etc/*|/run|/run/*|/var|/var/*) fail 'Scratch root must not use system paths.' ;; esac
    [[ -f $OPS_ROOT/SYNTHETIC_ONLY ]] || fail 'Scratch root requires a SYNTHETIC_ONLY marker; never use real data or secrets.'
    OPS_SCRATCH=1
    # shellcheck disable=SC2034
    OPS_CACHE=$OPS_ROOT/cache
    # shellcheck disable=SC2034
    OPS_BUN=$OPS_ROOT/bin/bun
    OPS_LOCK=$OPS_ROOT/operations.lock
fi
service_control() {
    if [[ $OPS_SCRATCH == 1 ]]; then
        # Proxy and fullsync are absent in the local harness.
        if [[ ${2:-} != noctua.service ]]; then [[ $1 != is-active ]]; return; fi
        python3 "$OPS_HELPERS/scratch-runtime.py" "$OPS_ROOT" "$1"
    else
        if [[ $1 == is-active ]]; then systemctl is-active --quiet "$2"; else systemctl "$@"; fi
    fi
}
operation_lock() {
    # A child backup inherits fd 9 from activation; do not reopen that lock.
    if [[ $(readlink /proc/self/fd/9 2>/dev/null || true) != "$OPS_LOCK" ]]; then
        exec 9>"$OPS_LOCK"
    fi
    flock -n 9 || fail 'Another release/backup operation holds the lock.'
}
check_sha() { [[ $1 =~ ^[0-9a-f]{40}$ ]] || fail 'Expected a full 40-character git SHA.'; }
release_path() {
    check_sha "$1"
    local target="$OPS_ROOT/releases/$1"
    [[ -d $target && ! -L $target && -f $target/server.js ]] || fail 'Missing flat release.'
    [[ $(cat "$target/REVISION") == "$1" ]] || fail 'Release revision mismatch.'
    printf '%s\n' "$target"
}
check_evidence() {
    local evidence=$1 sha=$2 key
    [[ -f $evidence && ! -L $evidence ]] || fail 'A regular reviewed release evidence file is required.'
    for key in "git_sha=$sha" 'test:ci=pass' 'lint=pass' 'build=pass' 'runtime_config=pass' 'standalone_workers=pass' 'go_live_gate=approved' 'bun_version=1.4.4'; do
        [[ $(grep -Fxc -- "$key" "$evidence" || true) == 1 ]] || fail "Missing/duplicate release evidence: $key"
    done
}
healthcheck() {
    local port=${1:-3654} attempt ok_status me_status
    local origin=https://mails.monkeymed.de
    if [[ $OPS_SCRATCH == 1 ]]; then
        port=$(python3 "$OPS_HELPERS/scratch-runtime.py" "$OPS_ROOT" port)
        origin=http://127.0.0.1:$port
    fi
    local host=${origin#*://} proto=${origin%%:*} forwarded_port=443
    [[ $OPS_SCRATCH == 0 ]] || forwarded_port=$port
    if [[ ! $port =~ ^[0-9]+$ ]]; then fail 'Invalid backend port.'; fi
    if ((port < 1024 || port > 65535)); then fail 'Invalid backend port.'; fi
    for ((attempt=0; attempt<30; attempt++)); do
        if [[ $OPS_SCRATCH == 1 ]] && ! service_control is-active noctua.service; then
            printf 'Owned scratch process is not running; health gate refused.\n' >&2
            return 1
        fi
        ok_status=$(curl --noproxy '*' --silent --output /dev/null --write-out '%{http_code}' --max-time 3 \
            -H "Host: $host" -H "X-Forwarded-Host: $host" \
            -H "X-Forwarded-Proto: $proto" -H "X-Forwarded-Port: ${forwarded_port}" -H 'X-Forwarded-For: 127.0.0.1' \
            "http://127.0.0.1:$port/api/ba/ok") || ok_status=000
        me_status=$(curl --noproxy '*' --silent --output /dev/null --write-out '%{http_code}' --max-time 3 \
            -H "Host: $host" -H "X-Forwarded-Host: $host" \
            -H "X-Forwarded-Proto: $proto" -H "X-Forwarded-Port: ${forwarded_port}" -H 'X-Forwarded-For: 127.0.0.1' \
            "http://127.0.0.1:$port/api/auth/me") || me_status=000
        if [[ $ok_status == 200 && $me_status == 401 ]] && service_control is-active noctua.service; then
            return 0
        fi
        sleep 2
    done
    printf 'Health gate failed: /api/ba/ok=%s /api/auth/me=%s port=%s\n' "$ok_status" "$me_status" "$port" >&2
    return 1
}
switch_link() {
    local target=$1 name=$2 temporary
    [[ $name == current || $name == previous ]] || fail 'Invalid release link name.'
    [[ ! -e $OPS_ROOT/$name || -L $OPS_ROOT/$name ]] || fail 'Refusing to replace a non-symlink.'
    temporary=$(mktemp -d "$OPS_ROOT/.link.XXXXXXXX")
    ln -s "$target" "$temporary/link"
    mv -Tf "$temporary/link" "$OPS_ROOT/$name"
    rmdir "$temporary"
}
