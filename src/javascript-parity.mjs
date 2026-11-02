/** AUDK v2.3: candidate-only JS parity against sealed CPython reference fixtures.
 * The only executable functions here are first-party, hard-coded pure math candidates.
 * Passing parity does NOT approve recipes, populate the registry or publish software.
 */
import {createHash} from 'node:crypto';
import {readFile,mkdir,lstat,realpath,writeFile} from 'node:fs/promises';
import {dirname,basename,join,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ORACLE_IDS,prepareReferenceCapture,capturePythonReferences} from './python-reference.mjs';

const HOME=resolve(fileURLToPath(new URL('..',import.meta.url)));
const SOURCE=fileURLToPath(import.meta.url);
const DEFAULT_IDS=Object.freeze([...ORACLE_IDS]);
const sha=value=>createHash('sha256').update(value).digest('hex');
const encode=value=>JSON.stringify(value,null,2)+'\n';
const ABS_TOL=5e-13, REL_TOL=5e-13;

// This implementation only claims the restricted input domain [-1, 1].
// A fixed Maclaurin series is easy to audit but is NOT a general-purpose math.erf.
function erfBounded(x){
 if(x < -1 || x > 1)throw RangeError('Candidate input outside approved prototype bounds');
 let term=x,acc=term;
 for(let n=1;n<40;n++){
  term*=-(x*x)/n;
  acc+=term/(2*n+1);
 }
 return 2/Math.sqrt(Math.PI)*acc;
}
const CANDIDATES=Object.freeze({
 'math.tan':  {impl:Math.tan, min:-1.2,max:1.2,domain:x=>true,notes:'Avoid the tan singularities near ±π/2'},
 'math.acos': {impl:Math.acos,min:-1,max:1,domain:x=>x>=-1&&x<=1,notes:'Python raises ValueError outside [-1,1]; JS Math.acos returns NaN'},
 'math.asin': {impl:Math.asin,min:-1,max:1,domain:x=>x>=-1&&x<=1,notes:'Python raises ValueError outside [-1,1]; JS Math.asin returns NaN'},
 'math.acosh':{impl:Math.acosh,min:1,max:10,domain:x=>x>=1,notes:'Python raises ValueError for x<1; candidate prototype is bounded to x<=10'},
 'math.atanh':{impl:Math.atanh,min:-0.95,max:0.95,domain:x=>x>-1&&x<1,notes:'Python raises ValueError at ±1; JS Math.atanh returns infinities'},
 'math.erf':  {impl:erfBounded,min:-1,max:1,domain:x=>true,notes:'Original finite 40-term Maclaurin candidate, restricted to [-1,1]'}
});

export function prepareJavascriptParity(catalog,assembly,{ids=DEFAULT_IDS}={}){
 const referencePlan=prepareReferenceCapture(catalog,assembly,{ids});
 return {schema:'audk.js-parity-plan.v1',functionIds:[...referencePlan.ids],cases:referencePlan.cases,
  candidateSummary:referencePlan.ids.map(id=>({functionId:id,stage:'experimental-review-only',bounds:{min:CANDIDATES[id].min,max:CANDIDATES[id].max},notes:CANDIDATES[id].notes})),
  policy:{fixedFixturesOnly:true,operatorExecutionRequired:true,unknownCodeExecution:false,
   humanApproved:false,registryPromotion:false,automaticPublication:false}};
}

/** Explicit bounded candidate adapter. Never evaluates SDK-discovered code. */
export function evaluateJavascriptCandidate(id,input){
 const c=CANDIDATES[id];
 if(!c)throw Error('Unreviewed unknown candidate cannot execute');
 const x=input?.x;
 if(typeof x!=='number'||!Number.isFinite(x))return {kind:'error',exception:'TypeError'};
 if(!c.domain(x))return {kind:'error',exception:'ValueError'};
 if(x<c.min||x>c.max)return {kind:'unsupported',reason:'bounded prototype outside admitted domain'};
 try{
  const value=c.impl(x);
  if(!Number.isFinite(value))return {kind:'unsupported',reason:'nonfinite candidate result'};
  return {kind:'value',value};
 }catch{return {kind:'unsupported',reason:'candidate implementation rejected input'}}
}

