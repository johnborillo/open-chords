import assets from 'open-chords:assets';
import {handleUgImport} from './ug-import.js';

export default {
 async fetch(request){
  const url=new URL(request.url);
  if(url.pathname==='/api/import/ultimate-guitar')return handleUgImport(request);
  if(url.pathname.startsWith('/api/'))return Response.json({error:{message:'Not found'}},{status:404,headers:{'Cache-Control':'no-store'}});
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
  if(url.pathname==='/robots.txt')return new Response(request.method==='HEAD'?null:'User-agent: *\nDisallow: /\n',{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-cache','X-Robots-Tag':'noindex, nofollow, noarchive'}});
  const asset=assets[url.pathname==='/'?'/index.html':url.pathname];
  if(!asset)return new Response('Not found',{status:404});
  const body=request.method==='HEAD'?null:asset.encoding==='base64'?Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)):asset.body;
  return new Response(body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
 }
};
