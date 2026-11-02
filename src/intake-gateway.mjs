/** AUDK v1.9 — private, metadata-only intake quarantine.
 * This server is NOT a build worker, publication endpoint or public web service.
 */
import http from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import {mkdir,open,readFile,readdir,lstat} from 'node:fs/promises';
import {isAbsolute,resolve,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateBuildHandoff} from './build-handoff.mjs';

const HOME=resolve(fileURLToPath(new URL('..',import.meta.url)));
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BYTES=4096;
const sha=s=>createHash('sha256').update(s).digest('hex');
const inside=(base,child)=>{const rel=relative(base,child);return !rel||(!rel.startsWith('..')&&!isAbsolute(rel));};

export function validateIntakeRoot(root,{buildRoot}={}){
 if(typeof root!=='string'||!isAbsolute(root))throw Error('Intake root must be an absolute directory');
 const path=resolve(root);
 if(inside(HOME,path)||inside(path,HOME))throw Error('Intake root must be separate from AUDK source');
 if(buildRoot){
  if(typeof buildRoot!=='string'||!isAbsolute(buildRoot))throw Error('Build root must be absolute');
  const other=resolve(buildRoot);
  if(inside(path,other)||inside(other,path))throw Error('Intake root must be separate from build-job storage');
 }
 return path;
}
export function intakeAuthorized(header,token){
 if(typeof token!=='string'||token.length<32||token.length>256)throw Error('Private intake token must be 32–256 characters');
 if(typeof header!=='string'||!header.startsWith('Bearer '))return false;
 const a=Buffer.from(sha(header.slice(7)),'hex'),b=Buffer.from(sha(token),'hex');
 return timingSafeEqual(a,b);
}
export function createIntakeLimiter({capacity=12,windowMs=60000,clock=()=>Date.now()}={}){
 if(!Number.isInteger(capacity)||capacity<1||capacity>120||!Number.isInteger(windowMs)||windowMs<1000||windowMs>3600000)throw Error('Invalid limiter bounds');
 let start=clock(),used=0;
 return {take(){const t=clock();if(t<start||t-start>=windowMs){start=t;used=0}if(used>=capacity)return false;used++;return true}};
}
const safeId=id=>typeof id==='string'&&UUID.test(id);
const inboxPath=(root,id)=>join(root,'inbox',id.toLowerCase()+'.json');
const encode=doc=>JSON.stringify(doc,null,2)+'\n';

/** Validate BEFORE writing; a new request is stored only in quarantine, never in jobs/. */
export async function stageIntake(root,doc,{now=Date.now(),maxItems=1000}={}){
 const safeRoot=validateIntakeRoot(root);validateBuildHandoff(doc,{now});
 if(!Number.isInteger(maxItems)||maxItems<1||maxItems>10000)throw Error('Invalid inbox capacity');
 const inbox=join(safeRoot,'inbox');await mkdir(inbox,{recursive:true,mode:0o700});
 const id=doc.requestId.toLowerCase(),path=inboxPath(safeRoot,id),payload=encode(doc);
 if(Buffer.byteLength(payload)>MAX_BYTES)throw Error('Intake document exceeds size limit');
 const fingerprint=sha(payload);
 try{
  const info=await lstat(path);
  if(!info.isFile()||info.isSymbolicLink())throw Error('Unsafe existing intake record');
  const existing=await readFile(path);
  if(sha(existing)!==fingerprint)throw Error('Conflicting request ID');
  return {requestId:id,state:'quarantined',replayed:true,digest:fingerprint,automaticExecution:false,automaticPublication:false};
 }catch(e){if(e.code!=='ENOENT')throw e}
 const files=(await readdir(inbox)).filter(name=>/^[0-9a-f-]{36}\.json$/.test(name));
 if(files.length>=maxItems)throw Error('Intake capacity reached');
 let f;
 try{
  f=await open(path,'wx',0o600);
  await f.writeFile(payload);
 }catch(e){
  if(e.code!=='EEXIST')throw e;
  const info=await lstat(path);
  if(!info.isFile()||info.isSymbolicLink())throw Error('Unsafe existing intake record');
  const existing=await readFile(path);
  if(sha(existing)!==fingerprint)throw Error('Conflicting request ID');
  return {requestId:id,state:'quarantined',replayed:true,digest:fingerprint,automaticExecution:false,automaticPublication:false};
 }finally{await f?.close()}
 return {requestId:id,state:'quarantined',replayed:false,digest:fingerprint,automaticExecution:false,automaticPublication:false};
}
export async function inspectIntake(root,id){
 const safeRoot=validateIntakeRoot(root);
 if(!safeId(id))throw Error('Invalid intake identifier');
 const path=inboxPath(safeRoot,id);
 const info=await lstat(path);
 if(!info.isFile()||info.isSymbolicLink()||info.size>MAX_BYTES)throw Error('Invalid intake record');
 const raw=await readFile(path);
 const doc=JSON.parse(raw.toString('utf8'));
 validateBuildHandoff(doc,{now:Date.parse(doc.createdAt)});
 return {requestId:doc.requestId,state:'quarantined',functionId:doc.request.functionId,mode:doc.request.mode,createdAt:doc.createdAt,digest:sha(raw),automaticExecution:false,automaticPublication:false};
}

