#!/usr/bin/env node
/** Operator-driven SDK development packet generation. Read-only unless --write. */
import {readFile} from 'node:fs/promises';
import {planRecipeDevelopment,writeRecipeDevelopment} from '../src/sdk-recipe-development.mjs';
const args=process.argv.slice(2);
const valid=new Set(['--ids','--module','--limit','--include-special','--write','--output']);
if(args.some(x=>x.startsWith('--')&&!valid.has(x)))throw Error('Unknown SDK recipe option');
const value=(name,fallback)=>{const index=args.indexOf(name);if(index<0)return fallback;if(args.lastIndexOf(name)!==index)throw Error('Repeated '+name);const v=args[index+1];if(!v||v.startsWith('--'))throw Error('Missing '+name);return v};
const flag=name=>{if(args.filter(x=>x===name).length>1)throw Error('Repeated '+name);return args.includes(name)};
const catalog=JSON.parse(await readFile(new URL('../catalog/python-standard-library.json',import.meta.url),'utf8'));
const plan=JSON.parse(await readFile(new URL('../catalog/assembly-plan.json',import.meta.url),'utf8'));
const ids=value('--ids','').split(',').map(x=>x.trim()).filter(Boolean);
const chosen=planRecipeDevelopment(catalog,plan,{ids,module:value('--module',null),limit:Number(value('--limit','10')),includeSpecial:flag('--include-special')});
if(!flag('--write')){
 console.log(JSON.stringify({schema:chosen.schema,mode:'inspect-only',pythonVersion:chosen.sourceVersion,selected:chosen.selected,
  packets:chosen.packets.map(p=>({functionId:p.functionId,stage:p.stage,parameterCount:p.arguments.parameters.length,testCaseProposals:p.proposedTestCases.length,documentation:p.provenance.documentation,approved:false})),
  outputWritten:false,publication:false},null,2));
}else{
 const output=value('--output',null);if(!output)throw Error('Explicit --output required with --write');
 const result=await writeRecipeDevelopment(chosen,{output});
 console.log(JSON.stringify({mode:'development-packets-only',output:result.output,packetCount:result.report.packets.length,executed:0,approved:0,published:0},null,2));
}
