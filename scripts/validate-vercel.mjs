import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import endpoint from '../api/import/ultimate-guitar.js';

const output='build/vercel-public';
const config=JSON.parse(await readFile('vercel.json','utf8'));
assert.equal(config.outputDirectory,output);
const paths=await readdir(output,{recursive:true});
assert.equal(paths.some(p=>/(^|\/)(server|research|\.openai|api|node_modules)(\/|$)/.test(p)),false,'Only frontend assets belong in the static output');
const html=await readFile(output+'/index.html','utf8');
assert.match(html,/<meta name="robots" content="noindex,nofollow,noarchive">/);
for(const [,path] of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
 if(path==='./'||/^(?:https?:|data:)/.test(path))continue;
 assert.ok((await readFile(output+'/'+path)).byteLength>0,path);
}
for(const file of ['src/app.js','src/importers.js','src/appearance.js','src/collections.js','vendor/chords/engine.mjs','vendor/alphatab/alphaTab.mjs','vendor/alphatab/alphaTab.core.mjs','vendor/alphatab/font/Bravura.woff2','vendor/alphatab/font/Bravura-OFL.txt'])assert.ok((await readFile(output+'/'+file)).byteLength>0,file);
for(const name of ['parse5','entities','chords-db','tonal-chord','tonal-note'])assert.match(await readFile(output+'/licenses/'+name+'.txt','utf8'),/MIT/);
assert.equal(await readFile(output+'/robots.txt','utf8'),'User-agent: *\nDisallow: /\n');
assert.ok(config.headers.some(rule=>rule.source==='/(.*)'&&rule.headers.some(h=>h.key==='X-Robots-Tag'&&h.value.includes('noindex'))));
const engine=await import('../'+output+'/vendor/chords/engine.mjs');
assert.ok(engine.getVoicings('Bm11/Gb').voicings.length>0);

const origin='https://open-chords.example';
const request=(url,headers={})=>new Request(origin+'/api/import/ultimate-guitar',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...headers},body:JSON.stringify({url})});
let response=await endpoint.fetch(new Request(origin+'/api/import/ultimate-guitar'));
assert.equal(response.status,405);
response=await endpoint.fetch(request('https://example.com/'));
assert.equal(response.status,400);assert.equal((await response.json()).error.code,'INVALID_URL');
response=await endpoint.fetch(request('https://tabs.ultimate-guitar.com/tab/1789723',{Origin:'https://other.example'}));
assert.equal(response.status,403);
const originalFetch=globalThis.fetch;
try{
 let calls=0;
 globalThis.fetch=async(url,options)=>{
  calls++;assert.equal(url,'https://tabs.ultimate-guitar.com/tab/1789723');assert.equal(options.redirect,'manual');
  const store={store:{page:{data:{tab:{song_name:'Original deployment test',artist_name:'Open Chords',username:'Open Chords',tonality_name:'C'},tab_view:{wiki_tab:{content:'[Verse]\n[ch]C[/ch]  [ch]G[/ch]\nAn original practice line'},meta:{capo:2,tuning:{value:'E A D G B E'}}}}}}};
  return new Response('<div class="js-store" data-content="'+JSON.stringify(store).replaceAll('&','&amp;').replaceAll('"','&quot;')+'"></div>',{headers:{'Content-Type':'text/html'}});
 };
 response=await endpoint.fetch(request('https://tabs.ultimate-guitar.com/tab/1789723'));
 assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
 const {song}=await response.json();assert.equal(song.title,'Original deployment test');assert.equal(song.capo,2);assert.equal(song.source,'https://tabs.ultimate-guitar.com/tab/1789723');assert.equal(calls,1);
}finally{globalThis.fetch=originalFetch;}
console.log('Vercel deployment validated: isolated static assets, fonts/licenses, crawler directives, chord engine, Web API importer success and rejection paths.');
