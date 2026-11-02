import {initializeNavigation} from './navigation-ui.js';
import {executeMacro, validateMacro, generateJavaScript, checkMacro} from './src/engine.mjs';
const $ = id => document.getElementById(id);
const wizard = $('wizard');
const notice = $('notice');
let currentRows = [];
let currentTrace = 0;
let registry = [];
let running = false;
let generatedCode = '';
const fields = ['macro-name','outer-name','outer-start','outer-end','outer-step','inner-name','inner-start','inner-end','inner-step','operation','branchBy'];

function getForm() {
  const value = name => wizard.elements.namedItem(name).value;
  const loop = part => ({name:value(`${part}-name`),start:Number(value(`${part}-start`)),end:Number(value(`${part}-end`)),step:Number(value(`${part}-step`))});
  return {name:value('macro-name'),outer:loop('outer'),inner:loop('inner'),operation:value('operation'),branchBy:value('branchBy')};
}
function setForm(macro){
  const values={'macro-name':macro.name,'outer-name':macro.outer.name,'outer-start':macro.outer.start,'outer-end':macro.outer.end,'outer-step':macro.outer.step,'inner-name':macro.inner.name,'inner-start':macro.inner.start,'inner-end':macro.inner.end,'inner-step':macro.inner.step,operation:macro.operation,branchBy:macro.branchBy};
  for(const field of fields) wizard.elements.namedItem(field).value=values[field];
  $('macro-output').value=JSON.stringify(macro,null,2);
}
function setNotice(message,error=false){notice.textContent=message;notice.classList.toggle('error',error);}
// GitHub Pages is static. Execute declarative applets entirely in this browser.
async function post(path, body) {
  switch (path) {
    case '/api/run': return executeMacro(body);
    case '/api/validate': return { valid:true, metadata:validateMacro(body) };
    case '/api/code': return { source:generateJavaScript(body) };
    case '/api/test': return checkMacro(body);
    default: throw new Error('This endpoint is available only from the local Node.js server');
  }
}
const showPanel=initializeNavigation();

