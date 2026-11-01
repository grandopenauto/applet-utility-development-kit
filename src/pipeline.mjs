/** AUDK v0.2: bounded, declarative, browser-safe applet composition. */
export const PIPELINE_SCHEMA = 'audk.pipeline.v1';
const MAX_ROWS = 5000;
const MAX_STEPS = 24;
const FIELD = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;
const FORBIDDEN = new Set(['__proto__','constructor','prototype']);
const KINDS = new Set(['crossJoin','map','filter','switch','sort','aggregate']);
const COMPARISONS = new Set(['eq','ne','gt','gte','lt','lte']);
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const isScalar = x => (typeof x==='string' && x.length<=80) || (typeof x==='number' && Number.isFinite(x)) || typeof x==='boolean';
function validField(x) {return typeof x==='string' && FIELD.test(x) && !FORBIDDEN.has(x);}
function assertField(x,label) {if(!validField(x))throw new Error(`${label} must be a safe field name`);}
function assertScalar(x,label) {if(!isScalar(x))throw new Error(`${label} must be a short string, finite number or boolean`);}
function assertArray(x,label) {if(!Array.isArray(x)||x.length===0||x.length>80||!x.every(isScalar))throw new Error(`${label} needs 1–80 scalar values`);}
function rangeSize(s) {
  if(!['start','end','step'].every(k=>Number.isSafeInteger(s[k]) && Math.abs(s[k])<=1e6))throw new Error('Range bounds must be integers within ±1,000,000');
  if(s.step===0)throw new Error('Range step must not be zero');
  if((s.end-s.start)*s.step<0)throw new Error('Range step must point toward end');
  return Math.ceil(Math.abs(s.end-s.start)/Math.abs(s.step));
}
export function validatePipeline(config) {
  if(!isObject(config) || config.schema!==PIPELINE_SCHEMA)throw new Error('Unknown pipeline schema');
  if(typeof config.name!=='string'||config.name.trim().length<1||config.name.length>80)throw new Error('Pipeline name must have 1–80 characters');
  const s=config.input;
  if(!isObject(s)||!['range','list'].includes(s.type))throw new Error('Input must be a range or list');
  assertField(s.field,'Input field');
  let n;
  if(s.type==='range') n=rangeSize(s);
  else {assertArray(s.values,'Input list');n=s.values.length;}
  if(n>MAX_ROWS)throw new Error(`Input exceeds ${MAX_ROWS} rows`);
  if(!Array.isArray(config.steps)||config.steps.length>MAX_STEPS)throw new Error(`Use at most ${MAX_STEPS} applets`);
  const ids=new Set();
  for(let i=0;i<config.steps.length;i++){
    const st=config.steps[i];const at=`Applet ${i+1}`;
    if(!isObject(st)||!KINDS.has(st.type))throw new Error(`${at} has an unsupported type`);
    if(typeof st.id!=='string'||!/^[a-z][a-z0-9-]{0,39}$/.test(st.id)||ids.has(st.id))throw new Error(`${at} needs a unique lowercase ID`);
    ids.add(st.id);
    if(st.type==='crossJoin'){
      assertField(st.field,`${at} field`);assertArray(st.values,`${at} values`);
      n*=st.values.length;
    }else if(st.type==='map'){
      assertField(st.field,`${at} source field`);assertField(st.outputField,`${at} output field`);
      if(!['add','multiply','prefix'].includes(st.operation))throw new Error(`${at}: unsupported map operation`);
      if(st.operation==='prefix'){if(typeof st.value!=='string'||st.value.length>80)throw new Error(`${at}: prefix must be a short string`);}
      else if(typeof st.value!=='number'||!Number.isFinite(st.value)||Math.abs(st.value)>1e9)throw new Error(`${at}: numeric map value required`);
    }else if(st.type==='filter'){
      assertField(st.field,`${at} field`);if(!COMPARISONS.has(st.operator))throw new Error(`${at}: unsupported filter comparator`);
      assertScalar(st.value,`${at} comparison value`);
      if(['gt','gte','lt','lte'].includes(st.operator)&&typeof st.value!=='number')throw new Error(`${at}: ordered comparison needs a number`);
    }else if(st.type==='switch'){
      assertField(st.field,`${at} field`);assertField(st.outputField,`${at} output field`);
      if(st.mode!=='parity')throw new Error(`${at}: supported switch mode is parity`);
    }else if(st.type==='sort'){
      assertField(st.field,`${at} field`);if(!['asc','desc'].includes(st.direction))throw new Error(`${at}: sort direction must be asc or desc`);
    }else if(st.type==='aggregate'){
      if(!['count','sum'].includes(st.operation))throw new Error(`${at}: aggregate operation must be count or sum`);
      if(st.operation==='sum')assertField(st.field,`${at} field`);
      assertField(st.outputField,`${at} output field`);n=1;
    }
    if(n>MAX_ROWS)throw new Error(`${at} would exceed the ${MAX_ROWS}-row safety limit`);
  }
  return {stepCount:config.steps.length,maxEstimatedRows:n};
}
const numeric=(v,name)=>{if(typeof v!=='number'||!Number.isFinite(v))throw new Error(`Field ${name} must contain finite numbers`);return v;};
function passes(a,op,b){
  if(op==='eq')return a===b;if(op==='ne')return a!==b;
  return typeof a==='number'&&Number.isFinite(a)&&({gt:a>b,gte:a>=b,lt:a<b,lte:a<=b})[op];
}
function compare(a,b){if(a===b)return 0;if(a===undefined)return 1;if(b===undefined)return -1;return a>b?1:-1;}
export function runPipeline(config){
  validatePipeline(config);
  const s=config.input;
  let rows=[];
  if(s.type==='range'){
    for(let i=s.start;s.step>0?i<s.end:i>s.end;i+=s.step)rows.push({[s.field]:i});
  }else rows=s.values.map(v=>({[s.field]:v}));
  const trace=[{id:'input',type:'input',count:rows.length,preview:rows.slice(0,12)}];
  for(const st of config.steps){
    switch(st.type){
      case 'crossJoin': rows=rows.flatMap(row=>st.values.map(v=>({...row,[st.field]:v})));break;
      case 'map': rows=rows.map(row=>{
        const original=row[st.field];let value;
        if(st.operation==='prefix')value=st.value+String(original??'');
        else {const n=numeric(original,st.field);value=st.operation==='multiply'?n*st.value:n+st.value; if(!Number.isFinite(value))throw new Error(`Non-finite output from ${st.id}`);}
        return {...row,[st.outputField]:value};
      });break;
      case 'filter':rows=rows.filter(row=>passes(row[st.field],st.operator,st.value));break;
      case 'switch':rows=rows.map(row=>({...row,[st.outputField]:numeric(row[st.field],st.field)%2===0?'even':'odd'}));break;
      case 'sort':rows=[...rows].sort((a,b)=>compare(a[st.field],b[st.field])*(st.direction==='desc'?-1:1));break;
      case 'aggregate':rows=[{[st.outputField]:st.operation==='count'?rows.length:rows.reduce((total,row)=>total+numeric(row[st.field],st.field),0)}];break;
    }
    if(rows.length>MAX_ROWS)throw new Error('Pipeline exceeded row limit');
    trace.push({id:st.id,type:st.type,count:rows.length,preview:rows.slice(0,12)});
  }
  return {name:config.name,rows,trace,metadata:{steps:config.steps.length,rows:rows.length}};
}
/** A standalone readable JavaScript implementation of a reviewed macro. */
export function generatePipelineCode(config){
  validatePipeline(config);
  const q=x=>JSON.stringify(x);
  const s=config.input;
  const lines=[`// AUDK — ${config.name.replace(/[\r\n]/g,' ')} (generated JavaScript)`,`// This code is standalone; the JSON macro runs without recompilation.`,`export function runApplet() {`];
  if(s.type==='range'){
    lines.push('  let rows = [];',`  for (let n=${s.start}; ${s.step}>0 ? n<${s.end} : n>${s.end}; n+=(${s.step})) rows.push({[${q(s.field)}]:n});`);
  }else lines.push(`  let rows = ${q(s.values)}.map(value => ({[${q(s.field)}]:value}));`);
  for(const st of config.steps){
    const f=q(st.field),o=q(st.outputField);
    lines.push(`  // ${st.id} · ${st.type}`);
    switch(st.type){
      case 'crossJoin':lines.push(`  rows = rows.flatMap(row => ${q(st.values)}.map(value => ({...row,[${f}]:value})));`);break;
      case 'map':{
        const expr=st.operation==='prefix'?`${q(st.value)} + String(row[${f}] ?? '')`:st.operation==='add'?`row[${f}] + (${q(st.value)})`:`row[${f}] * (${q(st.value)})`;
        lines.push(`  rows = rows.map(row => ({...row,[${o}]:${expr}}));`);break;
      }
      case 'filter':{
        const comp={eq:'===',ne:'!==',gt:'>',gte:'>=',lt:'<',lte:'<='}[st.operator];
        lines.push(`  rows = rows.filter(row => row[${f}] ${comp} ${q(st.value)});`);break;
      }
      case 'switch':lines.push(`  rows = rows.map(row => ({...row,[${o}]:row[${f}] % 2 === 0 ? 'even' : 'odd'}));`);break;
      case 'sort':lines.push(`  rows = [...rows].sort((a,b) => (a[${f}] === b[${f}] ? 0 : a[${f}] === undefined ? 1 : b[${f}] === undefined ? -1 : a[${f}] > b[${f}] ? 1 : -1) * ${st.direction==='desc'?-1:1});`);break;
      case 'aggregate':lines.push(st.operation==='count'?`  rows = [{[${o}]:rows.length}];`:`  rows = [{[${o}]:rows.reduce((total,row)=>total+row[${f}],0)}];`);break;
    }
  }
  lines.push('  return rows;','}','');
  return lines.join('\n');
}

export const EXAMPLE_PIPELINE=Object.freeze({
  schema:PIPELINE_SCHEMA,name:'Digital CrossDock door-slot routing',
  input:{type:'range',field:'door',start:1,end:5,step:1},
  steps:[
    {id:'time-slots',type:'crossJoin',field:'slot',values:['08:00','09:00','10:00','11:00']},
    {id:'priority-doors',type:'filter',field:'door',operator:'gte',value:2},
    {id:'door-lane',type:'switch',field:'door',mode:'parity',outputField:'lane'},
    {id:'sort-door',type:'sort',field:'door',direction:'asc'}
  ]
});
