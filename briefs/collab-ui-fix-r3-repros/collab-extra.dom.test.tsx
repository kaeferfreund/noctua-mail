import {afterEach, expect, it} from 'bun:test';
import {act, cleanup, renderHook, waitFor} from '@testing-library/react';
import {useThreadCollab} from '@/app/hooks/useThreadCollab';
import {useDetachedSendWarnings} from '@/app/components/mailclient/composition/useDetachedSendWarnings';
import {notifyDetachedComposeOutcome} from '@/lib/ui/detachedComposeHandoff';
const state = {accountId:'a',threadId:'one',status:'open',assigneeUserId:null,assignedByUserId:null,assignedAt:null,statusChangedAt:null,statusChangedByUserId:null,commentCount:0,lastActivityAt:1,updatedAt:1,updatedByUserId:null};
const members = [{userId:'alex',name:'Alex Example',email:'alex@example.test',role:'editor',isOwner:false}];
const json = (data:unknown,status=200) => new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
afterEach(() => {cleanup();window.localStorage.clear()});
it('C6: an obsolete denied GET must not override a newer successful mailbox read',async()=>{
 let oldDenied!: (response:Response)=>void;
 const apiFetch = (async(url:RequestInfo|URL)=>{
  if(String(url).endsWith('/me'))return json({user:{id:'alex'}});
  if(String(url).endsWith('/members'))return json({members});
  if(String(url).includes('/one/'))return new Promise<Response>(resolve=>{oldDenied=resolve});
  return json({ok:true,state:{...state,threadId:'two'},members,comments:[],activity:[]});
 }) as typeof fetch;
 const hook=renderHook(({thread})=>useThreadCollab('a',thread,{apiFetch}),{initialProps:{thread:'one'}});
 await waitFor(()=>expect(oldDenied).toBeDefined());
 // An earlier read was denied before membership was restored; the next read succeeds.
 hook.rerender({thread:'two'});
 await waitFor(()=>expect(hook.result.current.state?.threadId).toBe('two'));
 await act(async()=>{oldDenied(json({message:'Mailbox access was revoked'},403));});
 console.log('C6 observed',{readDenied:hook.result.current.readDenied,state:hook.result.current.state});
 expect(hook.result.current.readDenied).toBe(false);
 expect(hook.result.current.state?.threadId).toBe('two');
});
it('C4: a fresh login with no access to A must not see A warning receipts',()=>{
 notifyDetachedComposeOutcome('handoff-a',{version:1,status:'ready',ownerUserId:'previous-synthetic-user',accountId:'private-mailbox-a',mode:'new',draftId:'draft-a',sourceMessageId:null,createdAtMs:Date.now(),updatedAtMs:Date.now()},'sent',null,['Synthetic SMTP warning for the previous user.']);
 expect(window.localStorage.length).toBe(2);
 const hook=renderHook(()=>useDetachedSendWarnings([{id:'b',name:'Other user mailbox'}], 'current-synthetic-user'));
 console.log('C4 observed',hook.result.current.notices);
 expect(hook.result.current.notices).toEqual([]);
});
