import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {UNIVERSAL_RECIPES,UNIVERSAL_SCHEMA,buildUniversalCandidate,executeUniversal,generateUniversalPython} from '../src/universal-wizard.mjs';
import {apiResponse} from '../src/api.mjs';
import {SECTIONS,sectionFromHash} from '../navigation-ui.js';
const create=(recipe,args=recipe.examples[0].args)=>({schema:UNIVERSAL_SCHEMA,functionId:recipe.id,id:'review-candidate',name:'Reviewed candidate',description:'Validated pure function candidate',arguments:args});

test('all reviewed recipes have schema-defined fields, examples and candidate-only status',()=>{
 assert.equal(UNIVERSAL_RECIPES.length,14);
 for(const recipe of UNIVERSAL_RECIPES){
  assert.ok(recipe.fields.length>0&&recipe.examples.length>0);
  for(const example of recipe.examples){
   const config=create(recipe,example.args);
   const candidate=buildUniversalCandidate(config);
   assert.equal(candidate.manifest.status,'candidate-review-required');
   assert.deepEqual(candidate.manifest.capabilities,['pure-computation']);
   assert.deepEqual(candidate.result,executeUniversal(config));
   assert.match(candidate.javaScript,/export function runApplet/);
   assert.match(candidate.python,/def run_applet/);
   assert.match(candidate.testSource,/assert\.deepEqual/);
   const actual=runInNewContext(candidate.javaScript.replace('export function','function')+'\nrunApplet()');
   assert.deepEqual(JSON.parse(JSON.stringify(actual)),candidate.result);
  }
 }
});

test('generated JavaScript and test files run together in Node',async()=>{
 const recipe=UNIVERSAL_RECIPES.find(r=>r.id==='statistics.median');
 const candidate=buildUniversalCandidate(create(recipe));
 const dir=await mkdtemp(join(tmpdir(),'audk-universal-'));
 try{
  await writeFile(join(dir,'review-candidate.mjs'),candidate.javaScript);
  await writeFile(join(dir,'review-candidate.test.mjs'),candidate.testSource);
  const {NODE_TEST_CONTEXT,...env}=process.env;
  const run=spawnSync(process.execPath,['--test','review-candidate.test.mjs'],{cwd:dir,encoding:'utf8',timeout:7000,env});
  assert.equal(run.status,0,run.stderr);
  assert.match(run.stdout,/# pass 1/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('generated Python matches local preview for every curated recipe',()=>{
 for(const r of UNIVERSAL_RECIPES){
  for(const ex of r.examples){
   const c=create(r,ex.args);
   const py=generateUniversalPython(c);
   const run=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:7000,maxBuffer:50000});
   if(run.error?.code==='ENOENT')return;
   assert.equal(run.status,0,`${r.id}: ${run.stderr}`);
   assert.deepEqual(JSON.parse(run.stdout),executeUniversal(c),r.id);
  }
 }
});

test('rejects unchecked callables, extra parameter keys, unsafe values, and oversized inputs',()=>{
 const sqrt=UNIVERSAL_RECIPES.find(r=>r.id==='math.sqrt');
 assert.throws(()=>buildUniversalCandidate({...create(sqrt),functionId:'os.system'}),/allowlist/);
 assert.throws(()=>buildUniversalCandidate({...create(sqrt),id:'<script>'}),/ID/);
 assert.throws(()=>buildUniversalCandidate({...create(sqrt),arguments:{value:-1}}),/between/);
 assert.throws(()=>buildUniversalCandidate({...create(sqrt),arguments:{value:4,__proto__:'x',extra:'boom'}}),/Unexpected argument/);
 const sum=UNIVERSAL_RECIPES.find(r=>r.id==='builtins.sum');
 assert.throws(()=>buildUniversalCandidate(create(sum,{numbers:Array(65).fill(2)})),/1–64/);
 assert.throws(()=>buildUniversalCandidate(create(sum,{numbers:[1,'2']})),/bounded finite/);
 assert.throws(()=>buildUniversalCandidate(create(sum,{numbers:[NaN]})),/bounded finite/);
});

test('local REST API returns safe recipes and preview, and navigation includes wizard',async()=>{
 const list=await apiResponse('GET','/api/universal/functions');
 assert.equal(list.status,200);assert.equal(list.data.recipes.length,14);
 const preview=await apiResponse('POST','/api/universal/preview',create(UNIVERSAL_RECIPES[0]));
 assert.equal(preview.data.result,12);assert.equal(preview.data.manifest.status,'candidate-review-required');
 assert.ok(Object.hasOwn(SECTIONS,'universal'));
 assert.equal(sectionFromHash('#universal'),'universal');
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const server=await readFile(new URL('../src/server.mjs',import.meta.url),'utf8');
 assert.match(html,/data-tab="universal"/);assert.match(html,/id="universal-form"/);
 assert.match(html,/src="\.\/universal-ui\.js"/);
 assert.match(server,/universal-wizard\.mjs/);
});