/** Loopback-only service, no CORS, no queue access, no executable commands. */
export function startIntakeGateway({root,token,port=4194,host='127.0.0.1',rateLimit=12,maxItems=1000,buildRoot}={}){
 const dataRoot=validateIntakeRoot(root,{buildRoot});
 if(!['127.0.0.1','::1'].includes(host))throw Error('Intake gateway must bind loopback only');
 if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid intake port');
 intakeAuthorized('',token);
 const limiter=createIntakeLimiter({capacity:rateLimit});
 const server=http.createServer(async(req,res)=>{
  const reply=(code,obj)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj))};
  if(!intakeAuthorized(req.headers.authorization,token)){reply(401,{error:'Unauthorized'});return}
  if(req.headers.origin){reply(403,{error:'Browser origins are not authorized'});return}
  if(!limiter.take()){reply(429,{error:'Intake rate limit exceeded'});return}
  const url=new URL(req.url,'http://localhost');
  try{
   if(req.method==='GET'&&url.pathname==='/v1/intake/health'){reply(200,{ok:true,mode:'quarantine-only',publication:false,execution:false});return}
   if(req.method==='POST'&&url.pathname==='/v1/intake'){
    if(req.headers['content-type']?.split(';')[0]?.trim()!=='application/json'){reply(415,{error:'JSON required'});return}
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>MAX_BYTES){reply(413,{error:'Envelope too large'});return}chunks.push(chunk)}
    let doc;try{doc=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{reply(400,{error:'Invalid JSON'});return}
    const result=await stageIntake(dataRoot,doc,{maxItems});
    reply(result.replayed?200:201,result);return;
   }
   const found=/^\/v1\/intake\/([a-f0-9-]{36})$/i.exec(url.pathname);
   if(req.method==='GET'&&found){
    try{reply(200,await inspectIntake(dataRoot,found[1]))}
    catch(e){if(e.code==='ENOENT')reply(404,{error:'Unknown request'});else throw e}
    return;
   }
   reply(404,{error:'Unknown private endpoint'});
  }catch(e){
   const message=String(e.message||'');
   if(/Conflicting request ID/.test(message)){reply(409,{error:'Request ID already used'});return}
   if(/capacity/.test(message)){reply(429,{error:'Inbox at capacity'});return}
   reply(400,{error:'Invalid intake request'});
  }
 });
 server.requestTimeout=10000;server.headersTimeout=6000;server.keepAliveTimeout=1000;server.maxRequestsPerSocket=50;
 return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>resolve(server))});
}
