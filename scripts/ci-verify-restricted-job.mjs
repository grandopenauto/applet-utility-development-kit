#!/usr/bin/env node
/** GitHub Actions only: independent evidence and invariant assertions after worker exits. */
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {verifyBuildJob} from '../src/build-service.mjs';
const root=process.argv[2];
if(!root||!isAbsolute(root)||process.argv.length!==3)throw Error('Expected one absolute job root');
const entries=(await readdir(join(root,'jobs'),{withFileTypes:true})).filter(x=>x.isDirectory()&&/^[0-9a-f-]{36}$/.test(x.name));
assert.equal(entries.length,1,'Exactly one job must be persisted');
const job=JSON.parse(await readFile(join(root,'jobs',entries[0].name,'job.json'),'utf8'));
assert.equal(job.functionId,'math.sqrt');
assert.equal(job.mode,'reviewed-build');
assert.equal(job.state,'completed',job.error||'Job did not complete');
assert.equal(job.publication,'disabled');
assert.equal(job.reviewRequired,true);
assert.equal(job.artifacts.length,4);
const proof=await verifyBuildJob(root,job.jobId);
assert.equal(proof.reproducible,true);
assert.equal(proof.artifacts,4);
assert.equal(proof.signed,false);
console.log('AUDK_NONADMIN_REVIEWED_BUILD_EVIDENCE=PASS');
console.log('AUDK_NONADMIN_FOUR_ARTIFACTS_VERIFIED=PASS');
console.log('AUDK_NONADMIN_NO_PUBLICATION=PASS');
