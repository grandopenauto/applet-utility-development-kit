/** AUDK v0.6 browser-only schema-driven applet candidate wizard. */
import {UNIVERSAL_RECIPES,UNIVERSAL_SCHEMA,buildUniversalCandidate} from './src/universal-wizard.mjs';
const $=id=>document.getElementById(id);
const byId=Object.fromEntries(UNIVERSAL_RECIPES.map(x=>[x.id,x]));
const functionSelect=$('universal-function'),fields=$('universal-fields');
let last=null;
const message=(str,error=false)=>{const el=$('universal-status');el.textContent=str;el.classList.toggle('error',error);};
const el=(tag,cls,value)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(value!==undefined)node.textContent=value;return node;};
const setOutput=(name,value)=>{$('universal-'+name).textContent=value;};
function recipe(){return byId[functionSelect.value];}
function makeField(field,initial){
 const label=el('label',null,field.label),input=field.type==='numberArray'?el('textarea','flow-mini-textarea'):el('input');
 input.dataset.argument=field.name;input.dataset.argType=field.type;
 if(field.type==='boolean'){input.type='checkbox';input.checked=Boolean(initial);}else if(field.type==='numberArray'){input.value=JSON.stringify(initial);input.spellcheck=false;}
 else{input.type=field.type==='integer'||field.type==='number'?'number':'text';input.value=String(initial);if(field.type==='integer')input.step='1';if(field.type==='number')input.step='any';if(field.maxLength)input.maxLength=field.maxLength;}
 label.append(input);return label;
}
function selectRecipe(id){
 const selected=byId[id];if(!selected)return;
 functionSelect.value=id;$('universal-description').textContent=selected.description;
 const example=$('universal-example');example.replaceChildren();
 selected.examples.forEach((e,i)=>{const op=el('option',null,e.label);op.value=String(i);example.append(op);});
 selectExample(0);
}
function selectExample(index){
 const r=recipe();fields.replaceChildren();
 const sample=r.examples[index]||r.examples[0];
 r.fields.forEach(f=>fields.append(makeField(f,Object.hasOwn(sample.args,f.name)?sample.args[f.name]:f.default)));
 const slug=r.id.replace('.','-');$('universal-id').value=slug+'-applet';$('universal-name').value=r.title+' applet';$('universal-desc').value=r.description;
 last=null;$('universal-preview').textContent='Configure this function, then choose Validate & preview.';
 message(`Loaded ${r.id} · ${r.fields.length} parameter${r.fields.length===1?'':'s'} · example: ${sample.label}`);
}
function readArguments(){
 const obj={};for(const input of fields.querySelectorAll('[data-argument]')){
  let value;
  if(input.dataset.argType==='boolean')value=input.checked;
  else if(input.dataset.argType==='numberArray'){
   try{value=JSON.parse(input.value);}catch{throw Error(`${input.dataset.argument} must contain a valid JSON array`);}
  }else if(['number','integer'].includes(input.dataset.argType))value=input.value.trim()===''?NaN:Number(input.value);
  else value=input.value;
  obj[input.dataset.argument]=value;
 }
 return obj;
}
function generate(){
 try{
  const config={schema:UNIVERSAL_SCHEMA,id:$('universal-id').value,name:$('universal-name').value,description:$('universal-desc').value,functionId:functionSelect.value,arguments:readArguments()};
  last=buildUniversalCandidate(config);
  $('universal-send-review').disabled=false;
  setOutput('preview',JSON.stringify({function:last.manifest.functionId,result:last.result,status:last.manifest.status},null,2));
  setOutput('manifest',JSON.stringify(last.manifest,null,2));
  setOutput('javascript',last.javaScript);setOutput('python',last.python);setOutput('tests',last.testSource);
  message(`Validated ${last.manifest.functionId}. Preview ran locally. Exported code and manifest are REVIEW CANDIDATES, not published applets.`);
 }catch(error){last=null;$('universal-send-review').disabled=true;message(error.message,true);}
}
const downloads={manifest:['json','manifest'],javascript:['mjs','javaScript'],python:['py','python'],tests:['test.mjs','testSource']};
function download(kind){
 if(!last){message('Validate a candidate before exporting it.',true);return;}
 const [ext,key]=downloads[kind],text=kind==='manifest'?JSON.stringify(last.manifest,null,2):last[key];
 const blob=new Blob([text+'\n'],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=`${last.manifest.id}.${ext}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
for(const r of UNIVERSAL_RECIPES){const opt=el('option',null,`${r.id} · ${r.title}`);opt.value=r.id;functionSelect.append(opt);}
functionSelect.addEventListener('change',()=>selectRecipe(functionSelect.value));
$('universal-example').addEventListener('change',e=>selectExample(Number(e.target.value)));
$('universal-form').addEventListener('submit',e=>{e.preventDefault();generate();});
$('universal-send-review').addEventListener('click',()=>{
 if(!last){message('Validate the function first.',true);return;}
 const m=last.manifest;window.dispatchEvent(new CustomEvent('audk:universal-candidate',{detail:{config:{schema:m.schema,id:m.id,name:m.name,description:m.description,functionId:m.functionId,arguments:m.arguments}}}));
});
for(const key of Object.keys(downloads))$('universal-download-'+key).addEventListener('click',()=>download(key));
for(const button of document.querySelectorAll('[data-universal-view]'))button.addEventListener('click',()=>{
 const view=button.dataset.universalView;
 document.querySelectorAll('[data-universal-view]').forEach(b=>b.classList.toggle('active',b===button));
 document.querySelectorAll('[data-universal-output]').forEach(n=>n.hidden=n.dataset.universalOutput!==view);
});
window.addEventListener('audk:prefill-universal',e=>selectRecipe(e.detail?.functionId));
selectRecipe(UNIVERSAL_RECIPES[0].id);
