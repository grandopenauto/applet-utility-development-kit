/** AUDK v1.2 — public read-only view of assembly plans. No remote builds. */
import {validateAssemblyPlan,candidateSpecification} from './src/assembly-line.mjs';
const $=id=>document.getElementById(id);
const list=$('assembly-results'),detail=$('assembly-detail'),status=$('assembly-status');
const search=$('assembly-search'),stage=$('assembly-stage'),summary=$('assembly-summary');
let plan=null,selected='';
function el(tag,value,cls){const n=document.createElement(tag);if(value!==undefined)n.textContent=String(value);if(cls)n.className=cls;return n;}
function download(data,filename){const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'});const u=URL.createObjectURL(blob);const a=el('a');a.href=u;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(u),500);}
function showDetail(){detail.replaceChildren();const c=plan.candidates.find(x=>x.id===selected);if(!c){detail.append(el('p','Select a missing function to inspect its assembly specification.','muted'));return;}
 detail.append(el('h3',c.id),el('p',c.description,'muted'));
 const tags=el('div',undefined,'catalog-tags');for(const t of [c.stage,c.risk,'priority '+c.priority])tags.append(el('span',t,'catalog-tag'));detail.append(tags);
 detail.append(el('h4','Suggested configuration fields'));
 for(const f of (c.proposedFields||[]))detail.append(el('p',`${f.name}: ${f.suggestedType} (${f.reviewRequired?'unverified':'reviewed schema'})`,'muted'));
 if(!c.proposedFields?.length)detail.append(el('p','Manual parameter schema required.','muted'));
 detail.append(el('h4','Checks before publishing'));
 for(const check of c.checks)detail.append(el('p','• '+check,'muted'));
 const btn=el('button','↓ Export _applet specification','btn primary');btn.type='button';btn.addEventListener('click',()=>download(candidateSpecification(plan,c.id),c.id.replace('.','-')+'_applet.json'));detail.append(btn);
 detail.append(el('p','This generates a design specification, not executable software. Test and review implementations before publication.','muted'));
}
function render(){if(!plan)return;
 const q=search.value.toLowerCase().trim(),s=stage.value;
 const matches=plan.candidates.filter(c=>(s==='all'||s===c.stage)&&(!q||`${c.id} ${c.description}`.toLowerCase().includes(q)));
 list.replaceChildren();for(const c of matches.slice(0,70)){
  const b=el('button',undefined,'catalog-card');b.type='button';b.setAttribute('aria-pressed',String(c.id===selected));if(c.id===selected)b.classList.add('selected');
  b.append(el('strong',c.id),el('small',c.stage+' · '+c.risk),el('span',c.description,'muted'));
  b.addEventListener('click',()=>{selected=c.id;render();});list.append(b);
 }
 if(matches.length>70)list.append(el('p',`Showing 70 of ${matches.length}; narrow the search.`, 'muted'));
 if(!matches.some(x=>x.id===selected))selected=matches[0]?.id||'';
 showDetail();
 status.textContent=`${matches.length} matching functions · ${plan.coverage.missingFromRegistry} discovered functions remain without published applets. No remote compilation or auto-publishing.`;
}
async function load(){try{
 const res=await fetch('./catalog/assembly-plan.json',{cache:'no-store'});if(!res.ok)throw Error('HTTP '+res.status);
 const obj=await res.json();validateAssemblyPlan(obj);plan=obj;
 const c=obj.coverage;
 summary.textContent=`${c.discovered} discovered · ${c.reviewedWizardFunctions} configured · ${c.publishedPythonApplets} published Python applets · ${c.publishedTotal} total applets · ${c.implementationNeeded} implementation candidates · ${c.specialReview} special review`;
 render();
 }catch(e){status.textContent='Assembly plan unavailable: '+e.message}}
search.addEventListener('input',render);stage.addEventListener('change',render);load();
