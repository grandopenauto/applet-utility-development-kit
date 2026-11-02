import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {prepareProductionBatch,executeProductionBatch} from '../src/production-batch.mjs';
import {UNIVERSAL_RECIPES} from '../src/universal-wizard.mjs';
import {verifyBuildJob} from '../src/build-service.mjs';
const plan=JSON.parse(await readFile(new URL('../catalog/assembly-plan.json',import.meta.url),'utf8'));
const python=process.env.AUDK_TEST_PYTHON||'python';
const ids=['math.sqrt','math.gcd'];

test('batch planning is bounded, explicit and review-gated',()=>{
 const result=prepareProductionBatch({reviewed:ids,proposals:['math.tan']},plan);
 assert.equal(result.reviewed.length,2);
 assert.equal(result.proposals[0].runtimeEnabled,false);
 assert.equal(result.proposals[0].publishEnabled,false);
 assert.equal(result.policy.automaticPullRequests,false);
 assert.match(result.planFingerprint,/^[a-f0-9]{64}$/);
 assert.deepEqual(prepareProductionBatch({reviewed:ids,proposals:['math.tan']},plan),result);
});
test('rejects unreviewed execution, duplicate IDs, overlap, unlisted proposals and excessive batches',()=>{
 for(const input of [
  {reviewed:['math.tan']},{reviewed:['os.system']},{reviewed:['math.sqrt','math.sqrt']},
  {reviewed:['math.sqrt'],proposals:['math.sqrt']},{proposals:['os.system']},
  {reviewed:[]},{reviewed:Array(11).fill('math.sqrt')},{proposals:Array(26).fill('math.tan')},
 ])assert.throws(()=>prepareProductionBatch(input,plan));
});
test('actual private batch builds two reviewed functions, verifies evidence and stages inert proposal',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'audk-production-'));
 try{
  const output=join(parent,'batch-one');
  const {report}=await executeProductionBatch({reviewed:ids,proposals:['math.tan']},{output,python,plan});
  assert.equal(report.reviewedBuilt,2);
  assert.equal(report.proposalsPrepared,1);
  assert.equal(report.publication,'disabled');
  assert.equal(report.automaticPullRequests,false);
  assert.equal(report.status,'staged-for-manual-review');
  for(const record of report.reviewed){
   assert.equal(record.artifacts.length,4);
   assert.equal((await verifyBuildJob(output,record.jobId)).reproducible,true);
   assert.match(record.evidenceSha256,/^[a-f0-9]{64}$/);
  }
  const proposal=JSON.parse(await readFile(join(output,report.proposals[0].path),'utf8'));
  assert.equal(proposal.functionId,'math.tan');
  assert.equal(proposal.runtimeEnabled,false);
  assert.equal((await readdir(join(output,'jobs'))).filter(x=>/^[a-f0-9-]{36}$/.test(x)).length,2);
  assert.match(await readFile(join(output,'REVIEW-CHECKLIST.md'),'utf8'),/manual|review|pull request/i);
  await assert.rejects(()=>executeProductionBatch({reviewed:ids},{output,python,plan}),/EEXIST/);
 }finally{await rm(parent,{recursive:true,force:true})}
});
test('specification-only batch writes no executable jobs',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'audk-production-proposal-'));
 try{
  const output=join(parent,'proposals-only');
  const {report}=await executeProductionBatch({reviewed:[],proposals:['math.tan','math.acos']},{output,python,plan});
  assert.equal(report.reviewedBuilt,0);assert.equal(report.proposalsPrepared,2);
  await assert.rejects(()=>stat(join(output,'jobs')),{code:'ENOENT'});
  assert.equal((await readdir(join(output,'proposals'))).length,2);
 }finally{await rm(parent,{recursive:true,force:true})}
});
test('private output must not exist or overlap source; does not write before approval',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'audk-output-check-'));
 try{
  await assert.rejects(()=>executeProductionBatch({reviewed:ids},{output:'relative',python,plan}),/absolute/);
  await assert.rejects(()=>executeProductionBatch({reviewed:ids},{output:parent,python,plan}),/EEXIST/);
  assert.equal((await readdir(parent)).length,0);
 }finally{await rm(parent,{recursive:true,force:true})}
});
test('CLI defaults to inspect-only and does not create files',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'audk-prod-cli-'));
 try{
  const missing=join(parent,'still-missing');
  const proc=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/produce-applet-batch.mjs',import.meta.url)),'--reviewed','math.sqrt','--output',missing],{encoding:'utf8',timeout:8000});
  assert.equal(proc.status,0,proc.stderr);
  const result=JSON.parse(proc.stdout);
  assert.equal(result.mode,'inspect-only');assert.equal(result.outputWritten,false);
  assert.deepEqual(await readdir(parent),[]);
 }finally{await rm(parent,{recursive:true,force:true})}
});
