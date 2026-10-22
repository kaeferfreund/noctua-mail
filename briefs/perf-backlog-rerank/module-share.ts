import {writeFileSync} from 'node:fs';import {gzipSync} from 'node:zlib';
const groups={
 admin:['app/components/admin/AdminPanel.tsx','app/components/admin/AdminMailboxes.tsx','app/components/admin/AdminAuditLog.tsx','app/components/admin/AdminConfirmDialog.tsx'],
 security:['app/components/auth/SecuritySettings.tsx','app/components/auth/ReauthDialog.tsx'],
 collab:['app/components/collab/ThreadActivityPanel.tsx','app/components/collab/InternalNoteComposer.tsx','app/components/collab/ThreadCollaborationBar.tsx','app/components/collab/AssigneeCombobox.tsx','app/components/collab/StatusSelect.tsx','app/components/collab/CollabRowBadges.tsx','app/hooks/useThreadCollab.ts']
};const out:any={};for(const [name,files] of Object.entries(groups)){let parts=[];for(const f of files){const r=await Bun.build({entrypoints:[f],target:'browser',minify:true,external:['*'],write:false});if(!r.success)throw Error(String(r.logs));parts.push(await r.outputs[0].text())}const joined=parts.join('\n');out[name]={files,raw:Buffer.byteLength(joined),gzip:gzipSync(joined,{level:6}).length}}writeFileSync('/tmp/perf-backlog/module-share.json',JSON.stringify(out,null,2));
