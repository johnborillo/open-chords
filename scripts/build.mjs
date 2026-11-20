import {cp,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const base='node_modules/@coderline/alphatab/';
await mkdir('dist/vendor/alphatab',{recursive:true});
for(const file of ['alphaTab.mjs','alphaTab.core.mjs'])await cp(base+'dist/'+file,'dist/vendor/alphatab/'+file);
await cp(base+'dist/font','dist/vendor/alphatab/font',{recursive:true});
await cp(base+'LICENSE','dist/vendor/alphatab/LICENSE');
await mkdir('dist/vendor/chords',{recursive:true});
await build({entryPoints:['lib/chord-voicings.js'],outfile:'dist/vendor/chords/engine.mjs',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'inline'});
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.ttf':'font/ttf','.woff2':'font/woff2','.woff':'font/woff','.txt':'text/plain; charset=utf-8'};
const files=['index.html','styles.css','themes.css','library.css',...(await readdir('dist/src')).filter(f=>f.endsWith('.js')).map(f=>'src/'+f),'vendor/chords/engine.mjs','vendor/alphatab/alphaTab.mjs','vendor/alphatab/alphaTab.core.mjs','vendor/alphatab/LICENSE','vendor/alphatab/font/Bravura.woff2','vendor/alphatab/font/Bravura.woff','vendor/alphatab/font/Bravura-OFL.txt','vendor/alphatab/font/Bravura-FONTLOG.txt'];
const assets={};for(const file of files){const buffer=await readFile('dist/'+file),binary=/\.(woff2?|ttf)$/.test(file);assets['/'+file]={type:types[file.match(/\.[^.]+$/)?.[0]]||'text/plain; charset=utf-8',encoding:binary?'base64':'utf8',body:buffer.toString(binary?'base64':'utf8')};}
for(const name of ['parse5','entities'])assets['/licenses/'+name+'.txt']={type:'text/plain; charset=utf-8',encoding:'utf8',body:await readFile('node_modules/'+name+'/LICENSE','utf8')};
assets['/licenses/chords-db.txt']={type:'text/plain; charset=utf-8',encoding:'utf8',body:await readFile('node_modules/@tombatossals/chords-db/LICENSE','utf8')};
for(const name of await readdir('node_modules/@tonaljs')){assets['/licenses/tonal-'+name+'.txt']={type:'text/plain; charset=utf-8',encoding:'utf8',body:await readFile('node_modules/@tonaljs/'+name+'/LICENSE','utf8')};}
if(process.argv.includes('--vercel')){
 // Publish only the frontend asset allowlist; dist also contains private deployment output.
 const output='build/vercel-public';
 await rm(output,{recursive:true,force:true});
 for(const [pathname,asset] of Object.entries(assets)){
  const target=output+pathname;
  await mkdir(target.slice(0,target.lastIndexOf('/')),{recursive:true});
  await writeFile(target,Buffer.from(asset.body,asset.encoding==='base64'?'base64':'utf8'));
 }
 await writeFile(output+'/robots.txt','User-agent: *\nDisallow: /\n');
 console.log('Built Vercel frontend in '+output+'; import endpoint is api/import/ultimate-guitar.js.');
}else{
await mkdir('dist/server',{recursive:true});
await build({entryPoints:['server/worker.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'inline',plugins:[{name:'embedded-assets',setup(b){b.onResolve({filter:/^open-chords:assets$/},()=>({path:'assets',namespace:'open-chords'}));b.onLoad({filter:/.*/,namespace:'open-chords'},()=>({contents:'export default '+JSON.stringify(assets),loader:'js'}));}}]});
const hosting=JSON.parse(await readFile('.openai/hosting.json','utf8'));delete hosting.static;
await mkdir('dist/.openai',{recursive:true});await writeFile('dist/.openai/hosting.json',JSON.stringify(hosting,null,2)+'\n');
console.log('Built Open Chords Worker: direct-link importer and '+files.length+' embedded reader assets.');
}
