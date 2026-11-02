/** AUDK v0.7 — browser-local, non-authoritative review desk. */
import {UNIVERSAL_RECIPES,UNIVERSAL_SCHEMA} from './src/universal-wizard.mjs';
import {createReviewPacket,verifyReviewPacket,preparePromotionProposal} from './src/review.mjs';
const $=id=>document.getElementById(id);
const status=(msg,bad=false)=>{const target=$('review-status');target.textContent=msg;target.classList.toggle('error',bad);};
let packet=null,proposal=null;
const render=()=>{
 $('review-evidence').textContent=packet?JSON.stringify({status:packet.status,origin:packet.origin,functionId:packet.config.functionId,tests:packet.evidence.cases,sha256:packet.fingerprints,limitations:packet.evidence.limitations},null,2):'No candidate loaded.';
 $('review-packet').textContent=packet?JSON.stringify(packet,null,2):'No packet yet.';
 $('review-proposal').textContent=proposal?JSON.stringify(proposal,null,2):'Requires explicit local review acknowledgment.';
 $('review-download-packet').disabled=!packet;
 $('review-download-proposal').disabled=!proposal;
};
function download(name,body){const objectUrl=URL.createObjectURL(new Blob([body+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=objectUrl;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(objectUrl),1500);}
async function create(input){
 try{
  packet=await createReviewPacket(input);proposal=null;const checks=await verifyReviewPacket(packet);
  $('review-id').value=packet.config.id;$('review-function').value=packet.config.functionId;
  status(`Validated ${checks.id}: ${checks.evidenceCount} interpreter checks passed. Review source and limitations before proposing promotion.`);
  render();
 }catch(e){packet=null;proposal=null;status(e.message,true);render();}
}
function sample(){
 const recipe=UNIVERSAL_RECIPES.find(r=>r.id===$('review-function').value)||UNIVERSAL_RECIPES[0];
 const id=$('review-id').value.trim();
 return {schema:UNIVERSAL_SCHEMA,id,name:recipe.title+' applet',description:recipe.description,functionId:recipe.id,arguments:recipe.examples[0].args};
}
$('review-create').addEventListener('click',()=>create(sample()));
$('review-download-packet').addEventListener('click',()=>{if(packet)download(packet.config.id+'.review.json',JSON.stringify(packet,null,2));});
$('review-download-proposal').addEventListener('click',()=>{if(proposal)download(packet.config.id+'.proposal.json',JSON.stringify(proposal,null,2));});
$('review-import').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  if(file.size>120000)throw Error('Review packet exceeds the 120 KB import limit');
  const parsed=JSON.parse(await file.text());await verifyReviewPacket(parsed);packet=parsed;proposal=null;
  $('review-id').value=packet.config.id;$('review-function').value=packet.config.functionId;
  status(`Imported ${packet.config.id}; hashes and interpreter evidence verified. Review is still pending.`);render();
 }catch(err){packet=null;proposal=null;status(err.message,true);render();}
 e.target.value='';
});
$('review-prepare').addEventListener('click',async()=>{
 try{
  if(!packet)throw Error('Create or import a verified packet first');
  proposal=await preparePromotionProposal(packet,{reviewer:$('review-reviewer').value,note:$('review-note').value,acknowledged:$('review-confirm').checked});
  status('Local proposal generated. This does NOT publish an applet. Independent GitHub code review and CI are required.');render();
 }catch(e){proposal=null;status(e.message,true);render();}
});
for(const recipe of UNIVERSAL_RECIPES){const option=document.createElement('option');option.value=recipe.id;option.textContent=`${recipe.id} · ${recipe.title}`;$('review-function').append(option);}
window.addEventListener('audk:universal-candidate',e=>{create(e.detail.config);location.hash='#review';});
render();
