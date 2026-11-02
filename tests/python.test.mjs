import test from 'node:test';
import assert from 'node:assert/strict';
import {runPipeline,EXAMPLE_PIPELINE} from '../src/pipeline.mjs';
import {generatePipelinePython} from '../src/python-export.mjs';
import {createFunctionBlueprint,FUNCTION_BLUEPRINTS} from '../src/blueprints.mjs';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

function runPython(config){
 const source=generatePipelinePython(config);
 const tmp=spawnSync('python3',['-c',source],{encoding:'utf8',timeout:5000,maxBuffer:2e6});
 if(tmp.error?.code==='ENOENT')return null;
 assert.equal(tmp.status,0,tmp.stderr);
 return JSON.parse(tmp.stdout);
}
test('generated Python matches browser runtime on representative macros',()=>{
 const configs=[EXAMPLE_PIPELINE,
 {schema:'audk.pipeline.v1',name:'Inventory',input:{type:'list',field:'quantity',values:[2,4,6,8,10]},steps:[{id:'double',type:'map',field:'quantity',outputField:'units',operation:'multiply',value:2},{id:'minimum',type:'filter',field:'units',operator:'gte',value:10},{id:'total',type:'aggregate',operation:'sum',field:'units',outputField:'totalUnits'}]},
 {schema:'audk.pipeline.v1',name:'Strings and sorting',input:{type:'list',field:'item',values:['B','A','C']},steps:[{id:'prefix',type:'map',field:'item',outputField:'label',operation:'prefix',value:'Stock-'},{id:'sort',type:'sort',field:'item',direction:'desc'}]},
 {schema:'audk.pipeline.v1',name:'Negative step',input:{type:'range',field:'value',start:5,end:-1,step:-2},steps:[{id:'count',type:'aggregate',operation:'count',outputField:'count'}]}
 ];
 for(const config of configs){const actual=runPython(config);if(actual===null)return;assert.deepEqual(actual,runPipeline(config).rows,config.name);}
});
test('all function blueprints emit runnable, equivalent Python',()=>{
 for(const bp of FUNCTION_BLUEPRINTS){const artifact=createFunctionBlueprint({type:bp.id,id:'sample-blueprint',name:'Sample Blueprint',description:'Test',inputType:'range',start:1,end:6,step:1});assert.match(artifact.pythonCode,/def run_applet/);const actual=runPython(artifact.manifest.config);if(actual===null)return;assert.deepEqual(actual,artifact.preview.rows,bp.id);}
});
test('Python function discovery is read-only, bounded, and allowlisted',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../catalog/python-standard-library.json',import.meta.url),'utf8'));
 assert.equal(catalog.schema,'audk.discovery.v1');
 assert.ok(catalog.count>=250);
 assert.ok(catalog.entries.some(x=>x.module==='math'&&x.name==='sqrt'));
 assert.ok(catalog.catalogStatus==='discovered-only');
 const cli=spawnSync('python3',['tools/python_discover.py','--modules','os'],{cwd:new URL('../',import.meta.url),encoding:'utf8',timeout:5000});
 if(cli.error?.code!=='ENOENT')assert.notEqual(cli.status,0,'Arbitrary modules must be rejected');
});
test('Python explorer UI is in Pages and local HTTP allowlist',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const server=await readFile(new URL('../src/server.mjs',import.meta.url),'utf8');
 assert.match(html,/data-tab="python"/);assert.match(html,/data-flow-view="python"/);
 assert.match(html,/id="blueprint-python"/);assert.match(server,/python-standard-library\.json/);
 assert.match(server,/python-discovery-ui\.js/);
});
test('unsafe macro config cannot reach Python export',()=>{
 assert.throws(()=>generatePipelinePython({schema:'audk.pipeline.v1',name:'Dangerous',input:{type:'list',field:'x',values:[1]},steps:[{id:'unsafe',type:'exec',cmd:'rm -rf /'}]}),/unsupported type/);
});
