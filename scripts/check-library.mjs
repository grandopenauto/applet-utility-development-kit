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
  }else{runPipeline(entry.config);generatePipelineCode(entry.config);}
}
console.log(`Library validated: ${entries.length} applets.`);
