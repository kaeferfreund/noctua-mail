#!/usr/bin/env python3
"""Synthetic local process adapter; never used for production service management."""
import json
import os
from pathlib import Path
import re
import shlex
import signal
import socket
import subprocess
import sys
import time

root = Path(sys.argv[1]).resolve(strict=True)
action = sys.argv[2]
record = root / 'server-pid.json'


def identity(pid):
    try:
        # starttime and cwd prevent signaling an unrelated, reused PID.
        proc = Path(f'/proc/{pid}')
        stat = (proc / 'stat').read_text().rsplit(')', 1)[1].split()
        if stat[0] == 'Z':
            return None
        return {'pid': pid, 'start': stat[19], 'cwd': str((proc / 'cwd').resolve(strict=True))}
    except (OSError, ProcessLookupError):
        return None


def active():
    if not record.exists():
        return False
    saved = json.loads(record.read_text())
    return identity(saved['pid']) == saved


def environment():
    # Restricted systemd-style assignments, with quoting but no shell evaluation,
    # interpolation, command substitution, export or multiline values.
    values = {}
    for line in (root / 'env/noctua.env').read_text().splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        key, sep, value = line.partition('=')
        if not sep or not re.fullmatch(r'[A-Z][A-Z0-9_]*', key) or key in values:
            sys.exit('Invalid/duplicate scratch environment assignment')
        words = shlex.split(value, comments=False)
        if len(words) > 1:
            sys.exit('Quote values containing spaces')
        values[key] = words[0] if words else ''
    if not values.get('PORT', '').isdigit() or not 1024 <= int(values['PORT']) <= 65535:
        sys.exit('Scratch runtime requires a nonprivileged explicit port')
    if values.get('NOCTUA_DATA_DIR') != str(root / 'data'):
        sys.exit('Scratch data must stay under scratch root')
    if values.get('BETTER_AUTH_URL') != 'http://127.0.0.1:' + values['PORT']:
        sys.exit('Scratch origin must be the configured loopback port')
    values.update(NODE_ENV='production', HOSTNAME='127.0.0.1',
                  NEXT_TELEMETRY_DISABLED='1', BETTER_AUTH_TELEMETRY='0',
                  NOCTUA_MAILBOX_WATCHER='0', PATH=str(root / 'bin') + ':/usr/bin:/bin')
    return values


if action == 'is-active':
    sys.exit(0 if active() else 1)
elif action == 'port':
    print(environment()['PORT'])
elif action == 'start':
    if active():
        sys.exit(0)
    release = (root / 'current').resolve(strict=True)
    if not release.is_relative_to(root / 'releases'):
        sys.exit('Current must resolve below scratch releases')
    env = environment()
    # Fail before starting or probing an unrelated listener. Bind once and release;
    # the child still fails closed if a concurrent process wins the remaining race.
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', int(env['PORT'])))
    with (root / 'server.log').open('ab') as log:
        proc = subprocess.Popen([str(root / 'bin/bun'), '--no-env-file', '--bun', 'server.js'],
                                cwd=release, env=env, stdin=subprocess.DEVNULL,
                                stdout=log, stderr=log, start_new_session=True, close_fds=True)
    saved = identity(proc.pid)
    if saved is None:
        sys.exit('Scratch runtime exited before PID recording')
    record.write_text(json.dumps(saved))
    time.sleep(0.25)
    if not active():
        sys.exit('Owned scratch runtime exited during startup; see server.log')
    print(f'Started owned scratch PID {proc.pid}')
elif action == 'stop':
    if active():
        saved = json.loads(record.read_text())
        os.kill(saved['pid'], signal.SIGTERM)
        for _ in range(120):
            if not active():
                break
            time.sleep(0.1)
        if active():
            sys.exit('Owned process did not stop; PID record retained')
        print(f'Stopped owned scratch PID {saved["pid"]}')
    record.unlink(missing_ok=True)
else:
    sys.exit('Unknown scratch service operation')
