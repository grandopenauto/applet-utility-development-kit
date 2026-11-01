import test from 'node:test';import assert from 'node:assert/strict';import {executeMacro,validateMacro,generateJavaScript,checkMacro} from '../src/engine.mjs';
const macro={name:'sample',outer:{name:'a',start:1,end:4,step:1},inner:{name:'b',start:2,end:5,step:1},operation:'sum',branchBy:'sumParity'};
test('nested loop is deterministic',()=>{const r=executeMacro(macro);assert.equal(r.rows.length,9);assert.equal(r.rows[0].result,3);assert.equal(r.rows[0].branch,'odd')});
test('invalid step rejected',()=>assert.throws(()=>validateMacro({...macro,outer:{...macro.outer,step:0}})));
test('iteration count is bounded',()=>assert.throws(()=>validateMacro({...macro,inner:{...macro.inner,end:5000}})));
test('variable names must be safe',()=>assert.throws(()=>validateMacro({...macro,outer:{...macro.outer,name:'constructor;'}})));
test('self tests pass',()=>assert.equal(checkMacro(macro).passed,true));
test('generated code contains valid nested loops',()=>{const src=generateJavaScript(macro);assert.match(src,/for \(let a/);assert.match(src,/for \(let b/)});
