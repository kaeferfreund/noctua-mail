// Cost of mapAccountRow (secret decryption) vs the raw row read, 12 synthetic accounts. Outside git.
const ROOT = process.cwd();
await import(`${ROOT}/lib/testSetupEnv.ts`);
const api = await (await import(`${ROOT}/lib/testDbHarness.ts`)).dbModulePromise;
const { getDb } = await import(`${ROOT}/lib/db/connection.ts`);
const { mapAccountRow } = await import(`${ROOT}/lib/db/rowParsers.ts`);
for (let i = 0; i < 12; i++) await api.upsertAccount({ id: `m${i}`, name: `M${i}`, email: `m${i}@example.test`, avatar: "",
  imap: { host: "h", port: 993, secure: true, user: "u", password: "synthetic-imap" }, smtp: { host: "h", port: 465, secure: true, user: "u", password: "synthetic-smtp" },
  ...(i % 3 === 0 ? { caldav: { url: "https://dav.example.test/", user: "u", password: "synthetic-dav" } } : {}),
  ...(i % 2 === 0 ? { deepl: { apiKey: "synthetic-deepl", enabled: true, targetLang: "DE" } } : {}) } as any);
const db = await getDb(); const stmt = db.query("SELECT * FROM accounts");
const rows = stmt.all() as any[]; console.log("encrypted sample", String(rows[0].imapPassword).slice(0, 8));
const time = (f: () => void, n = 2000) => { for (let i = 0; i < 200; i++) f(); const t = performance.now(); for (let i = 0; i < n; i++) f(); return (performance.now() - t) / n; };
const read = time(() => stmt.all());
const map = time(() => rows.map(mapAccountRow));
console.log(JSON.stringify({ accounts: 12, readAllRowsMs: +read.toFixed(4), mapAccountRowAllMs: +map.toFixed(4), perRowMapUs: +(map / 12 * 1000).toFixed(1) }));
process.exit(0);
