/** v1.0: read-only candidate queue; metadata never becomes executable here. */
import {validateExpansionQueue} from './src/expansion.mjs';
import {makePythonIntake,validatePythonIntake} from './src/python-triage.mjs';
const byId=id=>document.getElementById(id);
const search=byId('expansion-search'),filter=byId('expansion-filter');
const list=byId('expansion-results'),details=byId('expansion-detail');
const count=byId('expansion-count'),status=byId('expansion-status');
const create=(tag,content,cls)=>{const n=document.createElement(tag);if(content!==undefined)n.textContent=String(content);if(cls)n.className=cls;return n;};
let queue,selected='';
function exportPacket(c){
 try{
  const entry={module:c.module,name:c.function,signature:c.signature,summary:c.summary};
  const packet=makePythonIntake(entry,{purpose:'Develop candidate from AUDK expansion queue'});
  validatePythonIntake(packet);
  const blob=new Blob([JSON.stringify({...packet,planning:{priority:c.priority,risk:c.risk,proposedFields:c.proposedFields,proposedChecks:c.proposedChecks}},null,2)+'\n'],{type:'application/json'});
  const uri=URL.createObjectURL(blob);const a=create('a');a.href=uri;a.download=`audk-intake-${c.module}-${c.function}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(uri),1000);
  status.textContent=`Exported non-executable intake for ${c.id}; code review is still required.`;
 }catch(e){status.textContent=e.message;}
}
function showDetails(){
 details.replaceChildren();const c=queue.candidates.find(x=>x.id===selected);
 if(!c){details.append(create('p','Select a function to inspect its proposed wizard and review needs.','muted'));return;}
 details.append(create('h3',c.id),create('p',c.summary,'muted'));
 const tags=create('div',undefined,'catalog-tags');for(const x of [c.risk+' risk',c.state,'priority '+c.priority])tags.append(create('span',x,'catalog-tag'));details.append(tags);
 details.append(create('p',c.reason,'muted'),create('h4','Signature'),create('pre',c.signature,'codebox'),create('h4','Suggested wizard fields (unverified)'));
 if(c.proposedFields.length){for(const f of c.proposedFields){details.append(create('p',`${f.name} — ${f.suggestedType} · ${f.required?'required':'optional'} · verify manually`,'muted'));}}
 else details.append(create('p','Manual schema design required.','muted'));
 details.append(create('h4','Required checks'));
 for(const check of c.proposedChecks)details.append(create('p','• '+check,'muted'));
 const btn=create('button','↓ Export review-only intake','btn primary');btn.type='button';btn.addEventListener('click',()=>exportPacket(c));details.append(btn);
 details.append(create('p','No Python or shell execution occurs in this browser. Exporting does not approve or publish the candidate.','muted'));
}
function render(){if(!queue)return;
 const q=search.value.toLowerCase().trim(),state=filter.value;
 const records=queue.candidates.filter(c=>(state==='all'||state===c.state)&&(!q||[c.id,c.signature,c.summary].some(s=>s.toLowerCase().includes(q))));
 count.textContent=`${records.length} candidates shown · ${queue.summary.alreadySupported} already supported · ${queue.summary.reviewCandidates} review candidates · ${queue.summary.specialReview} special review`;
 if(!records.some(c=>c.id===selected))selected=records[0]?.id||'';
 list.replaceChildren();
 for(const c of records.slice(0,60)){
  const item=create('button',undefined,'catalog-card');item.type='button';item.setAttribute('aria-pressed',String(c.id===selected));if(c.id===selected)item.classList.add('selected');
  item.append(create('strong',c.id),create('small',`priority ${c.priority} · ${c.risk} risk · ${c.state}`),create('span',c.summary,'muted'));
  item.addEventListener('click',()=>{selected=c.id;render();});list.append(item);
 }
 if(records.length>60)list.append(create('p',`Showing the first 60 of ${records.length}; refine your search.`, 'muted'));
 if(!records.length)list.append(create('p','No matching candidates.','muted'));
 showDetails();
}
async function load(){try{
 const res=await fetch('./catalog/expansion-queue.json',{cache:'no-store'});if(!res.ok)throw Error('Queue HTTP '+res.status);
 const data=await res.json();validateExpansionQueue(data);queue=data;
 status.textContent=`Pinned Python ${data.snapshot.pythonVersion} scan · metadata only · weekly scanning publishes downloadable GitHub Actions artifacts, not automatic applets.`;
 render();
 }catch(e){status.textContent='Expansion queue unavailable: '+e.message;}}
search.addEventListener('input',render);filter.addEventListener('change',render);load();
