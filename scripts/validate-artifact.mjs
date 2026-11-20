import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../dist/server/index.js';
const manifest=JSON.parse(await readFile('dist/.openai/hosting.json','utf8'));
assert.equal(manifest.project_id,'appgprj_6af91e76548481919db7d772b40db2a0');assert.equal(manifest.static,undefined);assert.equal(typeof worker.fetch,'function');
for(const [pathname,type] of [['/','text/html'],['/styles.css','text/css'],['/themes.css','text/css'],['/library.css','text/css'],['/src/collections.js','text/javascript'],['/src/appearance.js','text/javascript'],['/src/app.js','text/javascript'],['/vendor/chords/engine.mjs','text/javascript'],['/vendor/alphatab/alphaTab.mjs','text/javascript'],['/vendor/alphatab/alphaTab.core.mjs','text/javascript'],['/vendor/alphatab/font/Bravura.woff2','font/woff2']]){const response=await worker.fetch(new Request('https://openchords.example'+pathname));assert.equal(response.status,200,pathname);assert.ok(response.headers.get('Content-Type').includes(type));assert.ok((await response.arrayBuffer()).byteLength>0);}
const bad=await worker.fetch(new Request('https://openchords.example/api/import/ultimate-guitar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:'https://example.com/'})}));assert.equal(bad.status,400);assert.equal((await bad.json()).error.code,'INVALID_URL');
const missing=await worker.fetch(new Request('https://openchords.example/server/index.js'));assert.equal(missing.status,404);
const engine=await import('../dist/vendor/chords/engine.mjs');assert.ok(engine.getVoicings('Bm11/Gb').voicings.length>0);
for(const name of ['chords-db','tonal-chord','tonal-note']){const response=await worker.fetch(new Request('https://openchords.example/licenses/'+name+'.txt'));assert.equal(response.status,200);assert.match(await response.text(),/MIT/);}
console.log('Worker artifact validated: reader assets, Guitar Pro runtime/font, direct-link API, no exposed server bundle.');

for(const pathname of ['/vendor/themes/Oswald.ttf','/vendor/themes/Oswald-OFL.txt'])assert.equal((await worker.fetch(new Request('https://openchords.example'+pathname))).status,404);
for(const pathname of ['/themes.css','/src/appearance.js'])assert.doesNotMatch(await (await worker.fetch(new Request('https://openchords.example'+pathname))).text(),/ultimate-guitar|Oswald/);
const home=await worker.fetch(new Request('https://openchords.example/'));
assert.match(home.headers.get('X-Robots-Tag'),/noindex/);
assert.match(await home.text(),/<meta name="robots" content="noindex,nofollow,noarchive">/);
for(const method of ['GET','HEAD']){
 const response=await worker.fetch(new Request('https://openchords.example/robots.txt',{method}));assert.equal(response.status,200);
 assert.match(response.headers.get('Content-Type'),/text\/plain/);
 assert.equal(await response.text(),method==='HEAD'?'':'User-agent: *\nDisallow: /\n');
}
console.log('Public-link checks passed: crawler directives, retired theme/assets removed.');
