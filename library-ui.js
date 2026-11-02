/** Browser-only catalog; loading or previewing cannot publish or execute arbitrary code. */
import {CATEGORIES,filterCatalog,catalogRecord,previewCatalogApplet} from './src/catalog-browser.mjs';
import {UNIVERSAL_RECIPES} from './src/universal-wizard.mjs';
const $=id=>document.getElementById(id);
const list=$('catalog-results'),detail=$('catalog-detail'),search=$('catalog-search'),cat=$('catalog-category'),kind=$('catalog-kind'),count=$('catalog-count');
const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e;};
let records=[],selectedId='',examplesIndex=0;
const entries=new Map();
const loadFile=async path=>{const r=await fetch('./library/'+path,{cache:'no-store'});if(!r.ok)throw Error('Cannot load '+path);return r.json();};
const download=(name,text)=>{const blob=new Blob([text+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function setStatus(message){$('catalog-status').textContent=message;}
function launch(entry){
 if(entry.kind==='curated-function'||entry.kind==='universal-function'){window.dispatchEvent(new CustomEvent('audk:load-universal',{detail:entry.config}));location.hash='#universal';}
 else if(entry.kind==='pipeline'){window.dispatchEvent(new CustomEvent('audk:load-pipeline',{detail:entry.config}));location.hash='#compose';}
 else{window.dispatchEvent(new CustomEvent('audk:load-macro',{detail:entry.config}));location.hash='#configure';}
}
function detailView(){
 detail.replaceChildren();
 const entry=entries.get(selectedId);
 if(!entry){detail.append(make('p','Select an applet to inspect its inputs, example, and provenance.','muted'));return;}
 const meta=catalogRecord(entry);
 detail.append(make('h3',meta.title),make('p',meta.description,'muted'));
 const tags=make('div',undefined,'catalog-tags');for(const txt of [meta.category,meta.kind,meta.status,'v'+meta.version])tags.append(make('span',txt,'catalog-tag'));detail.append(tags);
 const info=make('div',undefined,'catalog-meta');
 for(const [k,v] of [['Applet ID',meta.id],['Function',meta.functionId||'Declarative macro'],['Parameters',meta.parameterCount??'Defined in configuration']]){
  const line=make('p');line.append(make('strong',k+': '),document.createTextNode(String(v)));info.append(line);
 }detail.append(info);
 let picker;
 const controls=make('div',undefined,'flow-toolbar-actions');
 const open=make('button','Configure this applet','btn primary');open.type='button';open.addEventListener('click',()=>launch(entry));controls.append(open);
 const exportButton=make('button','↓ Export manifest','btn secondary');exportButton.type='button';exportButton.addEventListener('click',()=>download(meta.id+'.json',JSON.stringify(entry,null,2)));controls.append(exportButton);detail.append(controls);
 const exampleBox=make('div',undefined,'catalog-example');detail.append(exampleBox);
 if(meta.exampleCount>1){
  const wrap=make('label','Example ','catalog-example-select');picker=document.createElement('select');
  for(let i=0;i<meta.exampleCount;i++){const label=UNIVERSAL_RECIPES.find(r=>r.id===meta.functionId)?.examples[i]?.label||'Example '+(i+1);const o=make('option',label);o.value=String(i);picker.append(o);}wrap.append(picker);detail.insertBefore(wrap,exampleBox);
  picker.addEventListener('change',()=>{examplesIndex=Number(picker.value);renderExample();});
 }
 function renderExample(){
  exampleBox.replaceChildren(make('h4','Sample execution'));
  try{const sample=previewCatalogApplet(entry,examplesIndex);exampleBox.append(make('p',sample.label,'muted'),make('pre',JSON.stringify(sample,null,2),'codebox'));}
  catch(e){exampleBox.append(make('p',e.message,'muted'));}
 }
 renderExample();
}
function render(){
 const filtered=filterCatalog([...entries.values()],{search:search.value,category:cat.value,kind:kind.value});
 if(!filtered.some(r=>r.id===selectedId)){selectedId=filtered[0]?.id||'';examplesIndex=0;}
 count.textContent=`${filtered.length} of ${entries.size} validated applets`;
 list.replaceChildren();
 if(!filtered.length)list.append(make('p','No applets match the current filters.','muted'));
 for(const r of filtered){
  const btn=make('button',undefined,'catalog-card');btn.type='button';btn.setAttribute('aria-pressed',String(r.id===selectedId));
  if(r.id===selectedId)btn.classList.add('selected');btn.append(make('strong',r.title),make('small',r.category+' · '+r.kind),make('span',r.description,'muted'));
  btn.addEventListener('click',()=>{selectedId=r.id;examplesIndex=0;render();detailView();});list.append(btn);
 }
 detailView();
}
for(const value of CATEGORIES){const opt=make('option',value);opt.value=value;cat.append(opt);}
for(const control of [search,cat,kind])control.addEventListener(control===search?'input':'change',render);
async function initialize(){try{
 const response=await fetch('./library/index.json',{cache:'no-store'});if(!response.ok)throw Error('Library index unavailable');
 const index=await response.json();if(index.schema!=='audk.library-index.v1'||!Array.isArray(index.files)||index.files.length>100||!index.files.every(f=>/^[a-z0-9-]+\.json$/.test(f)))throw Error('Invalid library index');
 const loaded=await Promise.all(index.files.map(loadFile));for(const entry of loaded){if(entries.has(entry.id))throw Error('Duplicate applet');entries.set(entry.id,entry);}
 setStatus('Read-only registry · Only reviewed declarative applets are loaded · No remote code execution');render();
 }catch(e){setStatus('Library unavailable: '+e.message);}}
initialize();
