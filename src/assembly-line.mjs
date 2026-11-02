/** AUDK v1.2 — deterministic inventory and non-executable applet proposals.
 * The Python discovery catalog is UNTRUSTED metadata, not permission to invoke code.
 */
import {UNIVERSAL_RECIPES} from './universal-wizard.mjs';
import {buildExpansionQueue,validateExpansionQueue} from './expansion.mjs';

export const ASSEMBLY_SCHEMA='audk.assembly-plan.v1';
const RECIPE_IDS=new Set(UNIVERSAL_RECIPES.map(r=>r.id));
const SAFE_ID=/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/i;
const bounded=x=>String(x??'').slice(0,350).replace(/[\u0000-\u001f\u007f]/g,' ');
const registryFunctionIds=entries=>new Set(entries.filter(x=>['curated-function','universal-function'].includes(x.kind)&&x.config?.functionId).map(x=>x.config.functionId));

export function buildAssemblyPlan(discovery,entries){
 if(!Array.isArray(entries)||entries.length>5000)throw Error('Invalid published applet registry');
 const queue=buildExpansionQueue(discovery);validateExpansionQueue(queue);
 const published=registryFunctionIds(entries);
 const discovered=new Set(discovery.entries.map(x=>`${x.module}.${x.name}`));
 const ready=UNIVERSAL_RECIPES.filter(x=>!published.has(x.id));
 const pending=queue.candidates.map(c=>({
   id:c.id,stage:c.state==='review-candidate'?'implementation-needed':'special-review',
   risk:c.risk,priority:c.priority,description:c.summary,
   signature:c.signature,proposedFields:c.proposedFields,
   checks:c.proposedChecks,
   sourceDocumentation:`https://docs.python.org/3/library/${c.module==='builtins'?'functions':c.module}.html`,
   executable:false,verified:false,automaticallyPublishable:false,
 }));
 const readyItems=ready.map(r=>({
   id:r.id,stage:'packaging-ready',risk:'bounded-reviewed-recipe',priority:100,
   description:r.description,signature:'Pinned AUDK configuration schema',
   proposedFields:r.fields.map(x=>({name:x.name,suggestedType:x.type,required:true,reviewRequired:false})),
   checks:['Compare generated JavaScript and Python against verified reference','Validate all bounded parameter types','Review code and registry diff in pull request'],
   example:r.examples[0],executable:false,verified:true,automaticallyPublishable:false
 }));
 for(const id of published){if(!SAFE_ID.test(id)||!RECIPE_IDS.has(id))throw Error('Published function lacks reviewed recipe: '+id);}
 const entriesById=new Map([...readyItems,...pending].map(c=>[c.id,c]));
 const coverage={
   discovered:discovery.entries.length,
   reviewedWizardFunctions:UNIVERSAL_RECIPES.length,
   publishedPythonApplets:published.size,
   publishedTotal:entries.length,
   packagingReady:readyItems.length,
   implementationNeeded:pending.filter(x=>x.stage==='implementation-needed').length,
   specialReview:pending.filter(x=>x.stage==='special-review').length,
   missingFromRegistry:discovery.entries.length-published.size
 };
 // Include reviewed recipe metadata even when the specific Python snapshot omits it.
 return {
   schema:ASSEMBLY_SCHEMA,
   catalogPythonVersion:bounded(discovery.pythonVersion),
   coverage,
   policy:{discoveryOnly:true,execUntrusted:false,publicBuildApi:false,automaticPublication:false,publication:'human-reviewed pull request'},
   candidates:[...entriesById.values()],
   publishedFunctions:[...published].sort(),
   allDiscoveredRepresented:[...published].filter(id=>discovered.has(id)).length===published.size
 };
}
export function validateAssemblyPlan(plan){
 if(plan?.schema!==ASSEMBLY_SCHEMA||!plan.policy?.discoveryOnly||plan.policy.execUntrusted!==false||plan.policy.publicBuildApi!==false||plan.policy.automaticPublication!==false)throw Error('Unsafe assembly plan');
 if(!plan.coverage||!Array.isArray(plan.candidates)||plan.candidates.length>1200)throw Error('Invalid assembly plan');
 const ids=new Set();
 for(const c of plan.candidates){
  if(!SAFE_ID.test(c.id)||ids.has(c.id)||!['packaging-ready','implementation-needed','special-review'].includes(c.stage))throw Error('Invalid or duplicate candidate');
  if(c.executable!==false||c.automaticallyPublishable!==false||typeof c.description!=='string')throw Error('Unsafe candidate flags');
  if(c.stage==='packaging-ready'&&!RECIPE_IDS.has(c.id))throw Error('Unreviewed function marked ready');
  ids.add(c.id);
 }
 return true;
}
export function candidateSpecification(plan,id){
 validateAssemblyPlan(plan);
 if(typeof id!=='string'||!SAFE_ID.test(id))throw Error('Invalid function identifier');
 const found=plan.candidates.find(c=>c.id===id);
 if(!found)throw Error('Function is not in assembly queue');
 const name=id.replace('.','-')+'_applet';
 return {schema:'audk.applet-spec.v1',functionId:id,proposedAppletName:name,
   stage:found.stage,documentation:found.sourceDocumentation??'Review AUDK pinned recipe and tests',
   purpose:found.description,signature:found.signature,inputs:found.proposedFields,
   sample:found.example??null,outputContract:'Must be confirmed from the official SDK documentation and executable reference tests',
   requiredChecks:found.checks,
   instructions:'Propose an implementation in an isolated development environment; never run untrusted snippets from documentation as code.',
   reviewStatus:'pending',compileStatus:'not-compiled',runtimeEnabled:false,publishEnabled:false};
}
