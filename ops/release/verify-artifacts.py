#!/usr/bin/env python3
# Purpose: bind release evidence to complete build artifacts; runbook §3.1–3.2; REVIEW BEFORE USE.
import hashlib
from pathlib import Path
import sys

root = Path(sys.argv[1]).resolve(strict=True)
manifest = Path(sys.argv[2])
expected = {}
for line in manifest.read_text().splitlines():
    digest, separator, name = line.partition("  ")
    path = Path(name)
    if (not separator or len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest)
            or path.is_absolute() or ".." in path.parts or name in expected):
        sys.exit("Invalid or duplicate artifact checksum entry")
    expected[name] = digest
actual = {}
for tree in (".next/standalone", ".next/static", "public"):
    if (root / tree).is_symlink():
        sys.exit("Artifact tree root must not be a symlink")
    for path in (root / tree).rglob("*"):
        # Symlinks complicate immutable evidence; fail rather than copy unchecked targets.
        if path.is_symlink():
            sys.exit("Artifact symlink requires explicit packaging review")
        if path.is_file():
            actual[path.relative_to(root).as_posix()] = hashlib.file_digest(path.open("rb"), "sha256").hexdigest()
if not actual or actual != expected:
    sys.exit("Artifact manifest must match every standalone/static/public file exactly")
print("Artifact checksums and coverage verified")
