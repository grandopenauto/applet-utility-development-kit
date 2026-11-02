/** AUDK v1.8: portable, inert build requests for offline human-operator intake.
 * Browser safe: no Node modules, no network, and no code execution.
 */
export const BUILD_HANDOFF_SCHEMA='audk.build-handoff.v1';
const ID=/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/i;
const KEY=/^[a-zA-Z0-9_-]{12,80}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ownKeys=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&
 Object.keys(obj).length===keys.length&&Object.keys(obj).every(key=>keys.includes(key));
const POLICY=Object.freeze({operatorApprovalRequired:true,automaticExecution:false,automaticPublication:false});

/** Prepare downloadable metadata only. All inputs are treated as untrusted at import. */
export function createBuildHandoff({functionId,mode,idempotencyKey,requestId,createdAt}={}){
 const doc={schema:BUILD_HANDOFF_SCHEMA,requestId,createdAt,
  request:{functionId,mode,idempotencyKey},policy:{...POLICY}};
 validateBuildHandoff(doc);
 return doc;
}

/** Enforce one unambiguous serialized shape; never accept code, URLs or privileges. */
export function validateBuildHandoff(doc,{now=Date.now(),maxAgeMs=14*86400000}={}){
 if(!ownKeys(doc,['schema','requestId','createdAt','request','policy'])||doc.schema!==BUILD_HANDOFF_SCHEMA)
  throw Error('Invalid build handoff schema or extra fields');
 if(typeof doc.requestId!=='string'||!UUID.test(doc.requestId))throw Error('Invalid handoff request ID');
 if(typeof doc.createdAt!=='string')throw Error('Invalid handoff timestamp');
 const ms=Date.parse(doc.createdAt);
 if(!Number.isFinite(ms)||new Date(ms).toISOString()!==doc.createdAt||ms>now+300000||ms<now-maxAgeMs)
  throw Error('Expired, future or noncanonical handoff timestamp');
 if(!ownKeys(doc.request,['functionId','mode','idempotencyKey'])||
   !ID.test(doc.request.functionId??'')||!KEY.test(doc.request.idempotencyKey??'')||
   !['reviewed-build','specification'].includes(doc.request.mode))
  throw Error('Invalid or extended build request');
 if(!ownKeys(doc.policy,['operatorApprovalRequired','automaticExecution','automaticPublication'])||
   doc.policy.operatorApprovalRequired!==true||doc.policy.automaticExecution!==false||doc.policy.automaticPublication!==false)
  throw Error('Unsafe handoff policy');
 return {functionId:doc.request.functionId,mode:doc.request.mode,idempotencyKey:doc.request.idempotencyKey};
}
