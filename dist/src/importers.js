import { parseSheet, isChord } from './music.js';
export const MAX_TEXT_SIZE=2*1024*1024;
export function safeSource(url) {
  if(!url)return '';
  try {const u=new URL(url);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}
}
export function fromUgStore(store, source='') {
 const data=store?.store?.page?.data || store?.page?.data || store;
 const view=data?.tab_view;const content=view?.wiki_tab?.content;
 if(view?.blocked || data?.access?.is_blocked)throw Error('This sheet is unavailable. Import a sheet you can open on Ultimate Guitar.');
 if(typeof content!=='string'||!content.trim())throw Error('No chord sheet was found in this page. Try a Chords or text Tab page, or paste the visible sheet.');
 const tab=data.tab||{};const meta=view.meta||{};
 return makeSong({title:tab.song_name||'Untitled sheet',artist:tab.artist_name||'',key:tab.tonality_name||'',capo:meta.capo??0,tuning:meta.tuning?.value||'',source:safeSource(source||tab.tab_url),author:tab.username||view.wiki_tab.username||'',content,format:'Ultimate Guitar'});
}
export function validateFingerings(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return {};
 return Object.fromEntries(Object.entries(value).slice(0,256).filter(([key,frets])=>key.length<=180&&/^[0-9,a-z|:-]+$/i.test(key)&&typeof frets==='string'&&/^(?:-1|[0-9]{1,2})(?:,(?:-1|[0-9]{1,2})){5}$/.test(frets)));
}
export function makeSong(input) {
 if(typeof input.content!=='string'||!input.content.trim())throw Error('Add a chord sheet before importing.');
 if(input.content.length>MAX_TEXT_SIZE)throw Error('This sheet is too large. Keep text files under 2 MB.');
 const parsed=parseSheet(input.content);
 const capo=Number(input.capo??parsed.metadata.capo??0);
 return {id:globalThis.crypto.randomUUID(),title:String(input.title||parsed.metadata.title||'Untitled sheet').slice(0,200),artist:String(input.artist||parsed.metadata.artist||'').slice(0,200),key:isChord(String(input.key||parsed.metadata.key||''))?String(input.key||parsed.metadata.key):'',capo:Number.isInteger(capo)&&capo>=0&&capo<=12?capo:0,tuning:String(input.tuning||'Standard · E A D G B E').slice(0,100),source:safeSource(input.source),author:String(input.author||'').slice(0,100),content:input.content,format:String(input.format||'Text'),fingerings:validateFingerings(input.fingerings),transpose:0,spelling:'auto',createdAt:new Date().toISOString()};
}
export function importText(text, filename='') {
 if(text.length>MAX_TEXT_SIZE)throw Error('Keep text files under 2 MB.');
 const trimmed=text.trim();
 if(trimmed.startsWith('{')) {
  let data;try{data=JSON.parse(trimmed);}catch{if(/\.json$/i.test(filename))throw Error('This JSON file is invalid. Export it again and retry.');}
  if(data){if(data.schema==='open-chords/v1')return makeSong(data.song);if(data.store||data.tab_view||data.page)return fromUgStore(data);throw Error('This JSON is not an Open Chords or Ultimate Guitar export.');}
 }
 if(/<(?:!doctype|html|div|script)\b/i.test(trimmed)) {
  const template=document.createElement('template');template.innerHTML=text;
  const element=template.content.querySelector('.js-store[data-content]');
  if(!element)throw Error('No Ultimate Guitar sheet data found. Save the chord page as HTML, use the export bookmark, or paste the sheet text.');
  let store;try{store=JSON.parse(element.getAttribute('data-content'));}catch{throw Error('The saved page contains invalid sheet data. Try exporting it again.');}
  return fromUgStore(store,template.content.querySelector('link[rel="canonical"]')?.getAttribute('href')||'');
 }
 return makeSong({content:text,title:parseSheet(text).metadata.title||(filename?filename.replace(/\.[^.]+$/,''):''),format:/\{(?:title|t):/i.test(text)?'ChordPro':'Text'});
}
export function bookmarklet() {
 const fn=()=>{
  try{
   if(location.hostname!=='tabs.ultimate-guitar.com')throw Error('Open an Ultimate Guitar Chords or text Tab page first.');
   const element=document.querySelector('.js-store[data-content]');
   const data=element?JSON.parse(element.getAttribute('data-content'))?.store?.page?.data:window.UGAPP?.store?.page?.data;
   const content=data?.tab_view?.wiki_tab?.content;
   if(typeof content!=='string'||!content.trim())throw Error('This page has no text chord sheet to export. Use a Chords or text Tab page.');
   const tab=data.tab||{},meta=data.tab_view.meta||{};
   const song={title:tab.song_name,artist:tab.artist_name,key:tab.tonality_name,capo:meta.capo||0,tuning:meta.tuning?.value,author:tab.username,content,source:location.href,format:'Ultimate Guitar'};
   const blob=new Blob([JSON.stringify({schema:'open-chords/v1',song},null,2)],{type:'application/json'});
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(song.title||'chord-sheet').replace(/[^a-z0-9 -]/gi,'')+'.openchords.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }catch(e){alert(e.message);}
 };
 return 'javascript:('+fn.toString()+')()';
}
