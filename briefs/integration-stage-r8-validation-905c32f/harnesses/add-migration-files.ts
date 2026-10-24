import {Database} from 'bun:sqlite';import {mkdirSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const db=new Database('.tmp/migration/round7-original.db');db.function('noctua_writer_v2',()=>2);
const fileHashes=[];
for(const account of ['synthetic-a','synthetic-b']){
 const source=`From: Synthetic Sender <sender@example.test>\r\nTo: team@example.test\r\nMessage-ID: <shared-0@example.test>\r\nSubject: Synthetic needle\r\n\r\nSynthetic migration source for ${account}.\r\n`;
 const digest=createHash('sha256').update(source).digest('hex');db.query("UPDATE messages SET hasSource=1,sourceSha256=? WHERE accountId=? AND id='shared-0'").run(digest,account);
 const files=[[`sources/${account}/shared-0.eml`,source],[`attachments/${account}/shared-0/same-attachment.bin`,'x']];
 for(const [relative,bytes]of files){for(const root of ['.tmp/migration/retained-original',path.resolve('.tmp/gate-data')]){const file=path.join(root,relative);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,bytes);}fileHashes.push({relative,sha256:createHash('sha256').update(bytes).digest('hex')});}
}
db.exec('UPDATE messages SET dateValue=rowid');db.close();
const legacy=new Database('.tmp/migration/legacy-original.db');legacy.exec('UPDATE messages SET dateValue=rowid');legacy.close();for(const kind of ['round7','legacy'])for(const suffix of ['','-wal','-shm'])rmSync(`.tmp/migration/${kind}-copy.db${suffix}`,{force:true});copyFileSync('.tmp/migration/legacy-original.db','.tmp/migration/legacy-copy.db');
copyFileSync('.tmp/migration/round7-original.db','.tmp/migration/round7-copy.db');writeFileSync('.tmp/migration/retained-files.json',JSON.stringify(fileHashes));console.log('Synthetic retained source/attachment originals and copies prepared; exact SHA-256 values stored privately');
