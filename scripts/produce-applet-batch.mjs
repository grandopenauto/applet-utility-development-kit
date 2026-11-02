#!/usr/bin/env node
/** Operator CLI. Inspect-only default; --build stages a new private batch. */
import {readFile} from 'node:fs/promises';
import {prepareProductionBatch,executeProductionBatch} from '../src/production-batch.mjs';
import {UNIVERSAL_RECIPES} from '../src/universal-wizard.mjs';
const args=process.argv.slice(2);
const valid=new Set(['--reviewed','--proposals','--limit','--output','--python','--build']);
if(args.some(x=>x.startsWith('--')&&!valid.has(x)))throw Error('Unknown option');
const one=(name,defaultValue)=>{const indices=args.map((v,i)=>v===name?i:-1).filter(i=>i>=0);if(indices.length>1)throw Error('Repeated '+name);if(!indices.length)return defaultValue;const v=args[indices[0]+1];if(!v||v.startsWith('--'))throw Error('Missing '+name);return v;};
const flag=name=>{if(args.filter(x=>x===name).length>1)throw Error('Repeated '+name);return args.includes(name)};
const parseIds=s=>s?s.split(',').map(x=>x.trim()):[];
const limit=Number(one('--limit','5'));
if(!Number.isInteger(limit)||limit<1||limit>10)throw Error('Batch reviewed limit must be 1–10');
const reviewed=parseIds(one('--reviewed',null));
const proposals=parseIds(one('--proposals',null));
if(!reviewed.length&&!proposals.length)reviewed.push(...UNIVERSAL_RECIPES.slice(0,limit).map(x=>x.id));
if(reviewed.length>limit)throw Error('Selected reviewed IDs exceed --limit');
const plan=JSON.parse(await readFile(new URL('../catalog/assembly-plan.json',import.meta.url),'utf8'));
const input={reviewed,proposals};
const prepared=prepareProductionBatch(input,plan);
if(!flag('--build')){
 console.log(JSON.stringify({...prepared,mode:'inspect-only',outputWritten:false},null,2));
}else{
 const output=one('--output',null);
 if(!output)throw Error('Explicit --output required for --build');
 const result=await executeProductionBatch(input,{output,python:one('--python','python'),plan});
 console.log(JSON.stringify({mode:'private-staging',output:result.output,reviewedBuilt:result.report.reviewedBuilt,proposalsPrepared:result.report.proposalsPrepared,publication:'disabled',reviewRequired:true},null,2));
}
