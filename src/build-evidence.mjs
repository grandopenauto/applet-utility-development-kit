/** AUDK v1.5 — reproducible, checksum-verified private build evidence.
 * This is NOT a signed attestation or a sandbox: the verifier trusts pinned local source.
 */
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {UNIVERSAL_RECIPES,buildUniversalCandidate} from './universal-wizard.mjs';
import {buildCuratedEntry} from './curated.mjs';
import {candidateSpecification,validateAssemblyPlan} from './assembly-line.mjs';

export const BUILD_EVIDENCE_SCHEMA='audk.build-evidence.v1';
const RECIPES=new Map(UNIVERSAL_RECIPES.map(r=>[r.id,r]));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=x=>JSON.stringify(x,null,2)+'\n';
const same=(a,b)=>a.length===b.length&&a.equals(b);

/** Rebuild the exact expected files from the first-party implementation. */
export function expectedBuildFiles(job,plan){
 if(job?.mode==='reviewed-build'){
  if(!RECIPES.has(job.functionId))throw Error('Reviewed recipe missing');
  const candidate=buildUniversalCandidate(buildCuratedEntry(job.functionId).config);
  const slug=job.functionId.replace('.','-')+'_applet';
  return new Map([
   [slug+'.mjs',candidate.javaScript],
   [slug+'.py',candidate.python],
   [slug+'.manifest.json',json({...candidate.manifest,published:false,reviewRequired:true})],
   [slug+'.test.mjs',candidate.testSource.replace(`'./${candidate.manifest.id}.mjs'`,`'./${slug}.mjs'`)]
  ]);
 }
 if(job?.mode==='specification'){
  validateAssemblyPlan(plan);
  const spec=RECIPES.has(job.functionId)?{
   schema:'audk.applet-spec.v1',functionId:job.functionId,stage:'reviewed-recipe',reviewStatus:'pending',runtimeEnabled:false,publishEnabled:false
  }:candidateSpecification(plan,job.functionId);
  if(spec.runtimeEnabled!==false||spec.publishEnabled!==false)throw Error('Specification executable flag denied');
  return new Map([['candidate_specification.json',json(spec)]]);
 }
 throw Error('Unknown build mode');
}

export function makeBuildEvidence(job,actualFiles,plan){
 if(job?.state!=='completed'||job.reviewRequired!==true||job.publication!=='disabled')throw Error('Only completed unpublished review-gated builds can be evidenced');
 if(!(actualFiles instanceof Map))throw Error('Expected artifact map');
 const expected=expectedBuildFiles(job,plan);
 if(expected.size!==actualFiles.size)throw Error('Build evidence artifact count mismatch');
 const entries=[];
 for(const [name,content] of expected){
  const bytes=actualFiles.get(name);
  if(!Buffer.isBuffer(bytes)||!same(bytes,Buffer.from(content,'utf8')))throw Error('Artifact differs from pinned expected output: '+name);
  entries.push({name,sha256:sha(bytes),bytes:bytes.length});
 }
 const recipe=RECIPES.get(job.functionId);
 const sourceFingerprint=sha(recipe?json(recipe):json({schema:plan.schema,candidate:plan.candidates.find(c=>c.id===job.functionId)}));
 return {
  schema:BUILD_EVIDENCE_SCHEMA,jobId:job.jobId,functionId:job.functionId,mode:job.mode,
  sourceFingerprint,sourceType:recipe?'reviewed-recipe':'review-queue-candidate',
  validation:job.validation,reviewRequired:true,publication:'disabled',
  evidenceType:'reproducible-checksums-not-a-signed-attestation',artifacts:entries
 };
}

export async function readAssemblyPlan(){return JSON.parse(await readFile(new URL('../catalog/assembly-plan.json',import.meta.url),'utf8'));}
export const evidenceDigest=bytes=>sha(bytes);
export const evidenceText=json;
