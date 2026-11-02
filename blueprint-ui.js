/** Schema-driven function wizard. All execution is local, declarative, bounded. */
import {FUNCTION_BLUEPRINTS,createFunctionBlueprint} from './src/blueprints.mjs';
const $=id=>document.getElementById(id);
const form=$('blueprint-form');
const kind=$('blueprint-type');
const inputs=$('blueprint-fields');
const notice=$('blueprint-notice');
const tabs=[...document.querySelectorAll('[data-blueprint-view]')];
let generated=null;
function el(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
function info(text,isError=false){notice.textContent=text;notice.classList.toggle('error',isError);}
for(const d of FUNCTION_BLUEPRINTS){const op=el('option',null,d.title);op.value=d.id;kind.append(op);}
function renderInputs(){
 const d=FUNCTION_BLUEPRINTS.find(x=>x.id===kind.value);
 $('blueprint-summary').textContent=d.summary;
 inputs.replaceChildren();
 for(const f of d.fields){
  const label=el('label',null,f.label);
  const input=el(f.type==='select'?'select':'input');input.dataset.blueprintField=f.name;
  if(f.type==='select')for(const choice of f.options){const op=el('option',null,choice.title);op.value=choice.value;input.append(op);}
  else input.type='text';
  input.value=f.default;label.append(input);inputs.append(label);
 }
 refresh();
}
function getConfig(){
 const options={};for(const input of inputs.querySelectorAll('[data-blueprint-field]'))options[input.dataset.blueprintField]=input.value;
 return {type:kind.value,id:$('blueprint-id').value.trim(),name:$('blueprint-name').value.trim(),description:$('blueprint-description').value.trim(),inputType:$('blueprint-input').value,inputValues:$('blueprint-values').value,start:$('blueprint-start').value,end:$('blueprint-end').value,step:$('blueprint-step').value,options};
}
function tableRows(rows){const table=el('table','flow-result-table');const head=el('tr');const keys=[...new Set(rows.flatMap(x=>Object.keys(x)))];keys.forEach(k=>head.append(el('th',null,k)));table.append(head);for(const row of rows.slice(0,12)){const tr=el('tr');keys.forEach(k=>tr.append(el('td',null,JSON.stringify(row[k]??''))));table.append(tr);}return table;}
function refresh(){
 try{
  generated=createFunctionBlueprint(getConfig());
  $('blueprint-count').textContent=String(generated.preview.rows.length);
  $('blueprint-source').textContent=generated.code;
  $('blueprint-json').textContent=JSON.stringify(generated.manifest,null,2);
  $('blueprint-tests').textContent=generated.testSource;
  $('blueprint-preview').replaceChildren(tableRows(generated.preview.rows));
  $('blueprint-export').disabled=false;
  $('blueprint-compose').disabled=false;
  info(`Ready · ${generated.definition.title} · ${generated.preview.rows.length} result rows · generated test available`);
 }catch(e){generated=null;$('blueprint-count').textContent='—';for(const id of ['blueprint-source','blueprint-json','blueprint-tests'])$(id).textContent='';$('blueprint-preview').replaceChildren();$('blueprint-export').disabled=true;$('blueprint-compose').disabled=true;info(e.message,true);}
}
function download(source,filename,type){const url=URL.createObjectURL(new Blob([source],{type}));const a=el('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
kind.addEventListener('change',renderInputs);
$('blueprint-input').addEventListener('change',()=>{$('blueprint-range').hidden=$('blueprint-input').value!=='range';$('blueprint-list').hidden=$('blueprint-input').value!=='list';refresh();});
form.addEventListener('input',refresh);
form.addEventListener('submit',e=>{e.preventDefault();refresh();});
$('blueprint-export').addEventListener('click',()=>{if(!generated)return;const id=generated.manifest.id;download(JSON.stringify(generated.manifest,null,2)+'\n',id+'.json','application/json');});
$('blueprint-export-code').addEventListener('click',()=>{if(generated)download(generated.code,generated.manifest.id+'.mjs','text/javascript');});
$('blueprint-export-tests').addEventListener('click',()=>{if(generated)download(generated.testSource,generated.manifest.id+'.test.mjs','text/javascript');});
$('blueprint-compose').addEventListener('click',()=>{if(!generated)return;window.dispatchEvent(new CustomEvent('audk:load-pipeline',{detail:generated.manifest.config}));document.querySelector('[data-tab="compose"]')?.click();});
for(const b of tabs)b.addEventListener('click',()=>{tabs.forEach(x=>x.classList.toggle('active',x===b));for(const p of document.querySelectorAll('[data-blueprint-output]'))p.hidden=p.dataset.blueprintOutput!==b.dataset.blueprintView;});
kind.value='map';renderInputs();
