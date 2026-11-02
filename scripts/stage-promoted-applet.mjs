/** Manually stage a verified, previously reviewed proposal as a registry file.
 * This command never contacts GitHub or publishes anything. A PR is still required.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {preparePromotionProposal} from '../src/review.mjs';
import {loadRegistry,validateEntry,libraryDir} from '../src/registry.mjs';
const args=process.argv.slice(2),value=flag=>{const i=args.indexOf(flag);return i>=0?args[i+1]:null;};
if(!value('--packet')||!value('--proposal')||!args.includes('--confirm-stage')){
 console.error('Usage: node scripts/stage-promoted-applet.mjs --packet candidate.review.json --proposal proposals/candidate.proposal.json --confirm-stage');process.exitCode=2;
}else{
 try{
  const packet=JSON.parse(await readFile(resolve(value('--packet')),'utf8'));
  const proposal=JSON.parse(await readFile(resolve(value('--proposal')),'utf8'));
  if(proposal.schema!=='audk.promotion-proposal.v1'||proposal.status!=='proposed-not-published')throw Error('Invalid proposal status');
  const expected=await preparePromotionProposal(packet,{reviewer:proposal.entry?.review?.reviewerLabel,note:proposal.entry?.review?.note,acknowledged:true});
  if(JSON.stringify(expected)!==JSON.stringify(proposal))throw Error('Proposal differs from verified candidate and reviewer record');
  if(proposal.entry.id!==packet.config.id||proposal.path!==`library/${packet.config.id}.json`)throw Error('Invalid registry destination');
  const current=await loadRegistry();if(current.some(x=>x.id===packet.config.id))throw Error('This applet is already registered');
  validateEntry(proposal.entry);
  const file=join(libraryDir,packet.config.id+'.json');
  await writeFile(file,JSON.stringify(proposal.entry,null,2)+'\n',{flag:'wx'});
  console.log(`Staged ${file}. NOT published — submit a PR with code review and passing CI.`);
 }catch(error){console.error(error.message);process.exitCode=1;}
}
