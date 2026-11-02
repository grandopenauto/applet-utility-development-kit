/** Operator-only, offline handoff importer. Never executes builds or publishes applets. */
import {lstat,readFile} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {validateBuildHandoff} from './build-handoff.mjs';
import {validateBuildRequest,submitBuildJob} from './build-service.mjs';

export async function inspectBuildHandoff(file,plan,{now=Date.now()}={}){
 if(typeof file!=='string'||!isAbsolute(file))throw Error('Handoff path must be absolute');
 const meta=await lstat(file);
 if(!meta.isFile()||meta.isSymbolicLink()||meta.size<40||meta.size>4096)
  throw Error('Handoff must be a small, regular JSON file without symbolic links');
 const raw=await readFile(file);
 if(raw.length>4096)throw Error('Handoff file too large');
 let doc;
 try{doc=JSON.parse(raw.toString('utf8'))}catch{throw Error('Invalid handoff JSON')}
 const request=validateBuildHandoff(doc,{now});
 const validated=validateBuildRequest(request,plan);
 return {schema:doc.schema,requestId:doc.requestId,createdAt:doc.createdAt,
  request:validated,requiresReviewedBuildApproval:validated.mode==='reviewed-build',
  eligibleForIntake:true,automaticExecution:false,automaticPublication:false};
}

export async function importBuildHandoff(file,plan,{now=Date.now(),dataRoot,enqueue=false,approveReviewed=false}={}){
 const inspected=await inspectBuildHandoff(file,plan,{now});
 if(!enqueue)return {...inspected,status:'inspected-not-queued'};
 if(inspected.requiresReviewedBuildApproval&&approveReviewed!==true)
  throw Error('Reviewed builds require explicit --approve-reviewed operator action');
 if(typeof dataRoot!=='string')throw Error('Private AUDK_BUILD_DATA_DIR required to enqueue');
 const job=await submitBuildJob(dataRoot,inspected.request,plan);
 return {...inspected,status:'queued',jobId:job.jobId,jobState:job.state};
}
