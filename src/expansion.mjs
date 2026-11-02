/** AUDK v1.0 discovery-to-review planning. Metadata only; never invoke discovered callables. */
import {UNIVERSAL_RECIPES} from './universal-wizard.mjs';

export const EXPANSION_SCHEMA='audk.expansion-queue.v1';
const REVIEWED=new Set(UNIVERSAL_RECIPES.map(x=>x.id));
const HIGH_RISK_NAMES=new Set([
 'builtins.eval','builtins.exec','builtins.compile','builtins.open','builtins.input',
 'builtins.breakpoint','builtins.__import__','builtins.setattr','builtins.delattr',
 'builtins.globals','builtins.locals','builtins.vars','builtins.help','builtins.exit',
 'builtins.quit','json.dump','json.load','operator.setitem','operator.delitem',
 'operator.attrgetter','operator.methodcaller','operator.call','operator.getitem',
 'operator.iadd','operator.iand','operator.iconcat','operator.ifloordiv','operator.ilshift',
 'operator.imatmul','operator.imod','operator.imul','operator.ior','operator.ipow',
 'operator.irshift','operator.isub','operator.itruediv','operator.ixor'
]);
const MODULES=new Set(['builtins','math','statistics','itertools','functools','operator','json']);
const SIMPLE=new Set(['math','statistics']);
const NAME=/^[a-z_][a-z0-9_]*$/i;
const safeText=(input,max=240)=>String(input??'').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max);

export function rateCandidate(entry){
 if(!entry||!MODULES.has(entry.module)||!NAME.test(entry.name)||typeof entry.signature!=='string') throw Error('Invalid or unallowlisted discovery metadata');
 const id=`${entry.module}.${entry.name}`;
 if(REVIEWED.has(id))return {state:'already-supported',risk:'none',priority:0,reason:'Existing reviewed wizard'};
 const uninspectable=entry.signature.includes('signature unavailable');
 const classLike=(entry.kind!==undefined&&entry.kind!=='function')||/^[A-Z]/.test(entry.name);
 const blocked=HIGH_RISK_NAMES.has(id)||classLike||uninspectable;
 if(blocked)return {state:'requires-special-review',risk:'elevated',priority:0,reason:classLike?'Callable class or non-function':uninspectable?'Signature unavailable':'Potential side effects or powerful access'};
 if(SIMPLE.has(entry.module))return {state:'review-candidate',risk:'lower',priority:90,reason:'Pure numeric/statistical function candidate; check ranges and edge cases'};
 if(entry.module==='operator')return {state:'review-candidate',risk:'moderate',priority:76,reason:'Operator candidate; confirm mutation/identity/operand behavior'};
 if(entry.module==='builtins')return {state:'review-candidate',risk:'moderate',priority:66,reason:'Builtin candidate; verify types, iteration bounds and side effects'};
 if(entry.module==='json')return {state:'review-candidate',risk:'moderate',priority:64,reason:'Data conversion candidate; bound depth and payload sizes'};
 return {state:'requires-special-review',risk:'moderate',priority:15,reason:'Stateful iterator, decorator or special adapter likely needed'};
}

export function proposeFields(signature){
 const parameters=[];
 const raw=String(signature||'');
 if(!raw.startsWith('(')||raw.includes('signature unavailable'))return parameters;
 // Suggestions only: never evaluate defaults or use strings as expressions.
 for(const token of raw.slice(1,Math.min(raw.length,241)).replace(/\)$/, '').split(',')){
  const part=token.trim();
  if(!part||part==='/'||part==='*')continue;
  const field=part.match(/^([a-z_][a-z0-9_]*)\s*(?:[=:]|$)/i);
  if(!field)continue;
  const name=field[1];
  if(parameters.some(f=>f.name===name)||parameters.length>=8)continue;
  const guessedType=/^(n|k|ndigits|start|stop|step|base|digits|precision)$/.test(name)?'integer':/^(text|s|string|sep|separator)$/.test(name)?'text':/^(values|iterable|numbers|items|data|seq|sequence)$/.test(name)?'array':'unknown';
  parameters.push({name,suggestedType:guessedType,required:!part.includes('='),reviewRequired:true});
 }
 return parameters;
}

export function buildExpansionQueue(discovery){
 if(discovery?.schema!=='audk.discovery.v1'||!Array.isArray(discovery.entries)||discovery.entries.length>1200||!Array.isArray(discovery.modules))throw Error('Invalid Python discovery catalog');
 if(discovery.modules.some(m=>!MODULES.has(m)))throw Error('Disallowed discovery module');
 const ids=new Set();const candidates=[];let supported=0;
 for(const entry of discovery.entries){
  if(!MODULES.has(entry.module)||!NAME.test(entry.name)||entry.module==='__proto__')throw Error('Invalid discovery entry');
  const id=`${entry.module}.${entry.name}`;
  if(ids.has(id))throw Error('Duplicate discovered callable: '+id);
  ids.add(id);
  const rate=rateCandidate(entry);
  if(rate.state==='already-supported'){supported++;continue;}
  const suggestion={
   id, module:entry.module, function:entry.name, signature:safeText(entry.signature),summary:safeText(entry.summary),
   state:rate.state,risk:rate.risk,priority:rate.priority,reason:rate.reason,
   proposedFields:rate.state==='review-candidate'?proposeFields(entry.signature):[],
   proposedChecks:['Confirm semantics against official Python documentation','Validate input types, limits and edge cases','Compare Python and JavaScript output for supported inputs','Review security and side effects before registry promotion'],
   runtimeEnabled:false,autoPublish:false
  };
  candidates.push(suggestion);
 }
 candidates.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
 return {
  schema:EXPANSION_SCHEMA,
  snapshot:{schema:discovery.schema,pythonVersion:safeText(discovery.pythonVersion,40),moduleCount:discovery.modules.length,discovered:discovery.entries.length},
  summary:{discovered:discovery.entries.length,alreadySupported:supported,reviewCandidates:candidates.filter(x=>x.state==='review-candidate').length,specialReview:candidates.filter(x=>x.state==='requires-special-review').length},
  policy:{execution:'disabled',publication:'human-reviewed pull request only',purpose:'Non-executable development planning; heuristic estimates'},
  candidates
 };
}

export function validateExpansionQueue(queue){
 if(queue?.schema!==EXPANSION_SCHEMA||!Array.isArray(queue.candidates)||queue.candidates.length>1200)throw Error('Invalid expansion queue');
 for(const c of queue.candidates){
  if(c.runtimeEnabled!==false||c.autoPublish!==false||!['review-candidate','requires-special-review'].includes(c.state))throw Error('Unsafe candidate state');
  if(!MODULES.has(c.module)||c.id!==`${c.module}.${c.function}`||!NAME.test(c.function))throw Error('Invalid candidate name');
 }
 return true;
}
