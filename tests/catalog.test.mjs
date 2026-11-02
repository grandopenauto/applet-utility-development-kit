import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadRegistry} from '../src/registry.mjs';
import {CATEGORIES,classifyApplet,filterCatalog,previewCatalogApplet} from '../src/catalog-browser.mjs';
import {classifyDiscovered,makePythonIntake,validatePythonIntake} from '../src/python-triage.mjs';
import {apiResponse} from '../src/api.mjs';
const entries=await loadRegistry();
const discovery=JSON.parse(await readFile(new URL('../catalog/python-standard-library.json',import.meta.url)));
test('v0.9 catalog enumerates only published manifests and categories',()=>{
 assert.equal(entries.length,28);
 assert.equal(filterCatalog(entries).length,28);
 assert.ok(CATEGORIES.includes(classifyApplet(entries.find(x=>x.id==='python-math-sqrt'))));
 assert.equal(filterCatalog(entries,{category:'Mathematics'}).length,16);
 assert.deepEqual(filterCatalog(entries,{search:'fACTOriAL'}).map(r=>r.id),['python-math-factorial']);
 assert.equal(filterCatalog(entries,{kind:'curated-function'}).length,24);
 assert.equal(filterCatalog(entries,{kind:'pipeline'}).length,2);
 assert.throws(()=>filterCatalog(entries,{category:'Admin'}),/Unknown category/);
});
test('catalog detail examples execute only reviewed bounded functions or existing macros',()=>{
 const sqrt=entries.find(e=>e.id==='python-math-sqrt');
 assert.equal(previewCatalogApplet(sqrt,0).result,12);
 assert.equal(previewCatalogApplet(sqrt,1).result,Math.sqrt(2));
 for(const entry of entries){const sample=previewCatalogApplet(entry,0);assert.ok(sample.label);assert.ok(sample.result!==undefined);}
 assert.throws(()=>previewCatalogApplet(sqrt,99),/Invalid example number/);
 assert.throws(()=>previewCatalogApplet(sqrt,3),/No such example/);
});
test('Python discovery exports metadata-only intake and does not confuse discovery with execution',()=>{
 const sqrt=discovery.entries.find(x=>x.module==='math'&&x.name==='sqrt');
 const tan=discovery.entries.find(x=>x.module==='math'&&x.name==='tan');
 assert.equal(classifyDiscovered(sqrt).state,'wizard-supported');
 assert.equal(classifyDiscovered(tan).state,'discovery-only');
 assert.throws(()=>makePythonIntake(sqrt),/already has a reviewed/);
 const packet=makePythonIntake(tan);
 assert.equal(packet.qualifiedName,'math.tan');
 assert.equal(packet.runtimeEnabled,false);assert.equal(packet.autoPublish,false);
 assert.equal(validatePythonIntake(packet),true);
 assert.throws(()=>validatePythonIntake({...packet,runtimeEnabled:true}),/safety state/);
 assert.throws(()=>validatePythonIntake({...packet,qualifiedName:'math.sqrt'}),/Mismatched/);
 assert.throws(()=>classifyDiscovered({module:'child_process',name:'execSync;evil'}),/Invalid/);
});
test('v0.9 local library search API uses validated catalog and filters',async()=>{
 const res=await apiResponse('GET','/api/library/search',null,{search:'sqrt',category:'Mathematics'});
 assert.equal(res.status,200);
 assert.deepEqual(res.data.applets.map(x=>x.id),['python-math-isqrt','python-math-sqrt']);
 assert.equal(res.data.applets[1].functionId,'math.sqrt');
});
test('browser and local server include the v0.9 modules and accessible controls',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const server=await readFile(new URL('../src/server.mjs',import.meta.url),'utf8');
 const nav=await readFile(new URL('../navigation-ui.js',import.meta.url),'utf8');
 for(const name of ['catalog-search','catalog-category','catalog-kind','catalog-results','catalog-detail','python-triage-status'])assert.match(html,new RegExp(`id="${name}"`));
 assert.match(html,/data-tab="library"/);assert.match(nav,/library:\{title:/);
 for(const asset of ['library-ui.js','src/catalog-browser.mjs','src/python-triage.mjs'])assert.ok(server.includes(asset));
});
