/** AUDK v2.2: sealed, reference-only Python 3.13 oracle for six pure math functions.
 * SDK metadata remains inert. Nothing here promotes, builds or publishes a recipe.
 */
import {createHash} from 'node:crypto';
import {readFile,mkdir,lstat,realpath,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join,resolve,isAbsolute,dirname,relative,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {developRecipePacket} from './sdk-recipe-development.mjs';
import {validateAssemblyPlan} from './assembly-line.mjs';

const HOME=resolve(fileURLToPath(new URL('..',import.meta.url)));
const ORACLE=fileURLToPath(new URL('../tools/approved_math_oracle.py',import.meta.url));
export const ORACLE_SCHEMA='audk.python-reference.v1';
export const ORACLE_IDS=Object.freeze(['math.tan','math.acos','math.asin','math.acosh','math.atanh','math.erf']);
const approved=new Set(ORACLE_IDS);
const sha=x=>createHash('sha256').update(x).digest('hex');
const json=x=>JSON.stringify(x,null,2)+'\n';
const FIXTURE_COUNTS={'math.tan':5,'math.acos':6,'math.asin':6,'math.acosh':5,'math.atanh':5,'math.erf':5};
const POSITIVE_COUNTS={'math.tan':4,'math.acos':4,'math.asin':4,'math.acosh':3,'math.atanh':3,'math.erf':4};
const UNIQUE=/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/i;

export function prepareReferenceCapture(catalog,assembly,{ids=['math.tan','math.acos','math.asin','math.acosh','math.atanh']}={}){
 validateAssemblyPlan(assembly);
 if(!Array.isArray(ids)||ids.length===0||ids.length>6||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!UNIQUE.test(id)||!approved.has(id)))
  throw Error('Only unique, approved pure-math reference fixtures are available');
 const packets=ids.map(id=>developRecipePacket(catalog,assembly,id));
 if(packets.some(p=>p.stage!=='implementation-needed'||p.policy?.executable!==false||p.review?.approvalStatus!=='not-approved'))
  throw Error('Oracle cannot evaluate approved/executable or special-review candidates');
 if(catalog.pythonVersion.split('.').slice(0,2).join('.')!=='3.13')throw Error('Python discovery catalog must be 3.13.x');
 return {schema:'audk.reference-plan.v1',ids:[...ids],cases:ids.reduce((n,id)=>n+FIXTURE_COUNTS[id],0),
  candidatePackets:packets.map(p=>({functionId:p.functionId,packetSha256:p.packetSha256,doc:p.provenance.documentation,verifiedDocumentation:false})),
  policy:{fixedFixturesOnly:true,unreviewedSourceExecution:false,recipeApproval:false,publication:false}};
}

function checkCase(id,c,index,seen){
 if(!c||typeof c!=='object'||Object.keys(c).sort().join(',')!=='caseId,inputs,outcome')throw Error('Oracle case schema mismatch');
 const expected=index<POSITIVE_COUNTS[id]?'reference-'+String(index+1).padStart(2,'0'):
  (id==='math.tan'||id==='math.erf'?'type-invalid-01':'domain-invalid-'+String(index-POSITIVE_COUNTS[id]+1).padStart(2,'0'));
 if(c.caseId!==expected||seen.has(c.caseId)||!c.inputs||Object.keys(c.inputs).join(',')!=='x')throw Error('Unexpected oracle fixture');
 seen.add(c.caseId);
 if(index<POSITIVE_COUNTS[id]){
  const v=c.outcome;
  if(typeof c.inputs.x!=='number'||!Number.isFinite(c.inputs.x)||v?.kind!=='value'||
     Object.keys(v).sort().join(',')!=='floatHex,kind,value'||typeof v.value!=='number'||!Number.isFinite(v.value)||
     typeof v.floatHex!=='string'||!/^[-]?(?:0x[0-9a-f]+\.[0-9a-f]+p[+-][0-9]+|0x0\.0p\+0)$/.test(v.floatHex))
   throw Error('Invalid finite Python reference value');
 }else{
  const v=c.outcome;
  if(v?.kind!=='error'||Object.keys(v).sort().join(',')!=='exception,kind'||
     v.exception!==(id==='math.tan'||id==='math.erf'?'TypeError':'ValueError'))throw Error('Invalid Python negative reference');
 }
 return c;
}

