import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createBuildHandoff,validateBuildHandoff} from '../src/build-handoff.mjs';
import {inspectBuildHandoff,importBuildHandoff} from '../src/build-handoff-import.mjs';
import {readBuildJob,runQueuedBuildJobs} from '../src/build-service.mjs';
const plan=JSON.parse(await readFile(new URL('../catalog/assembly-plan.json',import.meta.url),'utf8'));
const ID='00000000-0000-4000-8000-000000000001';
const KEY='test-offline-handoff-00001';
const fresh=()=>createBuildHandoff({functionId:'math.sqrt',mode:'reviewed-build',idempotencyKey:KEY,requestId:ID,createdAt:new Date().toISOString()});
const temp=()=>mkdtemp(join(tmpdir(),'audk-handoff-'));
test('browser-safe handoff is metadata-only with fixed policy and strict shape',()=>{
 const doc=fresh();
 assert.equal(doc.schema,'audk.build-handoff.v1');
 assert.deepEqual(validateBuildHandoff(doc),doc.request);
 assert.equal(doc.policy.automaticExecution,false);
 assert.equal(doc.policy.automaticPublication,false);
 assert.equal(doc.policy.operatorApprovalRequired,true);
 for(const patch of [
  {...doc,script:'rm -rf /'},
  {...doc,policy:{...doc.policy,automaticPublication:true}},
  {...doc,policy:{...doc.policy,automaticExecution:true}},
  {...doc,request:{...doc.request,code:'print(1)'}},
  {...doc,request:{...doc.request,mode:'shell'}},
  {...doc,requestId:'not-a-uuid'},
  {...doc,createdAt:'2099-01-01T00:00:00.000Z'},
  {...doc,createdAt:'2020-01-01T00:00:00.000Z'},
  {...doc,createdAt:'2026-11-01'},
 ])assert.throws(()=>validateBuildHandoff(patch));
});
test('handoff timestamp validation rejects edge cases and allows normal offline transfer',()=>{
 const now=Date.parse('2026-11-01T15:00:00.000Z');
 const doc={...fresh(),createdAt:'2026-10-31T15:00:00.000Z'};
 assert.equal(validateBuildHandoff(doc,{now}).functionId,'math.sqrt');
 assert.throws(()=>validateBuildHandoff({...doc,createdAt:'2026-11-01T15:06:00.000Z'},{now}),/future/);
 assert.throws(()=>validateBuildHandoff({...doc,createdAt:'2026-10-01T15:00:00.000Z'},{now}),/Expired/);
});
test('private importer only inspects by default; reviewed builds require extra approval to enqueue',async()=>{
 const dir=await temp(),file=join(dir,'request.json'),data=join(dir,'jobs-private');
 try{
  await writeFile(file,JSON.stringify(fresh()));
  const inspected=await inspectBuildHandoff(file,plan);
  assert.equal(inspected.eligibleForIntake,true);
  assert.equal(inspected.requiresReviewedBuildApproval,true);
  const preview=await importBuildHandoff(file,plan,{dataRoot:data});
  assert.equal(preview.status,'inspected-not-queued');
  await assert.rejects(()=>readFile(join(data,'jobs','notcreated.json')));
  await assert.rejects(()=>importBuildHandoff(file,plan,{enqueue:true,dataRoot:data}),/approve-reviewed/);
  const queued=await importBuildHandoff(file,plan,{enqueue:true,approveReviewed:true,dataRoot:data});
  assert.equal(queued.status,'queued');assert.equal(queued.jobState,'queued');
  const replay=await importBuildHandoff(file,plan,{enqueue:true,approveReviewed:true,dataRoot:data});
  assert.equal(replay.jobId,queued.jobId);
  const job=await readBuildJob(data,queued.jobId);
  assert.equal(job.state,'queued');assert.equal(job.publication,'disabled');
  assert.equal(job.reviewRequired,true);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('unreviewed functions cannot enter executable mode via downloaded metadata',async()=>{
 const dir=await temp(),file=join(dir,'request.json');
 try{
  const doc={...fresh(),request:{functionId:'math.tan',mode:'reviewed-build',idempotencyKey:KEY}};
  await writeFile(file,JSON.stringify(doc));
  await assert.rejects(()=>inspectBuildHandoff(file,plan),/Execution denied/);
  doc.request.mode='specification';await writeFile(file,JSON.stringify(doc));
  const safe=await importBuildHandoff(file,plan,{enqueue:true,dataRoot:join(dir,'data')});
  assert.equal(safe.requiresReviewedBuildApproval,false);
  assert.equal(safe.jobState,'queued');
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('operator intake rejects oversized, symlinked, malformed and unknown requests',async(t)=>{
 const dir=await temp(),file=join(dir,'request.json');
 try{
  await writeFile(file,JSON.stringify({...fresh(),unknown:'bad'}));
  await assert.rejects(()=>inspectBuildHandoff(file,plan));
  await writeFile(file,'{oops');await assert.rejects(()=>inspectBuildHandoff(file,plan),/JSON/);
  await writeFile(file,' '.repeat(4097));await assert.rejects(()=>inspectBuildHandoff(file,plan),/small/);
  await writeFile(file,JSON.stringify(fresh()));
  const link=join(dir,'alias.json');
  try{await symlink(file,link,'file')}
  catch(e){if(['EPERM','EACCES','ENOSYS'].includes(e.code)){t.diagnostic('Symlink unavailable');return}throw e}
  await assert.rejects(()=>inspectBuildHandoff(link,plan),/regular/);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('CLI enforces default inspect-only and no unknown switches',async()=>{
 const dir=await temp(),file=join(dir,'request.json');
 try{
  await writeFile(file,JSON.stringify(fresh()));
  const script=new URL('../scripts/import-build-handoff.mjs',import.meta.url);
  const out=JSON.parse(execFileSync(process.execPath,[fileURLToPath(script),file],{encoding:'utf8'}));
  assert.equal(out.status,'inspected-not-queued');
  assert.throws(()=>execFileSync(process.execPath,[fileURLToPath(script),file,'--approve-reviewed'],{stdio:'pipe'}));
  assert.throws(()=>execFileSync(process.execPath,[fileURLToPath(script),file,'--execute'],{stdio:'pipe'}));
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('browser export and server are still static with no privileged network connection',async()=>{
 const src=await readFile(new URL('../build-service-ui.js',import.meta.url),'utf8');
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.match(src,/createBuildHandoff/);assert.match(src,/crypto\.randomUUID/);
 assert.match(html,/builder-download/);assert.match(html,/private operator CLI/);
 assert.doesNotMatch(src,/fetch\([^)]*\/v1\/jobs/);
 assert.doesNotMatch(src,/AUDK_BUILD_TOKEN|Authorization:/);
});
