/** AUDK v2.1: deterministic, non-executable SDK-to-recipe development packets.
 * Discovery metadata is untrusted. No imports, eval, SDK calls, or automatic approval.
 */
import {createHash} from 'node:crypto';
import {mkdir,writeFile,lstat,realpath} from 'node:fs/promises';
import {join,resolve,relative,dirname,isAbsolute,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateAssemblyPlan} from './assembly-line.mjs';

const HOME=resolve(fileURLToPath(new URL('..',import.meta.url)));
const ID=/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/i;
const PARAM=/^[a-z_][a-z0-9_]*$/i;
const MODULES=new Set(['builtins','math','statistics','itertools','functools','operator','json']);
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=o=>JSON.stringify(o,null,2)+'\n';
const INSPECT='needs-independent-reference';
const special=new Set(['builtins.eval','builtins.exec','builtins.compile','builtins.open','builtins.__import__']);

/** Split metadata signatures without evaluating nested defaults or annotations. */
export function parseSignature(source){
 if(typeof source!=='string'||source.length>240||!source.startsWith('(')||!source.endsWith(')')||source.includes('signature unavailable'))
  return {status:'unparsed',parameters:[],warnings:['Uninspectable or overlong metadata signature; manual inspection required']};
 const parts=[];let token='',depth=0,quote='',escaped=false;
 for(const c of source.slice(1,-1)){
  if(quote){token+=c;if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote='';continue}
  if(c==='\''||c==='"'){quote=c;token+=c;continue}
  if('([{'.includes(c)){depth++;if(depth>8)return {status:'unparsed',parameters:[],warnings:['Metadata nesting too deep']}}
  if(')]}'.includes(c)){depth--;if(depth<0)return {status:'unparsed',parameters:[],warnings:['Malformed signature nesting']}}
  if(c===','&&depth===0){parts.push(token.trim());token='';continue}token+=c;
 }
 if(depth!==0||quote)return {status:'unparsed',parameters:[],warnings:['Incomplete signature metadata']};
 if(token.trim())parts.push(token.trim());
 if(parts.length>24)return {status:'unparsed',parameters:[],warnings:['Too many parameters for automatic drafting']};
 const slash=parts.indexOf('/'),star=parts.indexOf('*'),parameters=[],warnings=[];
 for(let i=0;i<parts.length;i++){
  let p=parts[i];if(!p||p==='/'||p==='*')continue;
  const kind=p.startsWith('**')?'variadic-keyword':p.startsWith('*')?'variadic-positional':star>=0&&i>star?'keyword-only':slash>=0&&i<slash?'positional-only':'positional-or-keyword';
  if(p.startsWith('**'))p=p.slice(2);else if(p.startsWith('*'))p=p.slice(1);
  const m=/^([a-z_][a-z0-9_]*)\s*(?::[^=]+)?(?:=(.*))?$/i.exec(p);
  if(!m||!PARAM.test(m[1])){warnings.push('A parameter could not be parsed; manual signature review required');continue}
  if(parameters.some(x=>x.name===m[1])){warnings.push('Repeated parameter name; manual review required');continue}
  parameters.push({name:m[1],kind,required:m[2]===undefined&&kind!=='variadic-positional'&&kind!=='variadic-keyword',
   defaultText:m[2]===undefined?null:m[2].trim().slice(0,120),inferredType:'unknown',bounds:null,verified:false});
 }
 return {status:warnings.length?'partial':'heuristic',parameters,warnings};
}

