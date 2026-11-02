/** AUDK v2.4: fixed first-party mathematical property checks against CPython 3.13.
 * Experimental candidates only. This is NOT a sandbox, recipe promotion or publication.
 */
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile,lstat,realpath} from 'node:fs/promises';
import {dirname,basename,join,isAbsolute,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {evaluateJavascriptCandidate} from './javascript-parity.mjs';

const HOME=resolve(fileURLToPath(new URL('..',import.meta.url)));
const ORACLE=fileURLToPath(new URL('../tools/approved_math_property_oracle.py',import.meta.url));
const JS_SOURCE=fileURLToPath(new URL('./javascript-parity.mjs',import.meta.url));
const IDS=['math.tan','math.acos','math.asin','math.acosh','math.atanh','math.erf'];
const FIXED_BOUNDS=[[-1.2,1.2],[-1,1],[-1,1],[1,10],[-0.95,0.95],[-1,1]];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const encode=x=>JSON.stringify(x,null,2)+'\n';
const absTolerance=5e-13,relTolerance=5e-13;

export function assessPropertyOracle(fixture){
 if(fixture?.schema!=='audk.math-property-oracle.v1'||!/^3\.13\.\d+$/.test(fixture.pythonVersion)||
    fixture.policy?.fixedInputs!==true||fixture.policy?.dynamicEvaluation!==false||
    fixture.policy?.untrustedCodeExecution!==false||fixture.policy?.automaticPromotion!==false||
    fixture.policy?.automaticPublication!==false||!Array.isArray(fixture.groups)||fixture.groups.length!==6)
    throw Error('Invalid bounded reference oracle fixture');
 if(fixture.groups.some((g,i)=>g.functionId!==IDS[i]||!Array.isArray(g.bounds)||g.bounds.length!==2||
    !Array.isArray(g.cases)||g.cases.length!==101))throw Error('Incomplete or reordered oracle grid');
 const detail=[];
 for(const group of fixture.groups){
  const [lo,hi]=group.bounds;let maxError=0,failures=0;
  const index=IDS.indexOf(group.functionId);
  if(index<0||lo!==FIXED_BOUNDS[index][0]||hi!==FIXED_BOUNDS[index][1])throw Error('Invalid or altered fixed reference bounds');
  const vals=[];
  for(let i=0;i<group.cases.length;i++){
   const entry=group.cases[i];const expectedX=lo+(hi-lo)*i/100;
   if(!Number.isFinite(entry.x)||entry.x!==expectedX||!Number.isFinite(entry.value))throw Error('Invalid or altered reference input');
   const actual=evaluateJavascriptCandidate(group.functionId,{x:entry.x});
   const diff=actual.kind==='value'?Math.abs(actual.value-entry.value):Infinity;
   const lim=absTolerance+relTolerance*Math.abs(entry.value);
   if(!(diff<=lim))failures++;
   if(Number.isFinite(diff))maxError=Math.max(maxError,diff);
   vals.push(actual.kind==='value'?actual.value:NaN);
  }
  // Independently check monotonicity on the sampled domain.
  for(let i=1;i<vals.length;i++){
   if(group.functionId==='math.acos'){
    if(!(vals[i]<vals[i-1]))failures++;
   }else if(!(vals[i]>vals[i-1]))failures++;
  }
  // Symmetry or complement property on symmetric grids.
  if(group.functionId!=='math.acosh')for(let i=0;i<51;i++){
   const a=vals[i],b=vals[100-i];
   const err=group.functionId==='math.acos'?Math.abs(a+b-Math.PI):Math.abs(a+b);
   if(!(err<=5e-12))failures++;
  }
  detail.push({functionId:group.functionId,cases:101,failures,maxAbsoluteError:maxError,
   monotonicity:'checked',symmetry:group.functionId==='math.acosh'?'not-applicable':'checked',
   reviewed:false,promoted:false});
 }
 // Boundary/invalid-input policy checks use only hard-coded, first-party adapters.
 const negative=[
  ['math.acos',1.0001,'error','ValueError'],['math.asin',-1.0001,'error','ValueError'],
  ['math.acosh',0.9999,'error','ValueError'],['math.atanh',1,'error','ValueError'],
  ['math.atanh',-1,'error','ValueError'],['math.tan',1.3,'unsupported',null],
  ['math.erf',1.001,'unsupported',null],['math.acosh',11,'unsupported',null],
  ['math.tan','5','error','TypeError'],['math.erf',null,'error','TypeError'],
  ['math.acos',Number.NaN,'error','TypeError'],['math.asin',Infinity,'error','TypeError']
 ];
 const invalid=negative.filter(([id,x,kind,exc])=>{const result=evaluateJavascriptCandidate(id,{x});return result.kind!==kind||(exc!==null&&result.exception!==exc)}).length;
 const base={schema:'audk.js-property-report.v1',pythonVersion:fixture.pythonVersion,functions:detail,
  samples:detail.reduce((a,x)=>a+x.cases,0),boundaryCases:negative.length,
  passed:detail.every(x=>x.failures===0)&&invalid===0,failedComparisons:detail.reduce((a,x)=>a+x.failures,0)+invalid,
  policy:{humanApprovalRequired:true,reviewedRecipesOnly:true,untrustedCodeExecution:false,
   automaticPromotion:false,automaticPublication:false,signed:false}};
 return {...base,sha256:sha(encode(base))};
}

export async function runPropertyParity({python='python'}={}){
 if(typeof python!=='string'||!(['python','python3','py'].includes(python)||isAbsolute(python)))throw Error('Approved Python binary required');
 const proc=spawnSync(python,['-I','-S',ORACLE],{cwd:HOME,encoding:'utf8',timeout:10000,maxBuffer:180000,windowsHide:true});
 if(proc.status!==0||proc.error)throw Error('Approved fixed Python property oracle failed');
 if(proc.stdout.length>130000)throw Error('Oracle output exceeded size cap');
 const fixture=JSON.parse(proc.stdout);
 const report=assessPropertyOracle(fixture);
 const {sha256:ignored,...base}=report;
 const complete={...base,provenance:{pythonOracleSha256:sha(await readFile(ORACLE)),jsCandidateSha256:sha(await readFile(JS_SOURCE))}};
 return {...complete,sha256:sha(encode(complete))};
}

export async function writePropertyParity(report,{output}={}){
 if(!report||report.schema!=='audk.js-property-report.v1'||report.passed!==true||
  report.policy?.automaticPromotion!==false||report.policy?.automaticPublication!==false||
  !Array.isArray(report.functions)||report.functions.length!==6||
  !report.functions.every(x=>x.reviewed===false&&x.promoted===false)||
  sha(encode(Object.fromEntries(Object.entries(report).filter(([key])=>key!=='sha256'))))!==report.sha256)
  throw Error('Invalid or failed fixed property report');
 if(typeof output!=='string'||!isAbsolute(output))throw Error('Fresh absolute output required');
 const dest=resolve(output);let parent=dirname(dest);
 while(true){const info=await lstat(parent);if(!info.isDirectory()||info.isSymbolicLink())throw Error('Output path must have ordinary directory ancestors');
  const next=dirname(parent);if(next===parent)break;parent=next;}
 const final=join(await realpath(dirname(dest)),basename(dest)),src=await realpath(HOME);
 const a=relative(src,final),b=relative(final,src);
 if(!a||!b||(!a.startsWith('..')&&!isAbsolute(a))||(!b.startsWith('..')&&!isAbsolute(b)))throw Error('Output must be separate from source');
 await mkdir(final,{recursive:false,mode:0o700});
 await writeFile(join(final,'property-parity-report.json'),encode(report),{flag:'wx',mode:0o600});
 await writeFile(join(final,'REVIEW-CHECKLIST.md'),[
  '# AUDK bounded property parity — NOT APPROVED','',
  '- [ ] Review official Python 3.13 math semantics, inputs and errors',
  '- [ ] Review reproducibility evidence and measured numerical tolerances',
  '- [ ] Inspect bounded erf approximation and near-domain endpoints',
  '- [ ] Approve a separate implementation pull request before any promotion',''
 ].join('\n'),{flag:'wx',mode:0o600});
 return {output:final,samples:report.samples,boundaryCases:report.boundaryCases,published:0};
}
