// Reviewer probes for 164a57e. FINDING tests assert the observed defect; passing is not a clean audit.
// Run only through run.sh; synthetic storage, read-only source and no external network.
import { beforeAll, expect, test } from "bun:test";
import { createAuthenticatedTestSession } from "../lib/testAuthHarness";
import { createCollabFixture } from "../lib/testThreadCollabHarness";
import { getDb, getAccountDb } from "../lib/db/connection";
import { requireActiveUserSession } from "../lib/auth";
import { mintMcpToken, validateMcpToken } from "../lib/mcpAuth";
import { executeMcpHttpRequest } from "../lib/mcpServer";
import * as collab from "../lib/threadCollab";
import * as store from "../lib/db/threadCollab";
import { buildImapMessageRowId } from "../lib/messageIds";
import { GET as getCollab, PATCH as patchCollab } from "../app/api/accounts/[accountId]/threads/[threadId]/collab/route";
import { POST as postComment } from "../app/api/accounts/[accountId]/threads/[threadId]/comments/route";
import { DELETE as deleteComment } from "../app/api/accounts/[accountId]/threads/[threadId]/comments/[commentId]/route";
import { GET as getActivity } from "../app/api/accounts/[accountId]/threads/[threadId]/activity/route";
import { GET as getSummary } from "../app/api/accounts/summary/route";
import { POST as copyMessages } from "../app/api/accounts/[accountId]/messages/copy-to-account/route";
import { GET as getAttachment } from "../app/api/accounts/[accountId]/messages/[messageId]/attachments/[attachmentId]/route";
import { GET as getHtml } from "../app/api/accounts/[accountId]/messages/[messageId]/html/route";
import { POST as newCandidates } from "../app/api/accounts/[accountId]/sync/new-candidates/route";
import { GET as getStream } from "../app/api/accounts/[accountId]/imap/stream/route";
import { POST as logout } from "../app/api/auth/logout/route";
import { requireJsonSameOrigin } from "../app/api/_helpers/requestOrigin";
import { getAttachmentMeta } from "../lib/db/messages/retrieval";
import { removeMessageAttachment } from "../lib/db/messages/attachments";
import { getMailboxSummaries } from "../lib/db/mailboxSummary";
import { listMessages, listThreads, listThreadMessages } from "../lib/db/messages/query";
import { encodeSecret, decodeSecret } from "../lib/secret";
import { readAuthEnv } from "../lib/betterAuth";
import { getAttachmentMessageDir, getDataDir } from "../lib/runtimePaths";
import { saveMessageSource, getMessageSource, saveAttachmentData, getAttachmentData } from "../lib/storage";
import { readFileSync } from "node:fs";
let user: Awaited<ReturnType<typeof createAuthenticatedTestSession>>;
beforeAll(async()=>{user=await createAuthenticatedTestSession();});
const origin="http://localhost:3000";
const thread="<synthetic-audit@example.test>";
function req(method="GET", body?:unknown, headers: Record<string,string>={}, cookie=user.jar) {
 return new Request(origin+"/api/audit",{method,headers:cookie.headers({origin,"content-type":"application/json",...headers}),...(body===undefined?{}:{body:JSON.stringify(body)})});
}
function route(accountId:string, extra:Record<string,string>={}) { return {params:Promise.resolve({accountId,threadId:encodeURIComponent(thread),...extra})}; }
async function pair(){
 const a=await createCollabFixture(), b=await createCollabFixture();
 const master=await getDb();
 const shard=(master.prepare("SELECT dbPath FROM accounts WHERE id=?").get(a.accountId) as any).dbPath;
 master.prepare("UPDATE accounts SET dbPath=? WHERE id=?").run(shard,b.accountId);
 expect(await getAccountDb(b.accountId)).toBe(a.db);
 await b.api.saveFoldersForAccount(b.accountId,[{id:b.folderId,accountId:b.accountId,name:"INBOX",specialUse:"\\Inbox",count:0}]);
 return {a,b,db:a.db,master};
}
async function member(f:Awaited<ReturnType<typeof createCollabFixture>>,role="editor",u=user){ await u.addMembership(u.user.id,f.accountId,role); }
const actor=()=>({userId:user.user.id,clientId:"web:audit"});