/** Python has no supplied arbitrary function/argument: its script has fixed literal fixtures. */
export async function capturePythonReferences(catalog,assembly,{ids,python='python',timeoutMs=10000}={}){
 const prepared=prepareReferenceCapture(catalog,assembly,{ids});
 if(typeof python!=='string'||(!['python','python3'].includes(python)&&!isAbsolute(python))||
  !Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>15000)throw Error('Invalid approved Python executor or time budget');
 const oracleSha256=sha(await readFile(ORACLE));
 const payload={schema:'audk.math-reference-request.v1',ids:prepared.ids};
 const result=spawnSync(python,['-I','-S',ORACLE],{
  input:JSON.stringify(payload)+'\n',encoding:'utf8',timeout:timeoutMs,maxBuffer:65536,windowsHide:true,
  cwd:HOME,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',PYTHONNOUSERSITE:'1'}
 });
 if(result.error||result.status!==0||typeof result.stdout!=='string'||Buffer.byteLength(result.stdout)>50000)
  throw Error('Pinned Python oracle execution failed or timed out');
 let response;
 try{response=JSON.parse(result.stdout)}catch{throw Error('Malformed Python oracle result')}
 if(response?.schema!=='audk.math-reference-oracle.v1'||response?.pythonImplementation!=='cpython'||
  !/^3\.13\.\d+$/.test(response.pythonVersion)||response.sourceCodeAccepted!==false||
  response.approvedRecipe!==false||response.automaticPublication!==false||
  response.codeExecution!=='fixed-approved-math-fixtures-only'||!Array.isArray(response.records)||response.records.length!==prepared.ids.length)
  throw Error('Python oracle provenance or policy rejected');
 const packets=[];
 for(let i=0;i<response.records.length;i++){
  const record=response.records[i],id=prepared.ids[i],draft=developRecipePacket(catalog,assembly,id);
  if(record?.functionId!==id||!Array.isArray(record.cases)||record.cases.length!==FIXTURE_COUNTS[id])throw Error('Oracle record mismatch');
  const seen=new Set();record.cases.forEach((c,n)=>checkCase(id,c,n,seen));
  for(let n=0;n<draft.proposedTestCases.length;n++){
   const expected=draft.proposedTestCases[n];const observed=record.cases[n];
   if(JSON.stringify(expected.inputs)!==JSON.stringify(observed.inputs))throw Error('Oracle input differs from pinned SDK development draft');
  }
  const base={schema:ORACLE_SCHEMA,functionId:id,recipeDraftSha256:draft.packetSha256,pythonVersion:response.pythonVersion,
   catalogPythonVersion:catalog.pythonVersion,oracleSourceSha256:oracleSha256,documentation:draft.provenance.documentation,
   referenceCases:record.cases,review:{referenceOutputsCaptured:true,documentationIndependentlyReviewed:false,
    inputBoundsApproved:false,crossLanguageParityVerified:false,humanApproved:false},
   policy:{trustedFixedFixturesOnly:true,executableRecipe:false,automaticPromotion:false,automaticPublication:false,signed:false}};
  packets.push({...base,sha256:sha(json(base))});
 }
 return {schema:'audk.reference-capture.v1',source:'sealed-cpython-3.13-math-fixtures',oracleSourceSha256:oracleSha256,
  pythonVersion:response.pythonVersion,catalogPythonVersion:catalog.pythonVersion,
  capturedCases:packets.reduce((n,p)=>n+p.referenceCases.length,0),packets,
  policy:{operatorReviewRequired:true,unknownCodeExecution:false,automaticPublication:false}};
}

async function makeOutput(output){
 if(typeof output!=='string'||!isAbsolute(output))throw Error('Reference output path must be absolute');
 const dest=resolve(output),source=await realpath(HOME),parent=dirname(dest);
 let current=parent;
 while(true){const f=await lstat(current);if(!f.isDirectory()||f.isSymbolicLink())throw Error('Reference output parent cannot be symlink or junction');
  const next=dirname(current);if(next===current)break;current=next}
 const full=join(await realpath(parent),basename(dest));
 const a=relative(source,full),b=relative(full,source);
 if(!a||!b||(!a.startsWith('..')&&!isAbsolute(a))||(!b.startsWith('..')&&!isAbsolute(b)))throw Error('Reference output must be separate from source');
 await mkdir(dest,{recursive:false,mode:0o700});return dest;
}
export async function writeReferenceCapture(result,{output}={}){
 if(result?.schema!=='audk.reference-capture.v1'||result.policy?.automaticPublication!==false||
   !Array.isArray(result.packets)||result.packets.length<1||result.packets.length>6||
   result.packets.some(p=>!approved.has(p.functionId)||p.policy?.executableRecipe!==false||
    p.policy.automaticPublication!==false||sha(json(Object.fromEntries(Object.entries(p).filter(([k])=>k!=='sha256'))))!==p.sha256))
  throw Error('Untrusted or tampered reference capture');
 const dir=await makeOutput(output),files=[];
 for(const packet of result.packets){
  const file=packet.functionId.replace('.','-')+'.reference.json',data=json(packet);
  await writeFile(join(dir,file),data,{flag:'wx',mode:0o600});
  files.push({functionId:packet.functionId,file,sha256:sha(data),caseCount:packet.referenceCases.length,approved:false});
 }
 const report={schema:'audk.reference-capture-report.v1',pythonVersion:result.pythonVersion,oracleSourceSha256:result.oracleSourceSha256,
  files,caseCount:result.capturedCases,reviewStatus:'pending',approvedRecipes:0,published:0};
 await writeFile(join(dir,'reference-report.json'),json(report),{flag:'wx',mode:0o600});
 await writeFile(join(dir,'REVIEW-CHECKLIST.md'),[
  '# AUDK Python reference evidence — NOT AN APPROVED RECIPE','','- [ ] Review official Python 3.13 math documentation and input domains',
  '- [ ] Confirm pinned test inputs, negative cases and numeric precision',
  '- [ ] Develop a bounded JavaScript implementation and separately verify parity',
  '- [ ] Review security and obtain human approval before promotion',
  '- [ ] Commit approved recipe through a reviewed PR; no automatic publication',''
 ].join('\n'),{flag:'wx',mode:0o600});
 return {output:dir,report};
}