function compareCase(id,item){
 const observed=evaluateJavascriptCandidate(id,item.inputs),ref=item.outcome;
 if(ref?.kind==='error')return {caseId:item.caseId,input:item.inputs,python:ref,javascript:observed,
  status:observed.kind==='error'&&observed.exception===ref.exception?'pass':'fail',comparison:'error-type'};
 if(ref?.kind!=='value'||typeof ref.value!=='number'||!Number.isFinite(ref.value))throw Error('Unsupported CPython fixture');
 const err=observed.kind==='value'?Math.abs(observed.value-ref.value):null;
 const limit=ABS_TOL+REL_TOL*Math.abs(ref.value);
 return {caseId:item.caseId,input:item.inputs,python:ref,javascript:observed,status:err!==null&&err<=limit?'pass':'fail',
  comparison:'bounded-absolute-relative',absoluteError:err,tolerance:limit};
}

export async function compareJavascriptParity(catalog,assembly,{ids=DEFAULT_IDS,python='python'}={}){
 const planned=prepareJavascriptParity(catalog,assembly,{ids});
 const capture=await capturePythonReferences(catalog,assembly,{ids:planned.functionIds,python});
 const candidateSourceSha256=sha(await readFile(SOURCE));
 const reports=capture.packets.map(packet=>{
  const cases=packet.referenceCases.map(item=>compareCase(packet.functionId,item));
  const passed=cases.filter(c=>c.status==='pass').length;
  return {functionId:packet.functionId,referencePacketSha256:packet.sha256,
   referenceOracleSha256:packet.oracleSourceSha256,candidateSourceSha256,
   cases,passed,failed:cases.length-passed,status:passed===cases.length?'parity-passed-for-fixed-fixtures':'parity-failed',
   review:{humanApproved:false,documentationReviewed:false,boundsApproved:false,implementationApproved:false},
   policy:{executableRecipe:false,autoPromotion:false,autoPublication:false}};
 });
 const base={schema:'audk.js-parity-report.v1',pythonVersion:capture.pythonVersion,
  referenceOracleSha256:capture.oracleSourceSha256,candidateSourceSha256,
  cases:reports.reduce((n,r)=>n+r.cases.length,0),passed:reports.reduce((n,r)=>n+r.passed,0),
  failed:reports.reduce((n,r)=>n+r.failed,0),candidates:reports,
  status:reports.every(r=>r.failed===0)?'fixed-fixtures-passed-awaiting-review':'review-required-parity-failed',
  policy:{humanApprovalRequired:true,untrustedCodeExecution:false,automaticPromotion:false,
   automaticPublication:false,signed:false}};
 return {...base,sha256:sha(encode(base))};
}

async function freshOutput(output){
 if(typeof output!=='string'||!isAbsolute(output))throw Error('Parity output path must be absolute');
 const dest=resolve(output),src=await realpath(HOME);let current=dirname(dest);
 while(true){const info=await lstat(current);if(!info.isDirectory()||info.isSymbolicLink())throw Error('Parity output parent must be a real directory');
  const next=dirname(current);if(next===current)break;current=next;}
 const final=join(await realpath(dirname(dest)),basename(dest));
 const a=relative(src,final),b=relative(final,src);
 if(!a||!b||(!a.startsWith('..')&&!isAbsolute(a))||(!b.startsWith('..')&&!isAbsolute(b)))throw Error('Output must be separate from source');
 await mkdir(final,{recursive:false,mode:0o700});return final;
}
export async function writeJavascriptParity(result,{output}={}){
 if(result?.schema!=='audk.js-parity-report.v1'||result.policy?.automaticPublication!==false||
  result.policy?.automaticPromotion!==false||result.policy?.untrustedCodeExecution!==false||
  !Array.isArray(result.candidates)||result.candidates.length<1||result.candidates.length>6||
  result.candidates.some(c=>!CANDIDATES[c.functionId]||c.policy?.executableRecipe!==false||c.review?.humanApproved!==false)||
  sha(encode(Object.fromEntries(Object.entries(result).filter(([key])=>key!=='sha256'))))!==result.sha256)
  throw Error('Invalid or tampered JavaScript parity report');
 const dir=await freshOutput(output);
 await writeFile(join(dir,'javascript-parity-report.json'),encode(result),{flag:'wx',mode:0o600});
 await writeFile(join(dir,'REVIEW-CHECKLIST.md'),[
  '# AUDK v2.3 JavaScript candidate review — NOT AN APPROVED RECIPE','',
  '- [ ] Validate numerical tolerance, edge inputs and bounded domains against official Python documentation',
  '- [ ] Independently inspect each candidate implementation, especially the erf approximation',
  '- [ ] Add more property, randomized and boundary tests in an isolated environment',
  '- [ ] Obtain explicit human review of implementation, input bounds, licensing and security',
  '- [ ] Promote only through a separately approved pull request; no automatic publication',''
 ].join('\n'),{flag:'wx',mode:0o600});
 return {output:dir,cases:result.cases,passed:result.passed,failed:result.failed,reviewRequired:true,published:0};
}
