/** AUDK Factory v0.3 — deterministic manifest creation (no arbitrary source execution). */
import {executeMacro,validateMacro,generateJavaScript} from './engine.mjs';
import {runPipeline,validatePipeline,generatePipelineCode,PIPELINE_SCHEMA} from './pipeline.mjs';

const identifier=/^[a-z][a-z0-9-]{2,49}$/;
const safeName=/^[A-Za-z_][A-Za-z0-9_]{0,39}$/;
const blocked=new Set(['__proto__','constructor','prototype']);
const templates=['nested-loop','crossdock-slots','inventory-reorder'];
function integer(value,label,min,max){
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(`${label} must be an integer from ${min} to ${max}`);
  return n;
}
function label(value,label,max=80){
  if(typeof value!=='string'||value.trim().length===0||value.length>max)throw Error(`${label} must contain 1–${max} characters`);
  return value.trim();
}
function field(value){if(typeof value!=='string'||!safeName.test(value)||blocked.has(value))throw Error('Field names must be simple safe identifiers');return value;}
function range(start,end,step){
  if((end-start)*step<0)throw Error('Step direction must lead from start to end');
  return Math.ceil(Math.abs(end-start)/Math.abs(step));
}
export const FACTORY_TEMPLATES=Object.freeze([
 {id:'nested-loop',title:'Nested loop lab',summary:'Build a nested loop with step-by-step tracing and code export'},
 {id:'crossdock-slots',title:'Door / slot matrix',summary:'Expand doors across time slots, filter and label lanes'},
 {id:'inventory-reorder',title:'Inventory threshold',summary:'Transform quantities, filter low stock, calculate the total'}
]);
export function createApplet(spec){
  if(!spec||typeof spec!=='object'||Array.isArray(spec))throw Error('Applet configuration object required');
  if(!identifier.test(spec.id??''))throw Error('Applet ID must be lowercase kebab-case (3–50 characters)');
  const name=label(spec.name,'Applet name');
  const description=label(spec.description,'Description',300);
  if(!templates.includes(spec.template))throw Error('Unsupported Applet Factory template');
  const start=integer(spec.start??1,'Start',-1000,1000);
  const end=integer(spec.end??5,'End',-1000,1000);
  const step=integer(spec.step??1,'Step',-100,100);
  if(step===0)throw Error('Step cannot be zero');
  const size=range(start,end,step);
  if(size<1||size>250)throw Error('Factory range must produce 1–250 items');
  let kind,config;
  if(spec.template==='nested-loop'){
    const inner=integer(spec.innerCount??3,'Inner iterations',1,20);
    if(size*inner>1000)throw Error('Nested-loop factory limit: 1,000 operations');
    config={name,outer:{name:'i',start,end,step},inner:{name:'j',start:1,end:inner+1,step:1},operation:'product',branchBy:'sumParity'};
    kind='macro';
    validateMacro(config);
  }else if(spec.template==='crossdock-slots'){
    const slots=label(spec.slots??'08:00,09:00,10:00','Time slots',240).split(',').map(s=>s.trim());
    if(slots.length>20||slots.some(s=>!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s))||new Set(slots).size!==slots.length)throw Error('Use 1–20 unique 24-hour HH:MM time slots, comma separated');
    if(slots.length*size>5000)throw Error('Door/slot matrix exceeds 5,000 rows');
    const minimum=integer(spec.minimum??start,'Minimum door',-1000,1000);
    config={schema:PIPELINE_SCHEMA,name,input:{type:'range',field:'door',start,end,step},steps:[
      {id:'slot-grid',type:'crossJoin',field:'slot',values:slots},
      {id:'eligible-doors',type:'filter',field:'door',operator:'gte',value:minimum},
      {id:'lane-label',type:'switch',field:'door',outputField:'lane',mode:'parity'},
      {id:'sort-doors',type:'sort',field:'door',direction:'asc'}]};
    kind='pipeline';validatePipeline(config);
  }else{
    const multiplier=integer(spec.multiplier??2,'Multiplier',-100,100);
    const threshold=integer(spec.threshold??12,'Threshold',-100000,100000);
    config={schema:PIPELINE_SCHEMA,name,input:{type:'range',field:'quantity',start,end,step},steps:[
      {id:'scaled-stock',type:'map',field:'quantity',outputField:'stock',operation:'multiply',value:multiplier},
      {id:'low-stock',type:'filter',field:'stock',operator:'lt',value:threshold},
      {id:'stock-total',type:'aggregate',field:'stock',operation:'sum',outputField:'stockTotal'}]};
    kind='pipeline';validatePipeline(config);
  }
  const entry={id:spec.id,kind,version:'0.3.0',description,config};
  const preview=kind==='macro'?executeMacro(config):runPipeline(config);
  const code=kind==='macro'?generateJavaScript(config):generatePipelineCode(config);
  return {entry,preview,code};
}
