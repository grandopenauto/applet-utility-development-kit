#!/usr/bin/env node
/** AUDK assembly report. Zero network, no discovered code execution, no registry writes. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {loadRegistry} from '../src/registry.mjs';
import {buildAssemblyPlan,validateAssemblyPlan,candidateSpecification} from '../src/assembly-line.mjs';
function option(flag,def){const i=process.argv.indexOf(flag);if(i<0)return def;if(!process.argv[i+1]||process.argv[i+1].startsWith('--'))throw Error(`Missing ${flag} value`);return process.argv[i+1];}
const input=resolve(option('--catalog','catalog/python-standard-library.json'));
const output=resolve(option('--output','catalog/assembly-plan.json'));
const specs=option('--spec-dir',null);
const limit=Number(option('--limit','15'));
if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('Limit must be 1–100');
if(input===output||output.endsWith('/library/index.json'))throw Error('Refusing to overwrite input or production library index');
const discovery=JSON.parse(await readFile(input,'utf8'));
const report=buildAssemblyPlan(discovery,await loadRegistry());validateAssemblyPlan(report);
await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');
let written=0;
if(specs){
 const dir=resolve(specs);if(dir===resolve('library')||dir.startsWith(resolve('library')+'/'))throw Error('Candidate specs must not write to the published library');
 await mkdir(dir,{recursive:true});
 for(const c of report.candidates.slice(0,limit)){
  const packet=candidateSpecification(report,c.id);
  await writeFile(resolve(dir,packet.proposedAppletName+'.json'),JSON.stringify(packet,null,2)+'\n',{flag:'wx'});written++;
 }
}
console.log(JSON.stringify({coverage:report.coverage,stageOnly:true,specificationsWritten:written,report:output}));
