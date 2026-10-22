import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createAuthenticatedTestSession} from '/home/monkey/code/noctua-mail/wt-review-auth/lib/testAuthHarness';
import {requireActiveUserSession} from '/home/monkey/code/noctua-mail/wt-review-auth/lib/auth';
import {assertStreamAuthorized} from '/home/monkey/code/noctua-mail/wt-review-auth/lib/authStreams';
test('regression: generation commit between stream check and enqueue prevents delivery',async()=>{
 const f=await createAuthenticatedTestSession();
 const source=await requireActiveUserSession(new Request('http://localhost:3000',{headers:f.jar.headers()}));
 if(source instanceof Response)throw new Error('Missing fixture');
 const identity={...source};let delivered=0;
 // Execute the actual route send closure; real checker and DB, a counting stream sink.
 const route=readFileSync('/home/monkey/code/noctua-mail/wt-review-auth/app/api/accounts/[accountId]/imap/stream/route.ts','utf8');
 const begin=route.indexOf('        const send = async');
 const end=route.indexOf('\n\n        type Session',begin);
 if(begin<0||end<0)throw new Error('Route closure not found');
 const wrapper='function reviewSendFactory(assertStreamAuthorized,identity,stopped,controller,encoder,getImapHttpError,mailboxFailure,accountId,accountContext,authStream){'+route.slice(begin,end)+';return send;}';
 const compiled=new Bun.Transpiler({loader:'ts'}).transformSync(wrapper);
 const createSend=new Function(compiled+'\nreturn reviewSendFactory;')();
 const send=createSend(assertStreamAuthorized,identity,false,{enqueue:()=>{delivered++;}},new TextEncoder(),()=>null,()=>null,'synthetic',{role:'viewer'},{close:()=>{}});
 const pending=send('message',{subject:'Synthetic envelope'});
 // The checker completes its synchronous DB snapshot; emit's continuation has not run yet.
 await Promise.resolve();
 f.master.transaction(()=>f.master.prepare('UPDATE auth_security_state SET generation=generation+1 WHERE userId=?').run(f.user.id)).immediate();
 await pending;
 await expect(assertStreamAuthorized(identity)).rejects.toThrow('revoked');
 console.log('sensitive deliveries after generation commit:',delivered);
 expect(delivered).toBe(0);
});
