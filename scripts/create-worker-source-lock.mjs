#!/usr/bin/env node
/** Maintainer-only: regenerate lock when reviewed code changes, then commit via PR. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const paths=['src/build-service.mjs','src/build-evidence.mjs','src/universal-wizard.mjs','src/curated.mjs','src/assembly-line.mjs','src/worker-policy.mjs','catalog/assembly-plan.json','scripts/run-restricted-worker.mjs'];
const files=[];
for(const path of paths){files.push({path,sha256:createHash('sha256').update(await readFile(new URL('../'+path,import.meta.url))).digest('hex')})}
await writeFile(new URL('../policy/worker-source-lock.json',import.meta.url),JSON.stringify({schema:'audk.worker-source-lock.v1',files},null,2)+'\n',{encoding:'utf8'});
console.log('Worker source lock generated with '+files.length+' pinned files; review changes before commit');
