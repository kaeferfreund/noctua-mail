import fs from 'node:fs';import zlib from 'node:zlib';
const stats=JSON.parse(fs.readFileSync('.next/diagnostics/route-bundle-stats.json')).find(r=>r.route==='/');
const paths=[...new Set(stats.firstLoadChunkPaths)];
const result={sha:process.argv[2],js_assets:paths.length,raw_bytes:0,gzip_bytes:0};
for(const p of paths){const b=fs.readFileSync(p);result.raw_bytes+=b.length;result.gzip_bytes+=zlib.gzipSync(b,{level:6}).length;}
console.log(JSON.stringify(result,null,2));fs.writeFileSync(`.tmp/bundle-${process.argv[3]}.json`,JSON.stringify(result,null,2));
