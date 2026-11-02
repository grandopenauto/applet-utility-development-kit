/** Static-only request builder. NEVER sends secrets or contacts a remote API. */
import {UNIVERSAL_RECIPES} from './src/universal-wizard.mjs';
import {validateAssemblyPlan} from './src/assembly-line.mjs';
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
 current=null;download.disabled=true;preview.textContent='Prepare a new request to preview it.';
}
selection.addEventListener('change',refresh);mode.addEventListener('change',refresh);
$('builder-prepare').addEventListener('click',()=>{
 if(mode.value==='reviewed-build'&&!reviewed.has(selection.value)){status.textContent='Denied: not a reviewed implementation';return}
 current={functionId:selection.value,mode:mode.value,idempotencyKey:'web-'+crypto.randomUUID()};
 preview.textContent=JSON.stringify(current,null,2);
 status.textContent='Request JSON prepared locally. Download and submit through a private authenticated operator channel; nothing was sent.';
 download.disabled=false;
});
download.addEventListener('click',()=>{
 if(!current)return;
 const blob=new Blob([JSON.stringify(current,null,2)+'\n'],{type:'application/json'});
 const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=current.functionId.replace('.','-')+'_build-request.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),500);
});
