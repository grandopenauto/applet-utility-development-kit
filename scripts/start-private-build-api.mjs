#!/usr/bin/env node
import {startPrivateBuildApi} from '../src/private-build-api.mjs';
const root=process.env.AUDK_BUILD_DATA_DIR,token=process.env.AUDK_BUILD_TOKEN;
if(!root||!token)throw Error('Set AUDK_BUILD_DATA_DIR and AUDK_BUILD_TOKEN privately before starting');
const server=await startPrivateBuildApi({dataRoot:root,token,port:Number(process.env.AUDK_BUILD_PORT||4193)});
console.log('AUDK private build API on loopback port '+server.address().port+' (not publicly exposed)');
