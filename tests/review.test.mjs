import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createReviewPacket,verifyReviewPacket,preparePromotionProposal,validatePromotedEntry,sha256} from '../src/review.mjs';
import {UNIVERSAL_RECIPES,UNIVERSAL_SCHEMA} from '../src/universal-wizard.mjs';
import {validateEntry} from '../src/registry.mjs';
import {apiResponse} from '../src/api.mjs';
import {SECTIONS,sectionFromHash} from '../navigation-ui.js';
const config=(recipe=UNIVERSAL_RECIPES[0],args=recipe.examples[0].args,id='sha256-demo')=>({schema:UNIVERSAL_SCHEMA,id,name:'Sample applet',description:'Pure demo candidate',functionId:recipe.id,arguments:args});
const clone=x=>JSON.parse(JSON.stringify(x));
test('Review evidence covers every reviewed function and its examples',async()=>{
 for(const r of UNIVERSAL_RECIPES){
  const p=await createReviewPacket(config(r));
  assert.equal((await verifyReviewPacket(p)).valid,true);
  assert.equal(p.evidence.passed,r.examples.length+1);
  assert.equal(p.evidence.failed,0);
  assert.equal(p.manifest.status,'candidate-review-required');
  assert.match(p.fingerprints.javascript,/^[a-f0-9]{64}$/);
 }
});
test('Hash evidence detects candidate, artifact and test tampering',async()=>{
 const good=await createReviewPacket(config());
 for(const [key,change] of [
  ['config',p=>p.config.arguments.value=100],
  ['manifest',p=>p.manifest.status='approved'],
  ['evidence',p=>p.evidence.cases[0].passed=false],
  ['artifacts',p=>p.artifacts.python+='\nprint("tampered")'],
  ['fingerprints',p=>p.fingerprints.manifest='0'.repeat(64)]
 ]){
  const broken=clone(good);change(broken);
  await assert.rejects(verifyReviewPacket(broken),/integrity verification/);
 }
});
test('SHA-256 fingerprints are deterministic and changes are detected',async()=>{
 const a=await createReviewPacket(config());
 const b=await createReviewPacket(config());
 assert.deepEqual(a,b);
 assert.notEqual(a.fingerprints.config,(await createReviewPacket(config(UNIVERSAL_RECIPES[0],{value:2}))).fingerprints.config);
 assert.equal((await sha256('AUDK')).length,64);
});
test('Promotion requires explicit acknowledgment, reviewer and detailed notes',async()=>{
 const p=await createReviewPacket(config());
 await assert.rejects(preparePromotionProposal(p,{reviewer:'Test Reviewer',note:'Examined checked code'}),/acknowledge/);
 await assert.rejects(preparePromotionProposal(p,{reviewer:'X',note:'Examined checked code',acknowledged:true}),/Reviewer label/);
 await assert.rejects(preparePromotionProposal(p,{reviewer:'Test Reviewer',note:'ok',acknowledged:true}),/Review notes/);
 const proposal=await preparePromotionProposal(p,{reviewer:'Test Reviewer',note:'Inspected source and interpreter evidence',acknowledged:true});
 assert.equal(proposal.status,'proposed-not-published');
 assert.equal(proposal.path,'library/sha256-demo.json');
 assert.doesNotThrow(()=>validatePromotedEntry(proposal.entry));
 assert.doesNotThrow(()=>validateEntry(proposal.entry));
});
test('Universal registry validation rejects missing review checkpoint and forged config',async()=>{
 const p=await createReviewPacket(config());
 const proposal=await preparePromotionProposal(p,{reviewer:'Test Reviewer',note:'Inspected source and output',acknowledged:true});
 const missing=clone(proposal.entry);delete missing.review;
 assert.throws(()=>validateEntry(missing),/promotion record/);
 const altered=clone(proposal.entry);altered.config.id='different-id';
 assert.throws(()=>validateEntry(altered),/does not match/);
});
test('Local review API is stateless and does not publish registry files',async()=>{
 const cfg=config();const packet=(await apiResponse('POST','/api/review/packet',cfg)).data;
 assert.equal((await apiResponse('POST','/api/review/verify',packet)).data.valid,true);
 const proposal=(await apiResponse('POST','/api/review/proposal',{packet,review:{reviewer:'Test Reviewer',note:'Read the source and checked evidence',acknowledged:true}})).data;
 assert.equal(proposal.status,'proposed-not-published');
 assert.equal((await apiResponse('POST','/api/review/publish',proposal)).status,404);
});
test('Review Desk navigation and browser assets are included',async()=>{
 assert.ok(SECTIONS.review);assert.equal(sectionFromHash('#review'),'review');
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const script=await readFile(new URL('../review-ui.js',import.meta.url),'utf8');
 assert.match(html,/data-tab="review"/);assert.match(html,/id="review-prepare"/);
 assert.match(html,/src="\.\/review-ui\.js"/);assert.match(script,/preparePromotionProposal/);
 assert.doesNotMatch(script,/(fetch\(.+?\/api\/review\/publish|window\.eval|new Function)/);
});
test('Local-only CLI stages proposals but never writes to library by itself',async()=>{
 const tmp=await mkdtemp(join(tmpdir(),'audk-review-'));
 try{
  const packet=await createReviewPacket(config());
  const file=join(tmp,'candidate.review.json');await writeFile(file,JSON.stringify(packet));
  const run=spawnSync(process.execPath,['scripts/promote-review.mjs','--packet',file,'--reviewer','Test Reviewer','--note','Validated the source and evidence','--acknowledge','--out',join(tmp,'proposals')],{cwd:new URL('../',import.meta.url),encoding:'utf8',timeout:10000});
  assert.equal(run.status,0,run.stderr);
  const result=JSON.parse(await readFile(join(tmp,'proposals','sha256-demo.proposal.json'),'utf8'));
  assert.equal(result.entry.kind,'universal-function');assert.equal(result.status,'proposed-not-published');
  const bad=spawnSync(process.execPath,['scripts/stage-promoted-applet.mjs','--packet',file,'--proposal',join(tmp,'proposals','sha256-demo.proposal.json')],{cwd:new URL('../',import.meta.url),encoding:'utf8',timeout:10000});
  assert.equal(bad.status,2);
 }finally{await rm(tmp,{recursive:true,force:true});}
});
