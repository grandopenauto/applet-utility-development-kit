import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,rm,mkdtemp,readdir,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {prepareReferenceCapture,capturePythonReferences,writeReferenceCapture,ORACLE_IDS} from '../src/python-reference.mjs';
const catalog=JSON.parse(await readFile(new URL('../catalog/python-standard-library.json',import.meta.url),'utf8'));
const assembly=JSON.parse(await readFile(new URL('../catalog/assembly-plan.json',import.meta.url),'utf8'));
const python=process.env.AUDK_TEST_PYTHON||'python';

test('approved oracle plan is inspect-only, bounded and excludes privileged SDK functions',()=>{
 const p=prepareReferenceCapture(catalog,assembly,{ids:['math.tan','math.acos']});
 assert.equal(p.cases,11);
 assert.equal(p.policy.unreviewedSourceExecution,false);
 assert.equal(p.policy.recipeApproval,false);
 assert.equal(p.policy.publication,false);
 assert.equal(p.candidatePackets[0].verifiedDocumentation,false);
 for(const ids of [['builtins.eval'],['math.sqrt'],['os.system'],['math.tan','math.tan'],Array(7).fill('math.erf'),[]]){
  assert.throws(()=>prepareReferenceCapture(catalog,assembly,{ids}));
 }
 assert.deepEqual(ORACLE_IDS,['math.tan','math.acos','math.asin','math.acosh','math.atanh','math.erf']);
});
test('reference capture checks Python pin and original draft policy',async()=>{
 await assert.rejects(()=>capturePythonReferences({...catalog,pythonVersion:'3.12.0'},assembly,{ids:['math.tan'],python}),/3.13/);
 await assert.rejects(()=>capturePythonReferences(catalog,assembly,{ids:['math.tan'],python:'bad && command'}),/executor/);
 const amended=structuredClone(assembly);amended.candidates.find(x=>x.id==='math.tan').stage='special-review';
 await assert.rejects(()=>capturePythonReferences(catalog,amended,{ids:['math.tan'],python}),/not eligible|special-review|disagree|cannot/);
});
test('sealed CPython oracle captures six approved math functions and negative cases',async()=>{
 const result=await capturePythonReferences(catalog,assembly,{ids:[...ORACLE_IDS],python});
 assert.equal(result.schema,'audk.reference-capture.v1');
 assert.equal(result.pythonVersion.split('.').slice(0,2).join('.'),'3.13');
 assert.equal(result.capturedCases,32);
 assert.equal(result.packets.length,6);
 assert.match(result.oracleSourceSha256,/^[a-f0-9]{64}$/);
 for(const packet of result.packets){
  assert.equal(packet.review.humanApproved,false);
  assert.equal(packet.review.documentationIndependentlyReviewed,false);
  assert.equal(packet.policy.executableRecipe,false);
  assert.equal(packet.policy.automaticPublication,false);
  assert.equal(packet.referenceCases.filter(x=>x.outcome.kind==='error').length>0,true);
  assert.match(packet.sha256,/^[a-f0-9]{64}$/);
 }
 const acos=result.packets.find(p=>p.functionId==='math.acos');
 assert.equal(acos.referenceCases[0].outcome.value,Math.PI);
 assert.equal(acos.referenceCases.at(-1).outcome.exception,'ValueError');
});
test('operator capture creates only private immutable evidence, never executable or approved recipes',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'audk-ref-'));
 try{
  const result=await capturePythonReferences(catalog,assembly,{ids:['math.tan','math.acos'],python});
  const output=join(parent,'capture-one');
  const saved=await writeReferenceCapture(result,{output});
  assert.equal(saved.report.files.length,2);
  assert.equal(saved.report.caseCount,11);
  assert.equal(saved.report.approvedRecipes,0);
  assert.equal(saved.report.published,0);
  const files=await readdir(output);
  assert.deepEqual(files.sort(),['REVIEW-CHECKLIST.md','math-acos.reference.json','math-tan.reference.json','reference-report.json'].sort());
  const tan=JSON.parse(await readFile(join(output,'math-tan.reference.json'),'utf8'));
  assert.equal(tan.functionId,'math.tan');
  assert.equal(tan.policy.executableRecipe,false);
  await assert.rejects(()=>writeReferenceCapture(result,{output}),/EEXIST/);
  const edited=structuredClone(result);edited.packets[0].referenceCases[0].outcome.value=999;
  await assert.rejects(()=>writeReferenceCapture(edited,{output:join(parent,'tamper')}),/tampered/);
  await assert.rejects(()=>stat(join(parent,'tamper')),{code:'ENOENT'});
 }finally{await rm(parent,{recursive:true,force:true})}
});
test('CLI previews without executing Python or creating output; denies source-execution flags',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'audk-ref-cli-'));
 try{
  const script=fileURLToPath(new URL('../scripts/capture-python-references.mjs',import.meta.url));
  const inspect=spawnSync(process.execPath,[script,'--ids','math.tan,math.acos'],{encoding:'utf8',timeout:8000});
  assert.equal(inspect.status,0,inspect.stderr);
  const plan=JSON.parse(inspect.stdout);
  assert.equal(plan.mode,'inspect-only');assert.equal(plan.pythonExecuted,false);assert.equal(plan.filesWritten,false);
  const bad=spawnSync(process.execPath,[script,'--exec','builtins.eval'],{encoding:'utf8',timeout:8000});
  assert.notEqual(bad.status,0);
  assert.deepEqual(await readdir(parent),[]);
 }finally{await rm(parent,{recursive:true,force:true})}
});
