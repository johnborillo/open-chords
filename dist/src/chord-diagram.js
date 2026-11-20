export function chordDiagram(voicing,{large=false}={}){
 const {frets,fingers,barres}=voicing,positive=frets.filter(f=>f>0);
 const base=positive.length&&Math.max(...positive)>4?Math.min(...positive):1;
 const y=fret=>28+(fret-base)*14;
 const label=frets.map(f=>f<0?'muted':f===0?'open':String(f)).join(', ');
 let svg=`<svg class="chord-diagram${large?' large':''}" viewBox="0 0 84 102" role="img" aria-label="Frets from lowest to highest string: ${label}"><g fill="none" stroke="currentColor" opacity=".35" stroke-width=".8">`;
 for(let i=0;i<6;i++)svg+=`<path d="M${20+i*10} 21v56"/>`;
 for(let i=0;i<5;i++)svg+=`<path d="M20 ${21+i*14}h50"/>`;
 svg+='</g>'+(base===1?'<path d="M20 21h50" stroke="currentColor" stroke-width="2" opacity=".75"/>':`<text x="3" y="31" fill="currentColor" font-size="8">${base}</text>`);
 frets.forEach((f,i)=>{const x=20+i*10;if(f<0)svg+=`<path d="m${x-2.3} 9 4.6 4.6m-4.6 0 4.6-4.6" stroke="currentColor" stroke-width=".9" opacity=".7"/>`;else if(f===0)svg+=`<circle cx="${x}" cy="11" r="2.6" fill="none" stroke="currentColor" stroke-width=".9" opacity=".7"/>`;});
 for(const b of barres)svg+=`<path class="diagram-barre" d="M${20+b.from*10} ${y(b.fret)}H${20+b.to*10}" stroke="currentColor" stroke-width="7.5" stroke-linecap="round"/>`;
 frets.forEach((f,i)=>{if(f<=0)return;const x=20+i*10;svg+=`<circle cx="${x}" cy="${y(f)}" r="4" fill="currentColor"/>`;if(large)svg+=`<text class="finger-number" x="${x}" y="${y(f)+2.5}" text-anchor="middle" font-family="sans-serif" font-size="7" font-weight="600">${fingers[i]}</text>`;});
 return svg+'</svg>';
}
