// Run against an isolated production build and synthetic SMTP fixture. See
// doc/DEV-FIXTURES.md; COMPOSE_QA_SEED_FILE supplies an enrolled synthetic user
// (email/password/totpURI/accountId), COMPOSE_QA_OUTBOX the fixture capture dir.
import {test, expect, type Page} from '@playwright/test';
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {totpFromUri} from '../../helpers/totp';

test.skip(!process.env.COMPOSE_QA_SEED_FILE || !process.env.COMPOSE_QA_OUTBOX, 'Requires isolated synthetic compose fixture');

// Match the auth browser harness: distinct synthetic proxy clients, real limits.
const scenarios = [
  "QA-001 rapid subject remains intact through autosave and SMTP",
  "QA-002 Send stays visible after autosave at 360px",
  "QA-002 Send stays visible after autosave at 390px",
  "QA-008 desktop modal contains keyboard focus and restores its opener",
  "sender identities: personal From, signature replacement, saved draft reopen and mobile From"
];
test.beforeEach(async ({page}, info) => {
  const index=scenarios.indexOf(info.title);
  if(index<0) throw new Error("Unknown synthetic compose scenario");
  await page.context().setExtraHTTPHeaders({'x-forwarded-for':`192.0.2.${51+index}`});
});
let lastSignInAt=0;


async function post(page: Page, url: string, body: unknown) {
  return page.evaluate(async ({url,body}) => (await fetch(url, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})).status, {url,body});
}

async function signIn(page: Page, person?: {email:string;password:string;totpURI:string;accountId:string}) {
  const seed=person ?? JSON.parse(readFileSync(process.env.COMPOSE_QA_SEED_FILE!, 'utf8'));
  const remaining=lastSignInAt+12500-Date.now();
  if(remaining>0) await new Promise(resolve=>setTimeout(resolve,remaining));
  lastSignInAt=Date.now();
  await page.goto('/');
  expect(await post(page,'/api/ba/sign-in/email',{email:seed.email,password:seed.password})).toBe(200);
  expect(await post(page,'/api/ba/two-factor/verify-totp',{code:totpFromUri(seed.totpURI)})).toBe(200);
  expect(await post(page,'/api/auth/switch-account',{accountId:seed.accountId})).toBe(200);
  await page.reload();
  await expect(page.getByRole('button', {name:'Toggle sidebar',exact:true})).toBeVisible();
}
async function openCompose(page: Page) {
  await page.getByRole('button', {name:'New mail',exact:true}).click();
  await expect(page.getByLabel('Subject:',{exact:true})).toBeVisible();
  await expect(page.locator('[data-lexical-editor="true"]')).toBeVisible();
}

// Real zero-delay keyboard events, autosave, send request and captured SMTP.
test('QA-001 rapid subject remains intact through autosave and SMTP', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await signIn(page);
  for(let run=0;run<5;run++) {
    await openCompose(page);
    await expect(page.getByLabel('From:',{exact:true})).toBeVisible();
    await page.getByLabel('To:',{exact:true}).fill('recipient@example.test');
    const subject=page.getByLabel('Subject:',{exact:true});
    const expected='QA keyboard fixture delivery';
    await subject.focus();
    await page.keyboard.type(expected,{delay:0});
    await expect(subject).toHaveValue(expected);
    await page.locator('[data-lexical-editor="true"]').fill(`Synthetic compose QA body ${run}`);
    await expect(page.getByRole('button',{name:'Discard Draft',exact:true})).toBeVisible();
    await expect(page.getByText(/Draft saved/)).toBeVisible();
    await expect(subject).toHaveValue(expected);
    const sentRequest=page.waitForRequest(request=>request.url().includes('/smtp/send') && request.method()==='POST');
    const sentResponse=page.waitForResponse(response=>response.url().includes('/smtp/send') && response.request().method()==='POST');
    const outbox=process.env.COMPOSE_QA_OUTBOX!;
    const before=new Set(readdirSync(outbox));
    await page.getByRole('button',{name:'Send',exact:true}).click();
    const payload=(await sentRequest).postDataJSON();
    expect(payload.subject).toBe(expected);
    expect(payload.to).toBe('recipient@example.test');
    expect(payload.text).toContain(`Synthetic compose QA body ${run}`);
    expect((await sentResponse).status()).toBe(200);
    await expect.poll(()=>readdirSync(outbox).filter(file=>file.endsWith('.eml')&&!before.has(file)).length).toBe(1);
    const file=readdirSync(outbox).find(file=>file.endsWith('.eml')&&!before.has(file))!;
    expect(readFileSync(path.join(outbox,file),'utf8')).toContain(`Subject: ${expected}\r\n`);
    console.log(JSON.stringify({finding:'QA-001',run,subject:expected,smtp:'exact match'}));
    await expect(subject).toHaveCount(0);
  }
});

