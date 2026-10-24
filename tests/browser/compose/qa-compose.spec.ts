// Run against an isolated production build and synthetic SMTP fixture. See
// doc/DEV-FIXTURES.md; COMPOSE_QA_SEED_FILE supplies an enrolled synthetic user
// (email/password/totpURI/accountId), COMPOSE_QA_OUTBOX the fixture capture dir.
import {test, expect, type Page, type Locator} from '@playwright/test';
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {totpFromUri} from '../../helpers/totp';

test.use({ locale: "en-GB" });

test.skip(!process.env.COMPOSE_QA_SEED_FILE || !process.env.COMPOSE_QA_OUTBOX, 'Requires isolated synthetic compose fixture');

// Match the auth browser harness: distinct synthetic proxy clients, real limits.
const scenarios = [
  "QA-001 rapid subject remains intact through autosave and SMTP",
  "QA-002 Send stays visible after autosave at 360px",
  "QA-002 Send stays visible after autosave at 390px",
  "QA-008 desktop modal contains keyboard focus and restores its opener",
  "sender identities: personal From, signature replacement, saved draft reopen and mobile From",
  "QA-002 Send stays visible after autosave at 320px",
  "P2-E/P2-G mobile sender metadata reserves a usable editor in de",
  "P2-E/P2-G mobile sender metadata reserves a usable editor in en"
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
async function openCompose(page: Page, newMail = 'New mail', subjectLabel = 'Subject:') {
  await page.getByRole('button', {name:newMail,exact:true}).click();
  await expect(page.getByLabel(subjectLabel,{exact:true})).toBeVisible();
  await expect(page.locator('[data-lexical-editor="true"]')).toBeVisible();
}

// Review P2-D: visibility alone misses clipped controls and oversized popovers.
async function assertFromBounds(page: Page, label = 'From:') {
  const from = page.getByLabel(label, {exact:true});
  const viewport = page.viewportSize()!;
  const control = await from.boundingBox();
  expect(control).not.toBeNull();
  expect(control!.x).toBeGreaterThanOrEqual(0);
  expect(control!.x + control!.width).toBeLessThanOrEqual(viewport.width);
  expect(control!.height).toBeGreaterThanOrEqual(36);
  expect(await from.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.right - 12, r.y + r.height / 2)); })).toBe(true);
  await from.click();
  await expect.poll(async () => Math.round((await page.getByRole('listbox').boundingBox())!.width)).toBe(viewport.width - 32);
  const menu = await page.getByRole('listbox').boundingBox();
  expect(menu).not.toBeNull();
  expect(menu!.x).toBeGreaterThanOrEqual(16);
  expect(menu!.x + menu!.width).toBeLessThanOrEqual(viewport.width - 16);
  for (const option of await page.getByRole('option').all()) {
    const box = await option.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  }
  console.log(JSON.stringify({finding:'P2-D',viewport,control,menu}));
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
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

