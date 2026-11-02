/** AUDK v0.5 read-only Python catalog browsing; entries are NOT executable applets. */
import {UNIVERSAL_RECIPES} from './src/universal-wizard.mjs';
const reviewed=new Set(UNIVERSAL_RECIPES.map(r=>r.id));
const search=document.getElementById('python-search');
const moduleSelect=document.getElementById('python-module');
const results=document.getElementById('python-results');
const status=document.getElementById('python-discovery-status');
const count=document.getElementById('python-discovery-count');
let catalog=null;
const element=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
function render(){
 if(!catalog)return;
 const phrase=search.value.trim().toLowerCase(),moduleName=moduleSelect.value;
 const filtered=catalog.entries.filter(entry=>(!moduleName||entry.module===moduleName)&&(!phrase||[entry.module+'.'+entry.name,entry.signature,entry.summary].some(x=>x.toLowerCase().includes(phrase))));
 count.textContent=`${filtered.length} / ${catalog.entries.length} discovered callables`;
 results.replaceChildren();
 for(const entry of filtered.slice(0,90)){
  const item=element('article','python-entry');
  item.append(element('strong',null,entry.module+'.'+entry.name));
  item.append(element('code',null,entry.signature));
  item.append(element('p','muted',entry.summary));
  if(reviewed.has(entry.qualifiedName)){const button=element('button','btn secondary','Configure in Universal Wizard');button.type='button';button.addEventListener('click',()=>{location.hash='#universal';window.dispatchEvent(new CustomEvent('audk:prefill-universal',{detail:{functionId:entry.qualifiedName}}));});item.append(button);}
  results.append(item);
 }
 if(filtered.length>90)results.append(element('p','muted',`Showing first 90 of ${filtered.length}. Refine the search to narrow results.`));
 if(filtered.length===0)results.append(element('p','muted','No matching Python callables.'));
}
async function init(){
 try{
  const response=await fetch('./catalog/python-standard-library.json',{cache:'no-store'});
  if(!response.ok)throw Error(`Catalog HTTP ${response.status}`);
  const data=await response.json();
  if(data.schema!=='audk.discovery.v1'||!Array.isArray(data.entries)||data.entries.length>1200)throw Error('Invalid catalog format');
  catalog=data;
  for(const name of data.modules){const opt=element('option',null,name);opt.value=name;moduleSelect.append(opt);}
  status.textContent=`Python ${data.pythonVersion} discovery snapshot · ${data.modules.length} allowlisted modules · signatures and documentation only`;
  render();
 }catch(err){status.textContent=`Unable to read Python discovery catalog: ${err.message}`;}
}
search.addEventListener('input',render);moduleSelect.addEventListener('change',render);
init();
