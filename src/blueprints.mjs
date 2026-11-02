/** AUDK v0.4: declarative Function Blueprint wizard and review-gated applet packaging. */
import {PIPELINE_SCHEMA,validatePipeline,runPipeline,generatePipelineCode} from './pipeline.mjs';
import {generatePipelinePython} from './python-export.mjs';

const option=(value,title)=>({value,title});
export const FUNCTION_BLUEPRINTS=Object.freeze([
 {id:'map',title:'Transform a value',summary:'Add, multiply or prefix a value in every row',fields:[
  {name:'operation',label:'Operation',type:'select',options:[option('multiply','Multiply'),option('add','Add'),option('prefix','Prefix text')],default:'multiply'},
  {name:'operand',label:'Number or prefix',type:'text',default:'2'},
  {name:'outputField',label:'Output field',type:'text',default:'result'}]},
 {id:'filter',title:'Filter rows',summary:'Keep only records meeting a condition',fields:[
  {name:'operator',label:'Comparison',type:'select',options:[option('gte','At least'),option('lt','Below'),option('eq','Exactly equal'),option('gt','Greater than'),option('lte','At most'),option('ne','Not equal')],default:'gte'},
  {name:'operand',label:'Compare with',type:'text',default:'3'}]},
 {id:'crossJoin',title:'Expand combinations',summary:'Produce combinations of values without writing a loop',fields:[
  {name:'outputField',label:'New field',type:'text',default:'slot'},
  {name:'values',label:'Values as JSON list',type:'json',default:'["08:00","09:00"]'}]},
 {id:'switch',title:'Switch / branch',summary:'Label numeric values as even or odd',fields:[
  {name:'outputField',label:'Branch field',type:'text',default:'branch'}]},
 {id:'sort',title:'Sort records',summary:'Sort your input in ascending or descending order',fields:[
  {name:'direction',label:'Direction',type:'select',options:[option('asc','Ascending'),option('desc','Descending')],default:'desc'}]},
 {id:'aggregate',title:'Aggregate results',summary:'Count records or sum numeric values',fields:[
  {name:'operation',label:'Operation',type:'select',options:[option('sum','Sum values'),option('count','Count rows')],default:'sum'},
  {name:'outputField',label:'Result field',type:'text',default:'total'}]}
]);
const validIdentifier=value=>typeof value==='string'&&/^[a-z][a-z0-9-]{2,49}$/.test(value);
function userText(value,label,max=80){if(typeof value!=='string'||!value.trim()||value.length>max)throw Error(`${label} must be 1–${max} characters`);return value.trim();}
function scalar(value){
 if(typeof value==='string' && value.trim()!==''){
  if(value==='true')return true;if(value==='false')return false;
  if(/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)){const n=Number(value);if(Number.isFinite(n))return n;}
 }
 return value;
}
function asList(value,label){
 let parsed;
 try{parsed=typeof value==='string'?JSON.parse(value):value;}catch{throw Error(`${label} needs a valid JSON array`)}
 if(!Array.isArray(parsed)||!parsed.length||parsed.length>80)throw Error(`${label} needs 1–80 values`);
 return parsed;
}
function inputFromSpec(spec){
 if(spec.inputType==='range'){
  const start=Number(spec.start),end=Number(spec.end),step=Number(spec.step);
  return {type:'range',field:'value',start,end,step};
 }
 if(spec.inputType==='list')return {type:'list',field:'value',values:asList(spec.inputValues,'Input')};
 throw Error('Choose a list or a number range input');
}
export function createFunctionBlueprint(spec){
 if(!spec||typeof spec!=='object'||Array.isArray(spec))throw Error('Function specification required');
 if(!validIdentifier(spec.id))throw Error('Applet ID must be lowercase kebab-case (3–50 characters)');
 const name=userText(spec.name,'Applet name');
 const description=userText(spec.description,'Description',300);
 const definition=FUNCTION_BLUEPRINTS.find(x=>x.id===spec.type);
 if(!definition)throw Error('Unsupported function blueprint');
 const options=spec.options??{};
 const params=Object.fromEntries(definition.fields.map(f=>[f.name,options[f.name]??f.default]));
 const st={id:'generated-function',type:definition.id};
 switch(definition.id){
  case 'map':
   if(!['multiply','add','prefix'].includes(params.operation))throw Error('Unsupported transform operation');
   Object.assign(st,{field:'value',outputField:params.outputField,operation:params.operation,value:params.operation==='prefix'?String(params.operand):Number(params.operand)});
   break;
  case 'filter': Object.assign(st,{field:'value',operator:params.operator,value:scalar(params.operand)});break;
  case 'crossJoin': Object.assign(st,{field:params.outputField,values:asList(params.values,'Combination values')});break;
  case 'switch':Object.assign(st,{field:'value',outputField:params.outputField,mode:'parity'});break;
  case 'sort':Object.assign(st,{field:'value',direction:params.direction});break;
  case 'aggregate':Object.assign(st,{operation:params.operation,field:'value',outputField:params.outputField});break;
 }
 const pipeline={schema:PIPELINE_SCHEMA,name,input:inputFromSpec(spec),steps:[st]};
 validatePipeline(pipeline);
 const manifest={id:spec.id,kind:'pipeline',version:'0.5.0',description,config:pipeline};

 const preview=runPipeline(pipeline);
 const code=generatePipelineCode(pipeline);
 const pythonCode=generatePipelinePython(pipeline);
 const first=preview.rows.slice(0,5);
 const testSource=`import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {runApplet} from './${manifest.id}.mjs';\n\ntest(${JSON.stringify(manifest.id+' generated function')}, () => {\n  const rows = runApplet();\n  assert.equal(rows.length, ${preview.rows.length});\n  assert.deepEqual(rows.slice(0, 5), ${JSON.stringify(first,null,2)});\n});\n`;
 return {manifest,preview,code,pythonCode,testSource,definition};
}
