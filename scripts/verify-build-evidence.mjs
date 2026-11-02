#!/usr/bin/env node
/** Operator CLI; no network access or publication. */
import {verifyBuildJob} from '../src/build-service.mjs';
import {isAbsolute} from 'node:path';
const [root,id,...extra]=process.argv.slice(2);
if(extra.length||!root||!isAbsolute(root)||!id)throw Error('Usage: node scripts/verify-build-evidence.mjs <absolute-job-root> <job-id>');
const result=await verifyBuildJob(root,id);
console.log(JSON.stringify(result));
