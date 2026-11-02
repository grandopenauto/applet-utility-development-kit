import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {UNIVERSAL_RECIPES} from '../src/universal-wizard.mjs';
import {evaluateJavascriptCandidate} from '../src/javascript-parity.mjs';
import {evaluateMathTanProposal,MATH_TAN_CANDIDATE_CONTRACT as CONTRACT} from '../src/candidate-math-tan.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const oracle=join(root,'tools','approved_math_property_oracle.py');
const python=process.env.AUDK_TEST_PYTHON||'python';
const compare=(actual,expected)=>Math.abs(actual-expected)<=5e-13+5e-13*Math.abs(expected);

test('math.tan proposal contract requires independent human approval and cannot register itself',()=>{
  assert.equal(CONTRACT.functionId,'math.tan');
  assert.equal(CONTRACT.bounds.minimum,-1.2);
  assert.equal(CONTRACT.bounds.maximum,1.2);
  assert.equal(CONTRACT.policy.executableRecipe,false);
  assert.equal(CONTRACT.policy.registryPromotion,false);
  assert.equal(CONTRACT.policy.automaticPublication,false);
  assert.equal(CONTRACT.review.humanApproved,false);
  assert.equal(CONTRACT.review.boundsApproved,false);
  assert.equal(UNIVERSAL_RECIPES.some(r=>r.id==='math.tan'),false);
});

test('math.tan proposal accepts endpoints, preserves signed zero, and refuses out-of-bounds',()=>{
  for(const x of [-1.2,-1.0,-0.5,-0,0,0.5,1.0,1.2]){
    const value=evaluateMathTanProposal(x);
    assert.equal(value.kind,'value');
    assert.equal(Object.is(value.value,Math.tan(x)),true);
  }
  assert.equal(Object.is(evaluateMathTanProposal(-0).value,-0),true);
  assert.equal(Object.is(evaluateMathTanProposal(0).value,0),true);
  for(const x of [-Math.PI/2,Math.PI/2,-1.2-Number.EPSILON,1.2+Number.EPSILON]) {
    assert.equal(evaluateMathTanProposal(x).kind,'unsupported');
  }
});

test('math.tan proposal refuses coercion, invalid numbers and arbitrary objects',()=>{
  const invalid=['0.2',true,false,0n,null,undefined,NaN,Infinity,-Infinity,[],{},new Number(0),()=>0];
  for(const x of invalid){
    assert.deepEqual(evaluateMathTanProposal(x),{kind:'error',exception:'TypeError'});
  }
});

test('math.tan proposal matches the existing experimental adapter on 1001 deterministic inputs',()=>{
  for(let i=0;i<=1000;i++){
    const x=-1.2+2.4*i/1000;
    const a=evaluateMathTanProposal(x),b=evaluateJavascriptCandidate('math.tan',{x});
    assert.equal(a.kind,b.kind,`at index ${i}`);
    if(a.kind==='value')assert.equal(Object.is(a.value,b.value),true,`at index ${i}`);
  }
});

test('math.tan proposal matches the pinned Python 3.13 property oracle on 101 reference inputs',()=>{
  const proc=spawnSync(python,['-I','-S',oracle],{cwd:root,encoding:'utf8',timeout:12000,maxBuffer:180000,windowsHide:true});
  assert.equal(proc.status,0,proc.stderr||String(proc.error));
  const fixture=JSON.parse(proc.stdout);
  assert.equal(fixture.schema,'audk.math-property-oracle.v1');
  assert.match(fixture.pythonVersion,/^3\.13\./);
  assert.equal(fixture.policy.dynamicEvaluation,false);
  const tan=fixture.groups.find(group=>group.functionId==='math.tan');
  assert.ok(tan);
  assert.deepEqual(tan.bounds,[-1.2,1.2]);
  assert.equal(tan.cases.length,101);
  let prior=-Infinity;
  for(let i=0;i<tan.cases.length;i++){
    const row=tan.cases[i],expectedX=-1.2+2.4*i/100;
    assert.equal(row.x,expectedX);
    const outcome=evaluateMathTanProposal(row.x);
    assert.equal(outcome.kind,'value',`at case ${i}`);
    assert.ok(compare(outcome.value,row.value),`reference mismatch at case ${i}`);
    assert.ok(outcome.value>prior,`not monotonic at case ${i}`);
    prior=outcome.value;
  }
});

test('math.tan candidate approval gate must remain separate from published library',()=>{
  assert.equal(CONTRACT.review.implementationApproved,false);
  assert.equal(CONTRACT.review.documentationReviewed,false);
  assert.equal(CONTRACT.policy.executableRecipe,false);
  assert.equal(typeof evaluateMathTanProposal,'function');
});
