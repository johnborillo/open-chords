export const themes = [
 {id:'sage', name:'Sage', description:'The original · soft greens'},
 {id:'tide', name:'Tide', description:'Calm blues · coastal air'},
 {id:'dusk', name:'Dusk', description:'Muted plum · evening practice'},
 {id:'amber', name:'Amber', description:'Warm earth · golden accents'},
];
export const PREFERENCES_KEY = 'open-chords/preferences/v1';

export function normalizePreferences(value) {
 const input=value && typeof value==='object' && !Array.isArray(value) ? value : {};
 // Earlier versions stored light/dark in the theme field.
 const legacyMode=['light','dark'].includes(input.theme) ? input.theme : 'dark';
 return {
  theme:themes.some(t=>t.id===input.theme) ? input.theme : 'sage',
  mode:['light','dark'].includes(input.mode) ? input.mode : legacyMode,
  fontSize:Math.max(11,Math.min(22,Number(input.fontSize)||14)),
 };
}

export function loadPreferences() {
 try{return normalizePreferences(JSON.parse(localStorage.getItem(PREFERENCES_KEY)||'{}'));}
 catch{return normalizePreferences();}
}

export function applyAppearance(preferences) {
 const root=document.documentElement;
 root.dataset.theme=preferences.theme;
 root.classList.toggle('light',preferences.mode==='light');
 root.style.colorScheme=preferences.mode;
 document.querySelector('meta[name="theme-color"]').content=getComputedStyle(root).getPropertyValue('--bg').trim();
}
