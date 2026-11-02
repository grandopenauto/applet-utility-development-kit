#!/usr/bin/env node
/** Inspect-only default; --compare runs sealed CPython oracle + pinned JavaScript candidates. */
import {readFile} from 'node:fs/promises';
import {prepareJavascriptParity,compareJavascriptParity,writeJavascriptParity} from '../src/javascript-parity.mjs';
const args=process.argv.slice(2);
const allowed=new Set(['--ids','--python','--output','--compare']);
if(args.some(x=>x.startsWith('--')&&!allowed.has(x)))throw Error('Unknown parity option');
function get(flag){
 const n=args.filter(x=>x===flag).length;if(n>1)throw Error('Repeated '+flag);
 if(!n)return null;if(flag==='--compare')return true;
 const i=args.indexOf(flag);const val=args[i+1];if(!val||val.startsWith('--'))throw Error('Missing '+flag);
 return val;
}
const ids=get('--ids')?.split(',').map(x=>x.trim()).filter(Boolean);
const python=get('--python')||process.env.AUDK_REFERENCE_PYTHON||'python';
const output=get('--output'),compare=get('--compare');
const catalog=JSON.parse(await readFile(new URL('../catalog/python-standard-library.json',import.meta.url),'utf8'));
const assembly=JSON.parse(await readFile(new URL('../catalog/assembly-plan.json',import.meta.url),'utf8'));
if(!compare){
 if(output)throw Error('--output requires explicit --compare');
 console.log(JSON.stringify({...prepareJavascriptParity(catalog,assembly,{ids}),mode:'inspect-only',pythonExecuted:false,filesWritten:false},null,2));
}else{
 if(!output)throw Error('Explicit fresh private absolute --output required');
 const result=await compareJavascriptParity(catalog,assembly,{ids,python});
 const saved=await writeJavascriptParity(result,{output});
 console.log(JSON.stringify({mode:'parity-evidence',...saved,pythonVersion:result.pythonVersion,
  state:result.status,automaticPromotion:false,automaticPublication:false},null,2));
 if(result.failed)process.exitCode=1;
}
