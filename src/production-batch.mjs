/** AUDK v2.0 — isolated, explicit reviewed-recipe batch production.
 * No discovery code execution, no registry writes, no pull request or publication.
 */
import {createHash} from 'node:crypto';
import {mkdir,writeFile,lstat,realpath} from 'node:fs/promises';
import {dirname,isAbsolute,join,relative,resolve,parse} from 'node:path';
import {fileURLToPath} from 'node:url';
import {UNIVERSAL_RECIPES} from './universal-wizard.mjs';
import {validateAssemblyPlan,candidateSpecification} from './assembly-line.mjs';
import {submitBuildJob,runQueuedBuildJobs,verifyBuildJob} from './build-service.mjs';

const HOME=resolve(fileURLToPath(new URL('..',import.meta.url)));
const APPROVED=new Set(UNIVERSAL_RECIPES.map(r=>r.id));
const sha=value=>createHash('sha256').update(value).digest('hex');
const encode=value=>JSON.stringify(value,null,2)+'\n';
const MAX_REVIEWED=10,MAX_PROPOSALS=25;

export function prepareProductionBatch({reviewed=[],proposals=[]}={},plan){
 validateAssemblyPlan(plan);
 if(!Array.isArray(reviewed)||reviewed.length>MAX_REVIEWED||!Array.isArray(proposals)||proposals.length>MAX_PROPOSALS)throw Error('Batch selection exceeds limits');
 if(reviewed.length+proposals.length===0)throw Error('Select at least one function');
 for(const items of [reviewed,proposals]){
  if(items.some(id=>typeof id!=='string'||!/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/i.test(id)||items.filter(x=>x===id).length!==1))throw Error('Invalid or duplicate function IDs');
 }
 if(reviewed.some(id=>!APPROVED.has(id)))throw Error('Unreviewed functions cannot be built');
 if(reviewed.some(id=>proposals.includes(id)))throw Error('Function cannot be a build and proposal simultaneously');
 const inert=proposals.map(id=>candidateSpecification(plan,id));
 const spec={schema:'audk.production-batch.v1',reviewed:[...reviewed],proposals:inert,
  policy:{reviewedRecipesOnly:true,unknownSourceExecution:false,automaticPublication:false,automaticPullRequests:false,operatorReviewRequired:true}};
 return {...spec,planFingerprint:sha(encode(spec))};
}

/** Require an existing real parent directory and a fresh empty result directory.
 * Unlike a build job, a production batch may not share any existing queue.
 */
async function newPrivateOutput(path){
 if(typeof path!=='string'||!isAbsolute(path))throw Error('Batch output must be an absolute path');
 const output=resolve(path),source=await realpath(HOME);
 let current=dirname(output);
 while(true){
  const info=await lstat(current);
  if(info.isSymbolicLink()||!info.isDirectory())throw Error('Batch output parent cannot use symlinks or junctions');
  const parent=dirname(current);if(parent===current)break;current=parent;
 }
 const parent=await realpath(dirname(output));
 const realOutput=join(parent,output.slice(dirname(output).length+1));
 const a=relative(source,realOutput),b=relative(realOutput,source);
 if(!a||!b||(!a.startsWith('..')&&!isAbsolute(a))||(!b.startsWith('..')&&!isAbsolute(b)))throw Error('Batch output must be separate from source');
 await mkdir(output,{recursive:false,mode:0o700}); // Fail if existing: prevents collisions with private queues.
 return output;
}

export async function executeProductionBatch(selection,{output,python='python',plan}={}){
 const prepared=prepareProductionBatch(selection,plan);
 const root=await newPrivateOutput(output);
 const jobs=[];
 try{
  for(let i=0;i<prepared.reviewed.length;i++){
   const id=prepared.reviewed[i];
   const key='audk-production-'+prepared.planFingerprint.slice(0,20)+'-'+i;
   jobs.push(await submitBuildJob(root,{functionId:id,mode:'reviewed-build',idempotencyKey:key},plan));
  }
  const completed=jobs.length?await runQueuedBuildJobs(root,{limit:jobs.length,python}):[];
  const records=[];
  for(const job of completed){
   if(job.state!=='completed')throw Error('Reviewed build validation failed: '+job.functionId);
   const proof=await verifyBuildJob(root,job.jobId);
   records.push({functionId:job.functionId,jobId:job.jobId,artifacts:job.artifacts,verification:{reproducible:proof.reproducible,sourceFingerprint:proof.sourceFingerprint},evidenceSha256:job.evidence.sha256,reviewRequired:true,publication:'disabled'});
  }
  if(records.length!==jobs.length)throw Error('Production batch did not complete all requested reviewed builds');
  const proposalRecords=[];
  if(prepared.proposals.length){
   await mkdir(join(root,'proposals'),{mode:0o700});
   for(const spec of prepared.proposals){
    const name=spec.proposedAppletName+'.spec.json';
    const bytes=encode(spec);
    await writeFile(join(root,'proposals',name),bytes,{flag:'wx',mode:0o600});
    proposalRecords.push({functionId:spec.functionId,path:'proposals/'+name,sha256:sha(bytes),runtimeEnabled:false,publishEnabled:false});
   }
  }
  const report={schema:'audk.production-report.v1',planFingerprint:prepared.planFingerprint,
   reviewedBuilt:records.length,proposalsPrepared:proposalRecords.length,reviewed:records,proposals:proposalRecords,
   status:'staged-for-manual-review',reviewRequired:true,publication:'disabled',automaticPullRequests:false};
  await writeFile(join(root,'production-report.json'),encode(report),{flag:'wx',mode:0o600});
  const checklist=['# AUDK batch review — NOT PUBLISHED','',`Reviewed function builds: ${records.length}`,`Inert development specifications: ${proposalRecords.length}`,'','- [ ] Independently inspect all artifact evidence and recipe fingerprints','- [ ] Review source diffs and the published applet registry before any PR','- [ ] Confirm versioning, licensing, security and bounded example execution','- [ ] Approve an explicitly reviewed pull request; no auto-publish',''];
  await writeFile(join(root,'REVIEW-CHECKLIST.md'),checklist.join('\n'),{flag:'wx',mode:0o600});
  return {output:root,report};
 }catch(error){
  // Retain failed artifacts for private audit; never publish partial results.
  await writeFile(join(root,'FAILED.txt'),String(error.message).slice(0,240)+'\n',{flag:'wx',mode:0o600}).catch(()=>{});
  throw error;
 }
}
