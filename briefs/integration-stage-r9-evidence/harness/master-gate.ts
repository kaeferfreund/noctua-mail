import assert from 'node:assert/strict';
import { Database } from 'bun:sqlite';
import { mkdirSync, rmSync } from 'node:fs';import path from 'node:path';
const kind=process.argv[2];process.env.NOCTUA_DATA_DIR=path.resolve(`.tmp/master-${kind}`);process.env.BETTER_AUTH_SECRET='synthetic-master-migration-secret-0123456789';process.env.BETTER_AUTH_URL='http://localhost:3799';process.env.PASSKEY_RP_ID='localhost';process.env.BETTER_AUTH_TELEMETRY='0';
rmSync(process.env.NOCTUA_DATA_DIR,{recursive:true,force:true});
if(kind==='older'){mkdirSync(path.join(process.env.NOCTUA_DATA_DIR,'db'),{recursive:true});const db=new Database(path.join(process.env.NOCTUA_DATA_DIR,'db/main.db'));db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,role TEXT NOT NULL,createdAt INTEGER NOT NULL);INSERT INTO users VALUES('synthetic-user','migration@example.test','user',1)`);db.close();}
const {getAuth}=await import('../lib/betterAuth');const {getDb,closeAllDbConnections}=await import('../lib/db/connection');const {installAuthControlPlane}=await import('../lib/db/authPolicy');const {initMasterSchema}=await import('../lib/db/schema');
await getAuth();let db=await getDb();
if(kind==='older')db.exec("UPDATE auth_login_epoch SET generation=7 WHERE id=1;DROP INDEX idx_user_provisioning_user_state;DELETE FROM noctua_auth_migrations WHERE id='user-provisioning-user-state-index-v1';ALTER TABLE users DROP COLUMN uiLocale;");
const epoch=db.query('SELECT * FROM auth_login_epoch').all();
for(let i=0;i<2;i++){closeAllDbConnections();db=await getDb();initMasterSchema(db);installAuthControlPlane(db);}
const locale=db.query('PRAGMA table_info(users)').all().find((r:any)=>r.name==='uiLocale');assert.equal(locale.notnull,0);assert.throws(()=>db.exec("INSERT INTO users(id,email,role,createdAt,uiLocale) VALUES('bad','bad@example.test','user',1,'fr')"),/CHECK/);
assert.deepEqual(db.query('PRAGMA index_info(idx_user_provisioning_user_state)').all().map((r:any)=>r.name),['userId','state']);assert.equal(db.query("SELECT COUNT(*) n FROM noctua_auth_migrations WHERE id='user-provisioning-user-state-index-v1'").get().n,1);assert.deepEqual(db.query('SELECT * FROM auth_login_epoch').all(),epoch);
if(kind==='older')assert.deepEqual(db.query("SELECT id,email,role,createdAt,uiLocale FROM users WHERE id='synthetic-user'").get(),{id:'synthetic-user',email:'migration@example.test',role:'user',createdAt:1,uiLocale:null});
console.log(`MASTER ${kind} PASS: nullable locale + CHECK; provisioning covering index and one receipt; two actual reopens; synthetic profile and auth epoch preserved`);closeAllDbConnections();