for(const role of ["viewer","editor","manager"] as const) test(`A1 ${role} collaboration HTTP role matrix`,async()=>{
 const f=await createCollabFixture(); await member(f,role); await f.seed(f.message(thread));
 expect((await getCollab(req(),route(f.accountId))).status).toBe(200);
 expect((await getActivity(req(),route(f.accountId))).status).toBe(200);
 expect((await patchCollab(req("PATCH",{status:"waiting"}),route(f.accountId))).status).toBe(role==="viewer"?403:200);
 const added=await postComment(req("POST",{body:"Synthetic audit note"}),route(f.accountId));
 expect(added.status).toBe(role==="viewer"?403:201);
 const id=role==="viewer"?"absent":(await added.json()).comment.id;
 expect((await deleteComment(req("DELETE"),route(f.accountId,{commentId:id}))).status).toBe(role==="viewer"?403:200);
});

test("A2 admin without membership cannot read collab, watcher stream, summary or candidates",async()=>{
 const f=await createCollabFixture();const admin=await createAuthenticatedTestSession(undefined,"admin");
 const r=()=>req("GET",undefined,{},admin.jar);
 expect((await getCollab(r(),route(f.accountId))).status).toBe(403);
 expect((await getActivity(r(),route(f.accountId))).status).toBe(403);
 expect((await getStream(r(),route(f.accountId))).status).toBe(403);
 expect((await newCandidates(req("POST",{}, {},admin.jar),route(f.accountId))).status).toBe(403);
 admin.master.prepare("UPDATE auth_session SET activeAccountId=? WHERE id=?").run(f.accountId,admin.session.id);
 expect((await (await getSummary(r())).json()).accounts).toEqual([]);
});

test("A3 banned live cookie is rejected on collab, watcher summary, SSE and candidates",async()=>{
 const f=await createCollabFixture();const banned=await createAuthenticatedTestSession(f.accountId);
 banned.master.prepare("UPDATE auth_user SET banned=1 WHERE id=?").run(banned.user.id);
 for(const call of [()=>getCollab(req("GET",undefined,{},banned.jar),route(f.accountId)),()=>getActivity(req("GET",undefined,{},banned.jar),route(f.accountId)),()=>getSummary(req("GET",undefined,{},banned.jar)),()=>getStream(req("GET",undefined,{},banned.jar),route(f.accountId)),()=>newCandidates(req("POST",{}, {},banned.jar),route(f.accountId))]) expect((await call()).status).toBe(401);
});

test("A4 MCP collab tools recheck viewer downgrade and ban; cookie never substitutes bearer",async()=>{
 const f=await createCollabFixture(); const u=await createAuthenticatedTestSession(f.accountId);await f.seed(f.message(thread));
 const s=await requireActiveUserSession(req("GET",undefined,{},u.jar));if(s instanceof Response)throw Error("fixture");
 const {token,tokenRecord}=await mintMcpToken(s,f.accountId,"audit",3600);
 const call=async(name:string,args:Record<string,unknown>)=>{
 const r=await executeMcpHttpRequest({body:{jsonrpc:"2.0",id:1,method:"tools/call",params:{name,arguments:args}},accountId:f.accountId,account:f.account,tokenRecord,authInfo:{token,clientId:"audit",scopes:[],extra:{userId:u.user.id}}}); return (r.responses[0] as any).result;};
 expect((await call("set_thread_status",{threadId:thread,status:"waiting"})).isError).not.toBe(true);
 await f.api.setUserAccountRole(u.user.id,f.accountId,"viewer",null);
 for(const [name,args] of [["set_thread_status",{threadId:thread,status:"closed"}],["add_internal_comment",{threadId:thread,body:"denied"}],["assign_thread",{threadId:thread,assigneeUserId:"me"}]] as const) expect((await call(name,args)).isError).toBe(true);
 expect(await validateMcpToken(token)).not.toBeNull();
 expect((await call("get_thread_collaboration",{threadId:thread,accountId:"other"})).isError).toBe(true);
 u.master.prepare("UPDATE auth_user SET banned=1 WHERE id=?").run(u.user.id);
 expect(await validateMcpToken(token)).toBeNull();
 expect((await call("get_thread_collaboration",{threadId:thread})).isError).toBe(true);
 const {POST}=await import("../app/api/mcp/route"); expect((await POST(req("POST",{jsonrpc:"2.0",id:1,method:"tools/list"}))).status).toBe(401);
});

