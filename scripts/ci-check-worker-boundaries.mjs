#!/usr/bin/env node
/** Runs as the disposable non-admin user before the worker. */
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
const [sourceFile,privateFile,writableFile]=process.argv.slice(2);
if(!sourceFile||!privateFile||!writableFile||process.argv.length!==5)throw Error('Expected source, protected sentinel, writable probe');
await assert.rejects(writeFile(sourceFile,'tampering'),e=>['EACCES','EPERM'].includes(e.code),'Read-only source must deny writes');
await assert.rejects(readFile(privateFile),e=>['EACCES','EPERM'].includes(e.code),'Private sentinel must deny reads');
await writeFile(writableFile,'synthetic write granted',{flag:'wx'});
await unlink(writableFile);
console.log('AUDK_NONADMIN_SOURCE_WRITE_DENIED=PASS');
console.log('AUDK_NONADMIN_PROTECTED_FILE_READ_DENIED=PASS');
console.log('AUDK_NONADMIN_JOB_ROOT_WRITE_GRANTED=PASS');
