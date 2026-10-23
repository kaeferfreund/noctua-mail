/** Offline synthetic fixtures for the compiled production HTTP mount. No test routes or flags. */
import {SCENARIOS} from "../tests/browser/auth/scenarios";
import {getAuth} from "../lib/betterAuth";
import {getDb,closeAllDbConnections} from "../lib/db/connection";
import {persistAccountRow} from "../lib/db/rowParsers";
import {insertUserAccountLinkRow} from "../lib/db/users";
import {saveFoldersForAccount} from "../lib/db/folders";
import {upsertMessages} from "../lib/db/messages";
import {createInviteCode} from "../lib/db/inviteCodes";
import {withAuthProof} from "../lib/authPolicyContext";
import {totpFromUri} from "../tests/helpers/totp";
import {writeFileSync} from "node:fs";

if (!process.env.AUTH_BROWSER_DATA_DIR || process.env.NOCTUA_DATA_DIR !== process.env.AUTH_BROWSER_DATA_DIR) throw new Error("Isolated synthetic storage required");
const password="synthetic-browser-password";
const auth=await getAuth();
const {parseSetCookieHeader}=await import("better-auth/cookies");
const seeds:Record<string,unknown>={};
for(const [index,[scenarioId,scenario]] of Object.entries(SCENARIOS).entries()) {
  const email=`browser-${index}@example.test`,role=["management","activatedReset","shellReset"].includes(scenarioId)?"admin":"user";
  const user=await withAuthProof({db:await getDb(),internal:true,creation:{userId:crypto.randomUUID(),email,role},authenticatedAt:Date.now(),method:"migration_fixture",createdSessionIds:[]},()=>auth.api.createUser({body:{email,name:"Synthetic Browser",password,role}}));
  const signed=await auth.api.signInEmail({body:{email:user.user.email,password},returnHeaders:true});
  const cookies=new Map<string,string>();
  const absorb=(headers:Headers)=>parseSetCookieHeader(headers.get("set-cookie")??"").forEach((value,name)=>{if(value.value)cookies.set(name,value.value);});
  absorb(signed.headers);
  const cookieHeaders=()=>new Headers({cookie:[...cookies].map(([name,value])=>`${name}=${value}`).join("; ")});
  const seed=await auth.api.enableTwoFactor({headers:cookieHeaders(),body:{password}});
  if(seed.method!=="totp")throw new Error("TOTP seed missing");
  const verified=await auth.api.verifyTOTP({headers:cookieHeaders(),body:{code:totpFromUri(seed.totpURI)},returnHeaders:true});
  absorb(verified.headers);
  await auth.api.signOut({headers:cookieHeaders()});
  if (scenarioId === "shellMailbox") {
    const db = await getDb();
    for (const id of ["synthetic-mailbox-a", "synthetic-mailbox-b"]) {
      const email = `${id}@example.test`;
      persistAccountRow(db, {id, email, name: id, avatar: "", ownerUserId: user.user.id,
        imap: {host: "imap.example.invalid", port: 993, secure: true, user: email, password: ""},
        smtp: {host: "smtp.example.invalid", port: 465, secure: true, user: email, password: ""}});
      insertUserAccountLinkRow(db, user.user.id, id, "manager");
      if (id === "synthetic-mailbox-b") {
        const folderId = `${id}:INBOX`;
        await saveFoldersForAccount(id, [{id: folderId, accountId: id, name: "INBOX", count: 1, specialUse: "\\Inbox"}]);
        await upsertMessages(id, folderId, [{id: "synthetic-i18n-message", messageId: "<i18n@example.test>", threadId: "<i18n@example.test>",
          accountId: id, folderId, subject: "Synthetic locale thread", from: "Synthetic Sender", fromEmail: "sender@example.test",
          to: email, preview: "Synthetic locale body", body: "Synthetic locale body", date: new Date().toISOString(), dateValue: Date.now(),
          unread: false, seen: true, flags: ["\\Seen"]}]);
      }
    }
  }
  seeds[scenario]={email:user.user.email,password,totpURI:seed.totpURI,backupCodes:seed.backupCodes,userId:user.user.id,...(scenarioId==="activatedSignup"?{inviteCode:(await createInviteCode({role:"user",email:"new-person@example.test"})).code}:{})};
}
writeFileSync(process.env.AUTH_BROWSER_SEED_FILE!,JSON.stringify(seeds),{mode:0o600});

closeAllDbConnections();