test("B1 shared shard collab scalar, batch, comments and activity reads remain account scoped",async()=>{
 const {a,b,db}=await pair();await member(a);await member(b);
 await a.seed(a.message(thread));await b.seed(b.message(thread));
 await collab.updateThreadCollabState(a.accountId,thread,{status:"waiting"},actor());
 const note=await collab.addThreadComment(a.accountId,thread,"A private note",actor());
 expect((await collab.getThreadCollabState(b.accountId,thread)).status).toBe("open");
 expect((await collab.getThreadCollabStates(b.accountId,[thread])).get(thread)?.commentCount).toBe(0);
 expect(await collab.listThreadComments(b.accountId,thread)).toEqual([]);
 expect(await collab.listThreadActivity(b.accountId,thread)).toEqual([]);
 expect(store.getThreadComment(db,b.accountId,thread,note!.comment.id)).toBeNull();
 await collab.deleteThreadComment(b.accountId,thread,note!.comment.id,actor());
 expect((await collab.listThreadComments(a.accountId,thread))).toHaveLength(1);
 await expect(collab.editThreadComment(b.accountId,thread,note!.comment.id,"bad",actor())).rejects.toThrow("Comment not found");
});

test("B2 shared shard remap, assignment cleanup and reply attribution do not touch other account",async()=>{
 const {a,b,db}=await pair();await member(a);await member(b);
 const [am]=await a.seed(a.message(thread));await b.seed(b.message(thread));
 await collab.updateThreadCollabState(a.accountId,thread,{status:"waiting",assigneeUserId:user.user.id},actor());
 await collab.updateThreadCollabState(b.accountId,thread,{status:"closed",assigneeUserId:user.user.id},actor());
 await collab.addThreadComment(a.accountId,thread,"A note",actor());await collab.addThreadComment(b.accountId,thread,"B note",actor());
 db.prepare("UPDATE messages SET threadId=? WHERE accountId=? AND id=?").run("new",a.accountId,am.id);
 db.transaction(()=>store.remapThreadCollab(db,a.accountId,[{oldThreadId:thread,newThreadId:"new",id:am.id,messageId:thread,dateValue:1}])).immediate();
 expect(store.getThreadCollabState(db,b.accountId,thread).status).toBe("closed");expect(store.listThreadComments(db,b.accountId,thread)[0].body).toBe("B note");
 expect(store.listThreadComments(db,a.accountId,"new")[0].body).toBe("A note");
 await collab.unassignUserInAccount(a.accountId,user.user.id,actor());
 expect(store.getThreadCollabState(db,b.accountId,thread).assigneeUserId).toBe(user.user.id);
 await collab.recordReplySent(a.accountId,{messageId:"<sent@example.test>",inReplyTo:thread},actor());
 expect(store.listThreadActivity(db,b.accountId,thread).some(x=>x.type==="reply_sent")).toBe(false);
});

test("B3 shared shard FTS, thread-member lookup and watcher counts exclude other account",async()=>{
 const {a,b}=await pair();await a.seed(a.message(thread,{body:"syntheticprivatewordA",unread:true}));await b.seed(b.message(thread,{body:"syntheticprivatewordB",unread:false}));
 expect((await listMessages({page:1,pageSize:30,accountId:a.accountId,query:"syntheticprivatewordB"})).items).toEqual([]);
 expect((await listMessages({page:1,pageSize:30,accountId:b.accountId,query:"syntheticprivatewordA"})).items).toEqual([]);
 const rows=(await listThreadMessages({accountId:a.accountId,threadIds:[thread]})).items;
 expect(rows).toHaveLength(1);expect(rows[0].accountId).toBe(a.accountId);
 const sums=await getMailboxSummaries([a.accountId,b.accountId]);expect(sums.map(x=>x.unreadInbox)).toEqual([1,0]);
});

test("FINDING S1 shared shard same RFC Message-ID sync overwrites another account message and FTS",async()=>{
 const {a,b}=await pair();const id=buildImapMessageRowId("<collision@example.test>");
 await a.seed(a.message(thread,{id,messageId:"<collision@example.test>",body:"synthetictargetprivate",subject:"A private"}));
 expect(await a.api.getMessageById(a.accountId,id)).not.toBeNull();
 await b.seed(b.message(thread,{id,messageId:"<collision@example.test>",body:"syntheticattacker",subject:"B replacement"}));
 expect(await a.api.getMessageById(a.accountId,id)).toBeNull();
 expect((await b.api.getMessageById(b.accountId,id))?.subject).toBe("B replacement");
 expect((await listMessages({page:1,pageSize:30,accountId:a.accountId,query:"synthetictargetprivate"})).items).toEqual([]);
});

