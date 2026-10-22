const fs=require('fs'),z=require('zlib'),vm=require('vm'),path=require('path');
const req=require('module').createRequire(process.cwd()+'/package.json'),acorn=req('acorn'),ts=req('typescript');
const x=JSON.parse(fs.readFileSync('/tmp/perf-backlog/measurements.json'));
function walk(n,cb){if(!n||typeof n!=='object')return;if(n.type)cb(n);for(const [k,v] of Object.entries(n)){if(k==='loc'||k==='range')continue;if(Array.isArray(v))v.forEach(a=>walk(a,cb));else if(v&&typeof v==='object')walk(v,cb)}}
const size=s=>({raw:Buffer.byteLength(s),gzip:z.gzipSync(s,{level:6}).length});
const output={routes:[],fingerprints:[],functions:[]};
for(const r of x.routes){const suffix=r.route==='/'?'':r.route.slice(1)+'/';const filename='.next/server/app/'+suffix+'page_client-reference-manifest.js';const ctx={};vm.runInNewContext(fs.readFileSync(filename,'utf8'),ctx);const m=Object.values(ctx.__RSC_MANIFEST)[0];const css=[...new Set(Object.values(m.entryCSSFiles).flat().map(f=>typeof f==='string'?f:f.path))];const sizes=css.map(f=>{const b=fs.readFileSync('.next/'+f);return {path:f,...size(b)}});output.routes.push({route:r.route,count:r.firstLoadChunkPaths.length,raw:r.raw,gzip:r.gzip,css:sizes,cssRaw:sizes.reduce((s,x)=>s+x.raw,0),cssGzip:sizes.reduce((s,x)=>s+x.gzip,0)})}
// Module IDs are verified through retained source literals, same method as prior brief.
for(const ids of [[98189],[713059],[175765],[356729,934838,918789],[715530],[130562,241631,789213,161505,282643,207026]]){
 const found=x.chunks.flatMap(c=>c.modules.filter(m=>ids.some(id=>m.ids.includes(id))).map(m=>({file:c.file,ids:m.ids,raw:m.raw,gzip:m.gzip,routes:c.routes})));
 output.fingerprints.push({ids,found});
}
// Exact minified function containing each unique UI marker; these are code contributions, not removal deltas.
const markers=['Account settings','Change user role','Reset MFA','Internal notes and activity','Revoke sessions','Security settings'];
const main=x.routes.find(r=>r.route==='/').firstLoadChunkPaths;
for(const f of main){const src=fs.readFileSync(f,'utf8'),ast=acorn.parse(src,{ecmaVersion:'latest'});let functions=[];walk(ast,n=>{if(/Function/.test(n.type))functions.push(n)});
 for(const marker of markers){const candidates=functions.filter(n=>{let hit=false;walk(n,a=>{if(a.type==='Literal'&&a.value===marker)hit=true});return hit}).sort((a,b)=>(a.end-a.start)-(b.end-b.start));if(candidates[0]){const n=candidates[0];output.functions.push({marker,file:f,name:n.id?.name||'anonymous',start:n.start,end:n.end,...size(src.slice(n.start,n.end))})}}
}
// Settings contribution estimates: minify each own module with imports external, gzip together.
(async()=>{const files=['app/components/AccountSettingsModal.tsx',...fs.readdirSync('app/components/account-settings/tabs').filter(f=>f.endsWith('.tsx')&&!f.includes('.test.')).map(f=>'app/components/account-settings/tabs/'+f)];const parts=[];for(const f of files){const result=await Bun.build({entrypoints:[f],target:'browser',minify:true,external:['*'],write:false});if(!result.success)throw Error(result.logs);const src=await result.outputs[0].text();parts.push(src)}output.settingsExternalizedEstimate={files,...size(parts.join('\n'))};fs.writeFileSync('/tmp/perf-backlog/bundle-detail.json',JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2))})();
