import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat,rm,mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseSignature,developRecipePacket,planRecipeDevelopment,writeRecipeDevelopment} from '../src/sdk-recipe-development.mjs';
const catalog=JSON.parse(await readFile(new URL('../catalog/python-standard-library.json',import.meta.url),'utf8'));
const plan=JSON.parse(await readFile(new URL('../catalog/assembly-plan.json',import.meta.url),'utf8'));

test('signature parser respects positional-only, keyword-only and nested defaults',()=>{
 const a=parseSignature('(x, /, *, precision=3, options=(1, 2), **kwargs)');
 assert.equal(a.status,'heuristic');
 assert.deepEqual(a.parameters.map(p=>[p.name,p.kind,p.required]),[
  ['x','positional-only',true],['precision','keyword-only',false],['options','keyword-only',false],['kwargs','variadic-keyword',false]]);
 assert.equal(a.parameters[2].defaultText,'(1, 2)');
 assert.equal(a.parameters.every(p=>p.verified===false&&p.bounds===null),true);
});
test('unknown and malformed signatures do not cause code evaluation or guessed defaults',()=>{
 assert.equal(parseSignature('(signature unavailable)').status,'unparsed');
 assert.equal(parseSignature('(x, default=__import__("os").system("bad"))').parameters[1].defaultText,'__import__("os").system("bad")');
 assert.equal(parseSignature('(x, options=[1, 2)').status,'unparsed');
});
test('math candidate packet has grounded provenance and unverified reference placeholders',()=>{
 const p=developRecipePacket(catalog,plan,'math.tan');
 assert.equal(p.stage,'implementation-needed');assert.equal(p.proposedAppletName,'math-tan_applet');
 assert.equal(p.provenance.pythonVersion,'3.13.5');
 assert.equal(p.provenance.documentation,'https://docs.python.org/3.13/library/math.html#math.tan');
 assert.equal(p.arguments.parameters[0].kind,'positional-only');
 assert.equal(p.proposedTestCases.length,3);
 assert.equal(p.proposedTestCases.every(c=>c.expectedOutput===null&&c.verified===false&&c.executable===false),true);
 assert.equal(p.policy.executable,false);assert.equal(p.review.approvalStatus,'not-approved');
 assert.match(p.packetSha256,/^[a-f0-9]{64}$/);
 assert.deepEqual(developRecipePacket(catalog,plan,'math.tan'),p);
});
test('powerful builtins are restricted to inert special-review packets',()=>{
 assert.throws(()=>planRecipeDevelopment(catalog,plan,{ids:['builtins.eval']}),/allowed development/);
 const p=planRecipeDevelopment(catalog,plan,{ids:['builtins.eval'],includeSpecial:true}).packets[0];
 assert.equal(p.stage,'special-review');assert.equal(p.proposedTestCases.length,0);
 assert.equal(p.review.securityReviewRequired,true);assert.equal(p.policy.runtimeEnabled,false);
});
test('tampered metadata, already reviewed functions and unknown IDs fail closed',()=>{
 assert.throws(()=>developRecipePacket(catalog,plan,'math.sqrt'),/eligible/);
 assert.throws(()=>developRecipePacket(catalog,plan,'os.system'));
 const corrupted={...catalog,entries:catalog.entries.map(e=>e.module==='math'&&e.name==='tan'?{...e,signature:'(danger=1)'}:e)};
 assert.throws(()=>developRecipePacket(corrupted,plan,'math.tan'),/disagree/);
 const duplicated={...catalog,entries:[...catalog.entries,...catalog.entries.filter(e=>e.module==='math'&&e.name==='tan')]};
 assert.throws(()=>developRecipePacket(duplicated,plan,'math.tan'),/exactly once/);
});
test('selection enforces module, review and limit boundaries',()=>{
 const res=planRecipeDevelopment(catalog,plan,{module:'math',limit:5});
 assert.equal(res.proposalCount,5);assert.equal(res.packets.every(p=>p.functionId.startsWith('math.')),true);
 assert.throws(()=>planRecipeDevelopment(catalog,plan,{ids:['math.tan','math.tan']}),/duplicate/);
 assert.throws(()=>planRecipeDevelopment(catalog,plan,{limit:26}),/limit/);
 assert.throws(()=>planRecipeDevelopment(catalog,plan,{module:'os'}),/module/);
 assert.throws(()=>planRecipeDevelopment(catalog,plan,{ids:['math.tan'],module:'json'}),/selection/);
});
test('CLI preview is inspect-only and writes nothing',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'audk-sdk-preview-'));
 try{
  const unused=join(parent,'never-created');
  const cmd=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/prepare-sdk-recipes.mjs',import.meta.url)),'--ids','math.tan,math.acos','--output',unused],{encoding:'utf8',timeout:8000});
  assert.equal(cmd.status,0,cmd.stderr);const json=JSON.parse(cmd.stdout);
  assert.equal(json.mode,'inspect-only');assert.equal(json.outputWritten,false);
  await assert.rejects(()=>stat(unused),{code:'ENOENT'});
 }finally{await rm(parent,{recursive:true,force:true})}
});
test('explicit private output produces only draft JSON and human checklist',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'audk-sdk-packets-'));
 try{
  const output=join(parent,'new-recipe-batch');
  const prepared=planRecipeDevelopment(catalog,plan,{ids:['math.tan','math.acos']});
  const run=await writeRecipeDevelopment(prepared,{output});
  assert.equal(run.report.packets.length,2);
  assert.equal(run.report.approved,0);assert.equal(run.report.executed,0);assert.equal(run.report.published,0);
  assert.deepEqual((await readdir(output)).sort(),['REVIEW-CHECKLIST.md','development-report.json','math-acos_applet.recipe-draft.json','math-tan_applet.recipe-draft.json']);
  assert.match(await readFile(join(output,'REVIEW-CHECKLIST.md'),'utf8'),/human|review|approved/i);
  await assert.rejects(()=>writeRecipeDevelopment(prepared,{output}),/EEXIST/);
  assert.equal((await readdir(parent)).length,1);
 }finally{await rm(parent,{recursive:true,force:true})}
});
test('writable output refuses checkout overlap and unsafe mutated packets',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'audk-sdk-reject-'));
 try{
  const planResult=planRecipeDevelopment(catalog,plan,{ids:['math.tan']});
  const forged={...planResult,packets:[{...planResult.packets[0],packetSha256:'0'.repeat(64)}]};
  await assert.rejects(()=>writeRecipeDevelopment(forged,{output:join(parent,'bad')}),/altered/);
  await assert.rejects(()=>writeRecipeDevelopment(planResult,{output:'relative'}),/absolute/);
 }finally{await rm(parent,{recursive:true,force:true})}
});
