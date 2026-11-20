import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/root/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173');await page.locator('#song-title').waitFor();
 const open=()=>page.getByRole('button',{name:'Settings',exact:true}).click();
 const close=()=>page.getByRole('button',{name:'Close settings',exact:true}).click();
 const palette=id=>page.locator('.theme-choice').filter({has:page.locator('input[value="'+id+'"]')});
 const mode=id=>page.locator('.mode-options label').filter({has:page.locator('input[value="'+id+'"]')});
 assert.equal(await page.locator('.sidebar #backup,.sidebar #restore,#theme').count(),0);
 await open();assert.equal(await page.getByRole('dialog',{name:'Settings',exact:true}).count(),1);
 assert.equal(await page.locator('[name="theme-palette"]').count(),4);
 const backgrounds=new Set();
 for(const theme of ['sage','tide','dusk','amber']){
  await palette(theme).click();
  for(const appearance of ['dark','light']){
   await mode(appearance).click();
   assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
   assert.equal(await page.locator('[name="color-mode"]:checked').inputValue(),appearance);
   const colors=await page.evaluate(()=>{const s=getComputedStyle(document.body);return {bg:s.backgroundColor,text:s.color,mode:s.colorScheme,meta:document.querySelector('meta[name="theme-color"]').content,root:getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()};});
   backgrounds.add(colors.bg);assert.notEqual(colors.bg,colors.text);assert.equal(colors.mode,appearance);assert.equal(colors.meta,colors.root);

  }
 }
 assert.equal(backgrounds.size,8);
 await page.screenshot({path:'/tmp/open-chords-settings-amber-light.png'});
 await close();await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'amber');assert.equal(await page.locator('html').getAttribute('class'),'light');
 await open();assert.equal(await page.locator('[name="theme-palette"]:checked').inputValue(),'amber');
 assert.equal(await page.locator('[name="theme-palette"][value="ultimate-guitar"]').count(),0);
 await palette('dusk').click();await mode('dark').click();
 await page.waitForTimeout(200);await page.screenshot({path:'/tmp/open-chords-settings-desktop.png'});
 const downloadEvent=page.waitForEvent('download');await page.locator('#backup').click();const download=await downloadEvent;
 const backup=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(backup.schema,'open-chords-library/v1');assert.equal(backup.songs.length,2);
 await page.getByRole('status').filter({hasText:'Library backup downloaded.'}).first().waitFor();
 const restore=async data=>page.locator('#restore-file').setInputFiles({name:'library.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
 await restore({schema:'wrong',songs:[]});await page.locator('#settings-status').filter({hasText:'Choose an Open Chords library backup.'}).waitFor();
 await restore({schema:backup.schema,songs:[...backup.songs,{...backup.songs[0],id:'restored-original',title:'Restored original'}]});
 await page.locator('#settings-status').filter({hasText:'Library restored.'}).waitFor();assert.equal(await page.locator('.song-link').count(),3);
 await restore(backup);await page.locator('#settings-status').filter({hasText:'Library restored.'}).waitFor();assert.equal(await page.locator('.song-link').count(),3);
 // Native dialog traps keyboard focus and Escape returns it to the settings trigger.
 await page.locator('#settings-dialog .primary').focus();await page.locator('#edit').evaluate(n=>n.focus());assert.equal(await page.evaluate(()=>document.querySelector('#settings-dialog').contains(document.activeElement)),true);
 // Chromium cycles through the browser/body and the scrollable dialog before its first control.
 for(let i=0;i<3;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement===document.body||document.querySelector('#settings-dialog').contains(document.activeElement)),true);}
 assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Close settings');
 await page.keyboard.press('Escape');assert.equal(await page.locator('#settings-dialog').evaluate(n=>n.open),false);assert.equal(await page.locator('#settings').evaluate(n=>n===document.activeElement),true);
 await page.setViewportSize({width:390,height:844});await open();await page.waitForTimeout(200);await page.screenshot({path:'/tmp/open-chords-settings-mobile.png'});
 for(const width of [320,390,768]){
  await page.setViewportSize({width,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.locator('#settings-dialog').evaluate(n=>n.scrollWidth<=n.clientWidth),true);
 }
 await close();await page.reload();await open();assert.equal(await page.locator('[name="theme-palette"]:checked').inputValue(),'dusk');assert.equal(await page.locator('[name="color-mode"]:checked').inputValue(),'dark');
 // Existing users keep the former light mode; unsupported saved values recover.
 await page.evaluate(()=>localStorage.setItem('open-chords/preferences/v1',JSON.stringify({theme:'light',fontSize:19})));
 await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'sage');assert.equal(await page.locator('#sheet').evaluate(n=>getComputedStyle(n).fontSize),'19px');await open();assert.equal(await page.locator('[name="color-mode"]:checked').inputValue(),'light');
 await page.evaluate(()=>localStorage.setItem('open-chords/preferences/v1',JSON.stringify({theme:'ultimate-guitar',mode:'light',fontSize:19})));
 await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'sage');assert.equal(await page.locator('#sheet').evaluate(n=>getComputedStyle(n).fontSize),'19px');await open();assert.equal(await page.locator('[name="color-mode"]:checked').inputValue(),'light');
 await page.evaluate(()=>localStorage.setItem('open-chords/preferences/v1','{bad json'));await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'sage');assert.ok((await page.locator('#song-title').textContent()).length>0);
 await open();await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('Storage unavailable');};});await palette('amber').click();await page.locator('#settings-status').filter({hasText:'last for this session'}).waitFor();assert.equal(await page.locator('html').getAttribute('data-theme'),'amber');
 assert.deepEqual(errors,[]);
 console.log('Settings browser checks passed: four palettes × two modes, persistent choices, migration, native dialog keyboard/focus, backup/restore merge and visible errors, 320–1440px layouts, retired-theme migration.');
}finally{await browser.close();}
