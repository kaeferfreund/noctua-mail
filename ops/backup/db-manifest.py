#!/usr/bin/env python3
# Purpose: reject unbacked shard paths; check SQLite, rebase isolated copies; runbook §6.1/§6.5; REVIEW BEFORE USE.
import json
from pathlib import Path
import sqlite3
import sys
from urllib.parse import quote


def connect(path):
    return sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)


def check_database(path):
    with connect(path) as db:
        if db.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
            sys.exit("SQLite integrity check failed (private manifest identifies databases)")
        if db.execute("PRAGMA foreign_key_check").fetchone() is not None:
            sys.exit("SQLite foreign-key check failed")


mode, data_arg, manifest_arg = sys.argv[1:4]
if Path(data_arg).is_symlink():
    sys.exit("Data root must not be a symlink")
data = Path(data_arg).resolve(strict=True)
manifest_path = Path(manifest_arg)
if mode == "capture":
    # Reject symlinks, which tar would otherwise preserve without their target data.
    if any(path.is_symlink() for path in data.rglob("*")):
        sys.exit("Data symlinks need explicit backup review")
    master = data / "db/main.db"
    rows = []
    if master.exists():
        with connect(master) as db:
            for account_id, stored in db.execute("SELECT id, dbPath FROM accounts ORDER BY id"):
                if stored and stored.strip():
                    path = Path(stored)
                    if not path.is_absolute():
                        path = Path(sys.argv[4]) / path
                else:
                    path = data / "db/accounts" / (quote(account_id, safe="~()*!.'-_") + ".db")
                path = path.resolve(strict=True)
                if not path.is_relative_to(data) or not path.is_file():
                    sys.exit("External shard path requires an expanded backup/restore design")
                rows.append({"id": account_id, "relative": str(path.relative_to(data))})
    elif any(data.iterdir()):
        sys.exit("Non-empty data tree has no master db/main.db")
    # Include nonstandard referenced shards, all conventional DBs, and legacy mail.db.
    databases = {path.resolve() for path in data.rglob("*.db")}
    databases.update(data / row["relative"] for row in rows)
    for path in databases:
        check_database(path)
    manifest_path.write_text(json.dumps({"accounts": rows, "databases": sorted(str(p.relative_to(data)) for p in databases)}, indent=2) + "\n")
elif mode == "restore":
    manifest = json.loads(manifest_path.read_text())
    # This operates only on an already extracted scratch copy, never on source paths.
    master = data / "db/main.db"
    if master.exists():
        with sqlite3.connect(master) as db:
            if {row[0] for row in db.execute("SELECT id FROM accounts")} != {row["id"] for row in manifest["accounts"]}:
                sys.exit("Restored account inventory mismatch")
            for row in manifest["accounts"]:
                target = (data / row["relative"]).resolve(strict=True)
                if not target.is_relative_to(data):
                    sys.exit("Unsafe restored shard reference")
                db.execute("UPDATE accounts SET dbPath=? WHERE id=?", (str(target), row["id"]))
    for name in manifest["databases"]:
        target = (data / name).resolve(strict=True)
        if not target.is_relative_to(data):
            sys.exit("Unsafe restored database path")
        check_database(target)
else:
    sys.exit("Usage: db-manifest.py capture|restore DATA MANIFEST [SOURCE_RELEASE_CWD]")
print("SQLite integrity/foreign keys and shard inventory verified")
