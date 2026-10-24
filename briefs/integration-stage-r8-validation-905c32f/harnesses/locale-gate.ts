import assert from 'node:assert/strict';
import { mkdirSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
cpSync('.next/static','.next/standalone/.next/static',{recursive:true});cpSync('public','.next/standalone/public',{recursive:true});
const base='http://127.0.0.1:3799';const env={...process.env,PORT:'3799',HOSTNAME:'127.0.0.1',NOCTUA_DATA_DIR:path.resolve('.tmp/locale-data'),BETTER_AUTH_URL:base,PASSKEY_RP_ID:'127.0.0.1',BETTER_AUTH_SECRET:'synthetic-locale-gate-secret-0123456789abcdef',IMAP_SECRET_KEY:Buffer.alloc(32,9).toString('base64'),NOCTUA_MAILBOX_WATCHER:'',BETTER_AUTH_TELEMETRY:'0'};
rmSync(path.resolve('.tmp/locale-data'),{recursive:true,force:true});
const child=Bun.spawn([process.execPath,'--bun',path.resolve('.next/standalone/server.js')],{env,stdout:'pipe',stderr:'pipe'});
let output='';const drain=async(s:ReadableStream<Uint8Array>)=>{for await(const chunk of s)output+=Buffer.from(chunk).toString();};const drains=Promise.all([drain(child.stdout),drain(child.stderr)]);
try{
 for(let i=0;i<600&&!output.includes('Ready on');i++){if(child.exitCode!==null)throw Error(output);await Bun.sleep(50);}assert(output.includes('Ready on'),output);
 const cases=[['German header','de','', 'de'],['English header','en','', 'en'],['German cookie overrides English','en','de','de'],['English cookie overrides German','de','en','en'],['invalid cookie ignored','en','invalid','en']];
 for(const [label,accept,cookie,expected] of cases){const response=await fetch(base,{headers:{'Accept-Language':accept,...(cookie?{Cookie:`noctua-ui-locale=${cookie}`}:{})}});assert.equal(response.status,200);const text=await response.text();assert(text.includes(`lang="${expected}"`),label);const js=text.match(/src="([^\"]+\.js[^\"]*)"/);assert(js,label);assert.equal((await fetch(base+js[1])).status,200);console.log(`PASS ${label}: lang=${expected}; HTML 200; static JS 200`);}
 console.log('I18N STANDALONE PASS: 5 locale cases; catalogs bundled; .next/static + public copied; port 3799; fresh isolated storage');
} finally{child.kill('SIGTERM');const timer=setTimeout(()=>child.kill('SIGKILL'),5000);await child.exited;clearTimeout(timer);await drains;writeFileSync('.tmp/locale-server.log',output);assert.equal(child.exitCode,0);}
