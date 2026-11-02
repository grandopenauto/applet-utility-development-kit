/** AUDK v1.3 operator-only API. NO public ingress, CORS, or arbitrary code upload. */
import http from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {submitBuildJob,readBuildJob,assertDataRoot} from './build-service.mjs';
const hashed=s=>createHash('sha256').update(s).digest();
export function authorize(value,token){
 if(typeof token!=='string'||token.length<32)throw Error('AUDK_BUILD_TOKEN must be at least 32 characters');
 if(typeof value!=='string'||!value.startsWith('Bearer '))return false;
 return timingSafeEqual(hashed(value.slice(7)),hashed(token));
}
export function startPrivateBuildApi({dataRoot,token,port=4193,host='127.0.0.1'}={}){
 assertDataRoot(dataRoot);
 if(host!=='127.0.0.1'&&host!=='::1')throw Error('Only loopback bindings are allowed');
 if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid private API port');
 authorize('',token);
 const server=http.createServer(async(req,res)=>{
  const reply=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(JSON.stringify(body))};
  if(!authorize(req.headers.authorization,token)){reply(401,{error:'Unauthorized'});return}
  const u=new URL(req.url,'http://localhost');
  if(req.headers.origin){reply(403,{error:'Browser origins are not authorized'});return}
  try{
   if(req.method==='GET'&&u.pathname==='/v1/health'){reply(200,{ok:true,mode:'private-loopback',publication:false});return}
   if(req.method==='POST'&&u.pathname==='/v1/jobs'){
    if(req.headers['content-type']?.split(';')[0]!=='application/json')throw Error('JSON content type required');
    let size=0;const chunks=[];
    for await(const b of req){size+=b.length;if(size>4096){reply(413,{error:'Request too large'});return}chunks.push(b)}
    const request=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const plan=JSON.parse(await readFile(new URL('../catalog/assembly-plan.json',import.meta.url),'utf8'));
    const job=await submitBuildJob(dataRoot,request,plan);
    reply(202,job);return;
   }
   if(req.method==='GET'&&/^\/v1\/jobs\/[0-9a-f-]{36}$/.test(u.pathname)){
    const job=await readBuildJob(dataRoot,u.pathname.slice('/v1/jobs/'.length));reply(200,job);return;
   }
   reply(404,{error:'Unknown private endpoint'});
  }catch(e){reply(400,{error:String(e.message).slice(0,180)})}
 });
 return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>resolve(server))});
}
