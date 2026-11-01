import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {readFile} from 'node:fs/promises';
import {EXAMPLE_PIPELINE, PIPELINE_SCHEMA,runPipeline,validatePipeline,generatePipelineCode} from '../src/pipeline.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
function generatedRows(config){const code=generatePipelineCode(config).replace('export function runApplet()','function runApplet()');return runInNewContext(code+'\nrunApplet()',{}, {timeout:1500});}
test('Digital CrossDock 4 doors × 4 slots filtered and categorized',()=>{
 const result=runPipeline(EXAMPLE_PIPELINE);
 assert.equal(result.trace[0].count,4);
 assert.deepEqual(result.trace.map(s=>s.count),[4,16,12,12,12]);
 assert.equal(result.rows[0].door,2);
 assert.equal(result.rows[0].slot,'08:00');
 assert.equal(result.rows[0].lane,'even');
 assert.equal(result.rows.length,12);
});
test('Generated JavaScript agrees with interpreted crossdock macro',()=>{
 assert.deepEqual(JSON.parse(JSON.stringify(generatedRows(EXAMPLE_PIPELINE))),runPipeline(EXAMPLE_PIPELINE).rows);
});
test('List, transform, filter and aggregate compose',()=>{
 const macro={schema:PIPELINE_SCHEMA,name:'inventory',input:{type:'list',field:'qty',values:[1,2,4,8]},steps:[
  {id:'triple',type:'map',field:'qty',outputField:'units',operation:'multiply',value:3},
  {id:'large',type:'filter',field:'units',operator:'gte',value:6},
  {id:'sum-units',type:'aggregate',operation:'sum',field:'units',outputField:'total'}
 ]};
 assert.deepEqual(runPipeline(macro).rows,[{total:42}]);
 assert.deepEqual(JSON.parse(JSON.stringify(generatedRows(macro))),runPipeline(macro).rows);
});
test('Text prefix, descending sort, count and code export work',()=>{
 const macro={schema:PIPELINE_SCHEMA,name:'text',input:{type:'list',field:'item',values:['b','a','c']},steps:[
  {id:'prefix',type:'map',field:'item',operation:'prefix',value:'Dock-',outputField:'label'},
  {id:'sort-label',type:'sort',field:'label',direction:'desc'},
  {id:'count',type:'aggregate',operation:'count',outputField:'number'}
 ]};
 assert.deepEqual(runPipeline(macro).rows,[{number:3}]);
 assert.deepEqual(JSON.parse(JSON.stringify(generatedRows(macro))),runPipeline(macro).rows);
});
test('Reject unsafe fields, duplicate applets and unsafe expansion',()=>{
 const bad=clone(EXAMPLE_PIPELINE);bad.steps[0].field='__proto__';assert.throws(()=>validatePipeline(bad),/safe field/);
 const dup=clone(EXAMPLE_PIPELINE);dup.steps[1].id=dup.steps[0].id;assert.throws(()=>validatePipeline(dup),/unique/);
 const huge=clone(EXAMPLE_PIPELINE);huge.input.end=100;huge.steps[0].values=Array(80).fill('time');assert.throws(()=>validatePipeline(huge),/5000-row/);
 const badStep=clone(EXAMPLE_PIPELINE);badStep.input.step=0;assert.throws(()=>validatePipeline(badStep),/step must not be zero/);
 const invalid=clone(EXAMPLE_PIPELINE);invalid.steps[0].values=['a',{}];assert.throws(()=>validatePipeline(invalid),/scalar/);
});
test('No eval or remote code execution on public Pages',async()=>{
 const [ui, engine, html]=await Promise.all([
  readFile(new URL('../composer-ui.js',import.meta.url),'utf8'),
  readFile(new URL('../src/pipeline.mjs',import.meta.url),'utf8'),
  readFile(new URL('../index.html',import.meta.url),'utf8')
 ]);
 assert.match(html,/id="panel-compose"/);
 assert.match(html,/src="\.\/composer-ui\.js"/);
 assert.match(ui,/runPipeline\(config\)/);
 assert.doesNotMatch(engine,/\beval\s*\(|\bnew Function\s*\(/);
 assert.doesNotMatch(ui,/fetch\(|innerHTML\s*=/);
});
