/** AUDK declarative, bounded loop-macro interpreter. No eval or OS commands. */
export const DEFAULT_MACRO = {name:'Nested-loop diagnostic',outer:{name:'i',start:1,end:4,step:1},inner:{name:'j',start:1,end:5,step:1},operation:'product',branchBy:'sumParity'};
const MAX_ROWS=5000;
const reserved=new Set('break case catch class const continue debugger default delete do else export extends false finally for function if import in instanceof let new null return super switch this throw true try typeof var void while with yield await arguments eval'.split(' '));
function record(v){return v!==null&&typeof v==='object'&&!Array.isArray(v)}
function loopCount(loop,label){
 if(!record(loop))throw Error(label+' must be an object');
 if(typeof loop.name!=='string'||!/^[A-Za-z_$][A-Za-z\d_$]*$/.test(loop.name)||reserved.has(loop.name))throw Error(label+' needs a valid variable name');
 for(const k of ['start','end','step'])if(!Number.isSafeInteger(loop[k])||Math.abs(loop[k])>1000000)throw Error(label+'.'+k+' must be an integer within one million');
 if(!loop.step)throw Error(label+' step cannot be zero');
 if((loop.end-loop.start)*loop.step<0)throw Error(label+' step points away from end');
 const count=Math.ceil(Math.abs(loop.end-loop.start)/Math.abs(loop.step));
 if(count>MAX_ROWS)throw Error(label+' exceeds iteration limit');
 return count;
}
export function validateMacro(m){
 if(!record(m)||typeof m.name!=='string'||!m.name.trim()||m.name.length>80)throw Error('Macro name must be 1–80 characters');
 const outerIterations=loopCount(m.outer,'outer'),innerIterations=loopCount(m.inner,'inner');
 if(m.outer.name===m.inner.name)throw Error('Loop variables must differ');
 if(!['pair','sum','product','difference'].includes(m.operation))throw Error('Unknown operation');
 if(!['none','sumParity'].includes(m.branchBy))throw Error('Unknown branch');
 const rows=outerIterations*innerIterations;
 if(rows>MAX_ROWS)throw Error('Too many emitted rows (max 5000)');
 return {rows,outerIterations,innerIterations};
}
export function executeMacro(m){
 const metadata=validateMacro(m),rows=[];
 const o=m.outer,i=m.inner;
 for(let a=o.start;o.step>0?a<o.end:a>o.end;a+=o.step){
  for(let b=i.start;i.step>0?b<i.end:b>i.end;b+=i.step){
   const result=m.operation==='pair'?String(a)+','+String(b):m.operation==='sum'?a+b:m.operation==='product'?a*b:a-b;
   const branch=m.branchBy==='sumParity'?((a+b)%2===0?'even':'odd'):'all';
   rows.push({index:rows.length+1,[o.name]:a,[i.name]:b,result,branch});
  }
 }
 return {rows,metadata};
}
export function generateJavaScript(m){
 validateMacro(m);
 const o=m.outer.name,i=m.inner.name, outer=m.outer,inner=m.inner;
 const expression=({pair:"String("+o+") + ',' + String("+i+")",sum:o+' + '+i,product:o+' * '+i,difference:o+' - '+i})[m.operation];
 const cmp=l=>l.step>0?'<':'>';
 const branch=m.branchBy==='sumParity'?"(("+o+" + "+i+") % 2 === 0 ? 'even' : 'odd')":"'all'";
 return [
  '// AUDK v0.1 generated JavaScript — portable example',
  'export function runApplet() {',
  '  const rows = [];',
  '  for (let '+o+' = '+outer.start+'; '+o+' '+cmp(outer)+' '+outer.end+'; '+o+' += '+outer.step+') {',
  '    for (let '+i+' = '+inner.start+'; '+i+' '+cmp(inner)+' '+inner.end+'; '+i+' += '+inner.step+') {',
  '      const branch = '+branch+';',
  '      rows.push({index: rows.length+1, '+o+', '+i+', result: '+expression+', branch});',
  '    }',
  '  }',
  '  return rows;',
  '}',''
 ].join('\n');
}
export function checkMacro(m){
 const metadata=validateMacro(m),rows=executeMacro(m).rows;
 const checks=[
  {name:'Configuration validated',passed:true},
  {name:'Iteration count matches expected',passed:rows.length===metadata.rows},
  {name:'Sequential trace indices',passed:rows.every((r,i)=>r.index===i+1)},
  {name:'Every row has a valid switch branch',passed:rows.every(r=>['all','even','odd'].includes(r.branch))}
 ];
 return {passed:checks.every(c=>c.passed),checks,rows:metadata.rows};
}
