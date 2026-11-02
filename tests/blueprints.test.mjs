import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {readFile} from 'node:fs/promises';
import {FUNCTION_BLUEPRINTS,createFunctionBlueprint} from '../src/blueprints.mjs';
import {validateEntry} from '../src/registry.mjs';
import {sectionFromHash,SECTIONS} from '../navigation-ui.js';

const base={id:'sample-blueprint',name:'Sample Blueprint',description:'Reusable portable transformation',inputType:'range',start:1,end:6,step:1};
test('every blueprint generates executable manifest, code and matching test fixture',()=>{
 for(const definition of FUNCTION_BLUEPRINTS){
  const result=createFunctionBlueprint({...base,type:definition.id});
  validateEntry(result.manifest);
  assert.equal(result.manifest.version,'0.5.0');
  assert.match(result.code,/export function runApplet/);
  assert.match(result.testSource,/assert\.deepEqual/);
  const rows=runInNewContext(result.code.replace('export function','function')+'\nrunApplet()');
  assert.deepEqual(JSON.parse(JSON.stringify(rows)),result.preview.rows);
 }
});
test('generated blueprint tests run using downloaded source files', async()=>{
 const result=createFunctionBlueprint({...base,type:'map'});
 const {mkdtemp,writeFile,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const {execFileSync}=await import('node:child_process');
 const folder=await mkdtemp(join(tmpdir(),'audk-blueprint-'));
 try{
  await writeFile(join(folder,result.manifest.id+'.mjs'),result.code);
  await writeFile(join(folder,result.manifest.id+'.test.mjs'),result.testSource);
  const {NODE_TEST_CONTEXT,...cleanEnv}=process.env;
  const output=execFileSync(process.execPath,['--test',result.manifest.id+'.test.mjs'],{cwd:folder,encoding:'utf8',env:cleanEnv});
  assert.match(output,/# pass 1/);
 }finally{await rm(folder,{recursive:true,force:true});}
});
test('blueprints reject malformed ids, script injection and unbounded expansions',()=>{
 assert.throws(()=>createFunctionBlueprint({...base,type:'sort',id:'<script>'}),/ID/);
 assert.throws(()=>createFunctionBlueprint({...base,type:'map',options:{outputField:'__proto__'}}),/safe field/);
 assert.throws(()=>createFunctionBlueprint({...base,type:'crossJoin',options:{values:'[1,2',outputField:'slot'}}),/JSON array/);
 assert.throws(()=>createFunctionBlueprint({...base,type:'crossJoin',end:5001,options:{values:'[1,2,3]',outputField:'slot'}}),/row/);
 assert.throws(()=>createFunctionBlueprint({...base,type:'map',options:{operation:'multiply',operand:'alert(1)',outputField:'result'}}),/numeric/);
});
test('navigation hash resolves all sections and rejects unknown routes',()=>{
 for(const tab of Object.keys(SECTIONS))assert.equal(sectionFromHash('#'+tab),tab);
 assert.equal(sectionFromHash('#made-up'),'configure');
});
test('new blueprint UI scripts and HTTPS-safe static assets are registered',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const server=await readFile(new URL('../src/server.mjs',import.meta.url),'utf8');
 assert.match(html,/data-tab="blueprints"/);
 assert.match(html,/id="current-location"/);
 assert.match(html,/data-jump="compose"/);
 assert.match(html,/src="\.\/blueprint-ui\.js"/);
 assert.match(server,/blueprint-ui\.js/);
 assert.match(server,/navigation-ui\.js/);
});
