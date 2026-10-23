// Run against an isolated production build and synthetic SMTP fixture. See
// doc/DEV-FIXTURES.md; COMPOSE_QA_SEED_FILE supplies an enrolled synthetic user
// (email/password/totpURI/accountId), COMPOSE_QA_OUTBOX the fixture capture dir.
import {test, expect, type Page} from '@playwright/test';
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {totpFromUri} from '../../helpers/totp';

test.skip(!process.env.COMPOSE_QA_SEED_FILE || !process.env.COMPOSE_QA_OUTBOX, 'Requires isolated synthetic compose fixture');

async function post(page: Page, url: string, body: unknown) {
  return page.evaluate(async ({url,body}) => (await fetch(url, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})).status, {url,body});
}

async function signIn(page: Page) {
  const seed=JSON.parse(readFileSync(process.env.COMPOSE_QA_SEED_FILE!, 'utf8'));
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
