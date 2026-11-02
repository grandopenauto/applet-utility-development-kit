import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildAssemblyPlan,validateAssemblyPlan,candidateSpecification} from '../src/assembly-line.mjs';
import {buildCuratedEntry,validateCuratedEntry,CURATED_FUNCTIONS} from '../src/curated.mjs';
import {loadRegistry} from '../src/registry.mjs';
import {apiResponse} from '../src/api.mjs';
const catalog=JSON.parse(await readFile(new URL('../catalog/python-standard-library.json',import.meta.url),'utf8'));
test('assembly plan is deterministic, complete, and separates review candidates',async()=>{
 const all=await loadRegistry(),plan=buildAssemblyPlan(catalog,all);
 assert.equal(all.length,28);assert.equal(CURATED_FUNCTIONS.length,24);
 assert.equal(plan.coverage.discovered,354);
 assert.equal(plan.coverage.publishedPythonApplets,24);
 assert.equal(plan.coverage.packagingReady,0);
 assert.equal(plan.coverage.missingFromRegistry,330);
 assert.equal(plan.coverage.implementationNeeded,157);
 assert.equal(plan.coverage.specialReview,173);
 assert.equal(plan.candidates.length,330);
 assert.equal(validateAssemblyPlan(plan),true);
 assert.deepEqual(plan,JSON.parse(await readFile(new URL('../catalog/assembly-plan.json',import.meta.url),'utf8')));
});
test('specifications are a safe inert design proposal, not executable scripts',async()=>{
 const plan=buildAssemblyPlan(catalog,await loadRegistry());
 const spec=candidateSpecification(plan,'math.tan');
 assert.equal(spec.proposedAppletName,'math-tan_applet');
 assert.equal(spec.runtimeEnabled,false);assert.equal(spec.publishEnabled,false);
 assert.equal(spec.compileStatus,'not-compiled');
 assert.ok(Array.isArray(spec.inputs));
 const sensitive=candidateSpecification(plan,'builtins.eval');assert.equal(sensitive.stage,'special-review');assert.equal(sensitive.runtimeEnabled,false);
});
test('reviewed backfill is pinned and third-party entries cannot fake promotion',async()=>{
 for(const id of ['math.isqrt','math.floor','math.ceil','builtins.abs','builtins.min','builtins.max']){
  assert.equal(validateCuratedEntry(buildCuratedEntry(id)).config.functionId,id);
 }
 assert.throws(()=>buildCuratedEntry('os.system'),/not a pinned/);
});
test('assembly metadata API is read-only and bounded',async()=>{
 const a=await apiResponse('GET','/api/assembly/plan');assert.equal(a.data.coverage.publishedPythonApplets,24);
 const b=await apiResponse('GET','/api/assembly/plan',null,{id:'math.tan'});
 assert.equal(b.data.specification.runtimeEnabled,false);
 await assert.rejects(()=>apiResponse('GET','/api/assembly/plan',null,{id:'os.system'}));
});
test('CLI emits reports and candidate specs only outside published library',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'audk-assembly-'));
 const out=join(temp,'plan.json'),specs=join(temp,'specs');
 execFileSync(process.execPath,['scripts/assemble-library.mjs','--output',out,'--spec-dir',specs,'--limit','4'],{cwd:new URL('../',import.meta.url),timeout:15000});
 const files=await readdir(specs);assert.equal(files.length,4);
 assert.equal(JSON.parse(await readFile(out,'utf8')).coverage.publishedTotal,28);
 for(const f of files){const packet=JSON.parse(await readFile(join(specs,f),'utf8'));assert.equal(packet.runtimeEnabled,false)}
 assert.throws(()=>execFileSync(process.execPath,['scripts/assemble-library.mjs','--spec-dir','library'],{cwd:new URL('../',import.meta.url),timeout:15000}));
});
test('static Pages interface does not expose a public compiler',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const workflow=await readFile(new URL('../.github/workflows/expansion-scan.yml',import.meta.url),'utf8');
 assert.match(html,/data-tab="assembly"/);assert.match(html,/id="assembly-results"/);
 assert.match(workflow,/scripts\/assemble-library.mjs/);assert.match(workflow,/contents: read/);
 assert.doesNotMatch(workflow,/contents: write/);
});

test('trusted builder only compiles pinned first-party recipes and stages outside library',async()=>{
 const tmp=await mkdtemp(join(tmpdir(),'audk-trusted-'));
 execFileSync(process.execPath,['scripts/build-trusted-applets.mjs','--output',tmp,'--limit','3'],{cwd:new URL('../',import.meta.url),timeout:15000});
 const result=JSON.parse(await readFile(join(tmp,'build-report.json'),'utf8'));
 assert.equal(result.generated,3);assert.equal(result.autoPublished,false);
 assert.equal((await readdir(tmp)).filter(x=>x.endsWith('.py')).length,3);
});
