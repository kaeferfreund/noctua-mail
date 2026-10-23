process.env.NOCTUA_DATA_DIR='/tmp/perf-rerank2/cold-data';
const start=performance.now();await import('/home/monkey/code/noctua-mail/wt-perf-rerank2/lib/syncOperation.ts');console.log(JSON.stringify({importMs:performance.now()-start}));
