#!/usr/bin/env node
import {verifySourceLock} from '../src/worker-policy.mjs';
const v=await verifySourceLock();
console.log(`AUDK_WORKER_LOCK_OK=${v.verifiedFiles}`);
