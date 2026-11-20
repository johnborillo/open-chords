import {parseSheet,transposeChord,transposeKey,plainText,chordPro,uniqueChords,isChord} from './music.js';
import {importText,makeSong,bookmarklet,safeSource} from './importers.js';
import {demos} from './demos.js';
import {getVoicings,tuningFromText,soundingNotes} from '../vendor/chords/engine.mjs';
import {chordDiagram} from './chord-diagram.js';
import {themes,PREFERENCES_KEY,loadPreferences,applyAppearance} from './appearance.js';
import {COLLECTIONS_KEY,validateCollections,mergeCollections,songsInView,moveSong} from './collections.js';
const $=s=>document.querySelector(s);
const paths={star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z','list-plus':'M4 5h12M4 10h12M4 15h7M17 13v8M13 17h8',minus:'M5 12h14',settings:'M9 3h6l1 4 4 1v6l-4 1-1 4H9l-1-4-4-1V8l4-1 1-4ZM15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0',moon:'M21 13a9 9 0 0 1-10-10 9 9 0 1 0 10 10Z',plus:'M12 5v14M5 12h14',search:'m21 21-5-5M19 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',library:'M4 4h4v16H4zM11 4h4v16h-4zM18 4l4 15-3 1-4-15',sun:'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',edit:'m15 4 5 5M4 20l4-1L20 7a2 2 0 0 0-4-4L4 15z',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',chevron:'m7 10 5 5 5-5',guitar:'m15 3 6 6m-4-4-7 7M8 9c-3-1-7 3-5 7s6 6 9 2c1-1 1-3 0-4 2 0 3-2 2-4-1-2-3-2-4-1M7 16h.01',metronome:'m12 3-7 18h14L12 3ZM12 16l6-9M8 17h8',play:'m8 4 12 8-12 8z',pause:'M8 5v14M16 5v14',scroll:'M8 4h8M8 20h8M12 4v16m-4-4 4 4 4-4',spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',arrow:'M4 12h16m-6-6 6 6-6 6',close:'m6 6 12 12M6 18 18 6',upload:'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',lock:'M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4',music:'M9 18V5l12-2v13M9 8l12-2M9 18a3 3 0 1 1-3-3c2 0 3 1 3 3ZM21 16a3 3 0 1 1-3-3c2 0 3 1 3 3Z'};
function icon(name){return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.music}"/></svg>`;}
function icons(root=document){root.querySelectorAll('[data-icon]').forEach(n=>{n.innerHTML=icon(n.dataset.icon);});}
icons();
const STORE='open-chords/library/v1';const PREFS=PREFERENCES_KEY;
let songs,preferences=loadPreferences(),storageWarning='';
try{const saved=localStorage.getItem(STORE);songs=saved?validateLibrary(JSON.parse(saved)):structuredClone(demos);}catch{songs=structuredClone(demos);storageWarning='Your saved library could not be read. Export a backup before making changes.';}
let collections={favorites:[],setlists:[]},libraryView='all';
try{collections=validateCollections(JSON.parse(localStorage.getItem(COLLECTIONS_KEY)||'null'),songs);}catch{storageWarning+=' Favorites and setlists could not be read. Keep a backup before making changes.';}
let activeId=songs[0]?.id,rows=[],toastTimer,importTab='paste',pendingSong=null,pendingScore=null,scoreApi=null,fileSequence=0;
let linkRequest=null;
let scrolling=false,scrollFrame=0,scrollLast=0,scrollRemainder=0;
let audioContext,metronome=false,beat=0,nextBeat=0,metroTimer;
const current=()=>songs.find(s=>s.id===activeId);
function validateLibrary(data){
 if(!Array.isArray(data)||data.length>500)throw Error('Invalid library.');
 const ids=new Set();return data.map(s=>{
  const valid=makeSong(s);valid.id=typeof s.id==='string'&&!ids.has(s.id)?s.id:valid.id;ids.add(valid.id);
  valid.transpose=Number.isInteger(s.transpose)&&Math.abs(s.transpose)<=24?s.transpose:0;
  valid.spelling=['auto','sharps','flats'].includes(s.spelling)?s.spelling:'auto';return valid;
 });
}
function toast(message){for(const [dialog,status] of [['settings-dialog','settings-status'],['setlist-dialog','setlist-status'],['add-setlist-dialog','add-setlist-status']])if($('#'+dialog).open)$('#'+status).textContent=message;$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4200);}
function save(){try{localStorage.setItem(STORE,JSON.stringify(songs));return true;}catch{toast('Device storage is full or unavailable. Export your library to keep these changes.');return false;}}
function savePrefs(){try{localStorage.setItem(PREFS,JSON.stringify(preferences));return true;}catch{toast('Device storage is unavailable. Your appearance changes will last for this session.');return false;}}
function element(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;}
function renderLibrary(){
 renderCollectionOptions();renderSetlistNavigation();const song=current(),favorite=!!song&&collections.favorites.includes(song.id);$('#favorite').disabled=$('#add-to-setlist').disabled=!song;$('#favorite').setAttribute('aria-pressed',String(favorite));$('#favorite').setAttribute('aria-label',favorite?'Remove from favorites':'Add to favorites');$('#favorite').title=favorite?'Remove from favorites':'Add to favorites';
 const q=$('#search').value.trim().toLowerCase(),list=$('#song-list');list.replaceChildren();
 for(const s of songsInView(songs,collections,libraryView).filter(s=>(s.title+' '+s.artist).toLowerCase().includes(q))){
  const b=element('button','song-link'+(s.id===activeId?' active':''));b.setAttribute('aria-current',s.id===activeId?'page':'false');b.innerHTML=icon('music');
  const wrap=element('span');wrap.append(element('strong','',s.title),element('small','',s.artist||s.format));b.append(wrap);if(collections.favorites.includes(s.id)){const mark=element('span','favorite-marker');mark.innerHTML=icon('star');mark.setAttribute('aria-hidden','true');b.append(mark);}b.onclick=()=>selectSong(s.id);list.append(b);
 }
 if(!list.childElementCount)list.append(element('p','field-hint',q?'No matching songs in this collection.':libraryView==='favorites'?'Star a song to find it here.':selectedSetlist()?'This setlist is empty. Use Edit setlist to add songs.':'Your next song starts here.'));
 $('#song-count').textContent=String(songs.length);
}
const songCount=count=>count+(count===1?' song':' songs');
const selectedSetlist=()=>collections.setlists.find(s=>'setlist:'+s.id===libraryView);
function saveCollections(){try{localStorage.setItem(COLLECTIONS_KEY,JSON.stringify(collections));return true;}catch{toast('Device storage is full or unavailable. Back up your library to keep favorites and setlists.');return false;}}
function selectSong(id){stopScroll();activeId=id;render();}
function renderCollectionOptions(){
 const select=$('#library-view');select.replaceChildren();
 for(const [value,label] of [['all','All songs · '+songs.length],['favorites','Favorites · '+collections.favorites.length]]){const option=element('option','',label);option.value=value;select.append(option);}
 if(collections.setlists.length){const group=element('optgroup');group.label='Setlists';for(const list of collections.setlists){const option=element('option','',list.name+' · '+list.songIds.length);option.value='setlist:'+list.id;group.append(option);}select.append(group);}
 if(![...select.options].some(o=>o.value===libraryView))libraryView='all';select.value=libraryView;
 $('#manage-setlist').hidden=!selectedSetlist();
}
function renderSetlistNavigation(){
 const list=selectedSetlist();$('#setlist-player').hidden=!list;if(!list)return;
 const index=list.songIds.indexOf(activeId);$('#playing-setlist-name').textContent=list.name;
 $('#setlist-position').textContent=list.songIds.length?(index>=0?'Song '+(index+1)+' of '+list.songIds.length:'Choose a song to begin'):'No songs yet · use Edit setlist to add songs';
 $('#setlist-prev').disabled=index<=0;$('#setlist-next').disabled=!list.songIds.length||index===list.songIds.length-1;
}
function stepSetlist(delta){const list=selectedSetlist();if(!list)return;const index=list.songIds.indexOf(activeId),id=list.songIds[index+delta];if(id){selectSong(id);$('#setlist-player').scrollIntoView({block:'start'});}}
$('#setlist-prev').onclick=()=>stepSetlist(-1);$('#setlist-next').onclick=()=>stepSetlist(1);
$('#library-view').onchange=e=>{
 libraryView=e.target.value;$('#search').value='';const list=selectedSetlist();if(list?.songIds.length&&!list.songIds.includes(activeId))activeId=list.songIds[0];stopScroll();render();
};
$('#favorite').onclick=()=>{
 const song=current();if(!song)return;const exists=collections.favorites.includes(song.id);
 collections.favorites=exists?collections.favorites.filter(id=>id!==song.id):[...collections.favorites,song.id];
 const saved=saveCollections();renderLibrary();if(saved)toast(exists?'Removed from favorites.':'Added to favorites.');
};
let editingSetlistId=null,draftSongIds=[];
function openSetlistEditor(id=null,initialSongId=null){
 if(!id&&collections.setlists.length>=100){toast('The library can hold up to 100 setlists.');return;}
 stopScroll();const list=collections.setlists.find(s=>s.id===id);editingSetlistId=list?.id||null;draftSongIds=list?[...list.songIds]:initialSongId?[initialSongId]:[];
 $('#setlist-title').textContent=list?'Edit setlist':'Create a setlist';$('#setlist-name').value=list?.name||'';$('#setlist-song-search').value='';$('#setlist-error').hidden=true;$('#setlist-status').textContent='';$('#delete-setlist').hidden=!list;
 renderSetlistDraft();$('#setlist-dialog').showModal();$('#setlist-name').focus();
}
function renderSetlistDraft(){
 const list=$('#setlist-draft');list.replaceChildren();$('#setlist-draft-count').textContent=songCount(draftSongIds.length);
 const byId=new Map(songs.map(s=>[s.id,s]));
 draftSongIds.forEach((id,index)=>{
  const song=byId.get(id);if(!song)return;const row=element('li','setlist-song-row');row.dataset.songId=id;
  const number=element('span','setlist-song-number',String(index+1));number.setAttribute('aria-hidden','true');
  const copy=element('div','setlist-song-copy');copy.append(element('strong','',song.title),element('small','',song.artist||'Your sheet'));row.append(number,copy);
  const actions=element('div','setlist-order-actions');
  for(const [direction,label,text] of [[-1,'up','↑'],[1,'down','↓']]){
   const button=element('button','icon-button',text);button.type='button';button.dataset.move=label;button.setAttribute('aria-label','Move '+song.title+' '+label);button.disabled=direction<0?index===0:index===draftSongIds.length-1;
   button.onclick=()=>{draftSongIds=moveSong(draftSongIds,id,direction);renderSetlistDraft();const moved=[...$('#setlist-draft').children].find(n=>n.dataset.songId===id);(moved.querySelector('[data-move="'+label+'"]:not(:disabled)')||moved.querySelector('.remove-setlist-song')).focus();$('#setlist-status').textContent=song.title+' moved to position '+(draftSongIds.indexOf(id)+1)+'.';};actions.append(button);
  }
  const remove=element('button','icon-button remove-setlist-song');remove.type='button';remove.innerHTML=icon('close');remove.setAttribute('aria-label','Remove '+song.title+' from setlist');remove.onclick=()=>{draftSongIds=draftSongIds.filter(value=>value!==id);renderSetlistDraft();$('#setlist-song-search').focus();$('#setlist-status').textContent=song.title+' removed from this setlist.';};actions.append(remove);row.append(actions);list.append(row);
 });
 if(!draftSongIds.length)list.append(element('li','field-hint','Your setlist is empty. Add songs below, then arrange them in playing order.'));
 renderAvailableSongs();
}
function renderAvailableSongs(){
 const list=$('#setlist-available'),query=$('#setlist-song-search').value.trim().toLowerCase();list.replaceChildren();
 for(const song of songs.filter(s=>!draftSongIds.includes(s.id)&&(s.title+' '+s.artist).toLowerCase().includes(query))){
  const row=element('div','available-song-row'),copy=element('div','setlist-song-copy');copy.append(element('strong','',song.title),element('small','',song.artist||'Your sheet'));
  const button=element('button','secondary','Add');button.type='button';button.setAttribute('aria-label','Add '+song.title+' to setlist');button.onclick=()=>{draftSongIds.push(song.id);renderSetlistDraft();$('#setlist-song-search').focus();$('#setlist-status').textContent=song.title+' added to position '+draftSongIds.length+'.';};row.append(copy,button);list.append(row);
 }
 if(!list.childElementCount)list.append(element('p','field-hint',query?'No matching songs to add.':songs.length?'All your songs are in this setlist.':'Import a song to add it to your setlist.'));
}
$('#setlist-song-search').oninput=renderAvailableSongs;
$('#setlist-song-search').onkeydown=e=>{if(e.key==='Enter')e.preventDefault();};
$('#new-setlist').onclick=()=>openSetlistEditor();$('#manage-setlist').onclick=()=>openSetlistEditor(selectedSetlist()?.id);
$('#setlist-form').onsubmit=e=>{
 e.preventDefault();const name=$('#setlist-name').value.trim();
 if(!name||collections.setlists.some(s=>s.id!==editingSetlistId&&s.name.toLowerCase()===name.toLowerCase())){$('#setlist-error').textContent=name?'Choose a different setlist name.':'Give your setlist a name.';$('#setlist-error').hidden=false;$('#setlist-name').focus();return;}
 const list={id:editingSetlistId||crypto.randomUUID(),name,songIds:[...draftSongIds]};
 if(editingSetlistId)collections.setlists=collections.setlists.map(s=>s.id===list.id?list:s);else collections.setlists.push(list);
 libraryView='setlist:'+list.id;$('#search').value='';if(list.songIds.length&&!list.songIds.includes(activeId))activeId=list.songIds[0];
 const saved=saveCollections();render();$('#setlist-dialog').close();if(saved)toast('Setlist saved.');
};
$('#delete-setlist').onclick=()=>{
 const list=collections.setlists.find(s=>s.id===editingSetlistId);if(!list||!confirm('Delete setlist “'+list.name+'”? Your songs will stay in the library.'))return;
 collections.setlists=collections.setlists.filter(s=>s.id!==list.id);if(libraryView==='setlist:'+list.id)libraryView='all';const saved=saveCollections();render();$('#setlist-dialog').close();if(saved)toast('Setlist deleted. Your songs are still in the library.');
};
$('#add-to-setlist').onclick=()=>{
 const song=current();if(!song)return;stopScroll();$('#add-setlist-song').textContent=song.title;$('#add-setlist-status').textContent='';const list=$('#setlist-memberships');list.replaceChildren();
 for(const setlist of collections.setlists){
  const label=element('label','setlist-membership'),input=element('input');input.type='checkbox';input.checked=setlist.songIds.includes(song.id);input.value=setlist.id;
  const copy=element('span','setlist-song-copy');copy.append(element('strong','',setlist.name),element('small','',songCount(setlist.songIds.length)));
  input.onchange=()=>{setlist.songIds=input.checked?[...setlist.songIds,song.id]:setlist.songIds.filter(id=>id!==song.id);const saved=saveCollections();copy.querySelector('small').textContent=songCount(setlist.songIds.length);renderLibrary();if(saved)$('#add-setlist-status').textContent=input.checked?'Added to '+setlist.name+'.':'Removed from '+setlist.name+'.';};label.append(input,copy);list.append(label);
 }
 if(!collections.setlists.length)list.append(element('p','field-hint','Create your first setlist to group songs for a session.'));
 $('#add-setlist-dialog').showModal();
};
$('#create-setlist-with-song').onclick=()=>{if(collections.setlists.length>=100){toast('The library can hold up to 100 setlists.');return;}$('#add-setlist-dialog').close();openSetlistEditor(null,current()?.id);};
$('#setlist-dialog').addEventListener('close',()=>{if(document.activeElement===document.body)$('#new-setlist').focus();});