const SAMPLE_SEEDS={
 'math.tan':[{x:0},{x:0.5},{x:-0.5}],
 'math.acos':[{x:-1},{x:0},{x:1}],
 'math.asin':[{x:-1},{x:0},{x:1}],
 'math.acosh':[{x:1},{x:2}],
 'math.atanh':[{x:-0.5},{x:0},{x:0.5}],
 'math.erf':[{x:-1},{x:0},{x:1}]
};
function templates(id,signature,stage){
 if(stage==='special-review')return [];
 const hasX=signature.parameters.some(p=>p.name==='x');
 const samples=SAMPLE_SEEDS[id]??(id.startsWith('math.')&&hasX?[{x:0},{x:1}]:[]);
 return samples.map((inputs,i)=>({caseId:'reference-'+String(i+1).padStart(2,'0'),inputs,
  expectedOutput:null,expectedError:null,referenceStatus:INSPECT,verified:false,executable:false}));
}
export function developRecipePacket(catalog,plan,id){
 validateAssemblyPlan(plan);
 if(catalog?.schema!=='audk.discovery.v1'||!Array.isArray(catalog.entries)||catalog.entries.length>1200||typeof catalog.pythonVersion!=='string'||!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(catalog.pythonVersion))throw Error('Invalid pinned SDK discovery catalog');
 if(typeof id!=='string'||!ID.test(id))throw Error('Invalid function ID');
 const matches=catalog.entries.filter(e=>`${e.module}.${e.name}`===id);
 if(matches.length!==1)throw Error('SDK function must occur exactly once in discovery catalog');
 const entry=matches[0],candidate=plan.candidates.find(x=>x.id===id);
 if(!candidate||!['implementation-needed','special-review'].includes(candidate.stage))throw Error('Function is not eligible for new recipe development');
 if(!MODULES.has(entry.module)||!PARAM.test(entry.name)||candidate.signature!==entry.signature||candidate.description!==entry.summary.slice(0,240))throw Error('Pinned discovery and assembly plan disagree');
 const parsed=parseSignature(entry.signature);
 const risk=candidate.stage==='special-review'?'special-review':candidate.risk;
 const version=catalog.pythonVersion.split('.').slice(0,2).join('.');
 const docPath=entry.module==='builtins'?'functions':entry.module;
 const documentation=`https://docs.python.org/${version}/library/${docPath}.html#${entry.module==='builtins'?'':entry.module+'.'}${entry.name}`;
 const provenance={catalog:'catalog/python-standard-library.json',assembly:'catalog/assembly-plan.json',pythonVersion:catalog.pythonVersion,
  snapshotSha256:sha(json({pythonVersion:catalog.pythonVersion,module:entry.module,name:entry.name,signature:entry.signature,summary:entry.summary})),
  documentation,documentationVerified:false};
 const output={schema:'audk.recipe-development.v1',functionId:id,proposedAppletName:id.replace('.','-')+'_applet',stage:candidate.stage,
  provenance,description:entry.summary.slice(0,240),signature:entry.signature,
  arguments:parsed,outputContract:{type:'unknown',exceptions:[],precision:null,verified:false},
  proposedTestCases:templates(id,parsed,candidate.stage),
  review:{risk,requiresHumanApproval:true,documentationReviewRequired:true,
   typeAndBoundReviewRequired:true,semanticAndEdgeCaseReviewRequired:true,
   securityReviewRequired:true,referenceExecutionRequired:true,
   blockers:[...(special.has(id)?['Powerful operation requires explicit security design']:[]),...parsed.warnings,
    'Capture authoritative expected values and error cases before implementation',
    'Approve bounded JS/Python semantics and independent reference tests'],approvalStatus:'not-approved'},
  policy:{executable:false,verified:false,compileStatus:'not-compiled',runtimeEnabled:false,
   automaticPromotion:false,automaticPullRequests:false,automaticPublication:false}};
 return {...output,packetSha256:sha(json(output))};
}
export function planRecipeDevelopment(catalog,plan,{ids=[],module=null,limit=10,includeSpecial=false}={}){
 validateAssemblyPlan(plan);
 if(!Number.isInteger(limit)||limit<1||limit>25)throw Error('SDK recipe development limit is 1..25');
 if(module!==null&&!MODULES.has(module))throw Error('Unrecognized SDK module');
 if(!Array.isArray(ids)||ids.length>25||ids.some(x=>typeof x!=='string'||!ID.test(x))||new Set(ids).size!==ids.length)throw Error('Invalid or duplicate selection');
 let candidates=plan.candidates.filter(c=>['implementation-needed','special-review'].includes(c.stage));
 if(module)candidates=candidates.filter(c=>c.id.startsWith(module+'.'));
 if(!includeSpecial)candidates=candidates.filter(c=>c.stage!=='special-review');
 const chosen=ids.length?ids.map(id=>{const c=candidates.find(x=>x.id===id);if(!c)throw Error('Function not in allowed development selection: '+id);return c}):candidates.slice(0,limit);
 if(chosen.length>limit)throw Error('Selected functions exceed limit');
 const packets=chosen.map(x=>developRecipePacket(catalog,plan,x.id));
 return {schema:'audk.recipe-development-plan.v1',sourceVersion:catalog.pythonVersion,selected:packets.map(x=>x.functionId),
  proposalCount:packets.length,specialReviewCount:packets.filter(x=>x.stage==='special-review').length,packets,
  policy:{specificationsOnly:true,execution:false,approval:false,publication:false}};
}
async function freshOutput(output){
 if(typeof output!=='string'||!isAbsolute(output))throw Error('Output must be an absolute directory');
 const dest=resolve(output),source=await realpath(HOME);
 let current=dirname(dest);
 while(true){const entry=await lstat(current);if(entry.isSymbolicLink()||!entry.isDirectory())throw Error('Output parent must be a real directory');const p=dirname(current);if(p===current)break;current=p}
 const p=await realpath(dirname(dest));const resolved=join(p,basename(dest));
 const a=relative(source,resolved),b=relative(resolved,source);
 if(!a||!b||(!a.startsWith('..')&&!isAbsolute(a))||(!b.startsWith('..')&&!isAbsolute(b)))throw Error('Output must be separate from source');
 await mkdir(dest,{recursive:false,mode:0o700});return dest;
}
export async function writeRecipeDevelopment(planResult,{output}={}){
 if(planResult?.schema!=='audk.recipe-development-plan.v1'||!planResult.policy?.specificationsOnly||planResult.policy.execution!==false||planResult.packets.length!==planResult.proposalCount)throw Error('Invalid development plan');
 if(planResult.packets.length>25||planResult.packets.some(packet=>
  !ID.test(packet.functionId)||packet.proposedAppletName!==packet.functionId.replace('.','-')+'_applet'||
  packet.policy?.executable!==false||packet.policy.automaticPublication!==false||
  sha(json(Object.fromEntries(Object.entries(packet).filter(([k])=>k!=='packetSha256'))))!==packet.packetSha256))
  throw Error('Unsafe or altered development packet');
 const dir=await freshOutput(output),packets=[];
 for(const packet of planResult.packets){
  const filename=packet.proposedAppletName+'.recipe-draft.json';
  const data=json(packet);
  await writeFile(join(dir,filename),data,{flag:'wx',mode:0o600});packets.push({functionId:packet.functionId,file:filename,sha256:sha(data),stage:packet.stage,approved:false});
 }
 const report={schema:'audk.recipe-development-report.v1',pythonVersion:planResult.sourceVersion,packets,approved:0,executed:0,published:0,requiresHumanReview:true};
 await writeFile(join(dir,'development-report.json'),json(report),{flag:'wx',mode:0o600});
 const checklist=['# AUDK SDK-to-recipe review — DRAFT ONLY','','All parameter types, bounds, reference examples, expected values and error behavior must be independently verified.','',
  '- [ ] Review official Python documentation and pin the exact runtime version','- [ ] Confirm positional-only, keyword-only, variadic and default parameter behavior',
  '- [ ] Set finite input limits and negative-test cases; block side effects','- [ ] Capture expected results from a trusted Python reference runner',
  '- [ ] Review JS equivalence and precision boundaries','- [ ] Obtain human code/security approval before writing executable recipes',
  '- [ ] Run AUDK reviewed batch suite only after separate implementation promotion','- [ ] Open a human-reviewed PR; no automatic publication',''];
 await writeFile(join(dir,'REVIEW-CHECKLIST.md'),checklist.join('\n'),{flag:'wx',mode:0o600});
 return {output:dir,report};
}
