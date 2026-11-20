export const COLLECTIONS_KEY='open-chords/collections/v1';

export function validateCollections(value,songs){
 if(value===undefined||value===null)return {favorites:[],setlists:[]};
 if(typeof value!=='object'||Array.isArray(value)||!Array.isArray(value.favorites)||!Array.isArray(value.setlists)||value.favorites.length>500||value.setlists.length>100)throw Error('Invalid favorites or setlists in this library.');
 const songIds=new Set(songs.map(s=>s.id)),ids=new Set();
 const cleanIds=list=>[...new Set(list.filter(id=>typeof id==='string'&&songIds.has(id)))];
 return {favorites:cleanIds(value.favorites),setlists:value.setlists.map(list=>{
  if(!list||typeof list.id!=='string'||!list.id||list.id.length>120||ids.has(list.id)||typeof list.name!=='string'||!list.name.trim()||!Array.isArray(list.songIds)||list.songIds.length>500)throw Error('Invalid setlist in this library.');
  ids.add(list.id);return {id:list.id,name:list.name.trim().slice(0,80),songIds:cleanIds(list.songIds)};
 })};
}

export function mergeCollections(existing,incoming,songs){
 const current=validateCollections(existing,songs),added=validateCollections(incoming,songs);
 const ids=new Set(current.setlists.map(s=>s.id));
 const setlists=[...current.setlists,...added.setlists.filter(s=>!ids.has(s.id))];
 if(setlists.length>100)throw Error('The library can hold up to 100 setlists.');
 return {favorites:[...new Set([...current.favorites,...added.favorites])],setlists};
}

export function songsInView(songs,collections,view){
 if(view==='favorites'){const ids=new Set(collections.favorites);return songs.filter(s=>ids.has(s.id));}
 if(view.startsWith('setlist:')){const byId=new Map(songs.map(s=>[s.id,s]));return (collections.setlists.find(s=>s.id===view.slice(8))?.songIds||[]).map(id=>byId.get(id)).filter(Boolean);}
 return songs;
}

export function moveSong(songIds,id,direction){
 const next=[...songIds],index=next.indexOf(id),target=index+direction;
 if(index>=0&&target>=0&&target<next.length)[next[index],next[target]]=[next[target],next[index]];
 return next;
}
