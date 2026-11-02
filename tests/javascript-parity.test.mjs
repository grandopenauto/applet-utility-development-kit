import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,readdir,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {prepareJavascriptParity,evaluateJavascriptCandidate,compareJavascriptParity,writeJavascriptParity} from '../src/javascript-parity.mjs';
const catalog=JSON.parse(await readFile(new URL('../catalog/python-standard-library.json',import.meta.url),'utf8'));
const assembly=JSON.parse(await readFile(new URL('../catalog/assembly-plan.json',import.meta.url),'utf8'));
const python=process.env.AUDK_TEST_PYTHON||'python';

test('parity preview is fixed six pure math functions, never auto-promotes',()=>{
 const plan=prepareJavascriptParity(catalog,assembly);
 assert.equal(plan.cases,32);assert.equal(plan.candidateSummary.length,6);
 assert.equal(plan.policy.humanApproved,false);assert.equal(plan.policy.registryPromotion,false);
 for(const ids of [['builtins.eval'],['math.sqrt'],['os.system'],['math.tan','math.tan'],[],Array(7).fill('math.tan')]){
  assert.throws(()=>prepareJavascriptParity(catalog,assembly,{ids}));
 }
});
test('bounded candidate adapter rejects unknown functions and invalid inputs',()=>{
 assert.throws(()=>evaluateJavascriptCandidate('builtins.eval',{x:1}),/cannot execute/);
 assert.deepEqual(evaluateJavascriptCandidate('math.tan',{x:'1'}),{kind:'error',exception:'TypeError'});
 assert.deepEqual(evaluateJavascriptCandidate('math.acos',{x:1.01}),{kind:'error',exception:'ValueError'});
 assert.deepEqual(evaluateJavascriptCandidate('math.atanh',{x:1}),{kind:'error',exception:'ValueError'});
 assert.equal(evaluateJavascriptCandidate('math.erf',{x:2}).kind,'unsupported');
 assert.equal(evaluateJavascriptCandidate('math.tan',{x:1.4}).kind,'unsupported');
});
test('fixed Maclaurin erf candidate agrees with representative known reference values',()=>{
 for(const [x,expected] of [[-1,-0.8427007929497149],[0,0],[0.5,0.5204998778130465],[1,0.8427007929497149]]){
  const value=evaluateJavascriptCandidate('math.erf',{x});
  assert.equal(value.kind,'value');assert.ok(Math.abs(value.value-expected)<2e-14);
 }
});
test('sealed CPython captures compare against six bounded JS prototypes, including negative cases',async()=>{
 const report=await compareJavascriptParity(catalog,assembly,{python});
 assert.equal(report.schema,'audk.js-parity-report.v1');
 assert.equal(report.cases,32);assert.equal(report.passed,32);assert.equal(report.failed,0);
 assert.equal(report.status,'fixed-fixtures-passed-awaiting-review');
 assert.equal(report.candidates.length,6);
 assert.equal(report.policy.automaticPublication,false);assert.equal(report.policy.automaticPromotion,false);
 assert.match(report.candidateSourceSha256,/^[0-9a-f]{64}$/);
 assert.match(report.referenceOracleSha256,/^[0-9a-f]{64}$/);
 const erf=report.candidates.find(c=>c.functionId==='math.erf');
 assert.equal(erf.passed,5);assert.equal(erf.review.humanApproved,false);
 for(const c of report.candidates){
  assert.equal(c.failed,0);assert.equal(c.policy.executableRecipe,false);
  assert.ok(c.cases.every(x=>x.status==='pass'));
 }
});
test('parity evidence is emitted only in a fresh private output directory',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'audk-jsparity-'));
 try{
  const report=await compareJavascriptParity(catalog,assembly,{ids:['math.tan','math.acos'],python});
  const target=join(parent,'out');const saved=await writeJavascriptParity(report,{output:target});
  assert.equal(saved.cases,11);assert.equal(saved.published,0);
  assert.deepEqual((await readdir(target)).sort(),['REVIEW-CHECKLIST.md','javascript-parity-report.json'].sort());
  assert.equal(JSON.parse(await readFile(join(target,'javascript-parity-report.json'),'utf8')).sha256,report.sha256);
  await assert.rejects(()=>writeJavascriptParity(report,{output:target}),/EEXIST/);
  const altered=structuredClone(report);altered.candidates[0].cases[0].javascript.value=900;
  await assert.rejects(()=>writeJavascriptParity(altered,{output:join(parent,'altered')}),/tampered/);
  await assert.rejects(()=>stat(join(parent,'altered')),{code:'ENOENT'});
 }finally{await rm(parent,{recursive:true,force:true})}
});
test('operator CLI defaults to preview and rejects arbitrary source/exec options',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'audk-parity-cli-'));
 try{
  const script=fileURLToPath(new URL('../scripts/compare-javascript-parity.mjs',import.meta.url));
  const run=args=>spawnSync(process.execPath,[script,...args],{encoding:'utf8',timeout:10000});
  const preview=run(['--ids','math.tan,math.acos']);
  assert.equal(preview.status,0,preview.stderr);
  const plan=JSON.parse(preview.stdout);assert.equal(plan.pythonExecuted,false);assert.equal(plan.filesWritten,false);
  assert.equal(plan.cases,11);
  assert.notEqual(run(['--exec','os.system']).status,0);
  assert.notEqual(run(['--output',join(parent,'bad')]).status,0);
  assert.deepEqual(await readdir(parent),[]);
 }finally{await rm(parent,{recursive:true,force:true})}
});
test('CLI actual parity report requires explicit comparison and never publishes',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'audk-parity-actual-'));
 try{
  const script=fileURLToPath(new URL('../scripts/compare-javascript-parity.mjs',import.meta.url));
  const output=join(parent,'parity');
  const run=spawnSync(process.execPath,[script,'--ids','math.tan,math.acos','--compare','--output',output,'--python',python],{encoding:'utf8',timeout:13000});
  assert.equal(run.status,0,run.stderr);
  const report=JSON.parse(run.stdout);
  assert.equal(report.cases,11);assert.equal(report.failed,0);assert.equal(report.automaticPublication,false);
  const saved=JSON.parse(await readFile(join(output,'javascript-parity-report.json'),'utf8'));
  assert.equal(saved.policy.automaticPromotion,false);assert.equal(saved.candidates.length,2);
 }finally{await rm(parent,{recursive:true,force:true})}
});