test("FINDING S1 shared shard distinct messages with common thread evict other account thread index",async()=>{
 const {a,b,db}=await pair();await a.seed(a.message(thread));
 expect(db.prepare("SELECT 1 FROM threads WHERE accountId=? AND threadId=?").get(a.accountId,thread)).not.toBeNull();
 await b.seed(b.message(thread));
 expect(await a.api.getMessageById(a.accountId,(await listThreadMessages({accountId:a.accountId,threadIds:[thread]})).items[0].id)).not.toBeNull();
 expect(db.prepare("SELECT 1 FROM threads WHERE accountId=? AND threadId=?").get(a.accountId,thread)).toBeNull();
 expect((await listThreads({page:1,pageSize:30,accountId:a.accountId})).items).toEqual([]);
});

test("FINDING S2 attachment preview discloses another mailbox filename in shared shard",async()=>{
 const {a,b}=await pair();await member(a,"viewer");
 const bid="synthetic-b-message",aid="synthetic-b-attachment";
 await b.seed(b.message(thread,{id:bid,attachments:[{id:aid,filename:"private-project-B.pdf",contentType:"application/pdf",size:1,inline:false}]}));
 expect(await a.api.getMessageById(a.accountId,bid)).toBeNull();
 expect((await getAttachmentMeta(a.accountId,bid,aid)).filename).toBe("private-project-B.pdf");
 const r=await getAttachment(new Request(origin+"/api/attachment?preview=1",{headers:user.jar.headers()}),route(a.accountId,{messageId:bid,attachmentId:aid}));
 expect(r.status).toBe(200);expect(await r.text()).toContain("private-project-B.pdf");
 // Data files themselves remain account-separated; do not claim full-byte disclosure.
 expect(await getAttachmentData(a.accountId,bid,aid)).toBeNull();
});

test("B4 copy-to-account requires editor role on both source and destination",async()=>{
 const {a,b}=await pair();const u=await createAuthenticatedTestSession();
 await member(a,"editor",u);await member(b,"viewer",u);
 const payload={messageIds:["synthetic"],destinationAccountId:b.accountId,destinationFolderId:b.folderId};
 expect((await copyMessages(req("POST",payload,{},u.jar),route(a.accountId))).status).toBe(403);
 await a.api.setUserAccountRole(u.user.id,a.accountId,"viewer",null);await a.api.setUserAccountRole(u.user.id,b.accountId,"editor",null);
 expect((await copyMessages(req("POST",payload,{},u.jar),route(a.accountId))).status).toBe(403);
});

for(const headers of [{origin:"https://evil.example.test"},{origin:"null"},{origin,"sec-fetch-site":"cross-site"},{origin:"https://evil.example.test","x-forwarded-host":"localhost:3000","x-forwarded-proto":"http"}])test(`D1 canonical origin rejects ${JSON.stringify(headers)}`,async()=>{
 expect(requireJsonSameOrigin(req("POST",{},headers))).toHaveProperty("status",403);
});

test("D2 collab writes reject origin and JSON violations; bodyless logout rejects bodies",async()=>{
 const f=await createCollabFixture();await member(f);await f.seed(f.message(thread));
 expect((await patchCollab(req("PATCH",{status:"closed"},{origin:"https://evil.example.test"}),route(f.accountId))).status).toBe(403);
 expect((await postComment(req("POST",{body:"bad"},{"content-type":"text/plain"}),route(f.accountId))).status).toBe(400);
 expect((await deleteComment(req("DELETE",undefined,{origin:"null"}),route(f.accountId,{commentId:"absent"}))).status).toBe(403);
 expect((await logout(req("POST",{}))).status).toBe(400);
 expect((await logout(req("POST",undefined,{origin:"https://evil.example.test"}))).status).toBe(403);
});

