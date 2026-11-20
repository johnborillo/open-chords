import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/root/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1280,height:950}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173');await page.getByRole('button',{name:'Import a song',exact:true}).click();
 assert.equal(await page.locator('#tab-ug').getAttribute('aria-selected'),'true');
 await page.locator('#import-submit').click();assert.ok((await page.locator('#import-error').textContent()).includes('Paste an Ultimate Guitar'));
 await page.locator('#ug-url').fill('https://example.com/tab/no/chords-123');await page.locator('#import-submit').click();await page.getByRole('alert').filter({hasText:'Use a link from tabs.ultimate-guitar.com.'}).waitFor();assert.equal(await page.locator('#import-dialog').evaluate(e=>e.open),true);
 await page.locator('#ug-url').fill('https://tabs.ultimate-guitar.com/tab/seether/careless-whisper-chords-813581?utm_source=test#intro');
 await page.screenshot({path:'/tmp/open-chords-link-form.png'});
 await page.locator('#import-submit').click();await page.getByRole('heading',{name:'Careless Whisper',exact:true}).waitFor();
 assert.equal(await page.locator('#source-meta a').getAttribute('href'),'https://tabs.ultimate-guitar.com/tab/seether/careless-whisper-chords-813581');assert.ok(await page.locator('.chord').count()>0);
 await page.getByRole('button',{name:'Transpose up one semitone'}).click();assert.equal(await page.locator('#transpose-value').textContent(),'+1 semitones');await page.reload();await page.getByRole('heading',{name:'After the Rain',exact:true}).waitFor();await page.locator('.song-link').filter({hasText:'Careless Whisper'}).click();assert.equal(await page.locator('#transpose-value').textContent(),'+1 semitones');
 // Simulate upstream failure at the API boundary; no duplicate song is added.
 await page.getByRole('button',{name:'Import a song',exact:true}).click();await page.route('**/api/import/ultimate-guitar',r=>r.fulfill({status:422,contentType:'application/json',body:JSON.stringify({error:{code:'SOURCE_BLOCKED',message:'Ultimate Guitar is blocking direct access to this sheet. Open the sheet and use the export bookmark or upload its saved HTML instead.'}})}));
 const count=await page.locator('.song-link').count();await page.locator('#ug-url').fill('https://tabs.ultimate-guitar.com/tab/open-chords/blocked-chords-123');await page.locator('#import-submit').click();await page.getByRole('alert').filter({hasText:'blocking direct access'}).waitFor();assert.equal(await page.locator('#ug-fallback').evaluate(e=>e.open),true);assert.equal(await page.locator('.song-link').count(),count);assert.equal(await page.locator('#import-submit').isEnabled(),true);
 await page.unroute('**/api/import/ultimate-guitar');
 // Closing a pending import cancels it; a stale response cannot create a song.
 let release;const pending=new Promise(resolve=>release=resolve);let requested;const received=new Promise(resolve=>requested=resolve);
 await page.route('**/api/import/ultimate-guitar',async r=>{requested();await pending;try{await r.fulfill({contentType:'application/json',body:JSON.stringify({schema:'open-chords/v1',song:{title:'Must not import',content:'[C]Cancelled request',source:'https://tabs.ultimate-guitar.com/tab/open-chords/test-chords-123'}})});}catch{}});
 await page.locator('#import-submit').click();await received;assert.equal(await page.locator('#import-submit').getAttribute('aria-busy'),'true');assert.equal(await page.locator('#ug-url').evaluate(e=>e.readOnly),true);await page.getByRole('button',{name:'Close import',exact:true}).click();release();await page.waitForTimeout(100);assert.equal(await page.locator('.song-link').count(),count);
 await page.unroute('**/api/import/ultimate-guitar');await page.getByRole('button',{name:'Import a song',exact:true}).click();assert.equal(await page.locator('#import-submit').isEnabled(),true);
 // File import remains available after cancellation.
 await page.getByRole('tab',{name:'Upload a file'}).click();await page.locator('#import-file').setInputFiles({name:'own.cho',mimeType:'text/plain',buffer:Buffer.from('{title: Fallback original}\n[C]Our own [G]line')});await page.locator('#import-submit:not([disabled])').waitFor();await page.locator('#import-submit').click();await page.getByRole('heading',{name:'Fallback original',exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Import a song',exact:true}).click();await page.locator('#ug-url').fill('https://tabs.ultimate-guitar.com/tab/open-chords/original-sheet-chords-123');await page.screenshot({path:'/tmp/open-chords-link-mobile.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);console.log('Link browser checks passed: live URL import, attribution, transposition, persistence, invalid link, blocked-page fallback, cancellation, file fallback, mobile.');
}finally{await browser.close();}
