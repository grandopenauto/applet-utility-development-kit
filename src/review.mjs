/** AUDK v0.7 — review packets for allowlisted, pure universal function candidates.
 * No eval, remote publishing, filesystem writes or privilege elevation.
 * SHA-256 is used for alteration detection, NOT reviewer identity/authentication.
 */
import {UNIVERSAL_RECIPES,UNIVERSAL_SCHEMA,buildUniversalCandidate,validateUniversalConfig,executeUniversal} from './universal-wizard.mjs';
export const REVIEW_SCHEMA='audk.review.v1';
export const PROMOTION_SCHEMA='audk.promotion-proposal.v1';
const textEncoder=new TextEncoder();
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const asText=(value,label,min,max)=>{
 if(typeof value!=='string'||value.trim().length<min||value.trim().length>max||/[\u0000-\u001f\u007f]/.test(value))throw Error(`${label} must be ${min}-${max} printable characters`);
 return value.trim();
};
export async function sha256(value){
 if(!globalThis.crypto?.subtle)throw Error('SHA-256 support is required for review evidence');
 const bytes=await globalThis.crypto.subtle.digest('SHA-256',textEncoder.encode(value));
 return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function cleanOrigin(origin){
 if(!['universal-wizard','local-cli'].includes(origin))throw Error('Unrecognized candidate origin');
 return origin;
}
const exampleConfig=(base,recipe,args)=>({schema:UNIVERSAL_SCHEMA,id:base.id,name:base.name,description:base.description,functionId:recipe.id,arguments:args});
export async function createReviewPacket(input,{origin='universal-wizard'}={}){
 const config=validateUniversalConfig(input),candidate=buildUniversalCandidate(config);
 const recipe=UNIVERSAL_RECIPES.find(x=>x.id===config.functionId);
 const tests=recipe.examples.map(example=>{
  const sample=exampleConfig(config,recipe,example.args);
  const actual=executeUniversal(sample);
  return {name:example.label,arguments:validateUniversalConfig(sample).arguments,result:actual,passed:true};
 });
 // The custom configuration is always independently evaluated as another fixture.
 tests.push({name:'Candidate configuration',arguments:config.arguments,result:candidate.result,passed:true});
 const artifacts={javascript:candidate.javaScript,python:candidate.python,testSource:candidate.testSource};
 const fingerprints={config:await sha256(JSON.stringify(config)),manifest:await sha256(JSON.stringify(candidate.manifest)),javascript:await sha256(artifacts.javascript),python:await sha256(artifacts.python),testSource:await sha256(artifacts.testSource),evidence:await sha256(JSON.stringify(tests))};
 return {schema:REVIEW_SCHEMA,status:'pending-human-review',config,manifest:candidate.manifest,origin:cleanOrigin(origin),evidence:{type:'allowlisted-interpreter-examples',passed:tests.length,failed:0,cases:tests,limitations:'Browser tests cover only the reviewed JS interpreter; generated JavaScript and Python require CI execution.'},artifacts,fingerprints};
}
export async function verifyReviewPacket(packet){
 if(!packet||typeof packet!=='object'||Array.isArray(packet)||packet.schema!==REVIEW_SCHEMA||packet.status!=='pending-human-review')throw Error('Invalid or non-pending review packet');
 const expected=await createReviewPacket(packet.config,{origin:packet.origin});
 for(const key of ['config','manifest','evidence','artifacts','fingerprints'])if(!same(packet[key],expected[key]))throw Error(`Review packet ${key} failed integrity verification`);
 return {valid:true,id:expected.config.id,recipe:expected.config.functionId,evidenceCount:expected.evidence.cases.length,contentFingerprint:expected.fingerprints.manifest};
}
export async function preparePromotionProposal(packet,{reviewer,note,acknowledged=false}={}){
 const checked=await verifyReviewPacket(packet);
 if(acknowledged!==true)throw Error('A human must explicitly acknowledge the reviewed output');
 const name=asText(reviewer,'Reviewer label',3,80),details=asText(note,'Review notes',12,1000);
 const entry={id:packet.config.id,kind:'universal-function',version:'0.7.0',name:packet.config.name,description:packet.config.description,config:packet.config,
  review:{schema:PROMOTION_SCHEMA,state:'locally-reviewed-proposal',reviewerLabel:name,note:details,manifestSha256:checked.contentFingerprint,
   reminder:'Local acknowledgment is not authenticated approval. Publication requires separate repository code review and CI.'}};
 return {schema:PROMOTION_SCHEMA,status:'proposed-not-published',path:`library/${entry.id}.json`,entry,
  evidence:{candidateFingerprint:checked.contentFingerprint,interpreterTests:checked.evidenceCount},nextStep:'Open a GitHub pull request; review diffs, run npm test and npm run check, then merge deliberately.'};
}
export function validatePromotedEntry(entry){
 if(!entry||entry.kind!=='universal-function'||entry.review?.schema!==PROMOTION_SCHEMA||entry.review?.state!=='locally-reviewed-proposal')throw Error('Universal registry entry requires an explicit promotion record');
 const config=validateUniversalConfig(entry.config);
 if(entry.id!==config.id||entry.name!==config.name||entry.description!==config.description||entry.version!=='0.7.0')throw Error('Promoted entry does not match its configuration');
 asText(entry.review.reviewerLabel,'Reviewer label',3,80);
 asText(entry.review.note,'Review notes',12,1000);
 if(!/^[a-f0-9]{64}$/.test(entry.review.manifestSha256))throw Error('Invalid manifest SHA-256');
 return entry;
}