function sheetChord(chord){const button=element('button','chord chord-tap',chord);button.type='button';button.dataset.chord=chord;button.setAttribute('aria-label','View fingerings for '+chord);button.setAttribute('aria-haspopup','dialog');button.onclick=()=>{const entry=guideEntries.get(chord);if(entry)openChord(entry);};return button;}
function renderSheet(){
 const sheet=$('#sheet');sheet.replaceChildren();const s=current();
 if(!s){sheet.append(element('p','field-hint','Import a chord sheet to make this space your own.'));return;}
 for(const row of rows){
  if(row.kind==='pair'){
   const line=element('div','sheet-pair');let cursor=0;
   const segments=[];const lyricText=row.text.padEnd(row.chords.at(-1)?.column||0,' ');
   if(row.chords[0]?.column>0)segments.push({chord:'',text:lyricText.slice(0,row.chords[0].column)});
   row.chords.forEach((c,i)=>{cursor=c.column;segments.push({chord:transposeChord(c.chord,s.transpose,s.spelling),text:lyricText.slice(cursor,row.chords[i+1]?.column??lyricText.length)});});
   for(const part of segments){const block=element('span','sheet-segment');block.append(part.chord?sheetChord(part.chord):element('span','chord','\u00a0'),element('span','lyric',part.text||'\u00a0'));line.append(block);}
   sheet.append(line);
  }else if(row.kind==='chords'){
   const line=element('div','sheet-chords');
   for(const part of plainText([row],s.transpose,s.spelling).split(/(\s+)/))line.append(isChord(part)?sheetChord(part):document.createTextNode(part));
   sheet.append(line);
  }
  else sheet.append(element('div','sheet-'+row.kind,row.text));
 }
}
let guideEntries=new Map(),expandedChord=null;
function selectedVoicing(entry){const saved=current()?.fingerings?.[entry.result.key];const index=entry.result.voicings.findIndex(v=>v.id===saved);return Math.max(0,index);}
function cycleVoicing(entry,delta){
 const s=current(),positions=entry.result?.voicings||[];if(!s||!positions.length)return;
 const index=(selectedVoicing(entry)+delta+positions.length)%positions.length;
 s.fingerings||={};s.fingerings[entry.result.key]=positions[index].id;save();paintChordCard(entry);
 if($('#chord-dialog').open&&expandedChord===entry.chord)paintChordDialog(entry);
}
function paintChordCard(entry){
 const {card,result,chord}=entry,index=selectedVoicing(entry),voicing=result.voicings[index];
 const button=card.querySelector('.chord-explore');button.innerHTML=chordDiagram(voicing);button.title='Explore '+chord+' fingerings';
 card.dataset.frets=voicing.id;card.dataset.source=voicing.source;
 card.querySelector('.voicing-counter').textContent=(index+1)+' / '+result.voicings.length;
}
function paintChordDialog(entry){
 const s=current(),{result,chord,tuning}=entry;
 const available=!!result?.voicings.length;$('.chord-facts').hidden=!available;$('.chord-dialog-nav').hidden=!available;$('#chord-dialog-title').textContent=chord;
 if(!available){$('#chord-dialog-description').textContent='Fingerings unavailable';$('#chord-diagram-large').replaceChildren(element('p','field-hint',/^(N\.?C\.?)$/i.test(chord)?'No chord is played here.':!tuning?'This sheet needs a recognized six-string tuning to show fingerings.':result?.status==='unknown'?'This chord symbol is not recognized.':'No comfortable shape was found for this tuning and capo.'));$('#chord-tuning').textContent=tuning?.label||s.tuning;return;}
 const index=selectedVoicing(entry),voicing=result.voicings[index],description=result.description;
 $('#chord-dialog-title').textContent=chord;$('#chord-dialog-description').textContent=description.quality+(description.bass?' · Bass '+description.bass:'');
 $('#chord-diagram-large').innerHTML=chordDiagram(voicing,{large:true});
 $('#chord-position').textContent='Voicing '+(index+1)+' of '+result.voicings.length;
 $('#chord-origin').textContent=voicing.source==='catalog'?'Library voicing':'Suggested voicing';
 const names=new Map(description.tones.map(t=>[t.pc,t.name]));if(description.bass)names.set(description.bassPc,description.bass);
 const noteNames=[...new Set(soundingNotes(voicing.frets,tuning.midi).map(n=>names.get(n%12)))];
 $('#chord-notes').textContent=noteNames.join(' · ');
 $('#chord-frets').textContent=voicing.frets.map(f=>f<0?'x':f).join('  ');
 $('#chord-omitted').textContent=voicing.omitted.length?'This voicing omits '+voicing.omitted.join(', ')+'.':'';$('#chord-omitted').hidden=!voicing.omitted.length;
 $('#chord-tuning').textContent=tuning.label+' · '+(s.capo?'Capo '+s.capo+' · frets relative to capo':'No capo');
 $('#chord-prev').disabled=result.voicings.length<2;$('#chord-next').disabled=result.voicings.length<2;
}
function openChord(entry){stopScroll();expandedChord=entry.chord;paintChordDialog(entry);$('#chord-dialog').showModal();}
function renderChords(){
 const s=current(),chords=s?uniqueChords(rows,s.transpose,s.spelling):[],list=$('#chord-cards');list.replaceChildren();guideEntries=new Map();
 const tuning=s?tuningFromText(s.tuning):null;
 for(const chord of chords){
  const card=element('div','chord-card');card.dataset.chord=chord;card.append(element('strong','',chord));
  const result=tuning?getVoicings(chord,{tuning:tuning.midi,maxFret:24-s.capo}):null;
  const entry={card,result,chord,tuning};guideEntries.set(chord,entry);
  if(result?.voicings.length){
   const explore=element('button','chord-explore');explore.setAttribute('aria-label','Explore fingerings for '+chord);explore.onclick=()=>openChord(entry);card.append(explore);
   const nav=element('div','voicing-nav');
   const previous=element('button','voicing-prev','‹'),next=element('button','voicing-next','›'),counter=element('span','voicing-counter');
   previous.setAttribute('aria-label','Previous fingering for '+chord);next.setAttribute('aria-label','Next fingering for '+chord);counter.setAttribute('aria-live','polite');
   previous.disabled=next.disabled=result.voicings.length<2;previous.onclick=()=>cycleVoicing(entry,-1);next.onclick=()=>cycleVoicing(entry,1);nav.append(previous,counter,next);card.append(nav);paintChordCard(entry);
  }else card.append(element('span','no-shape',/^(N\.?C\.?)$/i.test(chord)?'No chord':!tuning?'Unknown tuning':result?.status==='unknown'?'Unrecognized symbol':'No comfortable shape found'));
  list.append(card);
 }
 $('#chord-count').textContent=chords.length+' chords';$('.guide-note').textContent=tuning?tuning.label+' · frets relative to capo. Tap a sheet chord or diagram for fingerings.':'Chord names are retained. Diagrams need a recognized six-string tuning.';
}
$('#chord-prev').onclick=()=>{const entry=guideEntries.get(expandedChord);if(entry)cycleVoicing(entry,-1);};
$('#chord-next').onclick=()=>{const entry=guideEntries.get(expandedChord);if(entry)cycleVoicing(entry,1);};
$('#chord-dialog').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const entry=guideEntries.get(expandedChord);if(entry)cycleVoicing(entry,e.key==='ArrowRight'?1:-1);}});
function render(){
 renderLibrary();const s=current();rows=s?parseSheet(s.content).rows:[];
 $('#song-title').textContent=s?.title||'Your next song.';$('#song-artist').textContent=s?.artist||'A little space to play.';$('#crumb-title').textContent=s?.title||'Your library';$('#song-type').textContent=s?.format||'MAKE IT YOURS';document.title=(s?.title||'Your library')+' — Open Chords';
 $('#tuning-value').textContent=s?.tuning||'Standard · E A D G B E';const source=$('#source-meta');source.replaceChildren();
 if(s?.source){const a=element('a','',s.author?'Source · '+s.author:'View original sheet ↗');a.href=safeSource(s.source);a.target='_blank';a.rel='noopener noreferrer';source.append(a);}else source.textContent=s?.format==='Original practice sheet'?'Written for Open Chords':'Your personal sheet';
 $('#transpose-value').textContent=s?.transpose?(s.transpose>0?'+':'')+s.transpose+' semitones':'Original';
 $('#transpose-down').disabled=!s||s.transpose<=-24;$('#transpose-up').disabled=!s||s.transpose>=24;
 $('#capo').value=String(s?.capo||0);$('#spelling').value=s?.spelling||'auto';
 const key=transposeKey(s?.key||'',s?.transpose||0,s?.spelling||'auto');
 $('#key-select').replaceChildren();if(!s?.key){const o=element('option','','Set in editor');o.value='';$('#key-select').append(o);$('#key-select').disabled=true;}else{const names=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];for(const name of names){const o=element('option','',name+(s.key.endsWith('m')?'m':''));o.value=name+(s.key.endsWith('m')?'m':'');$('#key-select').append(o);}const pitch=transposeKey(key,0,'flats');const target=[...$('#key-select').options].find(o=>transposeKey(o.value,0,'flats')===pitch);if(target)$('#key-select').value=target.value;$('#key-select').disabled=false;}
 $('#print-meta').textContent=(key?'Shape key '+key+' · ':'')+'Capo '+(s?.capo||0)+(key?' · Sounding key '+transposeKey(key,s.capo,s.spelling):'');
 $('#sounding-key').textContent=key?'Sounding key '+transposeKey(key,s.capo,s.spelling):'Set a key in the editor';
 $('#edit').disabled=!s;$('#capo').disabled=!s;$('#spelling').disabled=!s;
 renderSheet();renderChords();applyPreferences();
}
function applyPreferences(){preferences.fontSize=Math.max(11,Math.min(22,Number(preferences.fontSize)||14));$('#sheet').style.fontSize=preferences.fontSize+'px';$('#font-down').disabled=preferences.fontSize<=11;$('#font-up').disabled=preferences.fontSize>=22;applyAppearance(preferences);syncAppearanceControls();}
for(let i=0;i<=12;i++){const o=element('option','',i?'Fret '+i:'No capo');o.value=String(i);$('#capo').append(o);}
for(const n of ['','C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B'])for(const minor of n?['','m']:['']){const o=element('option','',n+minor||'Unspecified');o.value=n+minor;$('#edit-key').append(o);}
function transpose(steps){const s=current();if(!s)return;s.transpose=Math.max(-24,Math.min(24,s.transpose+steps));save();render();}
$('#transpose-up').onclick=()=>transpose(1);$('#transpose-down').onclick=()=>transpose(-1);$('#reset').onclick=()=>{if(current()){current().transpose=0;save();render();}};
$('#key-select').onchange=e=>{const s=current();if(!s)return;const now=transposeKey(s.key,s.transpose,'flats');const names=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];const strip=k=>k.replace(/m$/,'');const from=names.indexOf(strip(now)),to=names.indexOf(strip(transposeKey(e.target.value,0,'flats')));let delta=to-from;if(delta>6)delta-=12;if(delta<-6)delta+=12;transpose(delta);};
$('#capo').onchange=e=>{if(current()){current().capo=Number(e.target.value);save();render();}};$('#spelling').onchange=e=>{if(current()){current().spelling=e.target.value;save();render();}};
$('#search').oninput=renderLibrary;
$('#font-down').onclick=()=>{preferences.fontSize-=1;applyPreferences();savePrefs();};$('#font-up').onclick=()=>{preferences.fontSize+=1;applyPreferences();savePrefs();};
function syncAppearanceControls(){
 document.querySelectorAll('[name="color-mode"]').forEach(n=>n.checked=n.value===preferences.mode);
 document.querySelectorAll('[name="theme-palette"]').forEach(n=>n.checked=n.value===preferences.theme);
 document.querySelectorAll('.theme-preview').forEach(n=>n.classList.toggle('light',preferences.mode==='light'));
}
for(const theme of themes){
 const label=element('label','theme-choice'),input=element('input');input.type='radio';input.name='theme-palette';input.value=theme.id;
 const preview=element('span','theme-preview');preview.dataset.theme=theme.id;preview.setAttribute('aria-hidden','true');
 preview.innerHTML='<span class="preview-sidebar"><i></i><i></i><i></i></span><span class="preview-page"><span class="preview-title"></span><span class="preview-chords"><b>C</b><b>G</b><b>Am</b></span><span class="preview-line"></span><span class="preview-line short"></span></span><span class="theme-check">✓</span>';
 const copy=element('span','theme-copy');copy.append(element('strong','',theme.name),element('small','',theme.description));label.append(input,preview,copy);$('#theme-options').append(label);
 input.onchange=()=>{preferences.theme=input.value;applyPreferences();if(savePrefs())$('#settings-status').textContent=theme.name+' theme saved.';};
}
document.querySelectorAll('[name="color-mode"]').forEach(n=>n.onchange=()=>{preferences.mode=n.value;applyPreferences();if(savePrefs())$('#settings-status').textContent=(n.value==='light'?'Light':'Dark')+' mode saved.';});
$('#settings').onclick=()=>{stopScroll();$('#settings-status').textContent='';syncAppearanceControls();$('#settings-dialog').showModal();};
function download(data,filename,type='text/plain'){const url=URL.createObjectURL(new Blob([data],{type}));const a=element('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function slug(title){return title.replace(/[^a-z0-9 _-]/gi,'').trim()||'chord-sheet';}
function exportSong(format){const s=current();if(!s)return;let text,ext;
 if(format==='json'){const song={...s,content:chordPro(rows,s.transpose,s.spelling),key:transposeKey(s.key,s.transpose,s.spelling),transpose:0};text=JSON.stringify({schema:'open-chords/v1',song},null,2);ext='openchords.json';}
 else if(format==='chordpro'){text=`{title: ${s.title}}\n{artist: ${s.artist}}\n`+(s.key?`{key: ${transposeKey(s.key,s.transpose,s.spelling)}}\n`:'')+`{capo: ${s.capo}}\n`+(s.source?`{comment: Source ${s.source}${s.author?' · '+s.author:''}}\n`:'')+'\n'+chordPro(rows,s.transpose,s.spelling);ext='cho';}
 else{text=s.title+'\n'+s.artist+'\n'+(s.key?'Shape key: '+transposeKey(s.key,s.transpose,s.spelling)+' · ':'')+'Capo: '+s.capo+'\n'+(s.source?'Source: '+s.source+(s.author?' · '+s.author:'')+'\n':'')+'\n'+plainText(rows,s.transpose,s.spelling);ext='txt';}
 download(text,slug(s.title)+'.'+ext,format==='json'?'application/json':'text/plain');$('.export-menu').open=false;toast('Exported '+s.title+'.');
}
document.querySelectorAll('[data-export]').forEach(b=>b.onclick=()=>exportSong(b.dataset.export));$('#print').onclick=()=>{$('.export-menu').open=false;window.print();};
$('#backup').onclick=()=>{download(JSON.stringify({schema:'open-chords-library/v1',songs,collections},null,2),'open-chords-library.json','application/json');toast('Library backup downloaded.');};$('#restore').onclick=()=>$('#restore-file').click();$('#restore-file').onchange=async e=>{
 try{const f=e.target.files[0];if(!f)return;if(f.size>10*1024*1024)throw Error('Choose a library backup under 10 MB.');const data=JSON.parse(await f.text());if(!data||data.schema!=='open-chords-library/v1')throw Error('Choose an Open Chords library backup.');const incoming=validateLibrary(data.songs),existing=new Set(songs.map(s=>s.id)),added=incoming.filter(s=>!existing.has(s.id));if(songs.length+added.length>500)throw Error('The library can hold up to 500 songs.');const combined=[...songs,...added],merged=mergeCollections(collections,data.collections,combined);songs=combined;collections=merged;activeId||=songs[0]?.id;const saved=save();const organized=saveCollections();render();if(saved&&organized)toast('Library restored. Existing songs were kept. Favorites and setlists were merged.');}catch(err){toast(err.message);}e.target.value='';
};
$('#delete').onclick=()=>{const s=current();if(!s)return;$('.export-menu').open=false;if(!window.confirm('Delete “'+s.title+'” from this device?'))return;songs=songs.filter(x=>x.id!==s.id);collections=validateCollections(collections,songs);activeId=songsInView(songs,collections,libraryView)[0]?.id||songs[0]?.id;save();saveCollections();stopScroll();render();toast('Song deleted.');};
function showEdit(){const s=current();if(!s)return;stopScroll();$('#edit-title').value=s.title;$('#edit-artist').value=s.artist;$('#edit-key').value=s.key;$('#edit-source').value=s.source;$('#edit-content').value=s.content;$('#edit-dialog').showModal();}
$('#edit').onclick=showEdit;$('#cancel-edit').onclick=()=>$('#edit-dialog').close();$('#edit-form').onsubmit=e=>{e.preventDefault();const s=current();if(!s)return;try{const updated=makeSong({...s,title:$('#edit-title').value,artist:$('#edit-artist').value,key:$('#edit-key').value,source:$('#edit-source').value,content:$('#edit-content').value});Object.assign(s,updated,{id:s.id,transpose:s.transpose,spelling:s.spelling});const saved=save();render();$('#edit-dialog').close();if(saved)toast('Sheet updated.');}catch(err){toast(err.message);}};
function setImportBusy(busy){$('#import-submit').disabled=busy||(importTab==='file'&&!!pendingScore&&!pendingSong);$('#import-submit').setAttribute('aria-busy',String(busy));$('#import-submit').innerHTML=busy?'Importing…':(importTab==='ug'?'Import from link':'Import song')+' '+icon('arrow');$('#ug-url').readOnly=busy;document.querySelectorAll('[data-tab]').forEach(b=>b.disabled=busy);}
function cancelLinkImport(){if(linkRequest){const request=linkRequest;linkRequest=null;request.abort();}setImportBusy(false);}
function clearScore(){fileSequence++;pendingSong=null;pendingScore=null;if(scoreApi){scoreApi.destroy();scoreApi=null;}$('#gp-preview').hidden=true;$('#gp-score').replaceChildren();}
function openImport(){stopScroll();clearScore();$('#import-form').reset();$('#import-error').hidden=true;$('#import-submit').disabled=false;$('#import-submit').innerHTML='Import song '+icon('arrow');$('#ug-fallback').open=false;setTab('ug');$('#import-dialog').showModal();$('#ug-url').focus();}
document.querySelectorAll('.import-trigger').forEach(b=>b.onclick=openImport);document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());$('#import-dialog').addEventListener('close',()=>{cancelLinkImport();clearScore();});
function setTab(tab){cancelLinkImport();importTab=tab;for(const name of ['ug','paste','file']){$('#tab-'+name).setAttribute('aria-selected',String(name===tab));$('#tab-'+name).tabIndex=name===tab?0:-1;$('#pane-'+name).hidden=name!==tab;}$('#import-error').hidden=true;setImportBusy(false);}
document.querySelectorAll('[data-tab]').forEach(b=>{b.onclick=()=>setTab(b.dataset.tab);b.onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const tabs=['ug','paste','file'];const next=tabs[(tabs.indexOf(b.dataset.tab)+(e.key==='ArrowRight'?1:2))%3];setTab(next);$('#tab-'+next).focus();}};});
$('#ug-bookmark').href=bookmarklet();$('#ug-bookmark').onclick=e=>{e.preventDefault();toast('Drag this link to your bookmarks bar, then run it on a UG chord page.');};$('#copy-bookmark').onclick=async()=>{try{await navigator.clipboard.writeText(bookmarklet());toast('Bookmark code copied.');}catch{toast('Clipboard unavailable. Drag the export link to your bookmarks bar.');}};$('#ug-choose-file').onclick=()=>{setTab('file');$('#import-file').click();};
function importError(message){$('#import-error').textContent=message;$('#import-error').hidden=false;}
async function readFile(file){
 if(!file)return;clearScore();const sequence=fileSequence;$('#import-error').hidden=true;$('#import-submit').disabled=true;
 try{
  const isScore=/\.(gp[345]?|gpx|xml|musicxml)$/i.test(file.name);
  if(file.size>(isScore?10:2)*1024*1024)throw Error(isScore?'Keep scores under 10 MB.':'Keep text files under 2 MB.');
  if(isScore){
   const {loadGuitarPro}=await import('./guitar-pro.js');const result=await loadGuitarPro(new Uint8Array(await file.arrayBuffer()));if(sequence!==fileSequence)return;pendingScore=result;
   const summary=$('#gp-preview .gp-summary');summary.replaceChildren(element('strong','',result.score.title||file.name));
   const select=element('select');select.id='gp-track';select.setAttribute('aria-label','Choose score part');
   for(let i=0;i<result.parts.length;i++){const p=result.parts[i],o=element('option','',p.name+' · '+p.count+' named chords');o.value=String(i);select.append(o);}
   if(result.parts.length){select.value=String(Math.max(0,result.parts.findIndex(p=>p.count)));summary.append(element('br'),select);}const hint=element('p','field-hint');summary.append(hint);$('#gp-preview').hidden=false;
   const choose=()=>{const part=result.parts[Number(select.value)];pendingSong=part?.song||null;$('#import-submit').disabled=!pendingSong;hint.textContent=pendingSong?'Import the named chord annotations from this part. Notes remain in the preview; no harmony is inferred.':'This part has no named chord annotations. You can view the score below, or choose another part.';scoreApi?.renderScore(result.score,[part?.trackIndex||0]);};
   try{scoreApi=new result.alpha.AlphaTabApi($('#gp-score'),{core:{fontDirectory:new URL('../vendor/alphatab/font/',import.meta.url).href,useWorkers:false},player:{enablePlayer:false},display:{scale:.65}});scoreApi.error.on(()=>{hint.textContent+=' The notation preview could not be rendered.';});}catch{hint.textContent='Score parsed; notation preview unavailable.';}
   select.onchange=choose;choose();
  }else{const song=importText(await file.text(),file.name);if(sequence!==fileSequence)return;pendingSong=song;$('#import-submit').disabled=false;toast('Ready to import “'+song.title+'”.');}
 }catch(err){if(sequence===fileSequence){pendingSong=null;pendingScore=null;importError(err.message);$('#import-submit').disabled=false;}}
}
$('#import-file').onchange=e=>readFile(e.target.files[0]);const drop=$('#drop-zone');for(const event of ['dragenter','dragover'])drop.addEventListener(event,e=>{e.preventDefault();drop.classList.add('dragging');});for(const event of ['dragleave','drop'])drop.addEventListener(event,e=>{e.preventDefault();drop.classList.remove('dragging');});drop.addEventListener('drop',e=>readFile(e.dataTransfer.files[0]));
async function songFromLink(url){
 const request=new AbortController();linkRequest=request;setImportBusy(true);
 const timeout=setTimeout(()=>request.abort('timeout'),22000);
 try{
  const response=await fetch('/api/import/ultimate-guitar',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({url}),signal:request.signal});
  let data;try{data=await response.json();}catch{throw Error('The importer is unavailable. Reload the app and try again.');}
  if(!response.ok){const error=Error(data.error?.message||'This sheet could not be imported. Try the export bookmark.');error.code=data.error?.code;throw error;}
  if(data.schema!=='open-chords/v1'||!data.song)throw Error('The importer returned an unreadable sheet. Try the export bookmark.');
  if(linkRequest!==request||request.signal.aborted)return null;
  return makeSong(data.song);
 }catch(error){
  if(linkRequest!==request)return null;
  if(request.signal.aborted&&request.signal.reason==='timeout')throw Error('The sheet took too long to load. Try again, or use the export bookmark.');
  if(error.name==='AbortError')return null;
  if(error instanceof TypeError)throw Error('Could not reach the importer. Check your connection and try again.');
  throw error;
 }finally{clearTimeout(timeout);if(linkRequest===request){linkRequest=null;setImportBusy(false);}}
}
$('#ug-url').addEventListener('input',()=>{$('#import-error').hidden=true;});
$('#import-form').onsubmit=async e=>{
 e.preventDefault();if(linkRequest)return;
 try{
  if(songs.length>=500)throw Error('Your library has 500 songs. Export a backup and remove a song before adding more.');
  let song;
  if(importTab==='file'){if(!pendingSong)throw Error('Choose a file to import first.');song=pendingSong;}
  else if(importTab==='ug'){
   const url=$('#ug-url').value.trim();
   if(url)song=await songFromLink(url);
   else if($('#ug-content').value.trim())song=importText($('#ug-content').value);
   else{const error=Error('Paste an Ultimate Guitar chord-sheet link first.');error.code='INVALID_URL';throw error;}
   if(!song)return;
  }else{song=importText($('#import-content').value);if($('#import-title').value.trim())song.title=$('#import-title').value.trim();if($('#import-artist').value.trim())song.artist=$('#import-artist').value.trim();}
  songs.push(song);activeId=song.id;libraryView='all';$('#search').value='';const saved=save();$('#import-dialog').close();render();if(saved)toast('“'+song.title+'” is in your library.');
 }catch(error){if(importTab==='ug'&&error.code!=='INVALID_URL')$('#ug-fallback').open=true;importError(error.message);}
};
function stopScroll(){scrolling=false;cancelAnimationFrame(scrollFrame);scrollLast=0;scrollRemainder=0;$('#scroll-toggle').setAttribute('aria-pressed','false');$('#scroll-toggle').setAttribute('aria-label','Start auto-scroll');}
function scrollTick(now){if(!scrolling)return;if(scrollLast){scrollRemainder+=(now-scrollLast)/1000*Number($('#scroll-speed').value);const px=Math.floor(scrollRemainder);if(px){window.scrollBy(0,px);scrollRemainder-=px;}}scrollLast=now;if(window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-2){stopScroll();return;}scrollFrame=requestAnimationFrame(scrollTick);}
$('#scroll-toggle').onclick=()=>{if(scrolling){stopScroll();return;}scrolling=true;$('#scroll-toggle').setAttribute('aria-pressed','true');$('#scroll-toggle').setAttribute('aria-label','Stop auto-scroll');scrollFrame=requestAnimationFrame(scrollTick);};window.addEventListener('wheel',()=>{if(scrolling)stopScroll();},{passive:true});
function paintRange(input){const min=Number(input.min),max=Number(input.max);input.style.setProperty('--range-fill',((Number(input.value)-min)/(max-min)*100)+'%');}
document.querySelectorAll('input[type="range"]').forEach(input=>{paintRange(input);input.addEventListener('input',()=>paintRange(input));});
function setBpm(value){const bpm=Math.round(Math.max(30,Math.min(240,Number(value)||80)));$('#bpm').value=String(bpm);$('#tempo').value=String(bpm);paintRange($('#tempo'));}
$('#bpm').onchange=e=>setBpm(e.target.value);$('#tempo').oninput=e=>setBpm(e.target.value);
function scheduleBeat(time,index){const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.frequency.value=index===0?1100:760;gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(.12,time+.002);gain.gain.exponentialRampToValueAtTime(.001,time+.055);osc.connect(gain);gain.connect(audioContext.destination);osc.start(time);osc.stop(time+.06);const delay=Math.max(0,(time-audioContext.currentTime)*1000);setTimeout(()=>{if(!metronome)return;document.querySelectorAll('.beats i').forEach((el,i)=>el.classList.toggle('active',i===index));},delay);}
function pump(){while(metronome&&nextBeat<audioContext.currentTime+.1){scheduleBeat(nextBeat,beat);nextBeat+=60/Number($('#bpm').value);beat=(beat+1)%4;}}
function stopMetronome(){metronome=false;clearInterval(metroTimer);$('#metronome-toggle').classList.remove('active');$('#metronome-toggle').setAttribute('aria-label','Start metronome');$('#metronome-toggle').innerHTML=icon('play');document.querySelectorAll('.beats i').forEach(el=>el.classList.remove('active'));}
$('#metronome-toggle').onclick=async()=>{if(metronome){stopMetronome();return;}try{audioContext||=new(window.AudioContext||window.webkitAudioContext)();await audioContext.resume();setBpm($('#bpm').value);metronome=true;beat=0;nextBeat=audioContext.currentTime+.04;$('#metronome-toggle').classList.add('active');$('#metronome-toggle').setAttribute('aria-label','Stop metronome');$('#metronome-toggle').innerHTML=icon('pause');pump();metroTimer=setInterval(pump,25);}catch{toast('Audio is unavailable in this browser.');}};
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopMetronome();stopScroll();}});document.addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();$('#search').focus();}});
render();if(storageWarning)toast(storageWarning);
