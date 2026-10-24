import { test, expect } from '@playwright/test';
import { signInQa } from '../tests/browser/ui/qaRound2Session';
test('German list and reader at 320 px against production',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.emulateMedia({colorScheme:'light'});await signInQa(page);
 const response=await page.request.put('/api/auth/preferences',{data:{uiLocale:'de'},headers:{origin:new URL(page.url()).origin}});expect(response.status()).toBe(200);await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','de');
 const search=page.getByRole('textbox',{name:/^E-Mails/}).first();await search.fill('QA synthetic 014');await search.press('Enter');await page.setViewportSize({width:320,height:780});
 const row=page.getByText('QA synthetic 014',{exact:true}).first();await expect(row).toBeVisible();
 await page.screenshot({path:'.tmp/german-list-320.png'});
 await row.click();await expect(page.locator('[data-message-action="delete"]').first()).toBeAttached();
 await page.screenshot({path:'.tmp/german-reader-320.png'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(320);
 console.log('GERMAN 320 PASS: locale de; list and reader screenshots; document width 320');
});
