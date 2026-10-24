import path from 'node:path';
import assert from 'node:assert/strict';
import { writeFileSync, rmSync } from 'node:fs';
process.env.NOCTUA_DATA_DIR=path.resolve('.tmp/shutdown-watcher-data');
rmSync(process.env.NOCTUA_DATA_DIR,{recursive:true,force:true});
process.env.BETTER_AUTH_SECRET='synthetic-shutdown-watcher-secret-0123456789';
process.env.BETTER_AUTH_URL='http://127.0.0.1:3798';process.env.PASSKEY_RP_ID='127.0.0.1';
process.env.IMAP_SECRET_KEY=Buffer.alloc(32,5).toString('base64');process.env.IMAP_CREDENTIALS_STORAGE='db';process.env.BETTER_AUTH_TELEMETRY='0';process.env.NOCTUA_DESKTOP_MODE='false';
const { startImapServer }=await import('../scripts/dev-fixture/imap-server');
const fixture=await startImapServer({host:'127.0.0.1',port:0,controlPort:0,user:'demo@monkeydent.test',pass:'demo',seed:'monkeydent'});
const { Database }=await import('bun:sqlite');
// Let the seed process exit and release its auth lifetime lock before launching the server.
const seed=Bun.spawnSync([process.execPath,'.tmp/watcher-seed.ts',String(fixture.port)],{env:process.env,stdout:'pipe',stderr:'pipe'});
assert.equal(seed.exitCode,0,seed.stdout.toString()+seed.stderr.toString());
const child=Bun.spawn([process.execPath,'--bun',path.resolve('.next/standalone/server.js')],{env:{...process.env,PORT:'3798',HOSTNAME:'127.0.0.1',NOCTUA_MAILBOX_WATCHER:'1'},stdout:'pipe',stderr:'pipe'});
let output='';const drain=async(s:ReadableStream<Uint8Array>)=>{for await(const chunk of s)output+=Buffer.from(chunk).toString();};const drains=Promise.all([drain(child.stdout),drain(child.stderr)]);
try {
 const deadline=Date.now()+30000;let idling=false;
 while(Date.now()<deadline&&child.exitCode===null){
  if(output.includes('Ready on')){try{const db=new Database(path.join(process.env.NOCTUA_DATA_DIR!,'db/accounts/synthetic-shutdown.db'),{readonly:true});try{idling=db.query("SELECT watcherState FROM mailbox_summary WHERE accountId='synthetic-shutdown'").get()?.watcherState==='idling';}finally{db.close();}}catch{}}
  if(idling)break;await Bun.sleep(50);
 }
 assert(idling,'Owned standalone watcher did not reach idling: '+output);
 const start=performance.now();child.kill('SIGTERM');let forced=false;const timer=setTimeout(()=>{forced=true;child.kill('SIGKILL');},5000);const exitCode=await child.exited;clearTimeout(timer);const durationMs=Math.round(performance.now()-start);await drains;
 const result={pid:child.pid,port:3798,exitCode,signal:child.signalCode,durationMs,forced,watcherStateBeforeSignal:'idling'};console.log(JSON.stringify(result));writeFileSync('.tmp/shutdown-watcher-result.json',JSON.stringify(result));assert.equal(exitCode,0);assert(!forced);console.log('WATCHER SHUTDOWN PASS: isolated synthetic mailbox and OS-assigned IMAP fixture');
} finally {if(child.exitCode===null){child.kill('SIGKILL');await child.exited;}await drains;writeFileSync('.tmp/shutdown-watcher-server.log',output);await fixture.stop();}
