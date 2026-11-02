#!/usr/bin/env node
import {runQueuedBuildJobs} from '../src/build-service.mjs';
const root=process.env.AUDK_BUILD_DATA_DIR;
if(!root)throw Error('AUDK_BUILD_DATA_DIR must be set');
const result=await runQueuedBuildJobs(root,{limit:Number(process.env.AUDK_WORKER_LIMIT||3),python:process.env.AUDK_PYTHON||'python'});
console.log(JSON.stringify({processed:result.length,completed:result.filter(x=>x.state==='completed').length,failed:result.filter(x=>x.state==='failed').length,jobIds:result.map(x=>x.jobId)}));
if(result.some(x=>x.state==='failed'))process.exitCode=1;
