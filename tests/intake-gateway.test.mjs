import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,readdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {request} from 'node:http';
import {createBuildHandoff} from '../src/build-handoff.mjs';
import {validateIntakeRoot,intakeAuthorized,createIntakeLimiter,stageIntake,inspectIntake,startIntakeGateway} from '../src/intake-gateway.mjs';
const token='private-gateway-test-token-more-than-32-characters';
const fresh=()=>createBuildHandoff({functionId:'math.sqrt',mode:'reviewed-build',idempotencyKey:'intake-test-123456789',requestId:'00000000-0000-4000-8000-000000000024',createdAt:new Date().toISOString()});
const temp=()=>mkdtemp(join(tmpdir(),'audk-intake-'));
async function http(port,path,{method='GET',auth=true,origin=false,body,contentType='application/json'}={}){
 const payload=body===undefined?null:typeof body==='string'?body:JSON.stringify(body);
 return new Promise((resolve,reject)=>{
  const headers={...(auth?{Authorization:'Bearer '+token}:{}),...(origin?{Origin:'https://audk.digitalcrossdock.com'}:{}),...(payload!==null?{'Content-Type':contentType,'Content-Length':Buffer.byteLength(payload)}:{})};
  const req=request({host:'127.0.0.1',port,path,method,headers},res=>{let data='';res.on('data',chunk=>data+=chunk);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(data)}))});
  req.on('error',reject);req.end(payload);
 });
}

test('intake authentication requires a strong private token and rejects browser origins',async()=>{
 assert.equal(intakeAuthorized('Bearer '+token,token),true);
 assert.equal(intakeAuthorized('Bearer wrong',token),false);
 assert.equal(intakeAuthorized(undefined,token),false);
 assert.throws(()=>intakeAuthorized('Bearer a','short'),/32/);
 const root=await temp();
 try{
  assert.throws(()=>startIntakeGateway({root,token,host:'0.0.0.0'}),/loopback/);
  const server=await startIntakeGateway({root,token,port:0});
  try{
   const port=server.address().port;
   assert.equal((await http(port,'/v1/intake/health',{auth:false})).status,401);
   assert.equal((await http(port,'/v1/intake/health',{origin:true})).status,403);
   const ok=await http(port,'/v1/intake/health');
   assert.equal(ok.status,200);assert.equal(ok.body.execution,false);
  }finally{await new Promise(resolve=>server.close(resolve))}
 }finally{await rm(root,{recursive:true,force:true})}
});
test('intake root cannot overlap source or build storage',async()=>{
 const root=await temp();
 try{
  assert.throws(()=>validateIntakeRoot(root,{buildRoot:root}),/separate/);
  assert.throws(()=>validateIntakeRoot(root,{buildRoot:join(root,'jobs')}),/separate/);
  assert.throws(()=>validateIntakeRoot('relative'),/absolute/);
 }finally{await rm(root,{recursive:true,force:true})}
});
test('quarantined intake is immutable, idempotent, and does not create build jobs',async()=>{
 const root=await temp();
 try{
  const doc=fresh();
  const first=await stageIntake(root,doc);
  assert.equal(first.state,'quarantined');assert.equal(first.replayed,false);
  const again=await stageIntake(root,doc);
  assert.equal(again.digest,first.digest);assert.equal(again.replayed,true);
  await assert.rejects(()=>stageIntake(root,{...doc,request:{...doc.request,mode:'specification'}}),/Conflicting/);
  const files=await readdir(join(root,'inbox'));
  assert.equal(files.length,1);
  assert.equal(JSON.parse(await readFile(join(root,'inbox',files[0]),'utf8')).policy.automaticExecution,false);
  await assert.rejects(()=>readdir(join(root,'jobs')));
  const receipt=await inspectIntake(root,doc.requestId);
  assert.equal(receipt.mode,'reviewed-build');assert.equal(receipt.state,'quarantined');
 }finally{await rm(root,{recursive:true,force:true})}
});
test('handoff validation denies policy elevation, arbitrary fields and stale envelopes',async()=>{
 const root=await temp();
 try{
  const doc=fresh();
  for(const altered of [
   {...doc,policy:{...doc.policy,automaticExecution:true}},
   {...doc,script:'shell'},
   {...doc,request:{...doc.request,source:'https://example.net/x.js'}},
   {...doc,createdAt:'2015-01-01T00:00:00.000Z'},
  ])await assert.rejects(()=>stageIntake(root,altered));
  assert.equal((await readdir(root)).length,0);
 }finally{await rm(root,{recursive:true,force:true})}
});
test('rate limiter enforces bounded quotas and resets at window boundary',()=>{
 let time=0;const limiter=createIntakeLimiter({capacity:2,windowMs:1000,clock:()=>time});
 assert.equal(limiter.take(),true);assert.equal(limiter.take(),true);assert.equal(limiter.take(),false);
 time=1001;assert.equal(limiter.take(),true);
 assert.throws(()=>createIntakeLimiter({capacity:0}),/bounds/);
});
test('gateway rejects oversized JSON, invalid content types, unknown paths and conflicting ID',async()=>{
 const root=await temp(),server=await startIntakeGateway({root,token,port:0,rateLimit:12,maxItems:1});
 try{
  const port=server.address().port,doc=fresh();
  assert.equal((await http(port,'/v1/intake',{method:'POST',body:doc,contentType:'text/plain'})).status,415);
  assert.equal((await http(port,'/v1/intake',{method:'POST',body:' '.repeat(4097)})).status,413);
  assert.equal((await http(port,'/v1/intake',{method:'POST',body:'bad'})).status,400);
  assert.equal((await http(port,'/v1/intake',{method:'POST',body:{...doc,command:'run'}})).status,400);
  const a=await http(port,'/v1/intake',{method:'POST',body:doc});assert.equal(a.status,201);
  assert.equal((await http(port,'/v1/intake',{method:'POST',body:doc})).status,200);
  assert.equal((await http(port,'/v1/intake',{method:'POST',body:{...doc,request:{...doc.request,mode:'specification'}}})).status,409);
  const status=await http(port,'/v1/intake/'+doc.requestId);
  assert.equal(status.status,200);assert.equal(status.body.state,'quarantined');
  assert.equal((await http(port,'/v1/jobs')).status,404);
  const next={...doc,requestId:'00000000-0000-4000-8000-000000000025'};
  assert.equal((await http(port,'/v1/intake',{method:'POST',body:next})).status,429);
 }finally{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true})}
});
test('private gateway never auto-queues or executes after authorized POST',async()=>{
 const root=await temp(),server=await startIntakeGateway({root,token,port:0,rateLimit:2});
 try{
  const port=server.address().port;
  const accepted=await http(port,'/v1/intake',{method:'POST',body:fresh()});
  assert.equal(accepted.status,201);
  assert.equal(accepted.body.automaticExecution,false);
  assert.equal(accepted.body.automaticPublication,false);
  await assert.rejects(()=>readdir(join(root,'jobs')));
  assert.equal((await http(port,'/v1/intake/health')).status,200);
  assert.equal((await http(port,'/v1/intake/health')).status,429);
 }finally{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true})}
});
test('public static studio retains no token, no remote intake submission',async()=>{
 const {readFile}=await import('node:fs/promises');
 const ui=await readFile(new URL('../build-service-ui.js',import.meta.url),'utf8');
 assert.doesNotMatch(ui,/AUDK_INTAKE_TOKEN|Authorization|fetch\([^)]*\/v1\/intake/);
 const gateway=await readFile(new URL('../src/intake-gateway.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(gateway,/runQueuedBuildJobs|submitBuildJob|spawnSync|execFileSync/);
});
