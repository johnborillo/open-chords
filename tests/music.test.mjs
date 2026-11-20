import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
import {parseSheet,transposeChord,plainText,chordPro,uniqueChords} from '../dist/src/music.js';
import {importText,fromUgStore,makeSong,bookmarklet} from '../dist/src/importers.js';
import {loadGuitarPro} from '../dist/src/guitar-pro.js';
const dom=new JSDOM('<!doctype html>',{url:'https://openchords.example'});globalThis.document=dom.window.document;
test('transposes roots and bass notes without changing extensions',()=>{
 assert.equal(transposeChord('D/F#',2),'E/G#');assert.equal(transposeChord('Bbmaj7/D',-2,'flats'),'Abmaj7/C');
 assert.equal(transposeChord('F#m7b5',1),'Gm7b5');assert.equal(transposeChord('C7(b9)',2),'D7(b9)');
 assert.equal(transposeChord('B',1),'C');assert.equal(transposeChord('Cb',-1,'flats'),'Bb');
 assert.equal(transposeChord('N.C.',8),'N.C.');assert.equal(transposeChord('Bridge',3),'Bridge');
 assert.equal(transposeChord('C/E',-25),'B/D#');assert.equal(transposeChord('C6/9',2),'D6/9');assert.equal(transposeChord('G7alt',2),'A7alt');assert.equal(transposeChord('Cb',0),'Cb');
});
test('every note transposes over complete octave cycles',()=>{
 for(const c of ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'])for(let i=-24;i<=24;i++){
  assert.equal(transposeChord(transposeChord(c,i,'flats'),-i,'flats'),c);
 }
});
test('parses UG marked chord-over-lyric lines preserving columns',()=>{
 const {rows}=parseSheet('[Verse]\n[tab][ch]G[/ch]    [ch]D/F#[/ch]\nTime carries on[/tab]');
 assert.equal(rows[0].kind,'section');assert.equal(rows[1].kind,'pair');assert.deepEqual(rows[1].chords,[{chord:'G',column:0},{chord:'D/F#',column:5}]);assert.equal(rows[1].text,'Time carries on');
 assert.match(plainText(rows,2),/A    E\/G#\nTime carries on/);
});
test('ChordPro roundtrip preserves lyrics, sections, metadata and bass notes',()=>{
 const original='{title: My Song}\n{key: C}\n[Chorus]\n[C]Take a [G/B]breath\n\nAm    F';
 const {rows,metadata}=parseSheet(original);assert.equal(metadata.title,'My Song');assert.equal(metadata.key,'C');
 const shifted=chordPro(rows,2);assert.match(shifted,/\[D\]Take a \[A\/C#\]breath/);assert.deepEqual(uniqueChords(parseSheet(shifted).rows),['D','A/C#','Bm','G']);
 assert.deepEqual(parseSheet(chordPro(rows)).rows,rows);
});
test('does not transpose lyrics or tablature',()=>{
 const {rows}=parseSheet('[Verse]\nA song about B and C\ne|--0--2--3--|\nB|--1--------|');
 assert.equal(plainText(rows,5),'[Verse]\nA song about B and C\ne|--0--2--3--|\nB|--1--------|');
});
const ug={store:{page:{data:{tab:{song_name:'Original Test',artist_name:'Open Chords',tonality_name:'C',username:'Tester',tab_url:'https://tabs.ultimate-guitar.com/tab/test'},tab_view:{wiki_tab:{content:'[Verse]\n[ch]C[/ch]    [ch]G/B[/ch]\nA brand new song'},meta:{capo:2,tuning:{value:'E A D G B E'}}}}}}};
test('imports observed UG data shape as inert HTML with attribution',()=>{
 const html='<html><script>throw Error("must not execute")</script><div class="js-store" data-content="'+JSON.stringify(ug).replaceAll('&','&amp;').replaceAll('"','&quot;')+'"></div></html>';
 const s=importText(html);assert.equal(s.title,'Original Test');assert.equal(s.capo,2);assert.equal(s.author,'Tester');assert.equal(s.source,'https://tabs.ultimate-guitar.com/tab/test');assert.equal(s.key,'C');
 assert.throws(()=>fromUgStore({tab_view:{wiki_tab:{content:''}}}),/No chord sheet/);
});
test('Open Chords exports reimport with source, capo and content',()=>{
 const s=makeSong({title:'Own sheet',content:'[C]Original [G]words',source:'javascript:alert(1)',capo:99});assert.equal(s.source,'');assert.equal(s.capo,0);
 const copy=importText(JSON.stringify({schema:'open-chords/v1',song:s}));assert.equal(copy.title,s.title);assert.equal(copy.content,s.content);assert.notEqual(copy.id,s.id);assert.equal(importText('{title: Authored title}\n[C]Our own words','file.cho').title,'Authored title');
});
test('rejects empty, unrecognized JSON and oversized input',()=>{
 assert.throws(()=>importText(''),/Add a chord sheet/);assert.throws(()=>importText('{"secret":"no"}'),/not an Open Chords/);assert.throws(()=>importText('x'.repeat(2*1024*1024+1)),/under 2 MB/);
});
test('bookmarklet validates site and exports only sheet fields',()=>{
 const code=bookmarklet();assert.ok(code.startsWith('javascript:'));assert.ok(code.includes('tabs.ultimate-guitar.com'));assert.ok(code.includes('open-chords/v1'));assert.ok(!code.includes('fetch('));assert.ok(!code.includes('cookie'));
});
test('real Guitar Pro file yields named chord annotations, capo and tuning',async()=>{
 const {parts,score}=await loadGuitarPro(new Uint8Array(await readFile(new URL('./fixtures/original-demo.gp',import.meta.url))));
 assert.equal(score.title,'Open Chords GP Demo');assert.equal(parts[0].count,4);assert.equal(parts[0].song.capo,2);assert.equal(parts[0].song.tuning,'E A D G B E');assert.deepEqual(uniqueChords(parseSheet(parts[0].song.content).rows),['C','G/B','Am7','Fmaj7']);
});
test('rejects invalid scores with a useful error',async()=>{await assert.rejects(()=>loadGuitarPro(new Uint8Array([1,2,3])),/could not be read/);});

test('a score without annotations remains a score with no invented chords',async()=>{
 const {score,alpha}=await loadGuitarPro(new Uint8Array(await readFile(new URL('./fixtures/original-demo.gp',import.meta.url))));
 for(const track of score.tracks)for(const staff of track.staves){staff.chords.clear();for(const bar of staff.bars)for(const voice of bar.voices)for(const beat of voice.beats)beat.chordId=null;}
 const bytes=new alpha.exporter.Gp7Exporter().export(score);const result=await loadGuitarPro(bytes);assert.equal(result.parts[0].count,0);assert.equal(result.parts[0].song,null);assert.ok(result.score.tracks.length>0);
});
