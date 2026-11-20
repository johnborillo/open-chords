import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeUgUrl,extractUgSong,importUltimateGuitar,handleUgImport,PAGE_LIMIT} from '../server/ug-import.js';
const URL1='https://tabs.ultimate-guitar.com/tab/open-chords/original-sheet-chords-123456';
const URL2='https://tabs.ultimate-guitar.com/tab/open-chords/original-sheet-chords-654321';
const sample={store:{page:{data:{tab:{song_name:'Original Link Test',artist_name:'Open Chords',tonality_name:'C',username:'Original Author'},tab_view:{wiki_tab:{content:'[Verse]\n[ch]C[/ch]    [ch]G/B[/ch]\nAn original test line'},meta:{capo:2,tuning:{value:'E A D G B E'}}}}}}};
const escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const html=(data=sample)=>'<!doctype html><script>throw Error("never execute")</script><div data-content="'+escape(JSON.stringify(data))+'" class="page js-store other"></div>';
const response=(text=html(),status=200,headers={})=>new Response(text,{status,headers:{'Content-Type':'text/html; charset=utf-8',...headers}});
const request=(url=URL1,extra={})=>new Request('https://openchords.example/api/import/ultimate-guitar',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://openchords.example'},body:JSON.stringify({url}),...extra});
test('normalizes real sheet URLs and removes tracking without changing the version',()=>{
 assert.equal(normalizeUgUrl(URL1+'/?utm_source=test#section'),URL1);
 assert.equal(normalizeUgUrl(URL1.replace('https://','')),URL1);
 assert.equal(normalizeUgUrl(URL1.replace('https://tabs.','http://www.')),URL1);
});
test('rejects arbitrary hosts, credentials, ports, protocols, search pages, encoded paths, and spoofed hosts before fetching',async()=>{
 for(const url of ['http://127.0.0.1/','https://169.254.169.254/latest/meta-data','https://tabs.ultimate-guitar.com.evil.example/tab/a/b-1','https://evil.example@tabs.ultimate-guitar.com/tab/a/b-1','https://tabs.ultimate-guitar.com:444/tab/a/b-1','file:///etc/passwd','https://tabs.ultimate-guitar.com/search.php?q=test','https://tabs.ultimate-guitar.com/tab/a/%2e%2e/private-1','https://tabs.ultimate-guitar.com/tab/a/b-1/../../api.php','https://tabs.ultimate-guitar.com./tab/a/b-1']){
  let called=false;await assert.rejects(()=>importUltimateGuitar(url,{fetchImpl:async()=>{called=true;return response();}}),e=>e.code==='INVALID_URL');assert.equal(called,false,url);
 }
});
test('parses HTML entities and attribute order without running scripts; preserves chord metadata and authorship',()=>{
 const song=extractUgSong(html(),URL1);assert.equal(song.title,'Original Link Test');assert.equal(song.capo,2);assert.equal(song.key,'C');assert.equal(song.author,'Original Author');assert.equal(song.source,URL1);assert.match(song.content,/G\/B/);
 const single="<div data-content='"+escape(JSON.stringify(sample))+"' class='js-store'></div>";assert.equal(extractUgSong(single,URL1).title,song.title);
 assert.throws(()=>extractUgSong('<div>captcha</div>',URL1),e=>e.code==='NO_SHEET');
 assert.throws(()=>extractUgSong('<div class="js-store" data-content="broken"></div>',URL1),e=>e.code==='PAGE_CHANGED');
});
test('fetches one public page with no caller cookies, authorization, or automatic redirects',async()=>{
 let seen;const song=await importUltimateGuitar(URL1,{fetchImpl:async(url,options)=>{seen={url,options};return response();}});
 assert.equal(song.source,URL1);assert.equal(seen.url,URL1);assert.equal(seen.options.redirect,'manual');assert.ok(seen.options.signal instanceof AbortSignal);assert.equal(seen.options.headers.Cookie,undefined);assert.equal(seen.options.headers.Authorization,undefined);
});
test('follows only validated same-host sheet redirects and retains the final source',async()=>{
 const urls=[];const song=await importUltimateGuitar(URL1,{fetchImpl:async url=>{urls.push(url);return urls.length===1?response('',302,{Location:URL2}):response();}});assert.deepEqual(urls,[URL1,URL2]);assert.equal(song.source,URL2);
});
test('does not follow cross-host, private-host, credentialed, non-HTTPS, or alternate-port redirects',async()=>{
 for(const location of ['http://127.0.0.1/tab/a/b-1','https://169.254.169.254/tab/a/b-1','https://evil.example/tab/a/b-1','https://user:pass@tabs.ultimate-guitar.com/tab/a/b-1','https://tabs.ultimate-guitar.com:444/tab/a/b-1','http://tabs.ultimate-guitar.com/tab/a/b-1']){
  let calls=0;await assert.rejects(()=>importUltimateGuitar(URL1,{fetchImpl:async()=>{calls++;return response('',302,{Location:location});}}),e=>e.code==='REDIRECT_BLOCKED');assert.equal(calls,1);
 }
});
test('bounds redirect loops',async()=>{
 let calls=0;await assert.rejects(()=>importUltimateGuitar(URL1,{fetchImpl:async()=>{calls++;return response('',302,{Location:URL1});}}),e=>e.code==='REDIRECT_FAILED');assert.equal(calls,4);
});
test('maps blocking, not-found, non-HTML and network failures to actionable errors',async()=>{
 for(const status of [401,403,429,503])await assert.rejects(()=>importUltimateGuitar(URL1,{fetchImpl:async()=>response('blocked',status)}),e=>e.code==='SOURCE_BLOCKED'&&e.message.includes('export bookmark'));
 await assert.rejects(()=>importUltimateGuitar(URL1,{fetchImpl:async()=>response('',404)}),e=>e.code==='NOT_FOUND');
 await assert.rejects(()=>importUltimateGuitar(URL1,{fetchImpl:async()=>response('{}',200,{'Content-Type':'application/json'})}),e=>e.code==='NOT_HTML');
 await assert.rejects(()=>importUltimateGuitar(URL1,{fetchImpl:async()=>{throw Error('private diagnostic must not escape');}}),e=>e.code==='FETCH_FAILED'&&!e.message.includes('private diagnostic'));
});
test('stops oversized HTML from both content-length and chunked responses',async()=>{
 await assert.rejects(()=>importUltimateGuitar(URL1,{fetchImpl:async()=>response('',200,{'Content-Length':String(PAGE_LIMIT+1)})}),e=>e.code==='TOO_LARGE');
 await assert.rejects(()=>importUltimateGuitar(URL1,{fetchImpl:async()=>response('x'.repeat(PAGE_LIMIT+1))}),e=>e.code==='TOO_LARGE');
});
test('aborts timed-out fetches',async()=>{
 await assert.rejects(()=>importUltimateGuitar(URL1,{timeoutMs:5,fetchImpl:(_url,{signal})=>new Promise((_resolve,reject)=>{signal.addEventListener('abort',()=>reject(new DOMException('Abort','AbortError')),{once:true});})}),e=>e.code==='TIMEOUT');
});
test('POST endpoint returns only normalized song data and never caches imported content',async()=>{
 const res=await handleUgImport(request(),{fetchImpl:async()=>response()});assert.equal(res.status,200);assert.equal(res.headers.get('Cache-Control'),'no-store');const body=await res.json();assert.equal(body.schema,'open-chords/v1');assert.equal(body.song.source,URL1);assert.equal(body.store,undefined);
});
test('POST endpoint rejects invalid methods, cross-origin requests, malformed and oversized bodies',async()=>{
 const options={fetchImpl:async()=>{throw Error('must not fetch');}};
 assert.equal((await handleUgImport(new Request('https://openchords.example/api/import/ultimate-guitar'),options)).status,405);
 assert.equal((await handleUgImport(request(URL1,{headers:{'Content-Type':'application/json',Origin:'https://evil.example'}}),options)).status,403);
 assert.equal((await handleUgImport(request(URL1,{headers:{'Content-Type':'text/plain'}}),options)).status,415);
 assert.equal((await handleUgImport(request(URL1,{body:'{broken'}),options)).status,400);
 assert.equal((await handleUgImport(request(URL1,{body:'x'.repeat(4097)}),options)).status,413);
 assert.equal((await handleUgImport(request('https://127.0.0.1/'),options)).status,400);
});
test('POST endpoint exposes a safe fallback on upstream blocks and missing annotations',async()=>{
 const blocked=await handleUgImport(request(),{fetchImpl:async()=>response('',403)});assert.equal(blocked.status,422);assert.equal((await blocked.json()).error.code,'SOURCE_BLOCKED');
 const pro=structuredClone(sample);delete pro.store.page.data.tab_view.wiki_tab;
 const missing=await handleUgImport(request(),{fetchImpl:async()=>response(html(pro))});assert.equal(missing.status,422);assert.equal((await missing.json()).error.code,'NO_SHEET');
});

test('accepts numeric UG share links with optional trailing slash and tracking',()=>{
 const short='https://tabs.ultimate-guitar.com/tab/1789723';
 for(const input of [short,short+'/',short+'?utm_source=share#intro','tabs.ultimate-guitar.com/tab/1789723','https://www.ultimate-guitar.com/tab/1789723'])assert.equal(normalizeUgUrl(input),short);
 for(const input of [short+'/extra','https://tabs.ultimate-guitar.com/tab/1789723abc','https://tabs.ultimate-guitar.com/tab/-1789723','https://tabs.ultimate-guitar.com/tab/0','https://tabs.ultimate-guitar.com/tab/1789723/../../api.php'])assert.throws(()=>normalizeUgUrl(input),e=>e.code==='INVALID_URL');
});
test('imports a numeric share link that returns the sheet directly',async()=>{
 const short='https://tabs.ultimate-guitar.com/tab/1789723';let fetched;
 const result=await handleUgImport(request(short),{fetchImpl:async url=>{fetched=url;return response();}});
 assert.equal(result.status,200);assert.equal(fetched,short);const {song}=await result.json();assert.equal(song.title,'Original Link Test');assert.equal(song.source,short);assert.equal(song.author,'Original Author');
});
test('validates redirects between numeric and full song links',async()=>{
 const short='https://tabs.ultimate-guitar.com/tab/1789723';
 for(const [from,to] of [[short,URL1],[URL1,short]]){
  const visited=[];const song=await importUltimateGuitar(from,{fetchImpl:async url=>{visited.push(url);return visited.length===1?response('',302,{Location:to}):response();}});
  assert.deepEqual(visited,[from,to]);assert.equal(song.source,to);
 }
 let calls=0;await assert.rejects(()=>importUltimateGuitar(short,{fetchImpl:async()=>{calls++;return response('',302,{Location:'https://127.0.0.1/tab/1789723'});}}),e=>e.code==='REDIRECT_BLOCKED');assert.equal(calls,1);
});
