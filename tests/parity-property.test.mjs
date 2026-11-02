import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,readdir,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {assessPropertyOracle,runPropertyParity,writePropertyParity} from '../src/parity-property.mjs';
const python=process.env.AUDK_TEST_PYTHON||'python';
const ORACLE=fileURLToPath(new URL('../tools/approved_math_property_oracle.py',import.meta.url));
const script=fileURLToPath(new URL('../scripts/check-parity-properties.mjs',import.meta.url));
const raw=spawnSync(python,['-I','-S',ORACLE],{encoding:'utf8',timeout:10000,maxBuffer:180000});
if(raw.status!==0)throw Error('Test fixture CPython oracle unavailable: '+String(raw.stderr).slice(0,180));
const fixture=JSON.parse(raw.stdout);

test('sealed CPython 3.13 oracle exposes six fixed math groups with 101 bounded samples each',()=>{
 assert.equal(fixture.groups.length,6);
 assert.deepEqual(fixture.groups.map(g=>g.cases.length),[101,101,101,101,101,101]);
 assert.equal(fixture.policy.dynamicEvaluation,false);
 assert.equal(fixture.policy.automaticPublication,false);
 assert.equal(fixture.schema,'audk.math-property-oracle.v1');
});
test('property gate compares 606 cases and mathematical invariants without promoting candidates',async()=>{
 const report=await runPropertyParity({python});
 assert.equal(report.samples,606);assert.equal(report.boundaryCases,12);
 assert.equal(report.passed,true);assert.equal(report.failedComparisons,0);
 assert.equal(report.policy.automaticPromotion,false);
 assert.equal(report.policy.automaticPublication,false);
 assert.equal(report.functions.every(x=>x.reviewed===false&&x.promoted===false),true);
 for(const fn of report.functions){assert.equal(fn.cases,101);assert.equal(fn.failures,0)}
 assert.match(report.provenance.pythonOracleSha256,/^[0-9a-f]{64}$/);
});
test('reference fixture rejects changed bounds, cases, values, metadata or function order',()=>{
 const copy=()=>structuredClone(fixture);
 for(const mutate of [
  f=>f.groups[0].bounds[0]=-1.3,
  f=>f.groups[1].cases[10].x=0.2333,
  f=>f.groups[2].cases.pop(),
  f=>f.groups[3].functionId='math.tan',
  f=>f.groups[4].cases[3].value=42,
  f=>f.policy.automaticPublication=true,
  f=>f.pythonVersion='3.12.0',
 ]){const f=copy();mutate(f);
  if(f.groups[4]?.cases[3]?.value===42){const report=assessPropertyOracle(f);assert.equal(report.passed,false)}
  else assert.throws(()=>assessPropertyOracle(f));}
});
test('writing evidence requires untampered all-pass report and a fresh private directory',async()=>{
 const base=await mkdtemp(join(tmpdir(),'audk-property-evidence-'));
 try{
  const result=await runPropertyParity({python});
  const out=join(base,'checked');const receipt=await writePropertyParity(result,{output:out});
  assert.equal(receipt.samples,606);assert.equal(receipt.published,0);
  assert.deepEqual((await readdir(out)).sort(),['REVIEW-CHECKLIST.md','property-parity-report.json'].sort());
  const file=JSON.parse(await readFile(join(out,'property-parity-report.json'),'utf8'));
  assert.equal(file.sha256,result.sha256);assert.equal(file.policy.automaticPublication,false);
  await assert.rejects(()=>writePropertyParity(result,{output:out}),/EEXIST/);
  const altered=structuredClone(result);altered.functions[0].maxAbsoluteError=400;
  await assert.rejects(()=>writePropertyParity(altered,{output:join(base,'tampered')}),/tampered|Invalid/);
  await assert.rejects(()=>stat(join(base,'tampered')),{code:'ENOENT'});
 }finally{await rm(base,{recursive:true,force:true})}
});
test('property CLI preview performs no Python execution and writes nothing',()=>{
 const proc=spawnSync(process.execPath,[script],{encoding:'utf8',timeout:10000});
 assert.equal(proc.status,0,proc.stderr);
 const x=JSON.parse(proc.stdout);assert.equal(x.pythonExecuted,false);assert.equal(x.outputWritten,false);
 assert.equal(x.expectedReferenceCases,606);
});
test('property CLI requires explicit --check, refuses arbitrary options and writes no output by default',async()=>{
 const base=await mkdtemp(join(tmpdir(),'audk-property-cli-'));
 try{
  const call=a=>spawnSync(process.execPath,[script,...a],{encoding:'utf8',timeout:15000});
  const ok=call(['--check','--python',python]);assert.equal(ok.status,0,ok.stderr);
  const x=JSON.parse(ok.stdout);assert.equal(x.passed,true);assert.equal(x.failed,0);assert.equal(x.outputWritten,false);
  assert.notEqual(call(['--exec','os.system']).status,0);
  assert.notEqual(call(['--output',join(base,'bad')]).status,0);
  assert.deepEqual(await readdir(base),[]);
 }finally{await rm(base,{recursive:true,force:true})}
});
