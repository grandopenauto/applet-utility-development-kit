import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {assessIdentity,parseIdentityOutput,verifySourceLock,requireWorkerLocation,checkRestrictedWorker} from '../src/worker-policy.mjs';

const allowedSid='S-1-5-21-123456-234567-345678-1001';
const identity={accountSid:allowedSid,groupSids:['S-1-5-32-545'],privileges:[]};
test('worker refuses system, shared-service, unknown and administrator identities',()=>{
 assert.equal(assessIdentity({...identity,allowedSid}).restricted,true);
 assert.throws(()=>assessIdentity({...identity,accountSid:'S-1-5-18',allowedSid}),/does not match/);
 assert.throws(()=>assessIdentity({...identity,allowedSid:'S-1-5-19'}),/dedicated/);
 assert.throws(()=>assessIdentity({...identity,groupSids:['S-1-5-32-544'],allowedSid}),/Privileged/);
 assert.throws(()=>assessIdentity({...identity,privileges:['SeDebugPrivilege'],allowedSid}),/Privileged/);
 assert.throws(()=>assessIdentity({...identity,allowedSid:'S-1-5-21-1-2-3-99'}),/does not match/);
});
test('whoami identity evidence parsing is conservative',()=>{
 const user='"ACME\\audk-worker","User","S-1-5-21-123456-234567-345678-1001"';
 const group='"BUILTIN\\Users","Alias","S-1-5-32-545"';
 const priv='"SeChangeNotifyPrivilege","Bypass traverse checking","Enabled"';
 assert.equal(parseIdentityOutput(user,group,priv).accountSid,allowedSid);
 assert.deepEqual(parseIdentityOutput(user,group,priv).privileges,[]);
 assert.deepEqual(parseIdentityOutput(user,group,'"SeImpersonatePrivilege","Impersonate","Disabled"').privileges,['SeImpersonatePrivilege']);
 assert.throws(()=>parseIdentityOutput('bad',group,priv),/Incomplete/);
});
test('worker roots must be distinct and cannot overlap',()=>{
 assert.deepEqual(requireWorkerLocation({source:'/tmp/audk-repo',storage:'/tmp/audk-private'}).source,'/tmp/audk-repo');
 assert.throws(()=>requireWorkerLocation({source:'/tmp/audk',storage:'/tmp/audk/jobs'}),/separate/);
 assert.throws(()=>requireWorkerLocation({source:'/tmp/audk/repo',storage:'/tmp/audk'}),/separate/);
 assert.throws(()=>requireWorkerLocation({source:'/tmp/audk',storage:'../not-absolute'}),/absolute/);
});
test('pinned worker sources check and tampered files fail closed',async()=>{
 const good=await verifySourceLock();assert.equal(good.verifiedFiles,7);
 const root=await mkdtemp(join(tmpdir(),'audk-lock-fixture-'));
 const orig=JSON.parse(await readFile(new URL('../policy/worker-source-lock.json',import.meta.url),'utf8'));
 for(const f of orig.files){
  const d=join(root,...f.path.split('/'));await mkdir(join(d,'..'),{recursive:true});
  const source=new URL('../'+f.path,import.meta.url);
  await copyFile(source,d);
 }
 await mkdir(join(root,'policy'),{recursive:true});
 await writeFile(join(root,'policy','worker-source-lock.json'),JSON.stringify(orig));
 assert.equal((await verifySourceLock({home:root})).verifiedFiles,7);
 await writeFile(join(root,'src','curated.mjs'),'// modified');
 await assert.rejects(()=>verifySourceLock({home:root}),/integrity mismatch/);
});
test('restricted preflight provides only reviewed, unpublished policy',async()=>{
 const storage=join(tmpdir(),'audk-worker-example-data');
 const p=await checkRestrictedWorker({allowedSid,storage,identity});
 assert.equal(p.restricted,true);assert.equal(p.sourceIntegrity,'pass');
 assert.equal(p.publication,'disabled');
 assert.equal(p.codePolicy,'reviewed-recipes-only');
 await assert.rejects(()=>checkRestrictedWorker({allowedSid,storage,identity:{...identity,groupSids:['S-1-5-32-544']}}),/Privileged/);
});
