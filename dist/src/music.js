const NATURAL = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const CHORD = /^([A-G])([#b♯♭]?)(?:(maj|min|dim|aug|sus|add|m|M|Δ|ø|°|\+|-)?([0-9]*(?:(?:maj|add|sus|no|omit)?[0-9]+|[#b♯♭][0-9]+|alt|\/[0-9]+|\([a-zA-Z0-9#b♯♭,+/\-]+\))*)?)(?:\/([A-G])([#b♯♭]?))?$/;
export const isChord = s => /^(N\.?C\.?)$/i.test(s) || CHORD.test(s);
export function transposeChord(chord, steps = 0, spelling = 'auto') {
  const m = CHORD.exec(chord);
  if (!m || (!steps && spelling === 'auto')) return chord;
  const names = spelling === 'flats' || (spelling === 'auto' && /[b♭]/.test(m[2] + (m[6] || ''))) ? FLATS : SHARPS;
  const note = (root, acc = '') => names[((NATURAL[root] + (/[#♯]/.test(acc) ? 1 : /[b♭]/.test(acc) ? -1 : 0) + steps) % 12 + 12) % 12];
  return note(m[1], m[2]) + chord.slice(m[1].length + m[2].length).replace(/\/[A-G][#b♯♭]?$/, '') + (m[5] ? '/' + note(m[5], m[6]) : '');
}
export const transposeKey = (key, steps, spelling = 'auto') => key ? transposeChord(key, steps, spelling) : '';
export function chordTokens(line) {
  return [...line.matchAll(/\S+/g)].filter(m => isChord(m[0])).map(m => ({ chord: m[0], column: m.index }));
}
function isChordLine(line) {
  const words = line.trim().split(/\s+/).filter(w => !/^[|:%×x\d.-]+$/.test(w));
  return words.length > 0 && words.every(isChord);
}
export function parseSheet(input) {
  const metadata = {};
  const lines = input.replace(/\r\n?/g, '\n').replace(/\[\/?tab\]/gi, '').split('\n').map(line => { if (!/\[ch\]/i.test(line)) return line; const bare = line.replace(/\[\/?ch\]/gi, ''); return isChordLine(bare) ? bare : line.replace(/\[ch\]([^\[]+)\[\/ch\]/gi, '[$1]'); });
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].replace(/\t/g, '    ');
    const directive = /^\{([^:}]+)(?::\s*(.*))?\}$/.exec(line.trim());
    if (directive) {
      const tag = directive[1].toLowerCase();
      const map = {title:'title',t:'title',artist:'artist',subtitle:'artist',st:'artist',key:'key',capo:'capo'};
      if (map[tag]) metadata[map[tag]] = directive[2] || '';
      else if (['start_of_chorus','soc'].includes(tag)) rows.push({kind:'section',text:'Chorus'});
      else if (['start_of_verse','sov'].includes(tag)) rows.push({kind:'section',text:directive[2] || 'Verse'});
      else if (!['end_of_chorus','eoc','end_of_verse','eov'].includes(tag)) rows.push({kind:'section',text:directive[2] || directive[1]});
      continue;
    }
    if (/^\s*\[[^\]]+\]\s*$/.test(line) && !isChord(line.trim().slice(1,-1))) {
      rows.push({kind:'section',text:line.trim().slice(1,-1)});continue;
    }
    if (/^\s*[eBGDAE]\|[-\d|~xhpbsr\/\\.() ]+/i.test(line)) { rows.push({kind:'tab',text:line});continue; }
    const inline = [...line.matchAll(/\[([^\]]+)\]/g)].filter(m=>isChord(m[1]));
    if (inline.length && !line.replace(/\[([^\]]+)\]/g, '').trim()) {
      const bare=line.replace(/\[([^\]]+)\]/g, '$1');
      rows.push({kind:'chords',text:bare,chords:chordTokens(bare)});continue;
    }
    if (inline.length) {
      let text='',last=0;const chords=[];
      for(const m of inline){text+=line.slice(last,m.index);chords.push({column:text.length,chord:m[1]});last=m.index+m[0].length;}
      text+=line.slice(last);rows.push({kind:'pair',text,chords});continue;
    }
    if (isChordLine(line)) {
      const chords=chordTokens(line);const next=lines[i+1];
      if(next?.trim() && !isChordLine(next) && !/^\s*[[{]/.test(next) && !/^\s*[eBGDAE]\|/i.test(next)) {
        rows.push({kind:'pair',text:next,chords});i++;
      } else rows.push({kind:'chords',text:line,chords});
    } else rows.push({kind:line.trim()?'lyric':'space',text:line});
  }
  return { metadata, rows };
}
export function chordPro(rows, steps=0, spelling='auto') {
  return rows.map(row=>{
    if(row.kind==='section') return '['+row.text+']';
    if(row.chords){let result=row.text;for(const c of [...row.chords].reverse()){
      if(row.kind==='chords') result=result.slice(0,c.column)+'['+transposeChord(c.chord,steps,spelling)+']'+result.slice(c.column+c.chord.length);
      else result=result.slice(0,c.column)+'['+transposeChord(c.chord,steps,spelling)+']'+result.slice(c.column);
    }return result;}
    return row.text;
  }).join('\n');
}
export function plainText(rows, steps=0, spelling='auto') {
  return rows.map(row=>{
    if(row.kind==='section')return '['+row.text+']';
    if(row.chords){let text=row.text;let top='';let offset=0;
      for(const c of row.chords){const chord=transposeChord(c.chord,steps,spelling);const column=Math.max(c.column+offset,top.length+(top?1:0));
        if(row.kind==='pair' && column>c.column+offset){text=text.slice(0,c.column+offset)+' '.repeat(column-c.column-offset)+text.slice(c.column+offset);offset=column-c.column;}
        top=top.padEnd(column,' ')+chord;
      }return row.kind==='pair'?top+'\n'+text:top;
    }return row.text;
  }).join('\n');
}
export function uniqueChords(rows, steps=0, spelling='auto') {
 return [...new Set(rows.flatMap(r=>(r.chords||[]).map(c=>transposeChord(c.chord,steps,spelling))))];
}
