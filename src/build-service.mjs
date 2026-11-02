/** AUDK v1.3: private, durable, review-gated job queue. Discovery data is never executable. */
import {randomUUID,createHash} from 'node:crypto';
import {mkdir,open,readFile,writeFile,rename,readdir,stat} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {UNIVERSAL_RECIPES,buildUniversalCandidate} from './universal-wizard.mjs';
import {buildCuratedEntry} from './curated.mjs';
import {candidateSpecification,validateAssemblyPlan} from './assembly-line.mjs';

export const BUILD_SERVICE_SCHEMA='audk.private-build.v1';
const recipes=new Map(UNIVERSAL_RECIPES.map(r=>[r.id,r]));
const IDs=/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/i;
const JOB_ID=/^[a-f0-9-]{36}$/;
const KEY=/^[a-zA-Z0-9_-]{12,80}$/;
const HOME=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const stamp=()=>new Date().toISOString();
const digest=value=>createHash('sha256').update(value).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';

export function assertDataRoot(dataRoot){
 if(typeof dataRoot!=='string'||!isAbsolute(dataRoot))throw Error('AUDK build data directory must be absolute');
 const root=resolve(dataRoot),rel=relative(HOME,root);
 if(!rel||(!rel.startsWith('..')&&!isAbsolute(rel)))throw Error('Build data directory must not be inside the public AUDK checkout');
 return root;
}
const directory=(root,id)=>join(assertDataRoot(root),'jobs',id);
async function saveAtomic(path,obj){const tmp=path+'.tmp-'+randomUUID();await writeFile(tmp,json(obj),{flag:'wx',mode:0o600});await rename(tmp,path);}

export function validateBuildRequest(request,plan){
 if(!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).some(x=>!['functionId','mode','idempotencyKey'].includes(x)))throw Error('Invalid build request fields');
 if(typeof request.functionId!=='string'||!IDs.test(request.functionId))throw Error('Invalid functionId');
 if(!KEY.test(request.idempotencyKey??''))throw Error('An idempotencyKey (12-80 URL-safe characters) is required');
 if(!['reviewed-build','specification'].includes(request.mode))throw Error('Unsupported build mode');
 const curated=recipes.has(request.functionId);
 if(request.mode==='reviewed-build'&&!curated)throw Error('Execution denied: function has no pinned reviewed recipe');
 if(!curated){validateAssemblyPlan(plan);candidateSpecification(plan,request.functionId);}
 return {functionId:request.functionId,mode:request.mode,idempotencyKey:request.idempotencyKey};
}

export async function submitBuildJob(root,request,plan){
 assertDataRoot(root);const safe=validateBuildRequest(request,plan);
 await mkdir(join(root,'jobs'),{recursive:true,mode:0o700});
 // Stable idempotency mapping uses an exclusive file: never duplicate a submitted job.
 const keyDigest=digest(safe.idempotencyKey);
 const keyPath=join(root,'jobs','idempotency-'+keyDigest+'.json');
 const signature=digest(JSON.stringify({functionId:safe.functionId,mode:safe.mode}));
 const jobId=randomUUID(),idPath=directory(root,jobId);
 try{
  const f=await open(keyPath,'wx',0o600);
  try{await f.writeFile(json({jobId,signature}));}finally{await f.close();}
 }catch(e){
  if(e.code!=='EEXIST')throw e;
  const existing=JSON.parse(await readFile(keyPath,'utf8'));
  if(existing.signature!==signature)throw Error('Idempotency key already bound to a different request');
  return readBuildJob(root,existing.jobId);
 }
 await mkdir(idPath,{recursive:false,mode:0o700});
 const job={schema:BUILD_SERVICE_SCHEMA,jobId,mode:safe.mode,functionId:safe.functionId,state:'queued',createdAt:stamp(),updatedAt:stamp(),artifacts:[],reviewRequired:true,publication:'disabled',executionPolicy:safe.mode==='reviewed-build'?'reviewed-recipes-only':'metadata-only'};
 await saveAtomic(join(idPath,'job.json'),job);
 return job;
}

export async function readBuildJob(root,id){
 if(typeof id!=='string'||!JOB_ID.test(id))throw Error('Invalid job identifier');
 const job=JSON.parse(await readFile(join(directory(root,id),'job.json'),'utf8'));
 if(job.jobId!==id||job.schema!==BUILD_SERVICE_SCHEMA)throw Error('Invalid persisted job');
 return job;
}

