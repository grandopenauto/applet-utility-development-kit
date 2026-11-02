#!/usr/bin/env node
/** Inspect-only by default; explicit --check invokes sealed first-party Python. */
import {runPropertyParity,writePropertyParity} from '../src/parity-property.mjs';
const args=process.argv.slice(2);
const flags=new Set(['--check','--output','--python']);
if(args.some(a=>a.startsWith('--')&&!flags.has(a)))throw Error('Unsupported option');
const value=flag=>{const i=args.indexOf(flag);if(i<0)return null;if(args.lastIndexOf(flag)!==i)throw Error('Repeated option');const v=args[i+1];if(!v||v.startsWith('--'))throw Error('Missing option value');return v;};
const check=args.includes('--check'),output=value('--output'),python=value('--python')||'python';
if(!check){if(output)throw Error('Writing requires explicit --check');console.log(JSON.stringify({mode:'inspect-only',functions:6,expectedReferenceCases:606,publication:false,pythonExecuted:false,outputWritten:false}));}
else {const report=await runPropertyParity({python});const result=output?await writePropertyParity(report,{output}):null;console.log(JSON.stringify({mode:'bounded-property-check',passed:report.passed,referenceSamples:report.samples,boundaryCases:report.boundaryCases,failed:report.failedComparisons,publication:false,outputWritten:!!result,...(result?{output:result.output}:{})}));if(!report.passed)process.exitCode=1;}