for(const viewport of [{width:360,height:780},{width:390,height:844}]) {
  test(`QA-002 Send stays visible after autosave at ${viewport.width}px`, async ({page})=>{
    await page.setViewportSize(viewport);
    await signIn(page);
    // The responsive sidebar owns the mobile New mail action.
    await page.getByRole('button',{name:'Toggle sidebar',exact:true}).click();
    await openCompose(page);
    await page.getByLabel('To:',{exact:true}).fill('recipient@example.test');
    await page.getByLabel('Subject:',{exact:true}).fill('Synthetic mobile autosave');
    await page.locator('[data-lexical-editor="true"]').fill('Synthetic mobile body');
    await expect(page.getByRole('button',{name:'Discard Draft',exact:true})).toBeVisible();
    await expect(page.getByText(/Draft saved/)).toBeVisible();
    const send=page.getByRole('button',{name:'Send',exact:true});
    const box=await send.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x+box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y+box!.height).toBeLessThanOrEqual(viewport.height);
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(await send.evaluate(el=>{const box=el.getBoundingClientRect();return el.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2));})).toBe(true);
    console.log(JSON.stringify({finding:'QA-002',viewport,send:box}));
  });
}

test('QA-008 desktop modal contains keyboard focus and restores its opener', async ({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await signIn(page);
  await openCompose(page);
  const opener=page.getByRole('button',{name:'Open in modal',exact:true});
  await opener.click();
  const dialog=page.getByRole('dialog',{name:'New message',exact:true});
  await expect(dialog).toHaveAttribute('aria-modal','true');
  await dialog.getByRole('button',{name:'Send',exact:true}).focus();
  for(let i=0;i<30;i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);
  }
  await dialog.getByRole('button',{name:'Send',exact:true}).focus();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  // Closing removes the inline composer too; the persistent shell compose
  // action is the useful replacement when the inline opener has unmounted.
  await expect(page.getByRole('button',{name:'New mail',exact:true})).toBeFocused();
});