export async function runQueuedBuildJobs(root,{limit=3,python='python'}={}){
 assertDataRoot(root);if(!Number.isInteger(limit)||limit<1||limit>10)throw Error('Worker limit is 1..10');
 if(typeof python!=='string'||!['python','python3','py'].includes(python)&&!isAbsolute(python))throw Error('Python runner must be a known executable or absolute path');
 await mkdir(join(root,'jobs'),{recursive:true,mode:0o700});
 const names=(await readdir(join(root,'jobs'))).filter(x=>JOB_ID.test(x)).sort();const results=[];
 for(const id of names){
  if(results.length>=limit)break;
  let job;try{job=await readBuildJob(root,id)}catch{continue}
  if(job.state!=='queued')continue;
  const path=directory(root,id);
  try{await mkdir(join(path,'.claim'));}catch(e){if(e.code==='EEXIST')continue;throw e}
  job={...job,state:'running',updatedAt:stamp()};await saveAtomic(join(path,'job.json'),job);
  try{
   const artifacts=[];
   if(job.mode==='specification'){
    const plan=JSON.parse(await readFile(new URL('../catalog/assembly-plan.json',import.meta.url),'utf8'));
    const spec=recipes.has(job.functionId)?{
     schema:'audk.applet-spec.v1',functionId:job.functionId,stage:'reviewed-recipe',reviewStatus:'pending',runtimeEnabled:false,publishEnabled:false
    }:candidateSpecification(plan,job.functionId);
    const file='candidate_specification.json';await writeFile(join(path,file),json(spec),{flag:'wx',mode:0o600});artifacts.push(file);
   }else{
    const recipe=recipes.get(job.functionId);
    if(!recipe)throw Error('Reviewed recipe no longer installed');
    const compiled=buildUniversalCandidate(buildCuratedEntry(job.functionId).config);
    const slug=job.functionId.replace('.','-')+'_applet';
    for(const [file,content] of [
     [slug+'.mjs',compiled.javaScript],[slug+'.py',compiled.python],
     [slug+'.manifest.json',json({...compiled.manifest,published:false,reviewRequired:true})],
     [slug+'.test.mjs',compiled.testSource.replace(`'./${compiled.manifest.id}.mjs'`,`'./${slug}.mjs'`)]
    ]){await writeFile(join(path,file),content,{flag:'wx',mode:0o600});artifacts.push(file)}
    // Execute only existing, explicitly reviewed, bounded recipes. This is NOT a sandbox for user code.
    const js=spawnSync(process.execPath,['--check',join(path,slug+'.mjs')],{cwd:path,timeout:4000,maxBuffer:16384,encoding:'utf8'});
    if(js.status!==0||js.error)throw Error('JavaScript syntax validation failed');
    const pythonRun=spawnSync(python,[join(path,slug+'.py')],{cwd:path,timeout:5000,maxBuffer:16384,encoding:'utf8',windowsHide:true});
    if(pythonRun.status!==0||pythonRun.error)throw Error('Reviewed Python example failed');
    const actual=JSON.parse(pythonRun.stdout);
    const expected=compiled.result;
    const equal=(a,b)=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(a),Math.abs(b)):JSON.stringify(a)===JSON.stringify(b);
    if(!equal(actual,expected))throw Error('Python output disagrees with pinned recipe');
    const test=spawnSync(process.execPath,['--test',join(path,slug+'.test.mjs')],{cwd:path,timeout:5000,maxBuffer:16384,encoding:'utf8'});
    if(test.status!==0||test.error)throw Error('Generated JavaScript test failed');
   }
   const report=[];
   for(const f of artifacts){const bytes=await readFile(join(path,f));report.push({name:f,sha256:digest(bytes),bytes:bytes.length})}
   job={...job,state:'completed',artifacts:report,updatedAt:stamp(),validation:job.mode==='reviewed-build'?'js-syntax,node-test,python-example':'metadata-only'};
  }catch(e){job={...job,state:'failed',updatedAt:stamp(),failureCode:'BUILD_VALIDATION_FAILED',error:String(e.message).slice(0,180)}}
  await saveAtomic(join(path,'job.json'),job);results.push(job);
 }
 return results;
}
