#!/usr/bin/env node
/** Private operator gateway. No public binding and never accesses a build queue. */
import {startIntakeGateway} from '../src/intake-gateway.mjs';
const root=process.env.AUDK_INTAKE_DATA_DIR;
const token=process.env.AUDK_INTAKE_TOKEN;
if(!root||!token)throw Error('Configure private AUDK_INTAKE_DATA_DIR and AUDK_INTAKE_TOKEN');
const gateway=await startIntakeGateway({root,token,buildRoot:process.env.AUDK_BUILD_DATA_DIR,port:Number(process.env.AUDK_INTAKE_PORT||4194)});
console.log('AUDK quarantine-only intake listening on loopback port '+gateway.address().port+'; no build execution');
