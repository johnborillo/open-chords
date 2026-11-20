import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePreferences,loadPreferences,PREFERENCES_KEY} from '../dist/src/appearance.js';

test('legacy light and dark choices retain their mode and sheet size',()=>{
 for(const mode of ['light','dark'])assert.deepEqual(normalizePreferences({theme:mode,fontSize:18}),{theme:'sage',mode,fontSize:18});
 assert.deepEqual(normalizePreferences({theme:'tide',mode:'light',fontSize:15}),{theme:'tide',mode:'light',fontSize:15});
});
test('untrusted or obsolete saved preferences recover to usable defaults',()=>{
 for(const value of [null,[],4,'light',{}, {theme:'deleted',mode:'system',fontSize:'wrong'}])assert.deepEqual(normalizePreferences(value),{theme:'sage',mode:'dark',fontSize:14});
 assert.deepEqual(normalizePreferences({theme:'ultimate-guitar',mode:'light',fontSize:18}),{theme:'sage',mode:'light',fontSize:18});
 assert.equal(normalizePreferences({fontSize:999}).fontSize,22);
 assert.equal(normalizePreferences({fontSize:-5}).fontSize,11);
});
test('unavailable storage and malformed JSON do not stop the app from opening',()=>{
 const previous=globalThis.localStorage;
 try{
  globalThis.localStorage={getItem(){throw Error('Storage disabled');}};
  assert.equal(loadPreferences().theme,'sage');
  globalThis.localStorage={getItem(key){assert.equal(key,PREFERENCES_KEY);return '{bad JSON';}};
  assert.equal(loadPreferences().mode,'dark');
 }finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
});
