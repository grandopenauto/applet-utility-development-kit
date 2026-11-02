#!/usr/bin/env node
/** Explicit operator-only worker. Refuses elevated, shared-service, or unknown principals. */
import {checkRestrictedWorker,probeWindowsIdentity} from '../src/worker-policy.mjs';
import {runQueuedBuildJobs} from '../src/build-service.mjs';
const root=process.env.AUDK_BUILD_DATA_DIR;
const allowedSid=process.env.AUDK_WORKER_ALLOWED_SID;
if(!root||!allowedSid)throw Error('Set private AUDK_BUILD_DATA_DIR and AUDK_WORKER_ALLOWED_SID');
const verification=await checkRestrictedWorker({storage:root,allowedSid,identity:probeWindowsIdentity()});
if(process.argv.includes('--check')){
 console.log(JSON.stringify({mode:'preflight-only',...verification}));
}else{
 if(process.argv.length!==2)throw Error('No command-line arguments accepted except --check');
 const python=process.env.AUDK_PYTHON;
 if(!python)throw Error('Set AUDK_PYTHON to an approved absolute Windows Python path');
 const results=await runQueuedBuildJobs(root,{limit:1,python});
 console.log(JSON.stringify({processed:results.length,completed:results.filter(j=>j.state==='completed').length,failed:results.filter(j=>j.state==='failed').length,publication:'disabled'}));
 if(results.some(j=>j.state==='failed'))process.exitCode=1;
}
