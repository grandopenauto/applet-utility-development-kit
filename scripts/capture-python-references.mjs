#!/usr/bin/env node
/** Operator-only. Preview by default; captures sealed CPython reference cases only with --capture. */
import {readFile} from 'node:fs/promises';
import {prepareReferenceCapture,capturePythonReferences,writeReferenceCapture} from '../src/python-reference.mjs';
const argv=process.argv.slice(2),known=new Set(['--ids','--python','--output','--capture']);
if(argv.some(x=>x.startsWith('--')&&!known.has(x)))throw Error('Unknown oracle option');
const single=name=>{const indices=argv.map((x,i)=>x===name?i:-1).filter(i=>i>=0);
 if(indices.length>1)throw Error('Duplicate '+name);
 if(!indices.length)return null;
 if(name==='--capture')return true;
 const v=argv[indices[0]+1];if(!v||v.startsWith('--'))throw Error('Missing '+name);
 return v;
};
const ids=single('--ids')?.split(',').map(x=>x.trim()).filter(Boolean);
const python=single('--python')||process.env.AUDK_REFERENCE_PYTHON||'python';
const output=single('--output'),capture=single('--capture');
const catalog=JSON.parse(await readFile(new URL('../catalog/python-standard-library.json',import.meta.url),'utf8'));
const assembly=JSON.parse(await readFile(new URL('../catalog/assembly-plan.json',import.meta.url),'utf8'));
if(!capture){
 if(output)throw Error('No --output accepted without explicit --capture');
 const planned=prepareReferenceCapture(catalog,assembly,{ids});
 console.log(JSON.stringify({...planned,mode:'inspect-only',pythonExecuted:false,filesWritten:false},null,2));
}else{
 if(!output)throw Error('Explicit fresh absolute --output required');
 const result=await capturePythonReferences(catalog,assembly,{ids,python});
 const stored=await writeReferenceCapture(result,{output});
 console.log(JSON.stringify({mode:'private-capture',output:stored.output,files:stored.report.files.length,cases:stored.report.caseCount,
  pythonVersion:result.pythonVersion,approvedRecipes:0,published:0},null,2));
}
