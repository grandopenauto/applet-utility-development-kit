/** AUDK v0.9: browse metadata, configure allowlisted functions, or export a non-executable intake proposal. */
import {UNIVERSAL_RECIPES} from './src/universal-wizard.mjs';
import {classifyDiscovered,makePythonIntake,validatePythonIntake} from './src/python-triage.mjs';
const reviewed=new Set(UNIVERSAL_RECIPES.map(r=>r.id));
const search=document.getElementById('python-search');
const moduleSelect=document.getElementById('python-module');
const results=document.getElementById('python-results');
const status=document.getElementById('python-discovery-status');
const count=document.getElementById('python-discovery-count');
const triage=document.getElementById('python-triage-status');
let catalog=null;
const element=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
function downloadIntake(entry){
 try{
  const proposal=makePythonIntake(entry);validatePythonIntake(proposal);
  const blob=new Blob([JSON.stringify(proposal,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`audk-intake-${entry.module}-${entry.name}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  triage.textContent=`Exported discovery-only intake for ${proposal.qualifiedName}. It is not executable and requires implementation, tests and code review.`;
 }catch(e){triage.textContent=e.message;}
}
function render(){
 if(!catalog)return;
 const phrase=search.value.trim().toLowerCase(),moduleName=moduleSelect.value;
 const filtered=catalog.entries.filter(entry=>(!moduleName||entry.module===moduleName)&&(!phrase||[entry.module+'.'+entry.name,entry.signature,entry.summary].some(x=>x.toLowerCase().includes(phrase))));
 count.textContent=`${filtered.length} / ${catalog.entries.length} discovered callables · ${UNIVERSAL_RECIPES.length} reviewed wizard recipes`;
 results.replaceChildren();
 for(const entry of filtered.slice(0,90)){
  const item=element('article','python-entry');
  item.append(element('strong',null,entry.module+'.'+entry.name));
  item.append(element('code',null,entry.signature));
  item.append(element('p','muted',entry.summary));
  const label=classifyDiscovered(entry);
  item.append(element('span','catalog-tag',label.state==='wizard-supported'?'Wizard supported':'Discovery only'));
  const button=element('button','btn secondary',label.action);button.type='button';
  if(reviewed.has(label.name))button.addEventListener('click',()=>{location.hash='#universal';window.dispatchEvent(new CustomEvent('audk:prefill-universal',{detail:{functionId:label.name}}));});
  else button.addEventListener('click',()=>downloadIntake(entry));
  item.append(button);results.append(item);
 }
 if(filtered.length>90)results.append(element('p','muted',`Showing first 90 of ${filtered.length}. Refine the search to narrow results.`));
 if(filtered.length===0)results.append(element('p','muted','No matching Python callables.'));
}
async function init(){try{
 const response=await fetch('./catalog/python-standard-library.json',{cache:'no-store'});
 if(!response.ok)throw Error(`Catalog HTTP ${response.status}`);
 const data=await response.json();if(data.schema!=='audk.discovery.v1'||!Array.isArray(data.entries)||data.entries.length>1200)throw Error('Invalid catalog format');
 catalog=data;
 for(const name of data.modules){const opt=element('option',null,name);opt.value=name;moduleSelect.append(opt);}
 status.textContent=`Python ${data.pythonVersion} discovery snapshot · ${data.modules.length} allowlisted modules · metadata only`;
 render();
 }catch(e){status.textContent=`Unable to read Python discovery catalog: ${e.message}`;}}
search.addEventListener('input',render);moduleSelect.addEventListener('change',render);init();