function buildElement(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(cls)el.className=cls;return el;}
function showTrace(){
  const row=currentRows[currentTrace];
  if(!row){$('trace-position').textContent='No iteration';$('selected-trace').textContent='No rows emitted.';return;}
  $('trace-position').textContent=`Iteration ${currentTrace+1} of ${currentRows.length}`;
  $('selected-trace').textContent=`Variables: ${Object.entries(row).filter(([k])=>!['index','result','branch'].includes(k)).map(([k,v])=>`${k} = ${v}`).join('   ·   ')}   →   result = ${row.result}   ·   switch: ${row.branch}`;
  for(const tr of $('trace-body').children)tr.classList.toggle('selected-row',Number(tr.dataset.index)===currentTrace);
}
function renderResults(data,macro){
  currentRows=data.rows;currentTrace=0;
  $('stat-rows').textContent=data.metadata.rows.toLocaleString();
  $('stat-outer').textContent=data.metadata.outerIterations.toLocaleString();
  $('stat-inner').textContent=data.metadata.innerIterations.toLocaleString();
  $('iteration-label').textContent=`${data.metadata.rows} steps`;
  const head=$('trace-head');head.replaceChildren();
  ['#',macro.outer.name,macro.inner.name,'Result','Switch branch'].forEach(h=>head.appendChild(buildElement('th',h)));
  const tbody=$('trace-body');tbody.replaceChildren();
  for(let x=0;x<Math.min(currentRows.length,150);x++){
    const row=currentRows[x],tr=document.createElement('tr');tr.dataset.index=x;
    [row.index,row[macro.outer.name],row[macro.inner.name],row.result,row.branch].forEach(v=>tr.appendChild(buildElement('td',v)));
    tr.addEventListener('click',()=>{currentTrace=x;showTrace()});tbody.appendChild(tr);
  }
  $('trace-limit').textContent=currentRows.length>150?'Showing the first 150 rows. The complete result is available through the API.':'';
  showTrace();
}
async function runApplet({switchTab=false}={}){
  if(running)return;
  running=true;
  $('run').disabled=true;
  try{
    const macro=getForm();
    const [run,code]=await Promise.all([post('/api/run',macro),post('/api/code',macro)]);
    renderResults(run,macro);generatedCode=code.source;$('code-output').textContent=generatedCode;
    $('macro-output').value=JSON.stringify(macro,null,2);
    setNotice(`Success: executed ${run.metadata.rows} iterations without compilation.`);
    if(switchTab)showPanel('visualize');
  }catch(err){setNotice(err.message,true)}finally{running=false;$('run').disabled=false;}
}
$('run').addEventListener('click',()=>runApplet({switchTab:true}));
$('previous').addEventListener('click',()=>{currentTrace=Math.max(0,currentTrace-1);showTrace()});
$('next').addEventListener('click',()=>{currentTrace=Math.min(currentRows.length-1,currentTrace+1);showTrace()});
$('run-tests').addEventListener('click',async()=>{
  const root=$('test-results');root.replaceChildren();
  try{const results=await post('/api/test',getForm());for(const c of results.checks)root.appendChild(buildElement('div',`${c.passed?'✓':'✕'}  ${c.name}`,'test-item'));setNotice(`Test laboratory: ${results.checks.filter(x=>x.passed).length}/${results.checks.length} checks passed.`);}
  catch(err){setNotice(err.message,true);root.appendChild(buildElement('div',err.message));}
});
$('apply-macro').addEventListener('click',async()=>{
  try{const macro=JSON.parse($('macro-output').value);await post('/api/validate',macro);setForm(macro);setNotice('Applied macro JSON to the wizard. No recompilation needed.');showPanel('configure');}
  catch(err){setNotice(err.message,true)}
});
$('download').addEventListener('click',()=>{
  const json=JSON.stringify(getForm(),null,2)+'\n';
  const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([json],{type:'application/json'}));link.download='audk-macro.json';link.click();URL.revokeObjectURL(link.href);
});
async function copy(text){try{await navigator.clipboard.writeText(text);setNotice('Copied to clipboard.')}catch{setNotice('Clipboard requires a secure browser context; select and copy manually.',true)}}
$('copy-code').addEventListener('click',()=>copy(generatedCode));
$('copy-macro').addEventListener('click',()=>copy($('macro-output').value));
$('macro-output').value=JSON.stringify(getForm(),null,2);
async function loadRegistry(){
  try{
    // Only known, reviewed manifests are available in the public demonstration.
    const manifests=['library/nested-loops.json','library/countdown-grid.json','library/digital-crossdock-routing.json','library/inventory-reorder.json','scenarios/digital-crossdock-slot-matrix.json'];
    registry=await Promise.all(manifests.map(async path=>{
      const res=await fetch('./'+path); if(!res.ok)throw new Error('Could not load '+path);
      return await res.json();
    }));
    const list=$('library-list');list.replaceChildren();
    for(const entry of registry){
      const b=document.createElement('button');b.type='button';b.className='library-item';
      b.appendChild(buildElement('strong',entry.config.name));b.appendChild(buildElement('small',entry.description));
      b.addEventListener('click',()=>{if(entry.kind==='pipeline'){window.dispatchEvent(new CustomEvent('audk:load-pipeline',{detail:entry.config}));showPanel('compose');}else{setForm(entry.config);showPanel('configure');}setNotice(`Loaded library applet: ${entry.id}`);for(const el of list.children)el.classList.remove('active');b.classList.add('active');});
      list.appendChild(b);
    }
  }catch(err){setNotice(err.message,true)}
}
loadRegistry();
runApplet();

// Keep exported code and JSON synchronized as the wizard configuration changes.
let previewTimer;
let previewRevision = 0;
wizard.addEventListener('input', () => {
  const revision = ++previewRevision;
  clearTimeout(previewTimer);
  const macro = getForm();
  $('macro-output').value = JSON.stringify(macro, null, 2);
  previewTimer = setTimeout(async () => {
    try {
      const code = await post('/api/code', macro);
      if (revision !== previewRevision) return;
      generatedCode = code.source;
      $('code-output').textContent = generatedCode;
      setNotice('Configuration updated. Generated code and macro are current; run to refresh the trace.');
    } catch (err) {
      if (revision === previewRevision) setNotice(err.message, true);
    }
  }, 170);
});
