process.env.NOCTUA_DATA_DIR='/tmp/perf-backlog/cold-data';
const start=performance.now();await import('/home/monkey/code/noctua-mail/wt-perf-backlog/lib/syncOperation.ts');console.log(JSON.stringify({importMs:performance.now()-start}));
