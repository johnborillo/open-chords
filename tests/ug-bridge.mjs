// Controlled browser replay using a locally retained public page; never visits the live site.
import {chromium} from '@playwright/test';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {bookmarklet} from '../dist/src/importers.js';
const html=await readFile('research/ug/page.html','utf8');
const dom=new JSDOM(html);const store=JSON.parse(dom.window.document.querySelector('.js-store').getAttribute('data-content'));
const data=store.store.page.data;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/root/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',args:['--no-sandbox']});
try{
 const context=await browser.newContext({acceptDownloads:true});const page=await context.newPage();
 await page.route('https://tabs.ultimate-guitar.com/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body><h1>Controlled page-data replay</h1></body></html>'}));
 await page.goto(data.tab.tab_url);
 await page.evaluate(s=>{const el=document.createElement('div');el.className='js-store';el.setAttribute('data-content',JSON.stringify(s));document.body.append(el);},store);
 const dl=page.waitForEvent('download');await page.evaluate(bookmarklet().slice('javascript:'.length));const download=await dl;const bytes=await readFile(await download.path(),'utf8');const exported=JSON.parse(bytes);
 assert.equal(exported.schema,'open-chords/v1');assert.equal(exported.song.content,data.tab_view.wiki_tab.content);assert.equal(exported.song.source,data.tab.tab_url);assert.equal(exported.song.author,data.tab.username);
 await page.goto('http://127.0.0.1:4173');await page.locator('.import-trigger').first().click();await page.locator('#tab-file').click();await page.locator('#import-file').setInputFiles({name:'replay.openchords.json',mimeType:'application/json',buffer:Buffer.from(bytes)});await page.locator('#import-submit:not([disabled])').waitFor();await page.locator('#import-submit').click();
 await page.getByRole('heading',{name:data.tab.song_name,exact:true}).waitFor();assert.ok(await page.locator('.sheet-pair').count()>0);assert.equal(await page.locator('#source-meta a').getAttribute('href'),data.tab.tab_url);
 console.log('Controlled UG replay passed: actual retained page-data → bookmark download → import → chord rendering and source attribution. No live site runtime claimed.');
}finally{await browser.close();}
