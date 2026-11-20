import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {getVoicings,describeChord,tuningFromText,soundingNotes,fingerShape,catalogStats} from '../lib/chord-voicings.js';
import {transposeChord} from '../dist/src/music.js';
import {makeSong} from '../dist/src/importers.js';
const TUNING=[40,45,50,55,59,64];
const pc=n=>(n%12+12)%12;
const NATURAL={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const pitch=s=>pc(NATURAL[s[0]]+(s[1]==='#'?1:s[1]==='b'?-1:0));
const qualities={major:{all:[0,4,7],must:[0,4,7]},minor:{all:[0,3,7],must:[0,3,7]},maj7:{all:[0,4,7,11],must:[0,4,11]},'7':{all:[0,4,7,10],must:[0,4,10]},m7:{all:[0,3,7,10],must:[0,3,10]},'7sus4':{all:[0,5,7,10],must:[0,5,10]},m11:{all:[0,3,7,10,14,17],must:[0,3,10,17]},dim7:{all:[0,3,6,9],must:[0,3,6,9]},maj9:{all:[0,4,7,11,14],must:[0,4,11,14]},m7b5:{all:[0,3,6,10],must:[0,3,6,10]},'7b5':{all:[0,4,6,10],must:[0,4,6,10]},sus2:{all:[0,2,7],must:[0,2,7]}};
import {screenshotChords} from './fixtures/chord-cases.mjs';

function checkFrets(frets,root,quality,bass,steps=0,tuning=TUNING){
 const expected=qualities[quality],tonic=pc(pitch(root)+steps),allowed=new Set(expected.all.map(n=>pc(tonic+n))),required=new Set(expected.must.map(n=>pc(tonic+n)));
 if(bass){allowed.add(pc(pitch(bass)+steps));required.add(pc(pitch(bass)+steps));}
 assert.equal(frets.length,6);assert.ok(frets.every(f=>Number.isInteger(f)&&f>=-1&&f<=18));
 const notes=frets.flatMap((f,i)=>f<0?[]:[tuning[i]+f]),present=new Set(notes.map(pc));assert.ok(notes.length>=3);
 for(const note of present)assert.ok(allowed.has(note),'Unexpected pitch '+note+' in '+frets);
 for(const note of required)assert.ok(present.has(note),'Missing defining pitch '+note+' in '+frets);
 if(bass)assert.equal(pc(Math.min(...notes)),pc(pitch(bass)+steps),'Slash bass must be the lowest sounding note');
 const positive=frets.filter(f=>f>0);assert.ok(!positive.length||Math.max(...positive)-Math.min(...positive)<=3);
}
test('catalog contains 529 named chords and 2,069 source positions',()=>{assert.deepEqual(catalogStats,{chords:529,positions:2069});});
test('every chord from all three screenshots has pitch-correct, bass-correct alternatives',()=>{
 for(const [name,root,quality,bass] of screenshotChords){const result=getVoicings(name);assert.equal(result.status,'ready',name);assert.ok(result.voicings.length>1,name+' needs alternatives');for(const v of result.voicings)checkFrets(v.frets,root,quality,bass);}
});
test('all screenshot chords remain valid across every semitone transposition',()=>{
 const started=performance.now();for(const [name,root,quality,bass] of screenshotChords)for(let steps=1;steps<12;steps++){
  const transposed=transposeChord(name,steps);const result=getVoicings(transposed,{limit:3});assert.equal(result.status,'ready',name+' → '+transposed);for(const v of result.voicings)checkFrets(v.frets,root,quality,bass,steps);
 }
 assert.ok(performance.now()-started<10000,'Bounded generation should remain fast enough for a song guide');
});
test('default common shapes retain accessible open and low-position fingerings',()=>{
 for(const [name,frets] of [['D',[-1,-1,0,2,3,2]],['Dmaj7',[-1,-1,0,2,2,2]],['G',[3,2,0,0,0,3]],['Bm',[-1,2,4,4,3,2]],['G7',[3,2,0,0,0,1]]])assert.deepEqual(getVoicings(name).voicings[0].frets,frets,name);
});
test('enharmonic slash spellings share the same validated voicings and preference key',()=>{
 const sharp=getVoicings('E/G#'),flat=getVoicings('E/Ab');assert.equal(sharp.key,flat.key);assert.deepEqual(sharp.voicings.map(v=>v.id),flat.voicings.map(v=>v.id));
 assert.equal(getVoicings('C#m7').key,getVoicings('Dbm7').key);
});
test('generated fallback covers slash chords and reports omitted optional extensions',()=>{
 const r=getVoicings('Bm11/Gb');assert.ok(r.voicings.some(v=>v.source==='generated'));assert.ok(r.voicings.some(v=>v.omitted.includes('C#')));
 assert.ok(describeChord('G7b5/A').requiredMask&(1<<1),'Altered fifth Db must be retained');
});
test('fingerings and barres respect open strings, fretted notes and a four-finger budget',()=>{
 assert.equal(fingerShape([1,2,3,4,1,2]),null);
 for(const [name] of screenshotChords)for(const v of getVoicings(name).voicings){
  assert.ok(v.fingerCount<=4);for(let i=0;i<6;i++){assert.equal(v.fingers[i]>0,v.frets[i]>0);assert.ok(v.fingers[i]>=0&&v.fingers[i]<=4);}
  for(const b of v.barres){assert.ok(b.from<b.to);assert.equal(v.frets[b.from],b.fret);assert.equal(v.frets[b.to],b.fret);assert.ok(v.frets.slice(b.from,b.to+1).every(f=>f>=b.fret),'Barre must not cover a sounding open string');}
 }
});
test('recognizes alternate tuning and generates voicings for its actual pitches',()=>{
 const drop=tuningFromText('Drop D'),explicit=tuningFromText('D A D G B E');assert.deepEqual(drop.midi,[38,45,50,55,59,64]);assert.deepEqual(explicit.midi,drop.midi);
 assert.deepEqual(tuningFromText('Standard · E A D G B E').midi,TUNING);assert.equal(tuningFromText('Unknown tuning'),null);
 assert.deepEqual(tuningFromText('DADGAD').midi,[38,45,50,55,57,62]);
 for(const tuning of [drop,tuningFromText('DADGAD')]){const result=getVoicings('D',{tuning:tuning.midi});assert.equal(result.status,'ready');for(const v of result.voicings){checkFrets(v.frets,'D','major',null,0,tuning.midi);assert.equal(v.source,'generated');}}
});
test('capo-relative fret limits exclude positions beyond the remaining neck',()=>{
 const r=getVoicings('Bm7',{maxFret:12});assert.ok(r.voicings.length>0);for(const v of r.voicings)assert.ok(v.frets.every(f=>f<=12));
});
test('unknown symbols and unavailable hand positions return explicit empty states',()=>{
 for(const symbol of ['N.C.','Bridge','Cnotachord','<script>','C'.repeat(100)])assert.equal(getVoicings(symbol).status,'unknown');
 const r=getVoicings('F#',{maxFret:0});assert.equal(r.status,'unavailable');assert.deepEqual(r.voicings,[]);
});
test('common text aliases and parenthesized alterations are interpreted',()=>{for(const c of ['C7(b9)','C6/9','Cm(maj7)','Fø7','GΔ7'])assert.ok(describeChord(c),c);});
test('chosen fingerings roundtrip through song exports, backups and validation',()=>{
 const result=getVoicings('Dmaj7');const input={title:'Own sheet',content:'[Dmaj7]Original',fingerings:{[result.key]:result.voicings[1].id}};
 const song=makeSong(input);assert.deepEqual(song.fingerings,input.fingerings);assert.deepEqual(makeSong(JSON.parse(JSON.stringify(song))).fingerings,input.fingerings);
 assert.deepEqual(makeSong({...input,fingerings:{'unsafe<script>':'-1,0,2,2,2,0',valid:'not frets'}}).fingerings,{});
});
