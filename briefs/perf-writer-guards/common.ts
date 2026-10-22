import {execSync} from 'node:child_process';
export const root='/home/monkey/code/noctua-mail/wt-perf-guards';
export function load(){return execSync('uptime').toString().trim()}
export function guards(db:any,mode:string){
 const triggers=db.query("SELECT name,tbl_name FROM sqlite_master WHERE type='trigger' AND name LIKE 'noctua_writer_v2_%'").all();
 if(triggers.length!==78) throw Error(`expected 78 guards, got ${triggers.length}`);
 if(mode==='current')return;
 if(mode==='native'){db.loadExtension('/tmp/perf-guards/writer.so');return;}
 if(mode.includes('det'))db.function('noctua_writer_v2',{deterministic:true},()=>2);
 const q=(x:string)=>'"'+x.replaceAll('"','""')+'"';
 db.transaction(()=>{for(const t of triggers){db.exec(`DROP TRIGGER ${q(t.name)}`);if(mode==='none')continue;
 const op=t.name.split('_').at(-1).toUpperCase();
 const expr=mode==='builtin'?"length('v2')":"noctua_writer_v2()";
 let body=`BEGIN SELECT CASE WHEN ${expr} IS NOT 2 THEN RAISE(ABORT,'Unsupported account shard writer') END; END`;
 if(mode.startsWith('when'))body=`WHEN ${expr} IS NOT 2 BEGIN SELECT RAISE(ABORT,'Unsupported account shard writer'); END`;
 if(mode==='prepare')body='BEGIN SELECT noctua_writer_v2() WHERE 0; END';
 if(mode==='deadcase')body="BEGIN SELECT CASE WHEN 0 THEN noctua_writer_v2() END; END";
 db.exec(`CREATE TRIGGER ${q(t.name)} BEFORE ${op} ON ${q(t.tbl_name)} ${body}`);
 }}).immediate();
}
export async function measure(db:any,fn:()=>any){let changes=db.query('SELECT total_changes() n').get().n;let cpu=process.cpuUsage();let t=performance.now();let result=await fn();let wall=performance.now()-t;let c=process.cpuUsage(cpu);return {wall,cpu:(c.user+c.system)/1000,changes:db.query('SELECT total_changes() n').get().n-changes,result}}
