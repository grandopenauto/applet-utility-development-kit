/** Public/static-only handoff builder. No API tokens or remote submission. */
import {UNIVERSAL_RECIPES} from './src/universal-wizard.mjs';
import {validateAssemblyPlan} from './src/assembly-line.mjs';
import {createBuildHandoff} from './src/build-handoff.mjs';
const $=id=>document.getElementById(id);
const selection=$('builder-function'),mode=$('builder-mode'),status=$('builder-status'),preview=$('builder-preview'),download=$('builder-download');
let current=null;
const reviewed=new Set(UNIVERSAL_RECIPES.map(x=>x.id));
function fill(candidates){
 const all=[...new Set([...reviewed,...candidates.map(c=>c.id)])].sort();
 selection.replaceChildren(...all.map(id=>{const opt=document.createElement('option');opt.value=id;opt.textContent=id+(reviewed.has(id)?' · reviewed':' · proposal only');return opt}));
 selection.value='math.sqrt';
}
fetch('./catalog/assembly-plan.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Catalog unavailable');return r.json()}).then(data=>{validateAssemblyPlan(data);fill(data.candidates)}).catch(e=>{status.textContent='Catalog unavailable: '+e.message;fill([])});
function refresh(){
 if(!reviewed.has(selection.value)){mode.value='specification';mode.querySelector('[value="reviewed-build"]').disabled=true}
 else mode.querySelector('[value="reviewed-build"]').disabled=false;
 current=null;download.disabled=true;preview.textContent='Prepare a new handoff to preview it.';
}
selection.addEventListener('change',refresh);mode.addEventListener('change',refresh);
$('builder-prepare').addEventListener('click',()=>{
 if(mode.value==='reviewed-build'&&!reviewed.has(selection.value)){status.textContent='Denied: not a reviewed implementation';return}
 try{
  current=createBuildHandoff({functionId:selection.value,mode:mode.value,
   idempotencyKey:'web-'+crypto.randomUUID(),requestId:crypto.randomUUID(),createdAt:new Date().toISOString()});
  preview.textContent=JSON.stringify(current,null,2);
  status.textContent='Portable handoff prepared in your browser. Download and inspect with the private operator CLI; nothing was sent or queued.';
  download.disabled=false;
 }catch(e){current=null;download.disabled=true;status.textContent='Handoff not prepared: '+e.message}
});
download.addEventListener('click',()=>{
 if(!current)return;
 const blob=new Blob([JSON.stringify(current,null,2)+'\n'],{type:'application/json'});
 const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=current.request.functionId.replace('.','-')+'_audk-handoff.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),500);
});
