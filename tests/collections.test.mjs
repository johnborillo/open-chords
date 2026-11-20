import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCollections,mergeCollections,songsInView,moveSong} from '../dist/src/collections.js';
const songs=[{id:'a',title:'A'},{id:'b',title:'B'},{id:'c',title:'C'}];
test('old libraries need no migration and song removal cleans collection references',()=>{
 assert.deepEqual(validateCollections(undefined,songs),{favorites:[],setlists:[]});
 const data={favorites:['a','missing','a'],setlists:[{id:'list',name:' Session ',songIds:['c','b','c','missing']}]};
 const result=validateCollections(data,songs.filter(s=>s.id!=='b'));
 assert.deepEqual(result,{favorites:['a'],setlists:[{id:'list',name:'Session',songIds:['c']}]});
 assert.equal(data.setlists[0].songIds.length,4);
});
test('setlist order is independent of library order and search; favorites retain library order',()=>{
 const collections={favorites:['c','a'],setlists:[{id:'gig',name:'Gig',songIds:['b','a']}]};
 assert.deepEqual(songsInView(songs,collections,'favorites').map(s=>s.id),['a','c']);
 assert.deepEqual(songsInView(songs,collections,'setlist:gig').map(s=>s.id),['b','a']);
 assert.deepEqual(songsInView(songs,collections,'setlist:missing'),[]);
 assert.deepEqual(moveSong(['b','a'],'a',-1),['a','b']);
 assert.deepEqual(moveSong(['b','a'],'b',-1),['b','a']);
});
test('backup merges are idempotent and preserve an existing setlist and its chosen order',()=>{
 const current={favorites:['a'],setlists:[{id:'same',name:'Edited',songIds:['c','a']}]};
 const backup={favorites:['b'],setlists:[{id:'same',name:'Old',songIds:['a','b']},{id:'new',name:'New',songIds:['b','a']}]};
 const merged=mergeCollections(current,backup,songs);
 assert.deepEqual(merged.favorites,['a','b']);assert.deepEqual(merged.setlists[0],current.setlists[0]);assert.deepEqual(merged.setlists[1].songIds,['b','a']);
 assert.deepEqual(mergeCollections(merged,backup,songs),merged);
 assert.deepEqual(mergeCollections(current,undefined,songs),current);
});
test('invalid or excessive metadata cannot partially overwrite valid data',()=>{
 for(const value of [[],{favorites:[],setlists:{}},{favorites:[],setlists:[{id:'bad',name:' ',songIds:[]}]},{favorites:[],setlists:[{id:'dup',name:'A',songIds:[]},{id:'dup',name:'B',songIds:[]}]}])assert.throws(()=>validateCollections(value,songs),/Invalid/);
 const current={favorites:[],setlists:Array.from({length:100},(_,i)=>({id:String(i),name:'Set '+i,songIds:[]}))};
 const snapshot=structuredClone(current);assert.throws(()=>mergeCollections(current,{favorites:[],setlists:[{id:'extra',name:'Extra',songIds:[]}]},songs),/100 setlists/);assert.deepEqual(current,snapshot);
});
