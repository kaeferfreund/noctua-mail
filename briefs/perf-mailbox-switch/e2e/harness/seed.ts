/** Seeds one synthetic admin user (password + TOTP) and 4 synthetic mailboxes (manager membership). App must be stopped. */
const WT = "/home/monkey/code/noctua-mail/wt-spike-switch-e2e";
if (process.env.NOCTUA_DATA_DIR !== "/home/monkey/code/noctua-mail/data/noctua-data-spike-switch-e2e") throw new Error("wrong data dir");
const { getAuth } = await import(`${WT}/lib/betterAuth.ts`);
const { getDb, closeAllDbConnections } = await import(`${WT}/lib/db/connection.ts`);
const { persistAccountRow } = await import(`${WT}/lib/db/rowParsers.ts`);
const { insertUserAccountLinkRow } = await import(`${WT}/lib/db/users.ts`);
const { withAuthProof } = await import(`${WT}/lib/authPolicyContext.ts`);
const { totpFromUri } = await import(`${WT}/tests/helpers/totp.ts`);
const { parseSetCookieHeader } = await import(`${WT}/node_modules/better-auth/dist/cookies/index.mjs`).catch(() => import("better-auth/cookies"));
const db = await getDb(), auth = await getAuth();
const email = "switch-admin@example.test", password = process.env.SPIKE_PASSWORD ?? `synthetic-${crypto.randomUUID()}`, role = "admin";
const result = await withAuthProof({ db, internal: true, creation: { userId: crypto.randomUUID(), email, role }, authenticatedAt: Date.now(), method: "migration_fixture", createdSessionIds: [] },
  () => auth.api.createUser({ body: { email, name: "Synthetic Switch Admin", password, role } }));
const signed = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
const cookies = new Map<string, string>();
const absorb = (h: Headers) => parseSetCookieHeader(h.get("set-cookie") ?? "").forEach((v: { value: string }, k: string) => { if (v.value) cookies.set(k, v.value); });
absorb(signed.headers);
const headers = () => new Headers({ cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") });
const seed = await auth.api.enableTwoFactor({ headers: headers(), body: { password } });
if (seed.method !== "totp") throw Error("totp missing");
const verified = await auth.api.verifyTOTP({ headers: headers(), body: { code: totpFromUri(seed.totpURI) }, returnHeaders: true }); absorb(verified.headers);
await auth.api.signOut({ headers: headers() });
const boxes = [["small", 3906, "Kleine Praxis"], ["medium", 3907, "Mittlere Praxis"], ["large", 3908, "Grosse Praxis"], ["folders", 3909, "Viele Ordner"]] as const;
for (const [key, port, name] of boxes) {
  const account = { id: `spike-${key}`, email: `${key}@example.test`, name, avatar: "", ownerUserId: result.user.id,
    imap: { host: "127.0.0.1", port, secure: false, user: `${key}@example.test`, password: "synthetic-imap" },
    smtp: { host: "127.0.0.1", port, secure: false, user: `${key}@example.test`, password: "synthetic-imap" } };
  persistAccountRow(db, account);
  insertUserAccountLinkRow(db, result.user.id, account.id, "manager");
}
await Bun.write("/tmp/spike-switch-e2e/seed.json", JSON.stringify({ email, password, totpURI: seed.totpURI, id: result.user.id, accounts: boxes.map(b => `spike-${b[0]}`) }));
closeAllDbConnections();
console.log("seeded", result.user.id);
