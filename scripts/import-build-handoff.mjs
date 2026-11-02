#!/usr/bin/env node
/** Inspect by default. Only enqueue with an explicit operator command. */
import {readFile} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {importBuildHandoff} from '../src/build-handoff-import.mjs';
const args=process.argv.slice(2);
if(args.length<1||args.length>3||!isAbsolute(args[0])||
 args.slice(1).some(x=>!['--enqueue','--approve-reviewed'].includes(x))||
 new Set(args.slice(1)).size!==args.length-1||
 (args.includes('--approve-reviewed')&&!args.includes('--enqueue')))
 throw Error('Usage: npm run build:import-handoff -- <absolute-json-path> [--enqueue [--approve-reviewed]]');
const plan=JSON.parse(await readFile(new URL('../catalog/assembly-plan.json',import.meta.url),'utf8'));
const result=await importBuildHandoff(args[0],plan,{
 dataRoot:process.env.AUDK_BUILD_DATA_DIR,
 enqueue:args.includes('--enqueue'),approveReviewed:args.includes('--approve-reviewed')
});
console.log(JSON.stringify(result,null,2));
