import {EXAMPLE_PIPELINE,PIPELINE_SCHEMA,runPipeline,validatePipeline,generatePipelineCode} from './src/pipeline.mjs';
import {generatePipelinePython} from './src/python-export.mjs';
const $=id=>document.getElementById(id);
const clone=x=>JSON.parse(JSON.stringify(x));
const inventory={schema:PIPELINE_SCHEMA,name:'Inventory reorder diagnostic',input:{type:'list',field:'quantity',values:[2,4,6,8,10]},steps:[{id:'double-stock',type:'map',field:'quantity',operation:'multiply',value:2,outputField:'units'},{id:'minimum',type:'filter',field:'units',operator:'gte',value:10},{id:'total',type:'aggregate',operation:'sum',field:'units',outputField:'totalUnits'}]};
let config=clone(EXAMPLE_PIPELINE), result=null, code='', pythonCode='';
let activeTab='trace', editRevision=0;
const allowed=['crossJoin','map','filter','switch','sort','aggregate'];
const types={crossJoin:'Cross join',map:'Map / transform',filter:'Filter',switch:'Switch / branch',sort:'Sort',aggregate:'Aggregate'};
const presets={
 crossJoin:()=>({type:'crossJoin',field:'slot',values:['08:00','09:00']}),
 map:()=>({type:'map',field:'door',operation:'multiply',value:2,outputField:'scaledDoor'}),
 filter:()=>({type:'filter',field:'door',operator:'gte',value:2}),
 switch:()=>({type:'switch',field:'door',mode:'parity',outputField:'lane'}),
 sort:()=>({type:'sort',field:'door',direction:'asc'}),
 aggregate:()=>({type:'aggregate',operation:'count',outputField:'count'})
};
function status(s,bad=false){$('composer-status').textContent=s;$('composer-status').classList.toggle('error',bad);}
const make=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=String(text);return node};
function fieldRow(label,value,change,options){
 const wrap=make('label','flow-field');wrap.appendChild(document.createTextNode(label));
 const ctrl=make(options?'select':'input');
 if(options){for(const [value,label] of options){const op=make('option',null,label);op.value=value;ctrl.append(op);}}else ctrl.type='text';
 ctrl.value=String(value??'');
 ctrl.addEventListener('change',()=>change(ctrl.value));
 wrap.append(ctrl);return wrap;
}
const textField=(label,field,obj)=>fieldRow(label,obj[field],v=>{obj[field]=v;refresh();});
const numField=(label,field,obj)=>fieldRow(label,obj[field],v=>{obj[field]=v.trim()===''?null:Number(v);refresh();});
function showForm(){
 $('flow-name').value=config.name;
 $('flow-source-type').value=config.input.type;
 $('flow-source-field').value=config.input.field;
 $('flow-range-controls').hidden=config.input.type!=='range';
 $('flow-list-controls').hidden=config.input.type!=='list';
 for(const f of ['start','end','step'])$('flow-range-'+f).value=config.input[f]??'';
 $('flow-list-json').value=JSON.stringify(config.input.values??[],null,2);
 const area=$('flow-steps');area.replaceChildren();
 config.steps.forEach((step,index)=>{
   const card=make('article','flow-step');
   const head=make('div','flow-step-head');
   head.append(make('span','step-count',String(index+1)));
   const title=make('select','flow-type');
   for(const k of allowed){const op=make('option',null,types[k]);op.value=k;title.appendChild(op);}title.value=step.type;
   title.setAttribute('aria-label',`Applet ${index+1} type`);
   title.addEventListener('change',()=>{const next={id:step.id,...presets[title.value]()};config.steps[index]=next;showForm();refresh();});
   head.append(title);
   const actions=make('div','flow-step-actions');
   for(const [symbol,label,offset] of [['↑','Move up',-1],['↓','Move down',1]]){
     const b=make('button','btn secondary',symbol);b.type='button';b.title=label;b.setAttribute('aria-label',`${label} applet ${index+1}`);b.disabled=index+offset<0||index+offset>=config.steps.length;
     b.addEventListener('click',()=>{const [item]=config.steps.splice(index,1);config.steps.splice(index+offset,0,item);showForm();refresh()});actions.append(b);
   }
   const rm=make('button','btn secondary','×');rm.type='button';rm.title='Remove';rm.setAttribute('aria-label',`Remove applet ${index+1}`);rm.addEventListener('click',()=>{config.steps.splice(index,1);showForm();refresh();});actions.append(rm);head.append(actions);card.append(head);
   const fields=make('div','flow-step-fields');
   fields.append(textField('Applet ID','id',step));
   if(step.type==='crossJoin'){
     fields.append(textField('New field','field',step));
     const f=fieldRow('Values (JSON array)',JSON.stringify(step.values),v=>{try{step.values=JSON.parse(v);refresh()}catch(e){status('Values need valid JSON: '+e.message,true)}});fields.append(f);
   }else if(step.type==='map'){
     fields.append(textField('Read field','field',step),textField('Write field','outputField',step));
     fields.append(fieldRow('Operation',step.operation,v=>{step.operation=v;step.value=v==='prefix'?'Item-':2;showForm();refresh();},[['multiply','Multiply'],['add','Add'],['prefix','Prefix text']]));
     fields.append(step.operation==='prefix'?textField('Prefix','value',step):numField('Value','value',step));
   }else if(step.type==='filter'){
     fields.append(textField('Read field','field',step));
     fields.append(fieldRow('Comparison',step.operator,v=>{step.operator=v;refresh();},[['eq','Equals'],['ne','Not equal'],['gt','Greater than'],['gte','At least'],['lt','Less than'],['lte','At most']]));
     fields.append(numField('Compare with','value',step));
   }else if(step.type==='switch')fields.append(textField('Read number','field',step),textField('Branch field','outputField',step));
   else if(step.type==='sort')fields.append(textField('Sort field','field',step),fieldRow('Direction',step.direction,v=>{step.direction=v;refresh();},[['asc','Ascending'],['desc','Descending']]));
   else if(step.type==='aggregate'){
     fields.append(fieldRow('Operation',step.operation,v=>{step.operation=v;if(v==='sum'&&!step.field)step.field=config.input.field;showForm();refresh();},[['count','Count'],['sum','Sum']]));
     if(step.operation==='sum')fields.append(textField('Sum field','field',step));
     fields.append(textField('Output field','outputField',step));
   }
   card.append(fields);area.append(card);
 });
 $('flow-json').value=JSON.stringify(config,null,2);
}
function renderTable(rows){
 const table=make('table','flow-result-table');const head=make('thead');const body=make('tbody');const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];
 const hr=make('tr');for(const key of keys)hr.append(make('th',null,key));head.append(hr);
 for(const row of rows.slice(0,12)){const tr=make('tr');for(const key of keys)tr.append(make('td',null,String(row[key]??'')));body.append(tr)}
 table.append(head,body);return table;
}
function render(){
 $('flow-json').value=JSON.stringify(config,null,2);
 try{
   const meta=validatePipeline(config);result=runPipeline(config);code=generatePipelineCode(config);pythonCode=generatePipelinePython(config);
   $('flow-result-count').textContent=String(result.rows.length);
   $('flow-step-count').textContent=String(meta.stepCount);
   $('flow-output-trace').replaceChildren();
   for(let i=0;i<result.trace.length;i++){
     const entry=result.trace[i];const details=make('details','flow-trace-step');details.open=i===result.trace.length-1;
     const summary=make('summary');summary.append(make('strong',null,entry.id),make('span',null,`${entry.type} · ${entry.count} rows`));details.append(summary);
     if(entry.preview.length)details.append(renderTable(entry.preview));else details.append(make('p','muted','No rows at this stage.'));
     $('flow-output-trace').append(details);
   }
   $('flow-output-code').textContent=code;
   $('flow-output-python').textContent=pythonCode;
   $('flow-output-json').textContent=JSON.stringify(config,null,2);
   status(`Ready · ${result.rows.length} output rows · ${result.trace.length-1} reusable applets`);
 }catch(err){result=null;code='';pythonCode='';$('flow-result-count').textContent='—';$('flow-step-count').textContent='—';$('flow-output-code').textContent='';$('flow-output-python').textContent='';$('flow-output-trace').replaceChildren(make('p','muted',err.message));$('flow-output-json').textContent=JSON.stringify(config,null,2);status(err.message,true)}
}
let timer;
function refresh(){clearTimeout(timer);timer=setTimeout(render,80);}
for(const btn of document.querySelectorAll('[data-flow-view]'))btn.addEventListener('click',()=>{
 activeTab=btn.dataset.flowView;
 for(const b of document.querySelectorAll('[data-flow-view]'))b.classList.toggle('active',b===btn);
 for(const view of document.querySelectorAll('[data-flow-output]'))view.hidden=view.dataset.flowOutput!==activeTab;
});
$('flow-name').addEventListener('change',e=>{config.name=e.target.value;refresh()});
$('flow-source-type').addEventListener('change',e=>{
 config.input=e.target.value==='list'?{type:'list',field:'item',values:[1,2,3]}:{type:'range',field:'door',start:1,end:5,step:1};showForm();refresh();
});
$('flow-source-field').addEventListener('change',e=>{config.input.field=e.target.value;refresh()});
for(const k of ['start','end','step'])$('flow-range-'+k).addEventListener('change',e=>{config.input[k]=e.target.value.trim()===''?null:Number(e.target.value);refresh()});
$('flow-list-json').addEventListener('change',e=>{try{config.input.values=JSON.parse(e.target.value);refresh()}catch(err){status(err.message,true)}});
$('flow-add').addEventListener('click',()=>{
 const type=$('flow-add-type').value;
 if(config.steps.length>=24){status('Maximum 24 applets per macro',true);return}
 let i=1;while(config.steps.some(s=>s.id===type.toLowerCase()+'-'+i))i++;const id=type.toLowerCase()+'-'+i;
 config.steps.push({id,...presets[type]()});showForm();refresh();
});
$('flow-example').addEventListener('change',e=>{config=clone(e.target.value==='inventory'?inventory:EXAMPLE_PIPELINE);showForm();render();});
$('flow-apply-json').addEventListener('click',()=>{
 try{const json=JSON.parse($('flow-json').value);validatePipeline(json);config=json;showForm();render();status('Macro JSON applied. No compilation necessary.')}catch(e){status(e.message,true)}
});
$('flow-download').addEventListener('click',()=>{
 try{validatePipeline(config)}catch(e){status(e.message,true);return}
 const blob=new Blob([JSON.stringify(config,null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const a=make('a');a.href=url;a.download='audk-composed-macro.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('flow-import').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{if(file.size>131072)throw Error('Macro file exceeds 128 KiB');const c=JSON.parse(await file.text());validatePipeline(c);config=c;showForm();render();status('Imported JSON macro successfully.')}catch(err){status(err.message,true)}finally{e.target.value=''}
});
$('flow-save').addEventListener('click',()=>{try{validatePipeline(config);localStorage.setItem('audk.saved.pipeline.v1',JSON.stringify(config));status('Saved this macro in this browser only.')}catch(e){status(e.message,true)}});
$('flow-load').addEventListener('click',()=>{try{const raw=localStorage.getItem('audk.saved.pipeline.v1');if(!raw)throw Error('No locally saved macro on this browser');const c=JSON.parse(raw);validatePipeline(c);config=c;showForm();render();status('Loaded macro saved in this browser.')}catch(e){status(e.message,true)}});
$('flow-copy-code').addEventListener('click',async()=>{try{if(!code)throw Error('Fix configuration first');await navigator.clipboard.writeText(code);status('Generated standalone JavaScript copied.')}catch(e){status(e.message,true)}});
$('flow-copy-python').addEventListener('click',async()=>{try{if(!pythonCode)throw Error('Fix configuration first');await navigator.clipboard.writeText(pythonCode);status('Generated standalone Python copied.')}catch(e){status(e.message,true)}});
$('flow-download-python').addEventListener('click',()=>{try{if(!pythonCode)throw Error('Fix configuration first');const url=URL.createObjectURL(new Blob([pythonCode],{type:'text/x-python'}));const a=make('a');a.href=url;a.download='audk-composed-macro.py';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){status(e.message,true)}});
$('flow-run').addEventListener('click',()=>render());
showForm();render();

// Allow reviewed Factory pipeline templates to open in the graphical composer.
window.addEventListener('audk:load-pipeline',e=>{try{validatePipeline(e.detail);config=clone(e.detail);showForm();render();status('Factory applet loaded into Composer. No compilation necessary.')}catch(err){status(err.message,true)}});
