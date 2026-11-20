import { makeSong } from './importers.js';
let library;
export async function loadGuitarPro(bytes) {
 library ||= import('../vendor/alphatab/alphaTab.mjs');
 const alpha=await library;
 let score;
 try{score=alpha.importer.ScoreLoader.loadScoreFromBytes(bytes);}catch{throw Error('This score could not be read. Choose a valid Guitar Pro 3–8 or MusicXML file.');}
 const parts=[];
 for(const track of score.tracks)for(const staff of track.staves){
  if(staff.isPercussion)continue;
  const lines=[];let count=0;
  for(const bar of staff.bars){
   const chords=[];
   for(const voice of bar.voices)for(const beat of voice.beats){
    if(beat.chord?.name && !chords.some(c=>c.index===beat.index))chords.push({index:beat.index,name:beat.chord.name});
   }
   if(chords.length){lines.push(chords.sort((a,b)=>a.index-b.index).map(c=>'['+c.name+']').join('    '));count+=chords.length;}
   else lines.push('|');
  }
  const notes=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  parts.push({trackIndex:track.index,name:track.name+(track.staves.length>1?' · Staff '+(staff.index+1):''),count,song:count?makeSong({title:score.title||'Imported score',artist:score.artist||'',content:'['+(track.name||'Guitar')+']\n'+lines.join('\n'),capo:staff.capo,tuning:staff.stringTuning.tunings.length?[...staff.stringTuning.tunings].reverse().map(n=>notes[n%12]).join(' '):'Unspecified tuning',format:'Guitar Pro · chord annotations',author:score.words||''}):null});
 }
 return {score,parts,alpha};
}
