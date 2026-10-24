// Mailbox-switch spike: phase anatomy of GET threads (first page, default view) and of the auth guard.
//   SWITCH_FIXTURE_ONLY=syn-m0,syn-l0 bun --tsconfig-override tsconfig.json anatomy.ts [out.json]
import { writeFileSync } from "node:fs";
import * as counter from "./sqlcounter";
import { buildFixture } from "./fixture";
const ROOT = process.env.SWITCH_ROOT ?? process.cwd();
const ITER = Number(process.env.ANATOMY_ITER ?? 40);
const fx = await buildFixture();
const { getMainDbPath } = await import(`${ROOT}/lib/runtimePaths.ts`);
const { getAuthDb } = await import(`${ROOT}/lib/db/connection.ts`);
counter.labelHandle(fx.master, "master"); counter.labelHandle(await getAuthDb(), "auth"); counter.setMainPath(getMainDbPath());
const threads = await import(`${ROOT}/app/api/accounts/[accountId]/threads/route.ts`);
const sw = await import(`${ROOT}/app/api/auth/switch-account/route.ts`);
const { listThreads } = await import(`${ROOT}/lib/db/messages/query.ts`);
const { enrichMessagesWithThreadTopics } = await import(`${ROOT}/app/api/_helpers/enrichMessagesWithThreadTopics.ts`);
const { enrichMessagesWithThreadCollab } = await import(`${ROOT}/app/api/_helpers/enrichMessagesWithThreadCollab.ts`);
const { getOwnAddresses } = await import(`${ROOT}/lib/ownAddresses.ts`);
const { getAccountById } = await import(`${ROOT}/lib/serverDb.ts`);
const { requireAccountContext } = await import(`${ROOT}/app/api/_helpers/accountContext.ts`);
const { requireActiveUserSession } = await import(`${ROOT}/lib/auth.ts`);
const { validateAccountFolders } = await import(`${ROOT}/app/api/_helpers/folderAccount.ts`);
const { buildTimeGroupKey } = await import(`${ROOT}/lib/messageGrouping.ts`);
const ORIGIN = "http://localhost:3000";
const rq = (path: string) => new Request(`${ORIGIN}${path}`, { headers: { cookie: fx.user.jar.header(), origin: ORIGIN } });
const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };
async function time(label: string, fn: () => Promise<any> | any, n = ITER) {
  await fn();
  const ms: number[] = [], sql: number[] = [], execs: number[] = [];
  for (let i = 0; i < n; i++) {
    counter.reset(); counter.state.enabled = true;
    const t = performance.now(); await fn(); ms.push(performance.now() - t);
    counter.state.enabled = false; sql.push(counter.state.total.ms); execs.push(counter.state.total.execs);
  }
  const row = { label, p50: q(ms, 0.5), p90: q(ms, 0.9), sqlP50: q(sql, 0.5), execs: q(execs, 0.5) };
  console.log(label.padEnd(60), `p50 ${row.p50.toFixed(2)} p90 ${row.p90.toFixed(2)} sql ${row.sqlP50.toFixed(2)} execs ${row.execs}`);
  return row;
}
const out: any[] = [];
for (const id of (process.env.SWITCH_FIXTURE_ONLY ?? "syn-m0").split(",")) {
  await sw.POST(new Request(`${ORIGIN}/api/auth/switch-account`, { method: "POST", body: JSON.stringify({ accountId: id }), headers: { cookie: fx.user.jar.header(), origin: ORIGIN, "content-type": "application/json" } }));
  const account = await getAccountById(id);
  const folderId = `${id}:INBOX`;
  const base = { accountId: id, folderId, page: 1, groupBy: "date", threadDateSource: "latestReceivedDateValue", fields: [], query: null, viewerUserId: fx.user.user.id };
  for (const pageSize of [50, 100, 300]) {
    const path = `/api/accounts/${id}/threads?page=1&pageSize=${pageSize}&groupBy=date&threadDateSource=latestReceivedDateValue&folderId=${encodeURIComponent(folderId)}`;
    const body = await (await threads.GET(rq(path), { params: Promise.resolve({ accountId: id }) })).text();
    const parsed = JSON.parse(body);
    // Topic ids/keywords/timestamps are random per fixture build: map them to name-based tokens before hashing.
    const topicIds = new Map<string, string>();
    const normalize = (v: any): any => {
      if (Array.isArray(v)) return v.map(normalize);
      if (v && typeof v === "object") {
        const o: any = {};
        const isTopic = typeof v.name === "string" && "imapKeyword" in v;
        if (isTopic) topicIds.set(v.id, `topic:${v.name}`);
        for (const [k, x] of Object.entries(v)) o[k] = isTopic && k === "id" ? `topic:${v.name}` : isTopic && k === "imapKeyword" ? `kw:${v.name}`
          : isTopic && (k === "createdAt" || k === "updatedAt") ? 0 : normalize(x);
        return o;
      }
      return typeof v === "string" && topicIds.has(v) ? topicIds.get(v) : v;
    };
    const normalized = JSON.stringify(normalize(parsed));
    out.push({ id, label: `hash ${id} pageSize=${pageSize}`, sha256: new Bun.CryptoHasher("sha256").update(normalized).digest("hex"), bytes: body.length,
      itemsWithSuggestions: parsed.items.filter((m: any) => m.topicSuggestions?.length).length });
    out.push({ id, ...(await time(`${id} route GET threads pageSize=${pageSize}`, async () => (await threads.GET(rq(path), { params: Promise.resolve({ accountId: id }) })).text())) });
    out.push({ id, ...(await time(`${id}   listThreads pageSize=${pageSize}`, () => listThreads({ ...base, pageSize } as any))) });
  }
  const data = await listThreads({ ...base, pageSize: 300 } as any);
  out.push({ id, ...(await time(`${id}   enrich topics+suggestions (900 items)`, async () => { const items = data.items.map((m: any) => ({ ...m }));
    await enrichMessagesWithThreadTopics(items, { accountId: id, accountEmail: getOwnAddresses(account!), includeSuggestions: true }); })) });
  out.push({ id, ...(await time(`${id}   enrich topics only (no suggestions)`, async () => { const items = data.items.map((m: any) => ({ ...m }));
    await enrichMessagesWithThreadTopics(items, { accountId: id, accountEmail: getOwnAddresses(account!), includeSuggestions: false }); })) });
  out.push({ id, ...(await time(`${id}   enrich collab`, async () => { const items = data.items.map((m: any) => ({ ...m })); await enrichMessagesWithThreadCollab(items, { accountId: id }); })) });
  out.push({ id, ...(await time(`${id}   slim + JSON.stringify`, () => JSON.stringify({ items: data.items.map(threads.slimThreadListItem), groups: data.groups, total: data.total }))) });
  out.push({ id, ...(await time(`${id}   buildTimeGroupKey x ${data.items.length}`, () => { for (const m of data.items) buildTimeGroupKey(m.dateValue, "date"); })) });
  out.push({ id, ...(await time(`${id}   requireAccountContext (guard+role+account)`, () => requireAccountContext(rq(`/api/accounts/${id}/threads`), id, { minRole: "viewer" }))) });
  out.push({ id, ...(await time(`${id}   validateAccountFolders`, () => validateAccountFolders(id, [folderId]))) });
}
out.push(await time(`requireActiveUserSession`, () => requireActiveUserSession(rq("/api/auth/me"))));
writeFileSync(process.argv[2] ?? "/tmp/spike-switch-server/anatomy.json", JSON.stringify(out, null, 1));
process.exit(0);