for(const viewport of [{width:320,height:740},{width:360,height:780},{width:390,height:844}]) {
  test(`QA-002 Send stays visible after autosave at ${viewport.width}px`, async ({page})=>{
    await page.setViewportSize(viewport);
    await signIn(page);
    // The responsive sidebar owns the mobile New mail action.
    await page.getByRole('button',{name:'Toggle sidebar',exact:true}).click();
    await openCompose(page);
    await assertFromBounds(page);
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
  await page.getByRole('button',{name:'Save preferences',exact:true}).click();
  expect((await prefSaved).status()).toBe(200);
  await expect(page.getByText('Preferences saved.',{exact:true})).toBeVisible();
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
  // Programmatic From changes remain authoritative across editor formats.
  for (const format of ['Text', 'Markdown']) {
    await page.getByRole('tab',{name:format,exact:true}).click();
    await from.click();
    await page.getByRole('option',{name:new RegExp(aliasEmail.replace(/\./g,'\\.'))}).click();
    await page.getByRole('tab',{name:'HTML',exact:true}).click();
    await expect(editor).toContainText(aliasEmail);
    await expect(editor).not.toContainText('demo@monkeydent.test');
    expect((await editor.innerText()).match(/Synthetic Alex/g)).toHaveLength(1);
    await from.click();
    await page.getByRole('option',{name:/demo@monkeydent.test/}).click();
    await expect(editor).not.toContainText(aliasEmail);
  }
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
  await assertFromBounds(page);
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

// Geometry is checked after a real autosave, including the footer's saved-draft
// controls. Test the editable element itself and its clipped visible area, not
// just a parent editor shell that could conceal a zero-height input.
for (const locale of ['de', 'en'] as const) {
  test(`P2-E/P2-G mobile sender metadata reserves a usable editor in ${locale}`, async ({page}, info) => {
    test.setTimeout(480000);
    await page.setViewportSize({width:390,height:844});
    await signIn(page);
    const seed=JSON.parse(readFileSync(process.env.COMPOSE_QA_SEED_FILE!, 'utf8'));
    const mailbox=`/api/accounts/${encodeURIComponent(seed.accountId)}`;
    const headers={origin:new URL(page.url()).origin};
    const catalog=JSON.parse(readFileSync(path.join('messages',`${locale}.json`),'utf8'));
    const copy=catalog.Compose;
    // Shell, reader and compose copy follow the UI language; read it from the catalogs the app renders.
    const chrome={toggleSidebar:catalog.Shell.sidebar.toggle as string,newMail:catalog.Shell.compose.new as string,drafts:catalog.Folders.drafts as string,editDraft:catalog.Reader.editDraft as string};
    // The relative save time always contains a number; "not saved yet" never does.
    const draftSaved=new RegExp(copy.draft.savedAgo.split('{time}').map((part:string)=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*\\d.*'));
    expect((await page.request.put('/api/auth/preferences',{headers,data:{uiLocale:locale}})).status()).toBe(200);
    const longName='Synthetic Long Display Name NNNNNNNNNNNN';
    const longEmail=`${'a'.repeat(47)}@example.test`;
    const measurements: unknown[]=[];
    let subject='';
    let draftId='';

    async function identity(email:string,displayName:string) {
      const all=await page.request.get(`${mailbox}/identities`);
      expect(all.status()).toBe(200);
      const existing=(await all.json()).identities.find((item:{email:string})=>item.email===email);
      const response=existing
        ? await page.request.patch(`${mailbox}/identities/${existing.id}`,{headers,data:{displayName,enabled:true}})
        : await page.request.post(`${mailbox}/identities`,{headers,data:{email,displayName}});
      expect(response.status()).toBe(existing?200:201);
      return (await response.json()).identity as {id:string;email:string;displayName:string};
    }
    async function openFresh(sender:{id:string;email:string;displayName:string},state:string) {
      expect((await page.request.put(`${mailbox}/prefs`,{headers,data:{defaultIdentityId:sender.id,signatureOverride:''}})).status()).toBe(200);
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('lang',locale);
      await page.getByRole('button',{name:chrome.toggleSidebar,exact:true}).click();
      await openCompose(page,chrome.newMail,copy.fields.subject);
      await expect(page.getByLabel(copy.from,{exact:true})).toContainText(sender.email);
      subject=`Synthetic editor space ${locale} ${state} ${Date.now()}`;
      const saved=page.waitForResponse(response=>response.url().endsWith('/drafts/save')&&response.request().postDataJSON().subject===subject);
      await page.getByLabel(copy.fields.subject,{exact:true}).fill(subject);
      const response=await saved;
      expect(response.status()).toBe(200);
      draftId=(await response.json()).draftId;
      await expect(page.getByText(draftSaved)).toBeVisible();
    }
    async function reopen() {
      await page.goto('/');
      await page.getByRole('button',{name:chrome.toggleSidebar,exact:true}).click();
      await page.getByRole('button',{name:new RegExp(chrome.drafts)}).first().click();
      await page.getByText(subject,{exact:true}).first().click();
      await page.getByRole('button',{name:chrome.editDraft,exact:true}).click();
      await expect(page.getByLabel(copy.fields.subject,{exact:true})).toHaveValue(subject);
    }
    async function matrix(sender:{email:string;displayName:string},state:string) {
      const fullSender=`${sender.displayName} <${sender.email}>`;
      for(const theme of ['light','dark'] as const) for(const width of [320,360,390]) {
        await page.setViewportSize({width,height:844});
        await page.emulateMedia({colorScheme:theme});
        await page.evaluate(theme=>{document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(theme);document.documentElement.style.colorScheme=theme;document.querySelectorAll('.radix-themes').forEach(el=>{el.classList.remove('light','dark');el.classList.add(theme);});},theme);
        const subtitle=page.getByTitle(copy.fromValue.replace('{sender}',fullSender),{exact:true});
        await expect(subtitle).toHaveText(copy.fromValue.replace('{sender}',fullSender));
        expect(await subtitle.evaluate(el=>({clamp:getComputedStyle(el).webkitLineClamp,hidden:!!el.closest('[aria-hidden="true"], [hidden]')}))).toEqual({clamp:'2',hidden:false});
        const from=page.getByLabel(copy.from,{exact:true});
        await expect(from).toHaveAttribute('title',fullSender);
        await expect(from).toContainText(fullSender);
        expect(await from.evaluate(el=>getComputedStyle(el.firstElementChild!).whiteSpace)).toBe('nowrap');
        const bounds=[];
        for(const button of [page.getByRole('button',{name:copy.closeComposer,exact:true}),page.getByRole('button',{name:copy.actions.cancel,exact:true})]) {
          const box=await button.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.y).toBeGreaterThanOrEqual(0);
          expect(box!.x+box!.width).toBeLessThanOrEqual(width);
          expect(box!.y+box!.height).toBeLessThanOrEqual(844);
          expect(box!.width).toBeGreaterThanOrEqual(44);
          expect(box!.height).toBeGreaterThanOrEqual(44);
          expect(await button.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
          bounds.push(box!);
        }
        if(state.includes('unavailable')) await expect(page.getByRole('button',{name:copy.actions.send,exact:true})).toBeDisabled();
        await assertFromBounds(page,copy.from);
        const editor=page.locator('[data-lexical-editor="true"]');
        await expect(editor).toBeVisible();
        const geometry=await editor.evaluate(el=>{
          const r=el.getBoundingClientRect();let top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom);
          for(let parent=el.parentElement;parent;parent=parent.parentElement) {
            if(['auto','scroll','hidden','clip'].includes(getComputedStyle(parent).overflowY)) {const p=parent.getBoundingClientRect();top=Math.max(top,p.top);bottom=Math.min(bottom,p.bottom);}
          }
          return {height:r.height,visibleHeight:bottom-top,hit:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};
        });
        expect(geometry.height).toBeGreaterThanOrEqual(120);
        expect(geometry.visibleHeight).toBeGreaterThanOrEqual(120);
        expect(geometry.hit).toBe(true);
        // A click and real keyboard input must reach the editor after autosave.
        const marker=`Synthetic ${locale} ${state} ${theme} ${width}.`;
        // Unavailable drafts were autosaved before disabling their identity.
        // Saving is deliberately blocked until the sender is repaired, while
        // the body must remain editable. Enabled cases also prove persistence.
        const saved=state.includes('unavailable') ? null : page.waitForResponse(response=>response.url().endsWith('/drafts/save')&&response.request().postDataJSON().text?.includes(marker),{timeout:20000});
        await editor.click();
        await page.keyboard.press('ControlOrMeta+A');
        await page.keyboard.type(marker,{delay:0});
        await expect(editor).toContainText(marker.trim());
        if(saved) {
          expect((await saved).status()).toBe(200);
          await expect(page.getByText(draftSaved)).toBeVisible();
          const persisted=await page.request.get(`${mailbox}/messages/${encodeURIComponent(draftId)}`);
          expect(persisted.status()).toBe(200);
          expect((await persisted.json()).message.body).toContain(marker.trim());
        }
        measurements.push({locale,state,theme,width,metadata:await page.locator('[class*=composeBody] > [class*=composeGrid]').evaluate(el=>el.clientHeight),header:await subtitle.locator('../..').evaluate(el=>el.getBoundingClientRect().height),from:(await from.boundingBox())!.height,editor:geometry.height,visibleEditor:geometry.visibleHeight,closeRight:bounds[0].x+bounds[0].width,typing:true});
        console.log(JSON.stringify({finding:'P2-G',...measurements.at(-1) as object}));
      }
    }
    async function keyboardMatrix(state:string) {
      for(const theme of ['light','dark'] as const) for(const width of [320,390]) {
        await test.step(`keyboard ${locale}/${state}/${theme}/${width}x500`,async()=>{
          await page.setViewportSize({width,height:844});
          await page.emulateMedia({colorScheme:theme});
          await page.evaluate(theme=>{document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(theme);document.documentElement.style.colorScheme=theme;document.querySelectorAll('.radix-themes').forEach(el=>{el.classList.remove('light','dark');el.classList.add(theme);});},theme);
          const editor=page.locator('[data-lexical-editor="true"]');
          await editor.click();
          await page.setViewportSize({width,height:500});
          const area=page.locator('[class*=composeScrollArea]');
          const grid=page.locator('[class*=composeBody] > [class*=composeGrid]');
          const body=page.locator('[class*=composeBody]');
          expect(await body.evaluate(el=>getComputedStyle(el).overflowY)).toBe('visible');
          expect(await grid.evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight,overflow:getComputedStyle(el).overflowY}))).toMatchObject({overflow:'visible'});
          expect(await grid.evaluate(el=>el.clientHeight)).toBeGreaterThan(0);
          expect(await area.evaluate(el=>getComputedStyle(el).overflowY)).toBe('auto');
          // Only the shared area may actually scroll. A zero-height metadata
          // viewport or clipping editor ancestor must not be hidden by .click().
          expect(await editor.evaluate(el=>{
            const scrolls=[];
            for(let p=el.parentElement;p;p=p.parentElement) {
              const style=getComputedStyle(p);
              if(['auto','scroll','hidden'].includes(style.overflowY)&&p.scrollHeight>p.clientHeight) scrolls.push(p.className);
            }
            return scrolls;
          })).toEqual([await area.getAttribute('class')]);
          async function visibleEditor() {
            return editor.evaluate(el=>{
              const r=el.getBoundingClientRect();let top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom);
              for(let p=el.parentElement;p;p=p.parentElement) if(['auto','scroll','hidden','clip'].includes(getComputedStyle(p).overflowY)) {const b=p.getBoundingClientRect();top=Math.max(top,b.top);bottom=Math.min(bottom,b.bottom);}
              const metadata=el.closest('[class*=composeBody]')?.querySelector('[class*=composeGrid]');
              if(metadata&&getComputedStyle(metadata).position==='sticky') top=Math.max(top,metadata.getBoundingClientRect().bottom);
              return Math.max(0,bottom-top);
            });
          }
          // Resizing with focus already in the editor must reveal it too.
          await expect.poll(visibleEditor).toBeGreaterThanOrEqual(96);
          const resizeVisible=await visibleEditor();
          // Focus must reveal the input without test-side scrollIntoView(),
          // locator clicks or programmatic scroll offsets.
          await editor.evaluate(el=>{el.blur();el.focus();});
          await expect.poll(visibleEditor).toBeGreaterThanOrEqual(96);
          const focusedVisible=await visibleEditor();
          const hit=async(target:Locator)=>target.evaluate(el=>{
            const r=el.getBoundingClientRect();let top=0,bottom=innerHeight;
            for(let p=el.parentElement;p;p=p.parentElement) if(['auto','scroll','hidden','clip'].includes(getComputedStyle(p).overflowY)) {const b=p.getBoundingClientRect();top=Math.max(top,b.top);bottom=Math.min(bottom,b.bottom);}
            return r.top>=top&&r.bottom<=bottom&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
          });
          async function wheelTo(target:Locator,click=true) {
            for(let attempt=0;attempt<30&&!await hit(target);attempt++) {
              const a=(await area.boundingBox())!,b=(await target.boundingBox())!;
              await page.mouse.move(a.x+4,a.y+a.height/2);
              await page.mouse.wheel(0,b.y+b.height/2<a.y+a.height/2?-80:80);
              await page.waitForTimeout(150);
            }
            expect(await hit(target)).toBe(true);
            const b=(await target.boundingBox())!;
            await page.mouse.move(b.x+b.width/2,b.y+b.height/2);
            if(click) await page.mouse.click(b.x+b.width/2,b.y+b.height/2);
            return b;
          }
          const from=page.getByLabel(copy.from,{exact:true});
          await wheelTo(from);
          await expect(page.getByRole('listbox')).toBeVisible();
          await page.keyboard.press('Escape');
          await expect(page.getByRole('listbox')).toHaveCount(0);
          const fromBox=await from.boundingBox();
          for(const label of [copy.fields.to,copy.fields.subject]) {
            const field=page.getByLabel(label,{exact:true});
            await wheelTo(field);
            await expect(field).toBeFocused();
            if(label===copy.fields.subject) {
              await page.keyboard.press('End');
              await page.keyboard.type('.');
              await page.keyboard.press('Backspace');
            }
          }
          await wheelTo(editor);
          await page.keyboard.type(' Synthetic keyboard access.');
          await expect(editor).toContainText('Synthetic keyboard access.');
          await expect.poll(visibleEditor).toBeGreaterThanOrEqual(96);
          const cancel=page.getByRole('button',{name:copy.actions.cancel,exact:true});

          // Exercise every saved-draft footer action with a real pointer,
          // including disabled controls, without discarding/sending the draft.
          const actionBounds=[];
          for(const name of [copy.actions.discardDraft,copy.actions.saveDraft,copy.actions.cancel,copy.actions.send]) {
            const action=page.getByRole('button',{name,exact:true});
            const b=await wheelTo(action,false);
            expect(b.width).toBeGreaterThanOrEqual(44);expect(b.height).toBeGreaterThanOrEqual(44);
            actionBounds.push({name,...b});
          }
          const forward=await area.evaluate(el=>el.scrollTop);
          expect(forward).toBeGreaterThan(0);
          const cancelBox=await cancel.boundingBox();
          // Return to metadata by wheel, then repeat pointer access to all
          // fields. No locator action may silently scroll a clipped ancestor.
          const a=(await area.boundingBox())!;
          await page.mouse.move(a.x+4,a.y+a.height/2);
          await page.mouse.wheel(0,-1000);
          await expect.poll(()=>area.evaluate(el=>el.scrollTop)).toBe(0);
          await wheelTo(from);
          await page.keyboard.press('Escape');
          await expect(page.getByRole('listbox')).toHaveCount(0);
          for(const label of [copy.fields.to,copy.fields.subject]) await wheelTo(page.getByLabel(label,{exact:true}));
          expect(await area.evaluate(el=>el.scrollTop)).toBeLessThan(forward);
          const close=page.getByRole('button',{name:copy.closeComposer,exact:true});
          const closeBox=(await close.boundingBox())!;
          expect(closeBox.width).toBeGreaterThanOrEqual(44);expect(closeBox.height).toBeGreaterThanOrEqual(44);
          expect(await hit(close)).toBe(true);
          const measurement={locale,state,theme,width,height:500,metadata:await grid.evaluate(el=>el.clientHeight),resizeVisible,focusedVisible,fromBox,cancelBox,closeBox,actionBounds,forward,back:await area.evaluate(el=>el.scrollTop),fromToSubjectHit:true,typing:true};
          console.log(JSON.stringify({finding:'P2 keyboard',...measurement}));
          await info.attach(`keyboard-${locale}-${state}-${theme}-${width}`,{body:JSON.stringify(measurement),contentType:'application/json'});
          await page.setViewportSize({width,height:844});
        });
      }
    }
    try {
      const long=await identity(longEmail,longName);
      await openFresh(long,'enabled long');
      await matrix(long,'enabled long');
      await keyboardMatrix('enabled');
      await page.getByRole('button',{name:copy.actions.cancel,exact:true}).click();
      expect((await page.request.patch(`${mailbox}/identities/${long.id}`,{headers,data:{enabled:false}})).status()).toBe(200);
      await reopen();
      await matrix(long,'unavailable');
      await keyboardMatrix('unavailable');
      await page.getByRole('button',{name:copy.actions.cancel,exact:true}).click();
      await reopen();
      await matrix(long,'reopened unavailable draft');
      await keyboardMatrix('reopened unavailable draft');
      await page.getByRole('button',{name:copy.actions.cancel,exact:true}).click();
      for(const [state,email,displayName] of [
        ['80-char name',`${'b'.repeat(47)}@example.test`,'N'.repeat(80)],
        ['120-char address',`${'a'.repeat(64)}@${'b'.repeat(42)}.example.test`,longName]
      ]) {
        const sender=await identity(email,displayName);
        await openFresh(sender,state);
        await matrix(sender,state);
        await page.getByRole('button',{name:copy.actions.cancel,exact:true}).click();
      }
      expect(measurements).toHaveLength(30);
      await info.attach(`editor-space-${locale}`,{body:JSON.stringify(measurements,null,2),contentType:'application/json'});
    } finally {
      expect((await page.request.put(`${mailbox}/prefs`,{headers,data:{defaultIdentityId:null,signatureOverride:null}})).status()).toBe(200);
      expect((await page.request.put('/api/auth/preferences',{headers,data:{uiLocale:'en'}})).status()).toBe(200);
    }
  });
}
