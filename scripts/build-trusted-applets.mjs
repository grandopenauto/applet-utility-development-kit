#!/usr/bin/env node
/** Assemble portable applet source from explicitly pinned, bounded AUDK recipes.
 * This never accepts new executable functions from a discovery catalog or HTTP.
 * Generated artifacts go to a separate staging directory, NOT the live registry.
 */
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {CURATED_FUNCTIONS,buildCuratedEntry} from '../src/curated.mjs';
import {buildUniversalCandidate} from '../src/universal-wizard.mjs';
const argv=process.argv;
function flag(n,d){const i=argv.indexOf(n);if(i<0)return d;if(!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Missing '+n);return argv[i+1];}
const output=resolve(flag('--output','/tmp/audk-compiled-reviewed'));
const max=Number(flag('--limit','24'));
const python=flag('--python','python');
if(!Number.isInteger(max)||max<1||max>CURATED_FUNCTIONS.length)throw Error('Invalid --limit');
const lib=resolve('library');if(output===lib||output.startsWith(lib+'/'))throw Error('Refusing to generate directly into published library');
await mkdir(output,{recursive:true});
let count=0;const results=[];
for(const func of CURATED_FUNCTIONS.slice(0,max)){
 const entry=buildCuratedEntry(func),pkg=buildUniversalCandidate(entry.config);
 const prefix=entry.id+'_applet';
 const js=join(output,prefix+'.mjs'),py=join(output,prefix+'.py');
 await writeFile(js,pkg.javaScript);await writeFile(py,pkg.python);
 await writeFile(join(output,prefix+'.manifest.json'),JSON.stringify({...pkg.manifest,status:'build-artifact-review-required'},null,2)+'\n');
 await writeFile(join(output,prefix+'.test.mjs'),pkg.testSource.replace(`'./${entry.id}.mjs'`,`'./${prefix}.mjs'`));
 execFileSync(process.execPath,['--check',js],{timeout:5000});
 // Executes ONLY existing reviewed AUDK-generated source with bounded sample inputs.
 const jsResult=await import('file://'+js+'?test='+count);
 const pyResult=JSON.parse(execFileSync(python,[py],{encoding:'utf8',timeout:5000,maxBuffer:16384}));
 const expected=pkg.result;
 const equal=(a,b)=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(a),Math.abs(b)):JSON.stringify(a)===JSON.stringify(b);
 if(!equal(jsResult.runApplet(),expected)||!equal(pyResult,expected))throw Error('Generated source mismatch: '+func);
 results.push({functionId:func,artifactPrefix:prefix,verified:'node-and-python-example',published:false});count++;
}
await writeFile(join(output,'build-report.json'),JSON.stringify({schema:'audk.trusted-build.v1',generated:count,source:'explicit-reviewed-allowlist',autoPublished:false,results},null,2)+'\n');
console.log(`AUDK trusted applet assembly: ${count} bounded JavaScript/Python bundles validated. Staged only.`);
