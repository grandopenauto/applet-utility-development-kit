import {createApplet,FACTORY_TEMPLATES} from './src/factory.mjs';
const $=id=>document.getElementById(id);
let generated=null;
const escapeFile=id=>id.replace(/[^a-z0-9-]/g,'');
function message(text,error=false){const el=$('factory-notice');el.textContent=text;el.classList.toggle('error',error);}
function values(){
 return {
  template:$('factory-template').value,id:$('factory-id').value.trim(),
  name:$('factory-name').value.trim(),description:$('factory-description').value.trim(),
  start:Number($('factory-start').value),end:Number($('factory-end').value),step:Number($('factory-step').value),
  innerCount:Number($('factory-inner').value),slots:$('factory-slots').value,
  minimum:Number($('factory-minimum').value),multiplier:Number($('factory-multiplier').value),threshold:Number($('factory-threshold').value)
 };
}
function renderPreview(){
 const root=$('factory-preview');root.replaceChildren();
 try{
  generated=createApplet(values());
  const {entry,preview,code}=generated;
  $('factory-output-json').textContent=JSON.stringify(entry,null,2);
  $('factory-output-code').textContent=code;
  $('factory-output-count').textContent=preview.rows.length.toLocaleString();
  $('factory-output-kind').textContent=entry.kind;
  const table=document.createElement('table');table.className='flow-result-table';
  const all=preview.rows.slice(0,10), keys=[...new Set(all.flatMap(row=>Object.keys(row)))];
  const header=document.createElement('thead');const tr=document.createElement('tr');
  for(const key of keys){const th=document.createElement('th');th.textContent=key;tr.append(th);}header.append(tr);table.append(header);
  const body=document.createElement('tbody');
  for(const row of all){const tr=document.createElement('tr');for(const key of keys){const td=document.createElement('td');td.textContent=String(row[key]??'');tr.append(td);}body.append(tr);}
  table.append(body);root.append(table);
  const badge=document.createElement('p');badge.className='muted';badge.textContent=`${preview.rows.length} output rows · ${entry.version} · validated without compilation`;root.append(badge);
  $('factory-download').disabled=false;
  $('factory-copy-code').disabled=false;
  $('factory-compose').disabled=entry.kind!=='pipeline';
  message('Applet generated and validated. Export the manifest for review before library publication.');
 }catch(err){
  generated=null;root.textContent=err.message;
  $('factory-output-json').textContent='';$('factory-output-code').textContent='';
  $('factory-output-count').textContent='—';$('factory-output-kind').textContent='—';
  $('factory-download').disabled=true;$('factory-copy-code').disabled=true;$('factory-compose').disabled=true;
  message(err.message,true);
 }
}
function templateVisible(){
 const selected=$('factory-template').value;
 $('factory-inner-wrap').hidden=selected!=='nested-loop';
 $('factory-slot-wrap').hidden=selected!=='crossdock-slots';
 $('factory-inventory-wrap').hidden=selected!=='inventory-reorder';
 $('factory-minimum-wrap').hidden=selected!=='crossdock-slots';
 renderPreview();
}
function download(text,filename,type){
 const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const select=$('factory-template');
for(const t of FACTORY_TEMPLATES){const option=document.createElement('option');option.value=t.id;option.textContent=t.title;select.append(option);}
select.value='crossdock-slots';select.addEventListener('change',templateVisible);
$('factory-form').addEventListener('input',renderPreview);
$('factory-form').addEventListener('submit',e=>{e.preventDefault();renderPreview();});
$('factory-download').addEventListener('click',()=>{if(generated)download(JSON.stringify(generated.entry,null,2)+'\n',escapeFile(generated.entry.id)+'.json','application/json');});
$('factory-copy-code').addEventListener('click',async()=>{if(!generated)return;try{await navigator.clipboard.writeText(generated.code);message('Generated JavaScript copied.')}catch{message('Select the code in the source preview to copy it manually.',true);}});
$('factory-compose').addEventListener('click',()=>{
 if(!generated||generated.entry.kind!=='pipeline')return;
 window.dispatchEvent(new CustomEvent('audk:load-pipeline',{detail:generated.entry.config}));
 document.querySelector('[data-tab="compose"]')?.click();
 message('Generated pipeline opened in the Applet Composer.');
});
for(const b of document.querySelectorAll('[data-factory-view]'))b.addEventListener('click',()=>{
 for(const button of document.querySelectorAll('[data-factory-view]'))button.classList.toggle('active',button===b);
 for(const pane of document.querySelectorAll('[data-factory-output]'))pane.hidden=pane.dataset.factoryOutput!==b.dataset.factoryView;
});
templateVisible();