test('sender identities: personal From, signature replacement, saved draft reopen and mobile From', async ({page,browser}) => {
  await page.setViewportSize({width:1440,height:900});
  await signIn(page);
  const seed=JSON.parse(readFileSync(process.env.COMPOSE_QA_SEED_FILE!, 'utf8'));
  const mailbox=`/api/accounts/${encodeURIComponent(seed.accountId)}`;
  const aliasEmail=`alias-compose-${Date.now()}@example.test`;
  await page.getByRole('button',{name:'User menu',exact:true}).click();
  await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
  await page.getByRole('tab',{name:'Signatures',exact:true}).click();
  await page.getByRole('button',{name:'Add signature',exact:true}).click();
  await page.getByLabel('Name',{exact:true}).fill('Synthetic shared signature');
  await page.getByLabel('Signature text',{exact:true}).fill('Team regards,\n{{user.name}}\n{{identity.email}}');
  await page.getByLabel('Default signature',{exact:true}).click();
  await page.getByRole('option',{name:'Synthetic shared signature',exact:true}).click();
  const sharedSaved=page.waitForResponse(response=>response.url().endsWith('/settings')&&response.request().method()==='PUT');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  const sharedResponse=await sharedSaved;
  expect(sharedResponse.status()).toBe(200);
  expect(sharedResponse.request().postDataJSON().teamDefaults).toBe(true);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'User menu',exact:true}).click();
  await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
  await page.getByRole('tab',{name:'Identities',exact:true}).click();
  await page.getByRole('button',{name:'Add identity',exact:true}).click();
  await page.getByLabel('Email',{exact:true}).fill(aliasEmail);
  await page.getByLabel('Display name',{exact:true}).fill('Synthetic Alias');
  const created=page.waitForResponse(response=>response.url().endsWith('/identities')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Save identity',exact:true}).click();
  const createdResponse=await created;
  expect(createdResponse.status()).toBe(201);
  const alias=(await createdResponse.json()).identity;
  await page.getByRole('tab',{name:'Preferences',exact:true}).click();
  await page.getByLabel('Default From',{exact:true}).selectOption(alias.id);
  await page.getByLabel('Personal signature',{exact:true}).selectOption('custom');
  await page.getByLabel('Personal signature text',{exact:true}).fill('Regards,\n{{user.name}}\n{{identity.email}}');
  const prefSaved=page.waitForResponse(response=>response.url().endsWith('/prefs')&&response.request().method()==='PUT');
  await page.getByRole('button',{name:'Save sender preferences',exact:true}).click();
  expect((await prefSaved).status()).toBe(200);
  await expect(page.getByText('Sender preferences saved.',{exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await openCompose(page);
  const from=page.getByLabel('From:',{exact:true});
  await expect(from).toContainText(aliasEmail);
  const editor=page.locator('[data-lexical-editor="true"]');
  await expect(editor).toContainText('Synthetic Alex');
  await expect(editor).toContainText(aliasEmail);
  const dialogs:string[]=[];
  page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.dismiss();});
  await from.click();
  await page.getByRole('option',{name:/demo@monkeydent.test/}).click();
  await expect(from).toContainText('demo@monkeydent.test');
  await expect(editor).toContainText('demo@monkeydent.test');
  await expect(editor).not.toContainText(aliasEmail);
  expect(dialogs).toEqual([]);
  expect((await editor.innerText()).match(/Synthetic Alex/g)).toHaveLength(1);
  await page.getByLabel('To:',{exact:true}).fill('recipient@example.test');
  await page.getByLabel('Subject:',{exact:true}).fill('Synthetic identity and signature browser proof');
  const saved=await page.waitForResponse(response=>response.url().endsWith('/drafts/save')&&response.request().postDataJSON().subject==='Synthetic identity and signature browser proof');
  expect(saved.status()).toBe(200);
  const savedData=await saved.json();
  expect(savedData.identityId).toBeTruthy();
  expect(saved.request().postDataJSON().identityId).toBe(savedData.identityId);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  // Reopen through the shared detached-draft initializer without reinsertion.
  const draftId=savedData.draftId;
  const handoffId='synthetic-sender-reopen';
  await page.evaluate(({handoffId,seed,draftId})=>localStorage.setItem(`noctua:detached-compose-handoff:${handoffId}`,JSON.stringify({version:1,status:'ready',accountId:seed.accountId,ownerUserId:seed.id,mode:'new',draftId,sourceMessageId:null,createdAtMs:Date.now(),updatedAtMs:Date.now()})),{handoffId,seed,draftId});
  await page.goto(`/compose/window?handoff=${handoffId}`);
  await expect(page.getByLabel('From:',{exact:true})).toContainText('demo@monkeydent.test');
  const restoredEditor=page.locator('[data-lexical-editor="true"]');
  await expect(restoredEditor).toContainText('Synthetic Alex');
  expect((await restoredEditor.innerText()).match(/Synthetic Alex/g)).toHaveLength(1);
  // The saved-draft action is reachable from its message details, including a
  // draft discovered after a background list refresh.
  const draftResponse=await page.request.get(`${mailbox}/messages/${encodeURIComponent(draftId)}`);
  expect(draftResponse.status()).toBe(200);
  const draft=(await draftResponse.json()).message;
  expect(draft.senderIdentityId).toBe(savedData.identityId);
  expect(draft.body.match(/Synthetic Alex/g)).toHaveLength(1);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.getByRole('button',{name:'Toggle sidebar',exact:true}).click();
  await openCompose(page);
  await expect(page.getByLabel('From:',{exact:true})).toBeVisible();
  await expect(page.getByLabel('From:',{exact:true})).toContainText(aliasEmail);
  await expect(page.getByRole('button',{name:'Send',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  // Sending the saved draft uses the server's saved identity contract.
  const beforeSent=new Set(readdirSync(process.env.COMPOSE_QA_OUTBOX!));
  const sent=await page.request.post(`${mailbox}/drafts/${encodeURIComponent(draftId)}/send`,{headers:{origin:new URL(page.url()).origin,"content-type":"application/json"}});
  expect(sent.status()).toBe(200);
  expect((await sent.json()).identityId).toBe(savedData.identityId);
  await expect.poll(()=>readdirSync(process.env.COMPOSE_QA_OUTBOX!).filter(file=>file.endsWith('.eml')&&!beforeSent.has(file)).length).toBe(1);
  const receipts=readdirSync(process.env.COMPOSE_QA_OUTBOX!).filter(file=>file.endsWith('.eml')&&!beforeSent.has(file)).map(file=>readFileSync(path.join(process.env.COMPOSE_QA_OUTBOX!,file),'utf8'));
  const receipt=receipts.find(source=>source.includes('Subject: Synthetic identity and signature browser proof'))!;
  expect(receipt).toBeTruthy(); expect(receipt).toContain('demo@monkeydent.test');
  // A separate enrolled editor inherits the shared template and uses their own
  // profile, even though the alias was created by the manager above.
  const otherContext=await browser.newContext({baseURL:process.env.COMPOSE_QA_BASE_URL??'http://localhost:3880',viewport:{width:390,height:844},extraHTTPHeaders:{'x-forwarded-for':'192.0.2.62'}});
  try {
    const otherPage=await otherContext.newPage();
    await signIn(otherPage,{...seed.other,accountId:seed.accountId});
    await otherPage.getByRole('button',{name:'Toggle sidebar',exact:true}).click();
    await openCompose(otherPage);
    const otherFrom=otherPage.getByLabel('From:',{exact:true});
    await expect(otherFrom).toBeVisible();
    await expect(otherFrom).toContainText('demo@monkeydent.test');
    const otherEditor=otherPage.locator('[data-lexical-editor="true"]');
    await expect(otherEditor).toContainText('Synthetic Jo');
    await expect(otherEditor).toContainText('Team regards,');
    await expect(otherEditor).not.toContainText('Synthetic Alex');
    await otherFrom.click();
    await otherPage.getByRole('option',{name:new RegExp(aliasEmail.replace(/\./g,'\\.'))}).click();
    await expect(otherEditor).toContainText(aliasEmail);
    await otherPage.getByLabel('To:',{exact:true}).fill('recipient@example.test');
    await otherPage.getByLabel('Subject:',{exact:true}).fill('Synthetic second sender signature proof');
    const otherSent=otherPage.waitForResponse(response=>response.url().endsWith('/smtp/send')&&response.request().method()==='POST');
    const beforeOther=new Set(readdirSync(process.env.COMPOSE_QA_OUTBOX!));
    await otherPage.getByRole('button',{name:'Send',exact:true}).click();
    const otherResponse=await otherSent;
    expect(otherResponse.status()).toBe(200);
    expect((await otherResponse.json()).identityId).toBe(alias.id);
    expect(otherResponse.request().postDataJSON().text).toContain('Synthetic Jo');
    expect(otherResponse.request().postDataJSON().text).not.toContain('Synthetic Alex');
    await expect.poll(()=>readdirSync(process.env.COMPOSE_QA_OUTBOX!).filter(file=>file.endsWith('.eml')&&!beforeOther.has(file)).length).toBe(1);
  } finally { await otherContext.close(); }
  // Reset only this synthetic person's preferences for repeatable future runs.
  expect((await page.request.put(`${mailbox}/prefs`,{headers:{origin:new URL(page.url()).origin},data:{defaultIdentityId:null,signatureOverride:null}})).status()).toBe(200);
});
