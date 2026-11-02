import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {submitBuildJob,runQueuedBuildJobs,verifyBuildJob} from '../src/build-service.mjs';
import {BUILD_EVIDENCE_SCHEMA,expectedBuildFiles,makeBuildEvidence,readAssemblyPlan} from '../src/build-evidence.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const tmp=()=>mkdtemp(join(tmpdir(),'audk-evidence-'));
const plan=await readAssemblyPlan();
const req=(id,mode,key)=>({functionId:id,mode,idempotencyKey:key});

async function built(id,mode,key){
 const root=await tmp();const job=await submitBuildJob(root,req(id,mode,key),plan);
 const [result]=await runQueuedBuildJobs(root,{limit:1,python:process.env.AUDK_TEST_PYTHON||'python'});
 assert.equal(result.state,'completed',result.error);
 return {root,job:result,dir:join(root,'jobs',job.jobId)};
}

test('reviewed output has a separate reproducible evidence record',async()=>{
 const {root,job,dir}=await built('math.sqrt','reviewed-build','evidence-reviewed-0001');
 assert.equal(job.artifacts.length,4);
 assert.equal(job.evidence.schema,BUILD_EVIDENCE_SCHEMA);
 const receipt=JSON.parse(await readFile(join(dir,'evidence.json'),'utf8'));
 assert.equal(receipt.artifacts.length,4);
 assert.match(receipt.sourceFingerprint,/^[a-f0-9]{64}$/);
 assert.equal(receipt.publication,'disabled');
 assert.equal(receipt.evidenceType,'reproducible-checksums-not-a-signed-attestation');
 const checked=await verifyBuildJob(root,job.jobId);
 assert.equal(checked.verified,true);assert.equal(checked.reproducible,true);
 assert.equal(checked.signed,false);
 assert.equal(checked.artifacts,4);
});

test('specification-only evidence never yields executable artifacts',async()=>{
 const {root,job,dir}=await built('math.tan','specification','evidence-specification-0002');
 assert.deepEqual(job.artifacts.map(x=>x.name),['candidate_specification.json']);
 const receipt=JSON.parse(await readFile(join(dir,'evidence.json'),'utf8'));
 assert.equal(receipt.sourceType,'review-queue-candidate');
 assert.equal(receipt.validation,'metadata-only');
 const checked=await verifyBuildJob(root,job.jobId);
 assert.equal(checked.artifacts,1);assert.equal(checked.publication,'disabled');
});

test('mutating output breaks verification without trusting stored checksum alone',async()=>{
 const {root,job,dir}=await built('math.sqrt','reviewed-build','evidence-mutation-0003');
 const filename=job.artifacts[0].name;
 await writeFile(join(dir,filename),Buffer.concat([await readFile(join(dir,filename)),Buffer.from('// altered\n')]));
 await assert.rejects(()=>verifyBuildJob(root,job.jobId),/checksum mismatch/);
 // Simulate a writer who updates *every* stored digest and the evidence itself.
 const jobPath=join(dir,'job.json');const record=JSON.parse(await readFile(jobPath,'utf8'));
 const bytes=await readFile(join(dir,filename));record.artifacts[0].bytes=bytes.length;record.artifacts[0].sha256=sha(bytes);
 const receiptPath=join(dir,'evidence.json');const receipt=JSON.parse(await readFile(receiptPath,'utf8'));
 receipt.artifacts[0].bytes=bytes.length;receipt.artifacts[0].sha256=sha(bytes);
 const raw=JSON.stringify(receipt,null,2)+'\n';
 await writeFile(receiptPath,raw);record.evidence.sha256=sha(raw);
 await writeFile(jobPath,JSON.stringify(record,null,2)+'\n');
 await assert.rejects(()=>verifyBuildJob(root,job.jobId),/differs from pinned expected output/);
});

test('evidence deletion and altered source fingerprints fail closed',async()=>{
 const {root,job,dir}=await built('math.tan','specification','evidence-tamper-0004');
 const receiptPath=join(dir,'evidence.json');const receipt=JSON.parse(await readFile(receiptPath,'utf8'));
 receipt.sourceFingerprint='f'.repeat(64);
 const raw=JSON.stringify(receipt,null,2)+'\n';
 await writeFile(receiptPath,raw);
 const jobPath=join(dir,'job.json'),record=JSON.parse(await readFile(jobPath,'utf8'));
 record.evidence.sha256=sha(raw);
 await writeFile(jobPath,JSON.stringify(record,null,2)+'\n');
 await assert.rejects(()=>verifyBuildJob(root,job.jobId),/disagrees with trusted recipe/);
});

test('specification and reviewed fingerprints come only from allowlisted contracts',()=>{
 assert.equal(expectedBuildFiles({functionId:'math.sqrt',mode:'reviewed-build'},plan).size,4);
 assert.equal(expectedBuildFiles({functionId:'math.tan',mode:'specification'},plan).size,1);
 assert.throws(()=>expectedBuildFiles({functionId:'math.tan',mode:'reviewed-build'},plan),/missing/);
 assert.throws(()=>makeBuildEvidence({jobId:'x',functionId:'math.tan',mode:'specification',state:'queued'},new Map(),plan),/completed/);
});
