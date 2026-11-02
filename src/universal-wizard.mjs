/** AUDK v0.6 — reviewed, declarative Python functions to portable applet candidates.
 * Discovery does not grant execution privileges. Only functions in RECIPES can run.
 */
export const UNIVERSAL_SCHEMA='audk.universal.v1';
const number=(name,label,def,min,max,integer=false)=>({name,label,type:integer?'integer':'number',default:def,min,max});
const numbers=(def)=>({name:'numbers',label:'Numeric values (JSON array)',type:'numberArray',default:def,minItems:1,maxItems:64,min:-1e9,max:1e9});
export const UNIVERSAL_RECIPES=Object.freeze([
 {id:'math.sqrt',title:'Square root',category:'Mathematics',description:'Compute the nonnegative square root of a number',fields:[number('value','Input number',144,0,1e12)],examples:[{label:'Square root of 144',args:{value:144}},{label:'Square root of 2',args:{value:2}}]},
 {id:'math.factorial',title:'Factorial',category:'Mathematics',description:'Multiply all positive integers through n (bounded to exact JavaScript integers)',fields:[number('value','Integer n',6,0,18,true)],examples:[{label:'6 factorial',args:{value:6}},{label:'0 factorial',args:{value:0}}]},
 {id:'math.gcd',title:'Greatest common divisor',category:'Mathematics',description:'Find the greatest common divisor of two nonnegative integers',fields:[number('a','First integer',48,0,1000000,true),number('b','Second integer',18,0,1000000,true)],examples:[{label:'48 and 18',args:{a:48,b:18}}]},
 {id:'statistics.mean',title:'Mean',category:'Statistics',description:'Calculate the arithmetic mean of a bounded numeric list',fields:[numbers([2,4,6,8])],examples:[{label:'Mean of 2, 4, 6, 8',args:{numbers:[2,4,6,8]}}]},
 {id:'statistics.median',title:'Median',category:'Statistics',description:'Calculate the median of a bounded numeric list',fields:[numbers([1,5,3,9])],examples:[{label:'Median of 1, 5, 3, 9',args:{numbers:[1,5,3,9]}}]},
 {id:'builtins.sum',title:'Sum',category:'Collections',description:'Add numeric values together',fields:[numbers([10,20,30])],examples:[{label:'Sum of 10, 20, 30',args:{numbers:[10,20,30]}}]},
 {id:'builtins.sorted',title:'Sort numbers',category:'Collections',description:'Sort numeric values in ascending or descending order',fields:[numbers([8,2,5,1]),{name:'descending',label:'Descending',type:'boolean',default:false}],examples:[{label:'Ascending numbers',args:{numbers:[8,2,5,1],descending:false}},{label:'Descending numbers',args:{numbers:[8,2,5,1],descending:true}}]},
 {id:'builtins.len',title:'Text length',category:'Text',description:'Count Unicode code points in a text string',fields:[{name:'text',label:'Text',type:'string',default:'Digital CrossDock',maxLength:256}],examples:[{label:'Digital CrossDock',args:{text:'Digital CrossDock'}}]}
]);
const getRecipe=id=>UNIVERSAL_RECIPES.find(r=>r.id===id);
const validId=id=>typeof id==='string'&&/^[a-z][a-z0-9-]{2,49}$/.test(id);
const reasonableText=(s,max,label)=>{if(typeof s!=='string'||!s.trim()||s.length>max)throw Error(`${label} must be between 1 and ${max} characters`);return s.trim();};
function cleanArg(field,v){
 if(field.type==='boolean'){if(typeof v!=='boolean')throw Error(`${field.label} must be true or false`);return v;}
 if(field.type==='string'){if(typeof v!=='string'||v.length>field.maxLength)throw Error(`${field.label} exceeds its ${field.maxLength} character limit`);return v;}
 if(field.type==='numberArray'){
  if(!Array.isArray(v)||v.length<field.minItems||v.length>field.maxItems)throw Error(`${field.label} requires ${field.minItems}–${field.maxItems} items`);
  return v.map((n,i)=>{if(typeof n!=='number'||!Number.isFinite(n)||n<field.min||n>field.max)throw Error(`${field.label} item ${i+1} is not a bounded finite number`);return n;});
 }
 if(typeof v!=='number'||!Number.isFinite(v)||v<field.min||v>field.max||(field.type==='integer'&&!Number.isSafeInteger(v)))throw Error(`${field.label} must be ${field.type==='integer'?'an integer':'a number'} between ${field.min} and ${field.max}`);
 return v;
}
export function validateUniversalConfig(config){
 if(!config||typeof config!=='object'||Array.isArray(config))throw Error('Applet configuration is required');
 if(config.schema!==UNIVERSAL_SCHEMA)throw Error('Unsupported universal applet schema');
 if(!validId(config.id))throw Error('Applet ID must be lowercase kebab-case (3–50 characters)');
 const name=reasonableText(config.name,80,'Name');
 const description=reasonableText(config.description,300,'Description');
 const recipe=getRecipe(config.functionId);
 if(!recipe)throw Error('Function is not in the reviewed AUDK allowlist');
 const supplied=config.arguments??{};
 if(!supplied||typeof supplied!=='object'||Array.isArray(supplied))throw Error('Arguments must be an object');
 if(Object.keys(supplied).some(k=>!recipe.fields.some(f=>f.name===k)))throw Error('Unexpected argument key');
 const args=Object.fromEntries(recipe.fields.map(f=>[f.name,cleanArg(f,Object.hasOwn(supplied,f.name)?supplied[f.name]:f.default)]));
 return {schema:UNIVERSAL_SCHEMA,id:config.id,name,description,functionId:recipe.id,arguments:args};
}
function factorial(n){let acc=1;for(let i=2;i<=n;i++)acc*=i;return acc;}
function gcd(a,b){while(b){const tmp=b;b=a%b;a=tmp;}return a;}
function median(numbers){const sorted=[...numbers].sort((a,b)=>a-b),half=Math.floor(sorted.length/2);return sorted.length%2?sorted[half]:(sorted[half-1]+sorted[half])/2;}
export function executeUniversal(config){
 const c=validateUniversalConfig(config),a=c.arguments;
 switch(c.functionId){
  case 'math.sqrt':return Math.sqrt(a.value);
  case 'math.factorial':return factorial(a.value);
  case 'math.gcd':return gcd(a.a,a.b);
  case 'statistics.mean':return a.numbers.reduce((acc,x)=>acc+x,0)/a.numbers.length;
  case 'statistics.median':return median(a.numbers);
  case 'builtins.sum':return a.numbers.reduce((acc,x)=>acc+x,0);
  case 'builtins.sorted':return [...a.numbers].sort((a,b)=>c.arguments.descending?b-a:a-b);
  case 'builtins.len':return [...a.text].length;
  default:throw Error('Unsupported reviewed function');
 }
}
const JS_BODIES={
 'math.sqrt':'return Math.sqrt(args.value);',
 'math.factorial':'let value=1;for(let i=2;i<=args.value;i++)value*=i;return value;',
 'math.gcd':'let a=args.a,b=args.b;while(b){const t=b;b=a%b;a=t;}return a;',
 'statistics.mean':'return args.numbers.reduce((s,n)=>s+n,0)/args.numbers.length;',
 'statistics.median':'const list=[...args.numbers].sort((a,b)=>a-b);const mid=Math.floor(list.length/2);return list.length%2?list[mid]:(list[mid-1]+list[mid])/2;',
 'builtins.sum':'return args.numbers.reduce((s,n)=>s+n,0);',
 'builtins.sorted':'return [...args.numbers].sort((a,b)=>args.descending?b-a:a-b);',
 'builtins.len':'return [...args.text].length;'
};
const PY_BODIES={
 'math.sqrt':'return math.sqrt(args["value"])',
 'math.factorial':'return math.factorial(args["value"])',
 'math.gcd':'return math.gcd(args["a"], args["b"])',
 'statistics.mean':'return statistics.mean(args["numbers"])',
 'statistics.median':'return statistics.median(args["numbers"])',
 'builtins.sum':'return sum(args["numbers"])',
 'builtins.sorted':'return sorted(args["numbers"], reverse=args["descending"])',
 'builtins.len':'return len(args["text"])'
};
export function generateUniversalJavaScript(config){
 const c=validateUniversalConfig(config);
 return `// AUDK v0.6 — Reviewed function: ${c.functionId}\n// Candidate for code review, not an automatically installed applet.\nexport function runApplet(){\n  const args=${JSON.stringify(c.arguments,null,2)};\n  ${JS_BODIES[c.functionId]}\n}\n`;
}
export function generateUniversalPython(config){
 const c=validateUniversalConfig(config);
 return `# AUDK v0.6 — Reviewed function: ${c.functionId}\n# Local Python 3.10+. No dynamic imports, eval, shell or network calls.\nimport json\nimport math\nimport statistics\n\n_CONFIG=json.loads(${JSON.stringify(JSON.stringify(c.arguments))})\n\ndef run_applet():\n    args = _CONFIG\n    ${PY_BODIES[c.functionId]}\n\nif __name__ == "__main__":\n    print(json.dumps(run_applet(), ensure_ascii=False, allow_nan=False))\n`;
}
export function buildUniversalCandidate(config){
 const c=validateUniversalConfig(config),result=executeUniversal(c),recipe=getRecipe(c.functionId);
 const manifest={schema:c.schema,id:c.id,kind:'universal-function',version:'0.6.0',status:'candidate-review-required',name:c.name,description:c.description,functionId:c.functionId,arguments:c.arguments,capabilities:['pure-computation'],runtime:['browser','node','python'],permission:'none'};
 const js=generateUniversalJavaScript(c),py=generateUniversalPython(c);
 const testSource=`import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {runApplet} from './${c.id}.mjs';\ntest(${JSON.stringify(c.name+' generated output')},()=>{\n  assert.deepEqual(runApplet(), ${JSON.stringify(result)});\n});\n`;
 return {manifest,recipe:{id:recipe.id,title:recipe.title,description:recipe.description,fields:recipe.fields},result,javaScript:js,python:py,testSource,exampleCount:recipe.examples.length};
}
