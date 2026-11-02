#!/usr/bin/env node
/** Generates a metadata-only review queue. Does not import or execute discovered functions. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {buildExpansionQueue,validateExpansionQueue} from '../src/expansion.mjs';
function option(flag,fallback){const i=process.argv.indexOf(flag);return i<0?fallback:process.argv[i+1];}
const input=resolve(option('--catalog','catalog/python-standard-library.json'));
const output=resolve(option('--output','catalog/expansion-queue.json'));
if(input===output)throw Error('Input and output must differ');
const source=JSON.parse(await readFile(input,'utf8'));
const queue=buildExpansionQueue(source);validateExpansionQueue(queue);
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(queue,null,2)+'\n','utf8');
console.log(`AUDK discovery queue: ${queue.summary.reviewCandidates} review candidates; ${queue.summary.specialReview} special review; ${queue.summary.alreadySupported} already supported. NO functions executed or published.`);
