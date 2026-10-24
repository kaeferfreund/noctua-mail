// Full sync of every folder of every synthetic mailbox before measuring. Records sync time (not switch cost).
import { chromium, ensureSession, BASE } from "./common.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
const browser = await chromium.launch({ headless: true });
const state = await ensureSession(browser, { fresh: true, accountId: "spike-small" });
const ctx = await browser.newContext({ baseURL: BASE, storageState: state });
const out = {};
const runJob = async (id, data) => {
  const r = await ctx.request.post(`/api/accounts/${id}/sync`, { data, headers: { origin: BASE } });
  const body = await r.json(); if (!body.jobId) return { http: r.status(), body };
  let st;
  for (;;) { await new Promise(res => setTimeout(res, 300)); st = await (await ctx.request.get(`/api/accounts/${id}/sync/status?jobId=${body.jobId}`)).json(); if (!["running", "queued"].includes(st.job?.status)) break; }
  return { http: r.status(), status: st.job?.status };
};
for (const key of ["small", "medium", "large", "folders"]) {
  const id = `spike-${key}`; const t0 = Date.now();
  const folders = await (await ctx.request.get(`/api/accounts/${id}/folders`)).json();
  const jobs = [];
  for (const f of folders) jobs.push({ folder: f.name ?? f.id, ...(await runJob(id, { folderId: f.id, mode: "full" })) });
  out[key] = { ms: Date.now() - t0, jobs: jobs.length, notDone: jobs.filter(j => j.status !== "done") };
  console.log(key, out[key].ms, out[key].jobs, JSON.stringify(out[key].notDone).slice(0, 300));
}
const folders = {};
for (const key of ["small", "medium", "large", "folders"]) {
  const f = await (await ctx.request.get(`/api/accounts/spike-${key}/folders`)).json();
  folders[key] = { folders: f.length, messages: f.reduce((a, b) => a + (b.count ?? 0), 0) };
}
console.log(folders);
mkdirSync("/tmp/spike-switch-e2e/results", { recursive: true });
writeFileSync("/tmp/spike-switch-e2e/results/prime-sync.json", JSON.stringify({ at: new Date().toISOString(), perFolderFullSync: out, folders }, null, 1));
await browser.close();
