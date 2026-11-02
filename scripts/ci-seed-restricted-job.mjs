#!/usr/bin/env node
/** GitHub Actions only: seed a reviewed synthetic job; no network and no publication. */
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {submitBuildJob} from '../src/build-service.mjs';

const storage=process.argv[2];
if(!storage||!isAbsolute(storage)||process.argv.length!==3)throw Error('Expected one absolute private job root');
const plan=JSON.parse(await readFile(new URL('../catalog/assembly-plan.json',import.meta.url),'utf8'));
const job=await submitBuildJob(storage,{functionId:'math.sqrt',mode:'reviewed-build',idempotencyKey:'audkci-'+randomUUID()},plan);
if(job.state!=='queued'||job.publication!=='disabled')throw Error('Unexpected seeded job state');
console.log('AUDK_CI_SEEDED_REVIEWED_JOB='+job.jobId);
