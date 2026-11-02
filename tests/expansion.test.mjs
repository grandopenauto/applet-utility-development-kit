import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildExpansionQueue,validateExpansionQueue,rateCandidate,proposeFields} from '../src/expansion.mjs';
import {apiResponse} from '../src/api.mjs';
const catalog=JSON.parse(await readFile(new URL('../catalog/python-standard-library.json',import.meta.url),'utf8'));
const queue=JSON.parse(await readFile(new URL('../catalog/expansion-queue.json',import.meta.url),'utf8'));
test('v1.0 candidate queue is deterministic and excludes implemented reviewed recipes',()=>{
 const fresh=buildExpansionQueue(catalog);
 assert.deepEqual(fresh,queue);
 assert.equal(queue.summary.discovered,354);
 assert.equal(queue.summary.alreadySupported,14);
 assert.equal(queue.candidates.some(x=>x.id==='math.sqrt'),false);
 assert.ok(queue.candidates.some(x=>x.id==='math.cos'));
 assert.equal(validateExpansionQueue(queue),true);
});
test('v1.0 review candidates cannot enable runtime or auto publish',()=>{
 assert.ok(queue.candidates.every(x=>x.runtimeEnabled===false&&x.autoPublish===false));
 const tampered=structuredClone(queue);tampered.candidates[0].runtimeEnabled=true;
 assert.throws(()=>validateExpansionQueue(tampered),/Unsafe candidate state/);
});
test('v1.0 risky builtins and callable classes require special review',()=>{
 const evalEntry={module:'builtins',name:'eval',signature:'(source, /)',kind:'function'};
 assert.equal(rateCandidate(evalEntry).priority,0);
 assert.equal(rateCandidate({module:'math',name:'cos',signature:'(x, /)',kind:'function'}).state,'review-candidate');
 assert.equal(rateCandidate({module:'json',name:'JSONEncoder',signature:'(a)',kind:'callable'}).state,'requires-special-review');
 assert.throws(()=>rateCandidate({module:'subprocess',name:'run',signature:'(x)'}),/unallowlisted/);
});
test('v1.0 suggested fields are only advisory identifiers',()=>{
 const fields=proposeFields('(n, values, *, optional=14, /, bad-key=8)');
 assert.deepEqual(fields.map(x=>x.name),['n','values','optional']);
 assert.equal(fields.every(x=>x.reviewRequired===true),true);
 assert.deepEqual(proposeFields('(signature unavailable)'),[]);
});
test('v1.0 local API has bounded metadata-only candidate access',async()=>{
 const r=await apiResponse('GET','/api/expansion/queue',null,{search:'math.cos',limit:'3'});
 assert.equal(r.status,200);assert.equal(r.data.readOnly,true);assert.ok(r.data.totalMatching>0);
 assert.equal(r.data.candidates[0].id,'math.cos');
 await assert.rejects(()=>apiResponse('GET','/api/expansion/queue',null,{limit:'10000'}),/Limit must/);
});
test('v1.0 weekly scanning does not grant write permissions or publish automatically',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/expansion-scan.yml',import.meta.url),'utf8');
 assert.match(workflow,/workflow_dispatch:/);assert.match(workflow,/schedule:/);
 assert.match(workflow,/contents: read/);assert.doesNotMatch(workflow,/contents: write/);
 assert.match(workflow,/upload-artifact/);
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/data-tab="expansion"/);assert.match(html,/id="expansion-results"/);
 const server=await readFile(new URL('../src/server.mjs',import.meta.url),'utf8');
 assert.match(server,/\/catalog\/expansion-queue.json/);
});
test('v1.0 discovery diff uses canonical module.name even in older snapshots lacking qualifiedName',async()=>{
 const {execFileSync}=await import('node:child_process');
 const out=execFileSync(process.execPath,['scripts/diff-python-catalog.mjs'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 const summary=JSON.parse(out);
 assert.equal(summary.changed,false);assert.equal(summary.added,0);assert.equal(summary.removed,0);
});
