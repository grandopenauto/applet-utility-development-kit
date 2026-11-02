/** AUDK v0.9: deterministic, read-only metadata for the published registry. */
import {UNIVERSAL_RECIPES,executeUniversal} from './universal-wizard.mjs';
import {executeMacro} from './engine.mjs';
import {runPipeline} from './pipeline.mjs';
const recipes=new Map(UNIVERSAL_RECIPES.map(r=>[r.id,r]));
export const CATEGORIES=Object.freeze(['All','Mathematics','Statistics','Collections','Text','Workflow','Diagnostics']);
export function classifyApplet(entry){
 if(entry?.kind==='curated-function'||entry?.kind==='universal-function')return recipes.get(entry.config?.functionId)?.category||'Workflow';
 if(entry?.kind==='pipeline')return 'Workflow';
 return 'Diagnostics';
}
export function catalogRecord(entry){
 if(!entry||typeof entry.id!=='string'||typeof entry.kind!=='string')throw Error('Invalid catalog record');
 const functionId=entry.config?.functionId||null;
 const recipe=recipes.get(functionId);
 return {id:entry.id,title:entry.name||entry.config?.name||entry.id,
   description:entry.description||'',kind:entry.kind,category:classifyApplet(entry),
   version:entry.version||'',functionId,
   status:entry.kind==='curated-function'?'First-party, CI verified':entry.kind==='universal-function'?'Reviewed proposal':'Validated example',
   parameterCount:recipe?.fields.length??null,exampleCount:recipe?.examples.length??1};
}
export function filterCatalog(entries,{search='',category='All',kind='All'}={}){
 if(!Array.isArray(entries))throw Error('Catalog must be an array');
 if(!CATEGORIES.includes(category))throw Error('Unknown category');
 if(!['All','curated-function','universal-function','macro','pipeline'].includes(kind))throw Error('Unknown kind');
 const query=String(search).trim().toLocaleLowerCase().slice(0,100);
 return entries.map(catalogRecord).filter(x=>
  (category==='All'||x.category===category)&&(kind==='All'||x.kind===kind)&&
  (!query||[x.id,x.title,x.description,x.kind,x.category,x.functionId||''].some(s=>s.toLocaleLowerCase().includes(query)))
 ).sort((a,b)=>a.title.localeCompare(b.title)||a.id.localeCompare(b.id));
}
export function previewCatalogApplet(entry,exampleIndex=0){
 if(!Number.isInteger(exampleIndex)||exampleIndex<0||exampleIndex>12)throw Error('Invalid example number');
 if(entry.kind==='curated-function'||entry.kind==='universal-function'){
  const recipe=recipes.get(entry.config?.functionId);
  if(!recipe)throw Error('No reviewed recipe');
  const e=recipe.examples[exampleIndex];if(!e)throw Error('No such example');
  const config={...entry.config,arguments:e.args};
  return {label:e.label,arguments:e.args,result:executeUniversal(config)};
 }
 if(exampleIndex!==0)throw Error('Only one example is available');
 if(entry.kind==='pipeline'){
  const result=runPipeline(entry.config);
  return {label:'Bundled scenario',result:{rows:result.rows?.slice(0,5),totalRows:result.rows?.length}};
 }
 if(entry.kind==='macro'){
  const result=executeMacro(entry.config);
  return {label:'Bundled macro',result:{rows:result.rows?.slice(0,5),totalRows:result.rows?.length}};
 }
 throw Error('Unsupported applet kind');
}
