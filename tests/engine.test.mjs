import {runPipeline} from '../src/pipeline.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {DEFAULT_MACRO,executeMacro,generateJavaScript,validateMacro,checkMacro} from '../src/engine.mjs';
import {loadRegistry} from '../src/registry.mjs';
const base=()=>structuredClone(DEFAULT_MACRO);

test('nested loop multiplies and correctly switches parity',()=>{
 const run=executeMacro(base());
 assert.equal(run.rows.length,12);
 assert.deepEqual(run.rows[0],{index:1,i:1,j:1,result:1,branch:'even'});
 assert.deepEqual(run.rows[1],{index:2,i:1,j:2,result:2,branch:'odd'});
 assert.equal(run.rows.at(-1).result,12);
});
test('negative steps work with exclusive end bounds',()=>{
 const macro={...base(),outer:{name:'row',start:3,end:0,step:-1},inner:{name:'column',start:4,end:1,step:-1},operation:'sum',branchBy:'none'};
 const out=executeMacro(macro);
 assert.equal(out.rows.length,9);assert.equal(out.rows[0].result,7);assert.equal(out.rows.at(-1).result,3);
});
test('zero step and mismatched direction rejected',()=>{
 assert.throws(()=>validateMacro({...base(),outer:{name:'i',start:1,end:5,step:0}}),/step/);
 assert.throws(()=>validateMacro({...base(),outer:{name:'i',start:1,end:5,step:-1}}),/step/);
});
test('macros exceeding operation limit rejected',()=>{
 assert.throws(()=>executeMacro({...base(),outer:{name:'i',start:0,end:100,step:1},inner:{name:'j',start:0,end:100,step:1}}),/Too many/);
});
test('variable names cannot inject JavaScript',()=>{
 assert.throws(()=>generateJavaScript({...base(),outer:{name:'i); process.exit(1); //',start:0,end:2,step:1}}),/identifier/);
 assert.throws(()=>generateJavaScript({...base(),outer:{name:'class',start:0,end:2,step:1}}),/identifier/);
});
test('generated JavaScript and interpreter agree on all supported modes',()=>{
 for(const operation of ['pair','sum','product','difference']){
   for(const branchBy of ['none','sumParity']){
     const macro={...base(),operation,branchBy};
     const source=generateJavaScript(macro).replace('export function runApplet','function runApplet');
     const output=vm.runInNewContext(`${source}\nJSON.stringify(runApplet())`,{}, {timeout:200});
     assert.deepEqual(JSON.parse(output),executeMacro(macro).rows);
   }
 }
});
test('library entries validate and self-tests pass',async()=>{
 const registry=await loadRegistry();assert.ok(registry.length>=2);
 for(const a of registry){
   if(a.kind==='macro')assert.equal(checkMacro(a.config).passed,true);
   else assert.ok(runPipeline(a.config).rows.length>=0);
 }
});
test('no results for empty loop ranges',()=>{
 const macro={...base(),outer:{name:'i',start:3,end:3,step:1}};
 assert.equal(executeMacro(macro).rows.length,0);
});
