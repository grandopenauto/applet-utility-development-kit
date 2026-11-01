import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createApplet,FACTORY_TEMPLATES} from '../src/factory.mjs';
import {validateEntry} from '../src/registry.mjs';

test('Factory templates create valid and runnable applets with exported code',()=>{
 for(const template of FACTORY_TEMPLATES){
  const created=createApplet({template:template.id,id:'factory-example',name:'Example',description:'An example component',start:1,end:5,step:1});
  validateEntry(created.entry);
  assert.ok(created.preview.rows.length>0);
  assert.ok(created.code.includes('export function'));
  const js=created.code.replace('export function','function')+'\nrunApplet();';
  const output=runInNewContext(js);
  assert.deepEqual(JSON.parse(JSON.stringify(output)),JSON.parse(JSON.stringify(created.preview.rows)));
 }
});
test('Factory rejects malicious IDs, oversized ranges and bad slots',()=>{
 const base={id:'safe-app',name:'Safe',description:'Example',template:'crossdock-slots'};
 assert.throws(()=>createApplet({...base,id:'__proto__'}),/ID/);
 assert.throws(()=>createApplet({...base,step:0}),/Step/);
 assert.throws(()=>createApplet({...base,start:1,end:1000}),/250/);
 assert.throws(()=>createApplet({...base,slots:'09:00,09:00'}),/slots/);
 assert.throws(()=>createApplet({...base,slots:'<script>'}),/slots/);
});
test('HTA companions stay local and contain no shell, ActiveX or network execution', async()=>{
 for(const name of ['audk-loop-planner','audk-slot-matrix']){
  const file=await readFile(new URL(`../downloads/hta/${name}.hta`,import.meta.url),'utf8');
  assert.match(file,/<HTA:APPLICATION/);
  assert.doesNotMatch(file,/ActiveXObject|WScript\.Shell|XMLHTTP|<script\s+src=|eval\(|Execute\(/i);
  assert.match(file,/JSON\.stringify/);
 }
});
test('Public Pages contains factory and companion download links', async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/data-tab="factory"/);
 assert.match(html,/src="\.\/factory-ui\.js"/);
 assert.match(html,/downloads\/hta\/audk-loop-planner\.hta/);
 assert.match(html,/downloads\/hta\/audk-slot-matrix\.hta/);
});

test('Offline HTAs generate macros accepted by the AUDK interpreters',async()=>{
 for(const [name,ids] of [
   ['audk-loop-planner',{outerStart:'1',outerEnd:'5',outerStep:'1',innerStart:'1',innerEnd:'4',innerStep:'1',outerName:'i',innerName:'j',operation:'product',branch:'sumParity'}],
   ['audk-slot-matrix',{first:'1',last:'4',minimum:'2',slots:'08:00,09:00,10:00'}]
 ]){
   const html=await readFile(new URL(`../downloads/hta/${name}.hta`,import.meta.url),'utf8');
   const code=html.match(/<script language="JScript"[^>]*>([\s\S]*?)<\/script>/i)?.[1];
   assert.ok(code,'missing inline JScript');
   const props={...ids,output:'',summary:''};
   const sandbox={JSON,Number,isFinite,Error,document:{getElementById(key){return {get value(){return props[key]},set value(v){props[key]=v},set innerText(v){props[key]=v},get innerText(){return props[key]}}}}};
   runInNewContext(code+'\nbuild();',sandbox,{timeout:1000});
   assert.ok(props.output,'missing generated macro');
   const cfg=JSON.parse(props.output);
   if(name==='audk-loop-planner') assert.equal((await import('../src/engine.mjs')).executeMacro(cfg).metadata.rows,12);
   else assert.equal((await import('../src/pipeline.mjs')).runPipeline(cfg).rows.length,9);
 }
});
