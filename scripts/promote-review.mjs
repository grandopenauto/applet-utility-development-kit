/** Local-only, explicit, offline promotion. No remote writes or auto-merge. */
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {preparePromotionProposal,verifyReviewPacket} from '../src/review.mjs';
import {loadRegistry,validateEntry,libraryDir} from '../src/registry.mjs';
const args=process.argv.slice(2),value=flag=>{const i=args.indexOf(flag);return i>=0?args[i+1]:null;};
if(!value('--packet')||!value('--reviewer')||!value('--note')||!args.includes('--acknowledge')){
 console.error('Usage: node scripts/promote-review.mjs --packet ./candidate.review.json --reviewer "Reviewer Name" --note "Reviewed input and generated code" --acknowledge [--out ./proposals]');process.exitCode=2;
}else{
 try{
  const packet=JSON.parse(await readFile(resolve(value('--packet')),'utf8'));
  await verifyReviewPacket(packet);
  const proposal=await preparePromotionProposal(packet,{reviewer:value('--reviewer'),note:value('--note'),acknowledged:true});
  const existing=await loadRegistry();if(existing.some(entry=>entry.id===proposal.entry.id))throw Error('Applet ID already exists in registry');
  validateEntry(proposal.entry);
  const out=resolve(value('--out')||'proposals');
  // Do not permit the proposed artifact to be written into the real registry.
  if(out===libraryDir||out.startsWith(libraryDir+'/'))throw Error('Proposals cannot write directly into the library');
  await mkdir(out,{recursive:true});const path=join(out,proposal.entry.id+'.proposal.json');
  try{await stat(path);throw Error('Proposal already exists; review before replacing');}catch(e){if(e.code!=='ENOENT')throw e;}
  await writeFile(path,JSON.stringify(proposal,null,2)+'\n',{flag:'wx'});
  console.log(`Wrote REVIEW PROPOSAL to ${path}. No repository/library mutation or publication occurred.`);
 }catch(error){console.error(error.message);process.exitCode=1;}
}
