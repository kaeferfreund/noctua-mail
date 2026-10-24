import {chromium,expect} from '/home/monkey/code/noctua-mail/wt-status-bar/node_modules/@playwright/test';
const b=await chromium.launch({headless:true,args:['--no-sandbox']});const c=await b.newContext({storageState:'/home/monkey/code/noctua-mail/wt-status-bar/.tmp/status-round2-state.json',locale:'de-DE',baseURL:'http://localhost:3875',viewport:{width:1280,height:900}}),p=await c.newPage();
await p.goto('/?openCalendar=1',{waitUntil:'domcontentloaded'});await expect(p.locator('.fc-event-title').first()).toBeVisible({timeout:30000});
console.log(await p.evaluate(()=>Object.fromEntries(['[data-slot="popover-content"]','.fc','.fc-view-harness','.fc-scrollgrid','.fc-event-title','.fc-scroller'].map(s=>{const e=document.querySelector<HTMLElement>(s)!,r=e.getBoundingClientRect(),c=getComputedStyle(e);return[s,{x:r.x,y:r.y,width:r.width,height:r.height,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,overflow:c.overflow,position:c.position,style:e.getAttribute('style')}]}))));
await p.screenshot({path:'/home/monkey/code/noctua-mail/briefs/status-bar-compact-evidence/round2/calendar-layout.png'});
const event=p.locator('.fc-event-title').filter({hasText:'Synthetic calendar frame 1280 edited'}).first();try{await event.click({timeout:5000});console.log('EVENT CLICK PASS')}catch(e){throw e;}
await b.close();
