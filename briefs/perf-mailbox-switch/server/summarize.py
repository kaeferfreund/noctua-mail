"""Mailbox-switch spike (server): tables from switch.ts / switch-load.ts JSON results.
Usage: python3 summarize.py switch <json>...      per-route table per file (+ hash equivalence across files)
       python3 summarize.py load <json>...        contention table per file
       python3 summarize.py stmts <json> <mode/step> [n]   top statements by ms per call"""
import json, sys

def f(x, d=1):
    return "-" if x is None or x != x else f"{x:.{d}f}"

def switch(paths):
    data = [(p, json.load(open(p))) for p in paths]
    for p, d in data:
        print(f"\n### {p}  load {d['loadStart']} -> {d['loadEnd']}  rounds {d['rounds']}/{d['coldRounds']}")
        print("| mode | step | class | n | p50 | p90 | p99 | SQL p50 | execs | compiles | bytes p50 | shard opened | writes |")
        print("|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|")
        for r in d["table"]:
            if r["mode"] == "process-first" and r["cls"] != "all":
                continue
            print(f"| {r['mode']} | {r['step']} | {r['cls']} | {r['ms']['n']} | {f(r['ms']['p50'])} | {f(r['ms']['p90'])} | {f(r['ms']['p99'])} | {f(r['sqlMs']['p50'])} | {r['execs']['p50']} | {r['compiles']['p50']} | {int(r['bytes']['p50'])} | {r['shardOpened']} | {'; '.join(w.split(' | ')[0] + ': ' + w.split(' | ')[1][:40] for w in r['writes'][:2]) or '-'} |")
        for mode, s in d["perSwitch"].items():
            print(f"critical path ({mode}): n {s['n']} p50 {f(s['p50'])} p90 {f(s['p90'])} p99 {f(s['p99'])} max {f(s['max'])}")
        oc = d.get("openCost") or []
        if oc:
            for cls in sorted({o["cls"] for o in oc}):
                xs = [o for o in oc if o["cls"] == cls]
                med = lambda k: sorted(o[k] for o in xs)[len(xs) // 2]
                print(f"getAccountDb {cls}: cold {f(med('coldMs'),2)} ms (sql {f(med('coldSqlMs'),2)}, {med('coldExecs')} execs / {med('coldCompiles')} compiles) vs warm {f(med('warmMs'),2)} ms ({med('warmExecs')} execs)")
    if len(data) > 1:
        base = data[0][1].get("hashes", {})
        for p, d in data[1:]:
            h = d.get("hashes", {})
            diff = [k for k in base if h.get(k) != base[k]]
            print(f"hash equivalence vs {data[0][0]}: {len(base) - len(diff)}/{len(base)} identical; differing: {diff[:10]}")

def load(paths):
    for p in paths:
        d = json.load(open(p))
        print(f"\n### {p}  phase {d['phaseMs']} ms  imap probe: {json.dumps(d.get('imapProbe', {}))[:400]}")
        print("| phase | load | switches | critical p50 | p90 | p99 | switch p50/p99 (retries) | me p50/p99 (retries) | folders p50/p99 | threads p50/p99 | child retries / BUSY |")
        print("|---|---|---:|---:|---:|---:|---|---|---|---|---|")
        for r in d["results"]:
            st = r["steps"]
            kids = []
            for name, c in r["children"].items():
                if "kinds" in c:
                    kids.append(name + " " + ",".join(f"{k} {v['busy']}/{v['attempts']}" for k, v in c["kinds"].items()))
                elif "retries" in c:
                    kids.append(name + " " + (",".join(f"{k} {v}" for k, v in c["retries"].items()) or "0") + (f" done {c['completed']}" if "completed" in c else "") + (f" req {c['requests']}" if "requests" in c else ""))
                else:
                    kids.append(name + " missing")
            cell = lambda s: f"{f(st[s]['p50'])} / {f(st[s]['p99'])}" + (f" ({st[s]['retries']}: {', '.join(f'{k} {v}' for k, v in st[s]['retryOps'].items())})" if st[s]['retries'] else "")
            print(f"| {r['phase']} | {r['loadStart'][0]:.1f}->{r['loadEnd'][0]:.1f} | {r['switches']} | {f(r['criticalPath']['p50'])} | {f(r['criticalPath']['p90'])} | {f(r['criticalPath']['p99'])} | {cell('switch')} | {cell('me')} | {cell('folders')} | {cell('threads')} | {'; '.join(kids) or '-'} |")

def stmts(path, key, n=15):
    d = json.load(open(path))
    for s in d["histograms"][key][:n]:
        print(f"| {s['msPerCall']:.3f} | {s['execsPerCall']:.1f} | {s['handle']} | `{s['sql'][len(s['handle'])+3:][:110]}` |")

if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "switch": switch(sys.argv[2:])
    elif cmd == "load": load(sys.argv[2:])
    else: stmts(sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 15)
