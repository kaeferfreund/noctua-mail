#!/usr/bin/env python3
"""Bind reviewed inputs or assembled flat releases to exact checksum coverage."""
import hashlib
import os
from pathlib import Path
import sys

mode = sys.argv[1] if sys.argv[1].startswith('--') else 'build'
args = sys.argv[2:] if mode != 'build' else sys.argv[1:]
root = Path(args[0]).resolve(strict=True)
manifest = Path(args[1])
release_mode = mode in ('--release', '--write-release')
if mode not in ('build', '--release', '--write-release'):
    sys.exit('Unknown verification mode')
actual = {}
trees = ('.',) if release_mode else ('.next/standalone', '.next/static', 'public')
cache = Path(os.environ.get('NOCTUA_OPS_ROOT', '/srv/noctua')) / 'cache'
cache_target = str(cache) if os.environ.get('NOCTUA_OPS_ROOT') else '/var/cache/noctua'
if release_mode and not (root / '.next/cache').is_symlink():
    sys.exit('Release must contain its configured cache symlink')
for tree in trees:
    base = root / tree
    if base.is_symlink() or not base.is_dir():
        sys.exit('Artifact tree must be an existing regular directory')
    for path in base.rglob('*'):
        name = path.relative_to(root).as_posix()
        if path.is_symlink():
            if release_mode and name == '.next/cache' and os.readlink(path) == cache_target:
                continue
            sys.exit('Artifact symlink requires explicit packaging review')
        if path.name.startswith('.env'):
            sys.exit('Environment files must never enter release artifacts')
        if path.is_file() and not (release_mode and name == 'RELEASE_ARTIFACTS.sha256'):
            with path.open('rb') as stream:
                actual[name] = hashlib.file_digest(stream, 'sha256').hexdigest()
if mode == '--write-release':
    if manifest != root / 'RELEASE_ARTIFACTS.sha256':
        sys.exit('Release manifest must be stored at the release root')
    manifest.write_text(''.join(f'{actual[name]}  {name}\n' for name in sorted(actual)))
else:
    expected = {}
    for line in manifest.read_text().splitlines():
        digest, separator, name = line.partition('  ')
        path = Path(name)
        if (not separator or len(digest) != 64 or any(c not in '0123456789abcdef' for c in digest)
                or path.is_absolute() or '..' in path.parts or name in expected
                or path.as_posix() != name):
            sys.exit('Invalid or duplicate artifact checksum entry')
        expected[name] = digest
    if not actual or actual != expected:
        sys.exit('Artifact manifest must match every artifact file exactly')
print('Artifact checksums and coverage verified')
