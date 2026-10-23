"""Reproduce the r4 protocol from this checkout, using scratch archives only.

Run: nice -n 10 python3 doc/sender-identities-r5/measure.py
Requires installed node_modules and unused .tmp/measure-{base,r4,r5} paths.
Never starts a Next server or reads .env.local into the report.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import statistics
import subprocess
import time

ROOT = Path(__file__).resolve().parents[2]
SOURCES = Path(__file__).resolve().parent
SCRATCH = ROOT / ".tmp"
PRODUCTION = ["lib/authStreams.ts", "lib/db/accountAccess.ts", "lib/db/senderIdentities.ts",
              "lib/db/messages/upsert.ts", "lib/db/processLeases.ts",
              "lib/dbWriteRetry.ts", "lib/outboundWrite.ts"]


def stats(values):
    if not values:
        return {"n": 0}
    v = sorted(values)
    return {"n": len(v), "p50": statistics.median(v),
            "p95": v[int((len(v)-1)*.95)], "p99": v[int((len(v)-1)*.99)],
            "max": v[-1], "total": sum(v)}


def summarize(out, log):
    import re
    d = json.loads((out / "main.json").read_text())
    d["draftLatencyMs"] = stats(d.pop("latencies"))
    d["auth"] = json.loads((out / "child-0.json").read_text())
    d["workers"] = [json.loads((out / f"child-{i}.json").read_text()) for i in (1, 2)]
    spans = {}
    for file in (out / "metrics").glob("*.json"):
        for key, values in json.loads(file.read_text())["spans"].items():
            spans.setdefault(key, []).extend(values)
    d["timings"] = {key: stats(values) for key, values in spans.items()}
    d["busyRetries"] = sum(len(v) for k, v in spans.items() if k.startswith("retry."))
    d["retryExhaustions"] = sum(len(v) for k, v in spans.items() if k.startswith("exhausted."))
    active = 0
    for raw in re.findall(r'\[sync\] worker started (\{[^\n]+\})', log.read_text()):
        worker = json.loads(raw)
        file = out / "metrics" / f"{worker['pid']}.json"
        if file.exists() and json.loads(file.read_text())["spans"]:
            active += 1
    d["watcherWorkersWithDbActivity"] = active
    return d


def prepare(name, rev):
    target = SCRATCH / f"measure-{name}"
    target.mkdir()  # Refuse to overwrite a previous archive or active run.
    archive = subprocess.Popen(["git", "archive", rev], cwd=ROOT, stdout=subprocess.PIPE)
    subprocess.run(["tar", "-x", "-C", str(target)], stdin=archive.stdout, check=True)
    assert archive.wait() == 0
    if name == "r5":
        for file in PRODUCTION:
            shutil.copyfile(ROOT / file, target / file)
    (target / "node_modules").symlink_to(ROOT / "node_modules", target_is_directory=True)
    shutil.copyfile(SOURCES / "dbProbe.ts.txt", target / "lib/reviewDbProbe.ts")
    source = (SOURCES / "load.ts.txt").read_text().replace(
        "let fixtureText='';",
        "process.once('exit',()=>{try{fixture.kill('SIGKILL')}catch{}});\nlet fixtureText='';")
    (target / "scripts/reviewLoad.ts").write_text(source)
    p = target / "lib/db/connection.ts"
    source = 'import { attachDbProbe } from "../reviewDbProbe";\n' + p.read_text()
    source = source.replace('// Shard-only tuning',
                            'attachDbProbe(db, options.accountShard ? "shard" : "master");\n  // Shard-only tuning')
    p.write_text(source)
    if name != "base":
        p = target / "lib/outboundWrite.ts"
        source = 'import { record } from "./reviewDbProbe";\n' + p.read_text()
        source = source.replace('      shard.exec("BEGIN IMMEDIATE");',
                                '      let masterAcquired = 0;\n      shard.exec("BEGIN IMMEDIATE");')
        source = source.replace('master.exec("BEGIN IMMEDIATE");',
                                'const masterBefore=performance.now();\n        master.exec("BEGIN IMMEDIATE");\n        masterAcquired=performance.now();\n        record("guard.masterAcquireMs",masterAcquired-masterBefore);')
        source = source.replace('actor.assertCurrent(master);',
                                'const assertionStart=performance.now();\n          actor.assertCurrent(master);\n          record("guard.assertMs",performance.now()-assertionStart);\n          record("guard.dmlAttempts");')
        source = source.replace('shard.exec("COMMIT");', 'shard.exec("COMMIT");\n          record("guard.commits");')
        source = source.replace('master.exec("ROLLBACK");',
                                'master.exec("ROLLBACK");\n          record("guard.masterHoldMs",performance.now()-masterAcquired);')
        p.write_text(source)
    return target


if __name__ == "__main__":
    SCRATCH.mkdir(exist_ok=True)
    trees = {name: prepare(name, rev) for name, rev in
             [("base", "9424150"), ("r4", "d5ae17b"), ("r5", "HEAD")]}
    results = {"sourceSha256": {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in PRODUCTION},
               "samples": {}}
    # Interleave controls; do not run any gates during these measurements.
    for name in ["base-1", "r4-1", "r5-1", "r5-2", "r4-2", "base-2"]:
        variant = name.rsplit("-", 1)[0]
        out = SCRATCH / f"measure-{name}-results"
        out.mkdir()
        log = out / "load.log"
        env = {**os.environ, "TMPDIR": str(SCRATCH), "REVIEW_OUT": str(out), "REVIEW_DURATION": "60000"}
        started = time.time()
        with log.open("w") as stream:
            p = subprocess.run(["nice", "-n", "10", "timeout", "240", "bun", "scripts/reviewLoad.ts"],
                               cwd=trees[variant], env=env, stdout=stream, stderr=stream)
        if p.returncode:
            raise RuntimeError(f"{name}: exit {p.returncode}; see {log}")
        results["samples"][name] = summarize(out, log)
        results["samples"][name]["elapsedSecondsIncludingSetup"] = time.time() - started
        (SCRATCH / "measurement.json").write_text(json.dumps(results, indent=2) + "\n")
        print(name, results["samples"][name]["saves"], flush=True)
