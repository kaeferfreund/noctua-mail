// Timeline of selected runs: requests (start→end), marks, long tasks.
import { readFileSync } from "node:fs";
const [file, group, idx = "3"] = process.argv.slice(2);
const res = JSON.parse(readFileSync(file, "utf8"));
const rs = res.runs.filter(r => `${r.mode}:${r.from}->${r.to}` === group);
for (const i of idx.split(",").map(Number)) { const r = rs[i]; if (!r) continue;
  console.log(`-- ${group} rep ${r.rep} firstRows ${r.marks.firstRows} settled ${r.settledMs} marks ${JSON.stringify(r.marks)}`);
  console.log("   longTasks", r.longTasks.list.map(l => `${Math.round(l.start)}+${Math.round(l.dur)}`).join(" "));
  for (const q of r.requests) console.log(`   ${String(Math.round(q.startMs)).padStart(5)} → ${q.endMs == null ? (q.stream ? "stream" : "  ?  ") : String(Math.round(q.endMs)).padStart(5)} ${q.method} ${q.urlKey.slice(0, 110)}`);
}
