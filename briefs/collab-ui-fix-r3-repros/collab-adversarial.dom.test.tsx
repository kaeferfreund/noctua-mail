import { afterEach, expect, it } from 'bun:test';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useThreadCollab } from '@/app/hooks/useThreadCollab';
import { useDetachedSendWarnings } from '@/app/components/mailclient/composition/useDetachedSendWarnings';
import { DETACHED_COMPOSE_EVENT_STORAGE_KEY, notifyDetachedComposeOutcome } from '@/lib/ui/detachedComposeHandoff';
const state = {accountId:'a',threadId:'one',status:'open',assigneeUserId:null,assignedByUserId:null,assignedAt:null,statusChangedAt:null,statusChangedByUserId:null,commentCount:0,lastActivityAt:1,updatedAt:1,updatedByUserId:null};
const members = [{userId:'synthetic-user',name:'Synthetic User',email:'synthetic@example.test',role:'editor',isOwner:false}];
const json = (data:unknown,status=200) => new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const snapshot = (threadId:string) => json({ok:true,state:{...state,threadId},members,comments:[],activity:[]});
function deferred<T>() {let resolve!: (value:T)=>void; const promise = new Promise<T>(r=>{resolve=r}); return {promise,resolve};}
afterEach(() => {cleanup();window.localStorage.clear()});

it('R2-3: a denial after TWO newer successful reads must not erase the latest state or members',async()=>{
 const denied = deferred<Response>(); let reads=0; const denials:string[]=[];
 const apiFetch = (async(url:RequestInfo|URL)=>{
  if(String(url).endsWith('/me'))return json({user:{id:'synthetic-user'}});
  if(String(url).endsWith('/members'))return json({members});
  if(++reads===1)return denied.promise;
  const match=String(url).match(/threads\/([^/]+)/)!;
  return snapshot(match[1]);
 }) as typeof fetch;
 const hook=renderHook(({thread})=>useThreadCollab('a',thread,{apiFetch,sessionKey:'session-1',onReadDenied:a=>denials.push(a)}),{initialProps:{thread:'one'}});
 await waitFor(()=>expect(reads).toBe(1));
 hook.rerender({thread:'two'});
 await waitFor(()=>expect(hook.result.current.state?.threadId).toBe('two'));
 hook.rerender({thread:'three'});
 await waitFor(()=>expect(hook.result.current.state?.threadId).toBe('three'));
 await act(async()=>{denied.resolve(json({message:'Synthetic obsolete denial'},403));});
 expect(hook.result.current.readDenied).toBe(false);
 expect(hook.result.current.state?.threadId).toBe('three');
 expect(hook.result.current.members).toEqual(members);
 expect(denials).toEqual([]);
});

it('R2-3: a latest genuine denial still clears cached state and prevents mutations',async()=>{
 let reads=0,mutations=0;const denials:string[]=[];
 const apiFetch = (async(url:RequestInfo|URL,init?:RequestInit)=>{
  if(String(url).endsWith('/me'))return json({user:{id:'synthetic-user'}});
  if(String(url).endsWith('/members'))return json({members});
  if(init?.method)mutations++;
  return ++reads===1?snapshot('one'):json({message:'Synthetic revoked access'},403);
 }) as typeof fetch;
 const hook=renderHook(()=>useThreadCollab('a','one',{apiFetch,onReadDenied:a=>denials.push(a)}));
 await waitFor(()=>expect(hook.result.current.state?.threadId).toBe('one'));
 await act(async()=>{await hook.result.current.reload().catch(()=>{});});
 expect(hook.result.current.readDenied).toBe(true);
 expect(hook.result.current.state).toBeUndefined();
 expect(hook.result.current.members).toEqual([]);
 expect(denials).toEqual(['a']);
 expect(await hook.result.current.update({status:'done'})).toBe(false);
 expect(mutations).toBe(0);
});

it('R2-4: same owner keeps B receipt while A is revoked, including late A events and access restoration',()=>{
 const handoff={version:1 as const,status:'ready' as const,ownerUserId:'synthetic-user',accountId:'a',mode:'new' as const,draftId:null,sourceMessageId:null,createdAtMs:Date.now(),updatedAtMs:Date.now()};
 notifyDetachedComposeOutcome('synthetic-a',handoff,'sent',null,['Synthetic A guidance']);
 notifyDetachedComposeOutcome('synthetic-b',{...handoff,accountId:'b'},'sent',null,['Synthetic B guidance']);
 const hook=renderHook(({accounts})=>useDetachedSendWarnings(accounts,'synthetic-user'),{initialProps:{accounts:[{id:'a'},{id:'b'}]}});
 expect(hook.result.current.notices).toHaveLength(2);
 hook.rerender({accounts:[{id:'b'}]});
 expect(hook.result.current.notices.map(n=>n.title)).toEqual(['Email sent · b']);
 act(()=>{
  notifyDetachedComposeOutcome('late-synthetic-a',handoff,'sent',null,['Late synthetic A guidance']);
  window.dispatchEvent(new StorageEvent('storage',{key:DETACHED_COMPOSE_EVENT_STORAGE_KEY}));
 });
 expect(hook.result.current.notices.map(n=>n.title)).toEqual(['Email sent · b']);
 act(()=>{hook.result.current.dismiss(hook.result.current.notices[0].id);});
 expect(hook.result.current.notices).toEqual([]);
 hook.rerender({accounts:[{id:'b'},{id:'a'}]});
 expect(hook.result.current.notices).toHaveLength(2);
 expect(hook.result.current.notices.every(n=>n.title==='Email sent · a')).toBe(true);
});

it('R2-new: a later failed refresh cannot supersede an authoritative access denial',async()=>{
 const denied=deferred<Response>(),failed=deferred<Response>();let reads=0;const denials:string[]=[];
 const apiFetch=(async(url:RequestInfo|URL)=>{
  if(String(url).endsWith('/me'))return json({user:{id:'synthetic-user'}});
  if(String(url).endsWith('/members'))return json({members});
  reads++;
  return reads===1?snapshot('one'):reads===2?denied.promise:failed.promise;
 }) as typeof fetch;
 const hook=renderHook(({thread})=>useThreadCollab('a',thread,{apiFetch,onReadDenied:a=>denials.push(a)}),{initialProps:{thread:'one'}});
 await waitFor(()=>expect(hook.result.current.state?.threadId).toBe('one'));
 hook.rerender({thread:'two'});
 await waitFor(()=>expect(reads).toBe(2));
 hook.rerender({thread:'one'});
 await waitFor(()=>expect(reads).toBe(3));
 await act(async()=>{failed.resolve(json({message:'Synthetic transient server failure'},500));});
 await waitFor(()=>expect(hook.result.current.error).toBe('Synthetic transient server failure'));
 await act(async()=>{denied.resolve(json({message:'Synthetic mailbox access revoked'},403));});
 console.log('R2-new observed',{readDenied:hook.result.current.readDenied,state:hook.result.current.state?.threadId,denials});
 expect(hook.result.current.readDenied).toBe(true);
 expect(hook.result.current.state).toBeUndefined();
 expect(hook.result.current.members).toEqual([]);
 expect(denials).toEqual(['a']);
});
