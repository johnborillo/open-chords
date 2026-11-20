import http from 'node:http';
import worker from '../dist/server/index.js';
const port=Number(process.env.PORT||4173);
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://'+(req.headers.host||'localhost:'+port));
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>4096){res.writeHead(413,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:'The request is too large.'}}));return;}chunks.push(chunk);}
  const body=chunks.length?Buffer.concat(chunks):undefined;
  const request=new Request(url,{method:req.method,headers:req.headers,...(body?{body}:{} )});
  const response=await worker.fetch(request);
  res.writeHead(response.status,Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Request failed');}
}).listen(port,'0.0.0.0',()=>console.log('Open Chords: http://localhost:'+port));
