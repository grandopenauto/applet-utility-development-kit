import {buildUniversalCandidate} from '../src/universal-wizard.mjs';
import {sha256} from '../src/review.mjs';
import {executeUniversal} from '../src/universal-wizard.mjs';
import {loadRegistry} from '../src/registry.mjs';
import {checkMacro,generateJavaScript} from '../src/engine.mjs';
import {runPipeline,generatePipelineCode} from '../src/pipeline.mjs';
const entries=await loadRegistry();
const ids=new Set();
for(const entry of entries){
  if(ids.has(entry.id))throw new Error('Duplicate applet id: '+entry.id);
  ids.add(entry.id);
  if(entry.kind==='macro'){
    const result=checkMacro(entry.config);generateJavaScript(entry.config);
    if(!result.passed) throw new Error('Failed self-test: '+entry.id);
  }else if(entry.kind==='universal-function'){
    executeUniversal(entry.config);
    const candidate=buildUniversalCandidate(entry.config);
    const digest=await sha256(JSON.stringify(candidate.manifest));
    if(digest!==entry.review.manifestSha256)throw Error('Universal applet review fingerprint mismatch: '+entry.id);
  }
  else{runPipeline(entry.config);generatePipelineCode(entry.config);}
}
console.log(`Library validated: ${entries.length} applets.`);
