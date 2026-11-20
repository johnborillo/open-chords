import { parse } from 'parse5';
import { fromUgStore } from '../dist/src/importers.js';

export class ImportError extends Error {
 constructor(status,code,message){super(message);this.status=status;this.code=code;}
}
const fail=(status,code,message)=>{throw new ImportError(status,code,message);};
const FALLBACK='Open the sheet and use the export bookmark or upload its saved HTML instead.';
export const PAGE_LIMIT=2*1024*1024;
export function normalizeUgUrl(input){
 if(typeof input!=='string'||input.trim().length>2048)fail(400,'INVALID_URL','Paste a full Ultimate Guitar chord-sheet link.');
 let text=input.trim();
 if(/^(?:tabs\.|www\.)?ultimate-guitar\.com\//i.test(text))text='https://'+text;
 let url;try{url=new URL(text);}catch{fail(400,'INVALID_URL','Paste a full Ultimate Guitar chord-sheet link.');}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port||!['tabs.ultimate-guitar.com','www.ultimate-guitar.com','ultimate-guitar.com'].includes(url.hostname))fail(400,'INVALID_URL','Use a link from tabs.ultimate-guitar.com.');
 if(!/^\/tab\/(?:[1-9]\d*|[a-z0-9-]+\/[a-z0-9-]+-\d+)\/?$/i.test(url.pathname))fail(400,'INVALID_URL','Paste an Ultimate Guitar sheet link, such as /tab/1789723 or a full song URL.');
 return 'https://tabs.ultimate-guitar.com'+url.pathname.replace(/\/$/,'');
}
export async function readLimited(response,limit){
 const declared=Number(response.headers.get('content-length'));
 if(Number.isFinite(declared)&&declared>limit){response.body?.cancel().catch(()=>{});fail(413,'TOO_LARGE','This page is too large to import directly. '+FALLBACK);}
 if(!response.body)return '';
 const reader=response.body.getReader(),decoder=new TextDecoder();let size=0,text='';
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){reader.cancel().catch(()=>{});fail(413,'TOO_LARGE','This page is too large to import directly. '+FALLBACK);}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();return text;}finally{reader.releaseLock();}
}
export function extractUgSong(html,source){
 const document=parse(html);const stack=[document];let store;
 while(stack.length){const node=stack.pop();const attrs=node.attrs;
  if(attrs?.some(a=>a.name==='class'&&a.value.split(/\s+/).includes('js-store'))){const raw=attrs.find(a=>a.name==='data-content')?.value;
   if(raw){try{store=JSON.parse(raw);}catch{fail(422,'PAGE_CHANGED','The page contains unreadable sheet data. '+FALLBACK);}break;}
  }
  // Template contents and script text are inert; never evaluate page JavaScript.
  if(node.childNodes)for(let i=node.childNodes.length-1;i>=0;i--)stack.push(node.childNodes[i]);
 }
 if(!store)fail(422,'NO_SHEET','No text chord sheet was found at this link. Choose a Chords or text Tab version, or use the export bookmark.');
 try{return fromUgStore(store,source);}catch{fail(422,'NO_SHEET','This page has no available text chord sheet. Choose a Chords or text Tab version. '+FALLBACK);}
}
export async function importUltimateGuitar(input,{fetchImpl=fetch,timeoutMs=15000,signal}={}){
 let url=normalizeUgUrl(input);const controller=new AbortController();
 const abort=()=>controller.abort();if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(abort,timeoutMs);
 try{
  for(let redirects=0;redirects<=3;redirects++){
   const response=await fetchImpl(url,{method:'GET',redirect:'manual',signal:controller.signal,headers:{Accept:'text/html,application/xhtml+xml','User-Agent':'OpenChords/0.2 (personal chord-sheet importer)'}});
   if([301,302,303,307,308].includes(response.status)){
    response.body?.cancel().catch(()=>{});
    const location=response.headers.get('location');
    if(!location||redirects===3)fail(502,'REDIRECT_FAILED','The sheet redirected too many times. '+FALLBACK);
    let redirected;try{redirected=new URL(location,url);}catch{fail(502,'REDIRECT_FAILED','The sheet returned an invalid redirect. '+FALLBACK);}
    // Every network hop stays on the exact approved host and sheet path.
    if(redirected.hostname!=='tabs.ultimate-guitar.com'||redirected.protocol!=='https:'||redirected.username||redirected.password||redirected.port)fail(502,'REDIRECT_BLOCKED','The link redirected away from an Ultimate Guitar sheet. '+FALLBACK);
    try{url=normalizeUgUrl(redirected.href);}catch{fail(502,'REDIRECT_BLOCKED','The link redirected away from a supported chord sheet. '+FALLBACK);}continue;
   }
   if(!response.ok){response.body?.cancel().catch(()=>{});
    if(response.status===404)fail(404,'NOT_FOUND','That sheet could not be found. Check the link and try again.');
    if([401,403,429,503].includes(response.status))fail(422,'SOURCE_BLOCKED','Ultimate Guitar is blocking direct access to this sheet. '+FALLBACK);
    fail(502,'UPSTREAM_ERROR','Ultimate Guitar could not load this sheet right now. Try again, or use the export bookmark.');
   }
   const contentType=response.headers.get('content-type')||'';
   if(!/\b(?:text\/html|application\/xhtml\+xml)\b/i.test(contentType)){response.body?.cancel().catch(()=>{});fail(422,'NOT_HTML','This link did not return a chord page. '+FALLBACK);}
   const html=await readLimited(response,PAGE_LIMIT);
   return extractUgSong(html,url);
  }
 }catch(error){
  if(error instanceof ImportError)throw error;
  if(controller.signal.aborted)fail(504,'TIMEOUT','The sheet took too long to load. Try again, or use the export bookmark.');
  fail(502,'FETCH_FAILED','Could not reach Ultimate Guitar. Try again, or use the export bookmark.');
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
function json(body,status=200,extra={}){return Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});}
export async function handleUgImport(request,options={}){
 if(request.method!=='POST')return json({error:{code:'METHOD_NOT_ALLOWED',message:'Use POST to import a sheet.'}},405,{Allow:'POST'});
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:{code:'ORIGIN_NOT_ALLOWED',message:'Open the importer from this site.'}},403);
 if(!/^application\/json\b/i.test(request.headers.get('content-type')||''))return json({error:{code:'INVALID_REQUEST',message:'Send a chord-sheet link as JSON.'}},415);
 try{
  const raw=await readLimited(request,4096);let body;try{body=JSON.parse(raw);}catch{fail(400,'INVALID_REQUEST','Paste a valid Ultimate Guitar link and try again.');}
  const song=await importUltimateGuitar(body?.url,{...options,signal:request.signal});
  return json({schema:'open-chords/v1',song});
 }catch(error){if(error instanceof ImportError)return json({error:{code:error.code,message:error.message}},error.status);
  return json({error:{code:'IMPORT_FAILED',message:'This sheet could not be imported. Try the export bookmark instead.'}},502);
 }
}
