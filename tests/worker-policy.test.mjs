import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,copyFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {assessIdentity,parseIdentityOutput,verifySourceLock,requireWorkerLocation,verifyWorkerFilesystem,checkRestrictedWorker} from '../src/worker-policy.mjs';

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
 const repo=join(tmpdir(),'audk-worker-repo');
 const data=join(tmpdir(),'audk-worker-data');
 assert.equal(requireWorkerLocation({source:repo,storage:data}).source,repo);
 assert.throws(()=>requireWorkerLocation({source:repo,storage:join(repo,'jobs')}),/separate/);
 assert.throws(()=>requireWorkerLocation({source:join(repo,'src'),storage:repo}),/separate/);
 assert.throws(()=>requireWorkerLocation({source:repo,storage:'not-absolute'}),/absolute/);
});
test('pinned worker sources check and tampered files fail closed',async()=>{
 const good=await verifySourceLock();assert.equal(good.verifiedFiles,8);
 const root=await mkdtemp(join(tmpdir(),'audk-lock-fixture-'));
 const orig=JSON.parse(await readFile(new URL('../policy/worker-source-lock.json',import.meta.url),'utf8'));
 for(const f of orig.files){
  const d=join(root,...f.path.split('/'));await mkdir(join(d,'..'),{recursive:true});
  const source=new URL('../'+f.path,import.meta.url);
  await copyFile(source,d);
 }
 await mkdir(join(root,'policy'),{recursive:true});
 await writeFile(join(root,'policy','worker-source-lock.json'),JSON.stringify(orig));
 assert.equal((await verifySourceLock({home:root})).verifiedFiles,8);
 await writeFile(join(root,'src','curated.mjs'),'// modified');
 await assert.rejects(()=>verifySourceLock({home:root}),/integrity mismatch/);
});
test('restricted preflight provides only reviewed, unpublished policy',async()=>{
 const storage=await mkdtemp(join(tmpdir(),'audk-worker-example-data-'));
 const p=await checkRestrictedWorker({allowedSid,storage,identity});
 assert.equal(p.restricted,true);assert.equal(p.sourceIntegrity,'pass');
 assert.equal(p.publication,'disabled');
 assert.equal(p.codePolicy,'reviewed-recipes-only');
 assert.equal(p.pathConfinement,'canonical-disjoint');
 await assert.rejects(()=>checkRestrictedWorker({allowedSid,storage,identity:{...identity,groupSids:['S-1-5-32-544']}}),/Privileged/);
});

test('worker preflight rejects missing job directory rather than creating it',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'audk-missing-root-'));
 try{
  await assert.rejects(()=>verifyWorkerFilesystem({storage:join(parent,'missing')}),/ENOENT/);
 }finally{await rm(parent,{recursive:true,force:true})}
});
test('worker refuses source and storage aliases through symlinks or junctions',async(t)=>{
 const parent=await mkdtemp(join(tmpdir(),'audk-reparse-'));
 const src=join(parent,'src'),data=join(parent,'data'),link=join(parent,'alias');
 await mkdir(src);await mkdir(data);
 try{
  const clean=await verifyWorkerFilesystem({source:src,storage:data});
  assert.equal(clean.pathConfinement,'canonical-disjoint');
  try{await symlink(src,link,process.platform==='win32'?'junction':'dir')}
  catch(e){if(['EPERM','EACCES','ENOSYS'].includes(e.code)){t.diagnostic('Symlink creation unavailable');return}throw e}
  await assert.rejects(()=>verifyWorkerFilesystem({source:src,storage:link}),/symlink|junction/);
 }finally{await rm(parent,{recursive:true,force:true})}
});
test('worker lock refuses a symlinked pinned source file despite matching bytes',async(t)=>{
 const root=await mkdtemp(join(tmpdir(),'audk-lock-reparse-'));
 const orig=JSON.parse(await readFile(new URL('../policy/worker-source-lock.json',import.meta.url),'utf8'));
 try{
  for(const f of orig.files){
   const target=join(root,...f.path.split('/'));
   await mkdir(join(target,'..'),{recursive:true});
   await copyFile(new URL('../'+f.path,import.meta.url),target);
  }
  await mkdir(join(root,'policy'),{recursive:true});
  await writeFile(join(root,'policy','worker-source-lock.json'),JSON.stringify(orig));
  const target=join(root,'src','curated.mjs');const aliased=join(root,'curated-original.mjs');
  await copyFile(target,aliased);await rm(target);
  try{await symlink(aliased,target,'file')}
  catch(e){if(['EPERM','EACCES','ENOSYS'].includes(e.code)){t.diagnostic('Symlink creation unavailable');return}throw e}
  await assert.rejects(()=>verifySourceLock({home:root}),/regular file/);
 }finally{await rm(root,{recursive:true,force:true})}
});