test("E1 ciphertext authentication, randomized IV and account DTO redaction",async()=>{
 const f=await createCollabFixture();await member(f);const secret="synthetic-at-rest-secret";
 const x=encodeSecret(secret),y=encodeSecret(secret);expect(x).not.toContain(secret);expect(x).not.toBe(y);expect(decodeSecret(x)).toBe(secret);
 const bytes=Buffer.from(x.slice(4),"base64");bytes[bytes.length-1]^=1;expect(()=>decodeSecret("enc:"+bytes.toString("base64"))).toThrow();
 const row=(await getDb()).prepare("SELECT imapPassword FROM accounts WHERE id=?").get(f.accountId) as any;
 expect(row.imapPassword).toStartWith("enc:");expect(row.imapPassword).not.toBe("synthetic");
 const {GET}=await import("../app/api/accounts/route");const body=JSON.stringify(await (await GET(req())).json());
 expect(body).not.toContain("enc:");
 const payload=JSON.parse(body);expect(Array.isArray(payload)).toBe(true);for(const account of payload){expect(account.imap.password).toBe("");expect(account.smtp.password).toBe("");}
});

test("E2 unsafe environment modes and noncanonical origins fail closed",()=>{
 const env={BETTER_AUTH_SECRET:"synthetic-012345678901234567890123456789",BETTER_AUTH_URL:"https://mail.example.test",IMAP_CREDENTIALS_STORAGE:"db"};
 for(const change of [{IMAP_CREDENTIALS_STORAGE:"cookie"},{NOCTUA_DESKTOP_MODE:"true"},{BETTER_AUTH_URL:"http://mail.example.test"},{PASSKEY_RP_ID:"other.example.test"},{NOCTUA_TRUSTED_ORIGINS:"https://*.example.test"},{BETTER_AUTH_TELEMETRY:"1"}]) expect(()=>readAuthEnv({...env,...change})).toThrow();
});

test("FINDING S3 HTML display retains remote pixels, CSS import and meta navigation without response CSP",async()=>{
 const f=await createCollabFixture();await member(f,"viewer");
 const html='<html><head><meta http-equiv="refresh" content="0;url=https://tracker.example.test/phish"><style>@import url("https://tracker.example.test/style");</style></head><body><img src="https://tracker.example.test/pixel?message=synthetic" onerror="alert(1)"><script>alert(1)</script><form action="https://tracker.example.test/"></form></body></html>';
 const [m]=await f.seed(f.message(thread,{htmlBody:html}));
 const response=await getHtml(req(),route(f.accountId,{messageId:m.id}));const body=await response.text();
 expect(body).toContain("https://tracker.example.test/pixel");expect(body).toContain("@import");expect(body).toContain('http-equiv="refresh"');
 expect(body).not.toContain("<script");expect(body).not.toContain("onerror");expect(body).not.toContain("<form");
 expect(response.headers.get("content-security-policy")).toBeNull();
 const component=readFileSync("app/components/HtmlMessage.tsx","utf8");expect(component.slice(component.lastIndexOf("<iframe"))).not.toContain("sandbox=");
});

test("H1 encoded filenames cannot traverse source/attachment account paths",async()=>{
 const f=await createCollabFixture();const msg="../../other/account",att="../../payload";
 expect(getAttachmentMessageDir(f.accountId,msg).startsWith(getDataDir()+"/attachments/"+encodeURIComponent(f.accountId)+"/")).toBe(true);
 await saveMessageSource(f.accountId,msg,"synthetic source");expect(await getMessageSource(f.accountId,msg)).toBe("synthetic source");
 await saveAttachmentData(f.accountId,msg,att,Buffer.from("synthetic attachment"));expect((await getAttachmentData(f.accountId,msg,att))?.toString()).toBe("synthetic attachment");
});

test("C1 hostile header text remains bound data and cannot change shard schema or collab account",async()=>{
 const f=await createCollabFixture();await member(f);
 const header="Synthetic'); DROP TABLE thread_comments;--\r\nevent: injected";
 const [m]=await f.seed(f.message(thread,{id:buildImapMessageRowId(header),subject:header,from:header}));
 expect((await f.api.getMessageById(f.accountId,m.id))?.subject).toBe(header);
 const note=await collab.addThreadComment(f.accountId,thread,"Synthetic after hostile header",actor());
 expect(note?.comment.accountId).toBe(f.accountId);
 expect(f.db.prepare("SELECT name FROM sqlite_master WHERE name='thread_comments'").get()).not.toBeNull();
});
