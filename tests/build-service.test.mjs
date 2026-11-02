import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {request} from 'node:http';
import {assertDataRoot,validateBuildRequest,submitBuildJob,readBuildJob,runQueuedBuildJobs} from '../src/build-service.mjs';
import {startPrivateBuildApi,authorize} from '../src/private-build-api.mjs';
const plan=JSON.parse(await readFile(new URL('../catalog/assembly-plan.json',import.meta.url),'utf8'));
const temp=()=>mkdtemp(join(tmpdir(),'audk-private-build-'));
const key='test-idempotency-key-0001';
test('build service refuses published checkout and arbitrary executable candidates',async()=>{
 assert.throws(()=>assertDataRoot(fileURLToPath(new URL('../library/',import.meta.url))),/public AUDK checkout/);
 assert.throws(()=>validateBuildRequest({functionId:'math.tan',mode:'reviewed-build',idempotencyKey:key},plan),/Execution denied/);
 assert.throws(()=>validateBuildRequest({functionId:'builtins.eval',mode:'reviewed-build',idempotencyKey:key},plan),/Execution denied/);
 assert.throws(()=>validateBuildRequest({functionId:'math.sqrt',mode:'shell',idempotencyKey:key},plan),/Unsupported/);
 assert.throws(()=>validateBuildRequest({functionId:'math.sqrt',mode:'reviewed-build',idempotencyKey:key,script:'evil'},plan),/Invalid/);
});
test('durable jobs, retry idempotency, and review-only candidate spec',async()=>{
 const dir=await temp();
 const req={functionId:'math.tan',mode:'specification',idempotencyKey:key};
 const original=await submitBuildJob(dir,req,plan);
 const replay=await submitBuildJob(dir,req,plan);
 assert.equal(replay.jobId,original.jobId);
 await assert.rejects(()=>submitBuildJob(dir,{...req,functionId:'math.sqrt'},plan),/already bound/);
 const results=await runQueuedBuildJobs(dir,{limit:1});
 assert.equal(results[0].state,'completed');assert.equal(results[0].artifacts.length,1);
 const saved=await readBuildJob(dir,original.jobId);
 assert.equal(saved.publication,'disabled');
 assert.equal(saved.validation,'metadata-only');
 assert.equal((await readdir(join(dir,'jobs',original.jobId))).some(x=>x.endsWith('.py')),false);
 assert.deepEqual(await runQueuedBuildJobs(dir,{limit:1}),[]);
});
test('reviewed recipe builds tested portable artifacts and remains unpublished',async()=>{
 const dir=await temp();const job=await submitBuildJob(dir,{functionId:'math.sqrt',mode:'reviewed-build',idempotencyKey:key},plan);
 const completed=(await runQueuedBuildJobs(dir,{python:process.env.AUDK_TEST_PYTHON||'python'}))[0];
 assert.equal(completed.jobId,job.jobId);assert.equal(completed.state,'completed',completed.error);
 assert.equal(completed.validation,'js-syntax,node-test,python-example');
 assert.equal(completed.artifacts.length,4);
 assert.equal(completed.artifacts.every(x=>/^[0-9a-f]{64}$/.test(x.sha256)),true);
 assert.equal(completed.reviewRequired,true);assert.equal(completed.publication,'disabled');
});
test('auth uses constant-time digests and requires a long operator token',()=>{
 const token='operator-test-only-token-with-32-plus-chars';
 assert.equal(authorize('Bearer '+token,token),true);
 assert.equal(authorize('Bearer wrong',token),false);
 assert.equal(authorize(undefined,token),false);
 assert.throws(()=>authorize('Bearer x','short'),/32/);
});
function send(port,path,{method='GET',token='',body=null,origin=null}={}){
 return new Promise((resolve,reject)=>{
  const payload=body===null?null:JSON.stringify(body);
  const headers={...(token?{Authorization:'Bearer '+token}:{}),...(origin?{Origin:origin}:{}),...(payload?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}:{})};
  const req=request({host:'127.0.0.1',port,path,method,headers},res=>{let text='';res.on('data',b=>text+=b);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(text)}))});
  req.on('error',reject);req.end(payload);
 });
}
test('loopback API rejects unauthorized and cross-origin requests; accepted job needs offline worker',async()=>{
 const dir=await temp(),token='private-test-operator-token-01234567890123456789';
 assert.throws(()=>startPrivateBuildApi({dataRoot:dir,token,host:'0.0.0.0'}),/loopback/);
 const server=await startPrivateBuildApi({dataRoot:dir,token,port:0});
 try{
  const port=server.address().port;
  const unauthorized=await send(port,'/v1/health');assert.equal(unauthorized.status,401);
  const browser=await send(port,'/v1/health',{token,origin:'https://audk.digitalcrossdock.com'});assert.equal(browser.status,403);
  const health=await send(port,'/v1/health',{token});assert.equal(health.status,200);
  const denied=await send(port,'/v1/jobs',{method:'POST',token,body:{functionId:'os.system',mode:'reviewed-build',idempotencyKey:'test-idempotency-key-0002'}});
  assert.equal(denied.status,400);
  const accepted=await send(port,'/v1/jobs',{method:'POST',token,body:{functionId:'math.sqrt',mode:'reviewed-build',idempotencyKey:'test-idempotency-key-0003'}});
  assert.equal(accepted.status,202);assert.equal(accepted.body.state,'queued');
  const info=await send(port,'/v1/jobs/'+accepted.body.jobId,{token});assert.equal(info.status,200);
  assert.equal(info.body.publication,'disabled');
 }finally{await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
});
test('public studio prepares requests but has no remote build submission',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const src=await readFile(new URL('../build-service-ui.js',import.meta.url),'utf8');
 const server=await readFile(new URL('../src/server.mjs',import.meta.url),'utf8');
 assert.match(html,/data-tab="build-service"/);
 assert.match(html,/id="builder-download"/);
 assert.match(server,/build-service-ui\.js/);
 assert.match(src,/crypto\.randomUUID/);
 assert.doesNotMatch(src,/fetch\([^)]*\/v1\/jobs/);
 assert.doesNotMatch(src,/Authorization|AUDK_BUILD_TOKEN/);
});
