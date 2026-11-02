/** AUDK v1.4: restricted-worker admission. Defense in depth, NOT a sandbox. */
import {execFileSync} from 'node:child_process';
import {readFile,lstat,realpath} from 'node:fs/promises';
import {join,resolve,isAbsolute,dirname,parse,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const HOME=resolve(fileURLToPath(new URL('..',import.meta.url)));
const SID=/S-1-5-(?:\d+-)+\d+/g;
const USER_SID=/^S-1-5-21-(?:\d+-){3}\d+$/;
const BAD_GROUPS=new Set(['S-1-5-32-544','S-1-5-32-548','S-1-5-32-549','S-1-5-32-550','S-1-5-32-551','S-1-5-32-552','S-1-5-18']);
const BAD_PRIVS=['SeDebugPrivilege','SeTcbPrivilege','SeBackupPrivilege','SeRestorePrivilege','SeTakeOwnershipPrivilege','SeCreateTokenPrivilege','SeLoadDriverPrivilege','SeAssignPrimaryTokenPrivilege','SeImpersonatePrivilege'];
const sha=value=>createHash('sha256').update(value).digest('hex');

/** Strictly require a *dedicated* unprivileged local or domain user; not SYSTEM/LocalService/admin. */
export function assessIdentity({accountSid,allowedSid,groupSids=[],privileges=[]}){
 if(typeof allowedSid!=='string'||!USER_SID.test(allowedSid))throw Error('AUDK_WORKER_ALLOWED_SID must identify a dedicated user SID');
 if(accountSid!==allowedSid)throw Error('Worker identity does not match pinned allowed SID');
 if(!Array.isArray(groupSids)||!Array.isArray(privileges))throw Error('Identity audit incomplete');
 if(groupSids.some(sid=>BAD_GROUPS.has(sid)))throw Error('Privileged local group membership denied');
 if(privileges.some(p=>BAD_PRIVS.includes(p)))throw Error('Privileged token right denied');
 return {identity:'dedicated-non-admin',accountSid,privilegedGroupCount:0,restricted:true};
}

export function parseIdentityOutput(user,groups,privs){
 const accountSids=String(user).match(SID)||[];
 const allGroupSids=String(groups).match(SID)||[];
 const privileges=BAD_PRIVS.filter(x=>new RegExp('(^|[^A-Za-z])'+x+'([^A-Za-z]|$)').test(String(privs)));
 if(accountSids.length!==1||!String(groups).trim()||!String(privs).trim())throw Error('Incomplete whoami identity probe');
 return {accountSid:accountSids[0],groupSids:allGroupSids,privileges};
}

export function probeWindowsIdentity({exec=execFileSync}={}){
 if(process.platform!=='win32')throw Error('Restricted worker execution is Windows-only');
 const command=args=>String(exec('whoami.exe',args,{encoding:'utf8',timeout:6000,maxBuffer:65536,windowsHide:true}));
 return parseIdentityOutput(command(['/user','/fo','csv','/nh']),command(['/groups','/fo','csv','/nh']),command(['/priv','/fo','csv','/nh']));
}

/** Reject symlink/junction indirection in the source, job root, and their ancestors.
 * This is filesystem-confusion defense in depth, NOT an operating-system sandbox.
 */
async function canonicalDirectory(path){
 const input=resolve(path),root=parse(input).root;
 let current=input;
 while(true){
  const info=await lstat(current);
  if(info.isSymbolicLink())throw Error('Worker source/data paths cannot use symlinks or junctions');
  if(current===input&&!info.isDirectory())throw Error('Worker path must be a directory');
  if(current===root)break;
  const parent=dirname(current);
  if(parent===current)break;
  current=parent;
 }
 return await realpath(input);
}

export async function verifyWorkerFilesystem({source=HOME,storage}={}){
 requireWorkerLocation({source,storage});
 const s=await canonicalDirectory(source),d=await canonicalDirectory(storage);
 const rel=relative(s,d),reverse=relative(d,s);
 if(!rel||!reverse||(!rel.startsWith('..')&&!isAbsolute(rel))||(!reverse.startsWith('..')&&!isAbsolute(reverse)))
  throw Error('Worker canonical source and job roots must be separate');
 return {pathConfinement:'canonical-disjoint',reparsePoints:'denied'};
}

export async function verifySourceLock({home=HOME,manifest='policy/worker-source-lock.json'}={}){
 const root=resolve(home);
 const lockPath=resolve(root,manifest);
 if(!lockPath.startsWith(root+'\\')&&!lockPath.startsWith(root+'/'))throw Error('Source lock must be inside checkout');
 if((await lstat(lockPath)).isSymbolicLink())throw Error('Worker source-lock manifest cannot be a symlink');
 const lock=JSON.parse(await readFile(lockPath,'utf8'));
 if(lock.schema!=='audk.worker-source-lock.v1'||!Array.isArray(lock.files)||lock.files.length<6||lock.files.length>25)throw Error('Worker source lock schema invalid');
 const names=new Set();
 for(const record of lock.files){
  if(typeof record.path!=='string'||!(/^(src|catalog|scripts)\/[a-zA-Z0-9_./-]+$/).test(record.path)||record.path.includes('..')||names.has(record.path)||!(/^[a-f0-9]{64}$/).test(record.sha256))throw Error('Worker source lock record rejected');
  names.add(record.path);
  const abs=join(root,...record.path.split('/'));
  const directory=dirname(abs);
  let current=directory;
  while(current!==root){
   if((await lstat(current)).isSymbolicLink())throw Error('Pinned source directory cannot be a junction');
   const parent=dirname(current);if(parent===current)throw Error('Pinned source path escaped checkout');current=parent;
  }
  const info=await lstat(abs);
  if(!info.isFile()||info.isSymbolicLink())throw Error('Pinned source must be a regular file');
  const bytes=await readFile(abs);
  if(sha(bytes)!==record.sha256)throw Error('Worker source integrity mismatch: '+record.path);
 }
 for(const path of ['src/build-service.mjs','src/build-evidence.mjs','src/universal-wizard.mjs','src/curated.mjs','src/assembly-line.mjs','catalog/assembly-plan.json']){
  if(!names.has(path))throw Error('Required worker source file not locked: '+path);
 }
 return {verifiedFiles:names.size,sourceIntegrity:'pass'};
}

export function requireWorkerLocation({source=HOME,storage}){
 if(typeof storage!=='string'||!isAbsolute(storage))throw Error('Worker data path must be absolute');
 const s=resolve(source),d=resolve(storage);
 if(d===s||d.startsWith(s+'\\')||d.startsWith(s+'/')||s.startsWith(d+'\\')||s.startsWith(d+'/'))throw Error('Source and job roots must be separate');
 return {source:s,storage:d};
}

export async function checkRestrictedWorker({allowedSid,storage,identity,home=HOME}={}){
 requireWorkerLocation({source:home,storage});
 const filesystem=await verifyWorkerFilesystem({source:home,storage});
 const verified=await verifySourceLock({home});
 const evaluated=assessIdentity({...identity,allowedSid});
 return {...filesystem,...verified,...evaluated,publication:'disabled',codePolicy:'reviewed-recipes-only'};
}
