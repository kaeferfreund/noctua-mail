import { expect, test } from "bun:test";
import { createTestAuthHarness } from "./testAuthHarness";
import { installAuthControlPlane } from "./db/authPolicy";
import { migrateTeamAuth, type TeamAuthMigrationManifest } from "./teamAuthMigration";

async function fixture() {
  const f=await createTestAuthHarness();
  f.master.exec(`ALTER TABLE users ADD COLUMN name TEXT; ALTER TABLE users ADD COLUMN passwordHash TEXT;
    ALTER TABLE users ADD COLUMN disabledAt INTEGER; ALTER TABLE users ADD COLUMN mustChangePassword INTEGER`);
  const password="synthetic-user-chosen-password", hash=await (await f.auth.$context).password.hash(password);
  f.master.prepare(`INSERT INTO users(id,email,role,createdAt,name,passwordHash,disabledAt) VALUES('legacy','legacy@example.test','admin',1234567890000,'Synthetic Legacy',?,NULL)`).run(hash);
  const manifest:TeamAuthMigrationManifest={version:1,users:[{userId:"legacy",legacyUserId:"legacy",email:"legacy@example.test",role:"admin",createdAt:1234567890000,passwordProvenance:"user-chosen"}],memberships:[]};
  return {...f,password,hash,manifest};
}
test("offline migration preserves IDs/name/time/chosen hash, provenance and rejects old tokens exactly once",async()=>{
  const f=await fixture();
  try {
    f.manifest.users[0].name="Reviewed Synthetic Name";
    expect((await migrateTeamAuth(f.auth,f.database,f.manifest)).status).toBe("complete");
    const row=f.master.prepare(`SELECT * FROM auth_user WHERE id='legacy'`).get();
    expect(row.name).toBe("Reviewed Synthetic Name");
    expect(new Date(row.createdAt).getTime()).toBe(1234567890000);
    expect(f.master.prepare(`SELECT password FROM auth_account WHERE userId='legacy'`).get().password).toBe(f.hash);
    expect(f.master.prepare(`SELECT kind,state FROM user_provisioning WHERE userId='legacy'`).get()).toEqual({kind:"migration",state:"complete"});
    const login=await f.signIn("legacy@example.test",f.password);
    expect(login.session?.user.id).toBe("legacy");
    const generation=f.master.prepare(`SELECT generation FROM auth_security_state WHERE userId='legacy'`).get().generation;
    expect((await migrateTeamAuth(f.auth,f.database,f.manifest)).status).toBe("already_complete");
    expect(f.master.prepare(`SELECT generation FROM auth_security_state WHERE userId='legacy'`).get().generation).toBe(generation);
    expect(await f.auth.api.getSession({headers:login.jar.headers()})).not.toBeNull();
    const audit=JSON.stringify(f.master.prepare(`SELECT * FROM admin_audit`).all());
    expect(audit).not.toContain(f.hash);expect(audit).not.toContain(f.password);
  } finally {f.close();}
});
test("temporary hashes are discarded and legacy name/ban imports cannot replay at startup",async()=>{
  const f=await fixture();
  try {
    f.master.exec(`UPDATE users SET disabledAt=123,mustChangePassword=1`);
    f.manifest.users[0].passwordProvenance="recovery";
    await migrateTeamAuth(f.auth,f.database,f.manifest);
    expect(f.master.prepare(`SELECT banned,banExpires FROM auth_user WHERE id='legacy'`).get()).toEqual({banned:1,banExpires:null});
    expect(f.master.prepare(`SELECT 1 FROM auth_account WHERE userId='legacy'`).get()).toBeNull();
    expect(f.master.prepare(`SELECT disabledAt FROM users WHERE id='legacy'`).get().disabledAt).toBe(123);
    expect(f.master.prepare(`SELECT name FROM auth_user WHERE id='legacy'`).get().name).toBe("Synthetic Legacy");
    f.master.exec(`UPDATE auth_user SET name='Updated Synthetic Name',banned=0 WHERE id='legacy'`);
    installAuthControlPlane(f.database);
    expect(f.master.prepare(`SELECT name,banned FROM auth_user WHERE id='legacy'`).get()).toEqual({name:"Updated Synthetic Name",banned:0});
  } finally {f.close();}
});
for(const fault of ["duplicate","shared","temporary","malformed-hash","wrong-id","missing-profile","unmapped-profile","write-fault"] as const) test(`migration refuses ${fault} atomically`,async()=>{
  const f=await fixture();
  try {
    if(fault==="duplicate") { f.master.exec(`DROP INDEX idx_users_email_lower`);f.master.exec(`INSERT INTO users(id,email,role,createdAt) VALUES('duplicate','LEGACY@example.test','user',1)`); }
    if(fault==="shared") f.master.exec(`INSERT INTO accounts(id,name,email,avatar,imapHost,imapPort,imapSecure,imapUser,imapPassword,smtpHost,smtpPort,smtpSecure,smtpUser,smtpPassword) VALUES('shared','Synthetic Shared','legacy@example.test','','imap.example.test',993,1,'shared@example.test','','smtp.example.test',465,1,'shared@example.test','')`);
    if(fault==="temporary") f.master.exec(`UPDATE users SET mustChangePassword=1`);
    if(fault==="malformed-hash") f.master.exec(`UPDATE users SET passwordHash='not-an-argon2id-hash'`);
    if(fault==="wrong-id") f.manifest.users[0].userId="different";
    if(fault==="missing-profile") f.manifest.users[0].legacyUserId="unknown";
    if(fault==="unmapped-profile") f.manifest.users=[];
    if(fault==="write-fault") f.master.exec(`CREATE TRIGGER synthetic_migration_fault BEFORE INSERT ON user_provisioning BEGIN SELECT RAISE(ABORT,'synthetic import failure'); END`);
    await expect(migrateTeamAuth(f.auth,f.database,f.manifest)).rejects.toThrow();
    expect(f.master.prepare(`SELECT 1 FROM auth_user`).get()).toBeNull();
    expect(f.master.prepare(`SELECT 1 FROM auth_security_state`).get()).toBeNull();
    expect(f.master.prepare(`SELECT 1 FROM user_provisioning`).get()).toBeNull();
    expect(f.master.prepare(`SELECT id FROM users WHERE id='legacy'`).get().id).toBe("legacy");
  } finally {f.close();}
});
test("explicit account-ID-only mapping creates only reviewed personal identity and membership",async()=>{
  const f=await createTestAuthHarness();
  try {
    f.master.exec(`INSERT INTO accounts(id,name,email,avatar,imapHost,imapPort,imapSecure,imapUser,imapPassword,smtpHost,smtpPort,smtpSecure,smtpUser,smtpPassword) VALUES('old-account','Synthetic Shared','shared@example.test','','imap.example.test',993,1,'shared@example.test','','smtp.example.test',465,1,'shared@example.test','')`);
    const manifest={version:1,users:[{userId:"personal",legacyUserId:null,email:"personal@example.test",name:"Synthetic Person",role:"user",createdAt:1234567890000,passwordProvenance:"recovery"}],memberships:[{userId:"personal",accountId:"old-account",role:"manager"}]};
    await migrateTeamAuth(f.auth,f.database,manifest);
    expect(f.master.prepare(`SELECT id FROM users`).get().id).toBe("personal");
    expect(f.master.prepare(`SELECT role FROM user_accounts WHERE userId='personal' AND accountId='old-account'`).get().role).toBe("manager");
  } finally {f.close();}
});
