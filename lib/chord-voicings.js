import guitar from '@tombatossals/chords-db/lib/guitar.json' with {type:'json'};
import {get as getChord} from '@tonaljs/chord';
import {chroma} from '@tonaljs/note';

export const STANDARD_TUNING=Object.freeze([40,45,50,55,59,64]);
const mod=n=>(n%12+12)%12;
const bit=pc=>1<<pc;
const count=mask=>{let n=0;for(;mask;mask&=mask-1)n++;return n;};
const keyOf=frets=>frets.join(',');
const sameTuning=tuning=>tuning.every((n,i)=>n===STANDARD_TUNING[i]);
const cache=new Map();

export function tuningFromText(text=''){
 const raw=String(text).trim();
 if(!raw||/^standard$/i.test(raw))return {midi:[...STANDARD_TUNING],standard:true,label:'E A D G B E'};
 if(/^drop d$/i.test(raw))return {midi:[38,45,50,55,59,64],standard:false,label:'D A D G B E'};
 let tokens=raw.split(/[\s·,()/]+/).filter(s=>/^[A-G][#b♯♭]?(?:[0-8])?$/.test(s));
 if(tokens.length!==6&&/^(?:[A-G][#b♯♭]?){6}$/.test(raw))tokens=raw.match(/[A-G][#b♯♭]?/g);
 if(tokens.length!==6)return null;
 const midi=tokens.map((s,i)=>{const pc=chroma(s.replaceAll('♯','#').replaceAll('♭','b'));if(pc===null)return NaN;const octave=/([0-8])$/.exec(s);return octave?12*(Number(octave[1])+1)+pc:STANDARD_TUNING[i]+mod(pc-STANDARD_TUNING[i]+6)-6;});
 if(midi.some(n=>!Number.isFinite(n)))return null;
 return {midi,standard:sameTuning(midi),label:tokens.join(' ')};
}

export function describeChord(symbol){
 if(typeof symbol!=='string'||symbol.length>80)return null;
 const text=symbol.trim().replaceAll('♯','#').replaceAll('♭','b');
 const match=/^([A-G](?:##|bb|#|b)?)(.*?)(?:\/([A-G](?:##|bb|#|b)?))?$/.exec(text);
 if(!match)return null;
 const [,tonic,quality,bass]=match;
 // Parenthesized alterations are common in text sheets, while Tonal uses C7b9.
 const suffix=quality.replace(/[(),]/g,'').replace(/^mmaj/,'mMaj').replace(/^min/,'m');
 const normalized=suffix.replace(/^ø7?$/,'m7b5').replace(/^Δ(?=[0-9])/,'maj');
 const chord=getChord(tonic+normalized);
 if(chord.empty||!chord.notes.length)return null;
 const tonicPc=chroma(tonic),bassPc=bass?chroma(bass):null;
 if(tonicPc===null||(bass&&bassPc===null))return null;
 const degrees=chord.intervals.map(i=>Number.parseInt(i,10));const top=Math.max(...degrees);
 let allowedMask=0,requiredMask=0;
 const tones=chord.notes.map((note,i)=>{
  const pc=chroma(note);allowedMask|=bit(pc);
  const interval=chord.intervals[i];
  // Preserve defining thirds/suspensions, sevenths and extensions. An unaltered
  // fifth may be omitted in larger chords; a ninth may be omitted below an 11/13.
  const optional=(interval==='5P'&&chord.notes.length>=4)||(degrees[i]===9&&top>=11)||(degrees[i]===11&&top>=13&&interval==='11P');
  if(!optional)requiredMask|=bit(pc);
  return {name:note,pc,interval,optional};
 });
 if(bassPc!==null){allowedMask|=bit(bassPc);requiredMask|=bit(bassPc);}
 return {symbol,tonic,tonicPc,bass:bass||'',bassPc,quality:chord.type||quality||'major',tones,allowedMask,requiredMask};
}

export function soundingNotes(frets,tuning=STANDARD_TUNING){
 return frets.flatMap((f,i)=>f<0?[]:[tuning[i]+f]);
}
export function fingerShape(frets){
 const fingers=Array(6).fill(0),barres=[];
 const levels=[...new Set(frets.filter(f=>f>0))].sort((a,b)=>a-b);let finger=0;
 for(const fret of levels){
  const contacts=frets.flatMap((f,i)=>f===fret?[i]:[]);
  for(let k=0;k<contacts.length;){
   const from=contacts[k];let end=k;
   while(end+1<contacts.length&&frets.slice(from,contacts[end+1]+1).every(f=>f>=fret))end++;
   if(++finger>4)return null;
   for(let j=k;j<=end;j++)fingers[contacts[j]]=finger;
   if(end>k)barres.push({fret,from,to:contacts[end],finger});
   k=end+1;
  }
 }
 return {fingers,barres,fingerCount:finger};
}
export function matchesChord(frets,description,tuning=STANDARD_TUNING,maxFret=18){
 if(!description||!Array.isArray(frets)||frets.length!==6||frets.some(f=>!Number.isInteger(f)||f< -1||f>maxFret))return false;
 const notes=soundingNotes(frets,tuning);if(notes.length<3)return false;
 let mask=0;for(const n of notes)mask|=bit(mod(n));
 if((mask&description.requiredMask)!==description.requiredMask||(mask&~description.allowedMask)!==0)return false;
 if(description.bassPc!==null&&mod(Math.min(...notes))!==description.bassPc)return false;
 const positive=frets.filter(f=>f>0);if(positive.length&&Math.max(...positive)-Math.min(...positive)>3)return false;
 return !!fingerShape(frets);
}

function catalogHand(frets,sourceFingers){
 if(!Array.isArray(sourceFingers)||sourceFingers.length!==6)return fingerShape(frets);
 const fingers=sourceFingers.map((f,i)=>frets[i]>0?f:0),barres=[];
 if(fingers.some((f,i)=>!Number.isInteger(f)||f<0||f>4||(frets[i]>0&&!f)))return fingerShape(frets);
 for(let finger=1;finger<=4;finger++){
  const contacts=fingers.flatMap((f,i)=>f===finger?[i]:[]);if(contacts.length<2)continue;
  const from=contacts[0],to=contacts.at(-1),fret=frets[from];
  if(contacts.some(i=>frets[i]!==fret)||frets.slice(from,to+1).some(f=>f<fret))return fingerShape(frets);
  barres.push({fret,from,to,finger});
 }
 return {fingers,barres,fingerCount:new Set(fingers.filter(Boolean)).size};
}
const catalog=new Map();const catalogSeen=new Set();
for(const chord of Object.values(guitar.chords).flat())for(const position of chord.positions){
 const absolute=position.frets.map(f=>f>0?f+(position.baseFret||1)-1:f);
 // Prefix muting also exposes useful root-position shapes and slash basses.
 for(let trim=0;trim<=3;trim++){
  const frets=absolute.map((f,i)=>i<trim?-1:f),id=keyOf(frets);
  if(catalogSeen.has(id)||soundingNotes(frets).length<3)continue;
  const hand=catalogHand(frets,position.fingers);if(!hand)continue;
  catalogSeen.add(id);let mask=0;for(const n of soundingNotes(frets))mask|=bit(mod(n));
  const entry={frets,...hand,source:'catalog',id};
  if(!catalog.has(mask))catalog.set(mask,[]);catalog.get(mask).push(entry);
 }
}
export const catalogStats=Object.freeze({chords:Object.values(guitar.chords).flat().length,positions:guitar.main.numberOfChords});

function rank(voicing,description,tuning){
 const {frets,fingerCount}=voicing,positive=frets.filter(f=>f>0),min=positive.length?Math.min(...positive):0,max=positive.length?Math.max(...positive):0;
 let mask=0;const notes=soundingNotes(frets,tuning);for(const n of notes)mask|=bit(mod(n));
 const first=frets.findIndex(f=>f>=0),last=frets.findLastIndex(f=>f>=0);
 const innerMutes=frets.slice(first,last+1).filter(f=>f<0).length;
 const inversion=description.bassPc===null&&mod(Math.min(...notes))!==description.tonicPc;
 return min*.65+max*.18+(max-min)*.5+fingerCount*.9+frets.filter(f=>f<0).length*.35+innerMutes*3-frets.filter(f=>f===0).length*.35-notes.length*1.1+(inversion?5:0)+count(description.allowedMask&~mask)*.7+(voicing.source==='catalog'?-.3:0);
}
function generate(description,tuning,maxFret){
 const results=[],seen=new Set();const frets=Array(6).fill(-1);
 for(let start=1;start<=Math.max(1,maxFret-2);start++){
  const end=Math.min(maxFret,start+3);
  const choices=tuning.map(pitch=>{
   const opts=[-1];if(description.allowedMask&bit(mod(pitch)))opts.push(0);
   for(let fret=start;fret<=end;fret++)if(description.allowedMask&bit(mod(pitch+fret)))opts.push(fret);
   return opts;
  });
  const remaining=Array(7).fill(0);for(let i=5;i>=0;i--)remaining[i]=remaining[i+1]|choices[i].reduce((m,f)=>f<0?m:m|bit(mod(tuning[i]+f)),0);
  function visit(index,mask,strings){
   if(((mask|remaining[index])&description.requiredMask)!==description.requiredMask||strings+6-index<Math.max(3,count(description.requiredMask)))return;
   if(index===6){
    if(!matchesChord(frets,description,tuning,maxFret))return;
    const id=keyOf(frets);if(seen.has(id))return;seen.add(id);
    results.push({frets:[...frets],...fingerShape(frets),source:'generated',id});return;
   }
   for(const fret of choices[index]){frets[index]=fret;visit(index+1,fret<0?mask:mask|bit(mod(tuning[index]+fret)),strings+(fret>=0?1:0));}
  }
  visit(0,0,0);
 }
 return results;
}

export function getVoicings(symbol,{tuning=STANDARD_TUNING,maxFret=18,limit=12}={}){
 const description=describeChord(symbol);
 if(!description)return {status:'unknown',description:null,voicings:[],key:''};
 if(!Array.isArray(tuning)||tuning.length!==6||tuning.some(n=>!Number.isInteger(n)))return {status:'tuning',description,voicings:[],key:''};
 maxFret=Math.max(0,Math.min(18,Number.isInteger(maxFret)?maxFret:18));limit=Math.max(1,Math.min(24,limit));
 const key=[description.tonicPc,description.allowedMask,description.requiredMask,description.bassPc??'any',tuning.join(','),maxFret].join('|');
 const decorate=v=>{const mask=soundingNotes(v.frets,tuning).reduce((m,n)=>m|bit(mod(n)),0);return {...v,omitted:description.tones.filter(t=>!(mask&bit(t.pc))).map(t=>t.name)};};
 const cached=cache.get(key);if(cached)return {...cached,description,voicings:cached.voicings.slice(0,limit).map(decorate)};
 let found=[];
 if(sameTuning(tuning)){
  const optional=description.allowedMask&~description.requiredMask;
  let subset=optional;
  while(true){for(const v of catalog.get(description.requiredMask|subset)||[])if(matchesChord(v.frets,description,tuning,maxFret))found.push(v);if(!subset)break;subset=(subset-1)&optional;}
 }
 // Generate when catalog coverage is thin, including complex slash chords and
 // alternate tunings. Both sources go through the same pitch/bass/hand checks.
 if(found.length<6)found.push(...generate(description,tuning,maxFret));
 const dedup=new Map();for(const v of found)if(!dedup.has(v.id))dedup.set(v.id,v);
 const best=[...dedup.values()].sort((a,b)=>rank(a,description,tuning)-rank(b,description,tuning)||a.id.localeCompare(b.id)).slice(0,24);
 const result={status:best.length?'ready':'unavailable',key,voicings:best};
 if(cache.size>=256)cache.delete(cache.keys().next().value);cache.set(key,result);
 return {...result,description,voicings:best.slice(0,limit).map(decorate)};
}
