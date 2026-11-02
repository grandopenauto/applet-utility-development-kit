import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {CURATED_FUNCTIONS,buildCuratedEntry,validateCuratedEntry} from '../src/curated.mjs';
import {UNIVERSAL_RECIPES,executeUniversal,buildUniversalCandidate} from '../src/universal-wizard.mjs';
import {loadRegistry,validateEntry} from '../src/registry.mjs';
import {apiResponse} from '../src/api.mjs';
const library=new URL('../library/',import.meta.url);
const copy=x=>JSON.parse(JSON.stringify(x));
test('all eighteen first-party presets are valid, pinned and executable',async()=>{
 const all=await loadRegistry(),curated=all.filter(e=>e.kind==='curated-function');
 assert.equal(CURATED_FUNCTIONS.length,18);
 assert.equal(curated.length,18);
 assert.equal(all.length,22);
 for(const f of CURATED_FUNCTIONS){
  const expected=buildCuratedEntry(f),found=curated.find(e=>e.id===expected.id);
  assert.deepEqual(found,expected);
  assert.doesNotThrow(()=>validateCuratedEntry(found));
  assert.notEqual(executeUniversal(found.config),undefined);
  assert.match(buildUniversalCandidate(found.config).python,/def run_applet/);
  assert.match(buildUniversalCandidate(found.config).javaScript,/export function runApplet/);
 }
});
test('third-party applets cannot claim first-party curated status or change pinned values',()=>{
 const valid=buildCuratedEntry('math.sqrt');
 const altered=copy(valid);altered.config.arguments.value=99;
 assert.throws(()=>validateEntry(altered),/differs/);
 const forged=copy(valid);forged.config.functionId='os.system';
 assert.throws(()=>validateEntry(forged),/pinned/);
 assert.throws(()=>buildCuratedEntry('os.system'),/pinned/);
});
test('GitHub Pages index exactly mirrors the public registry and excludes its own index',async()=>{
 const manifest=JSON.parse(await readFile(new URL('index.json',library),'utf8'));
 assert.equal(manifest.schema,'audk.library-index.v1');
 const actual=(await readdir(library)).filter(n=>n.endsWith('.json')&&n!=='index.json').sort();
 assert.deepEqual(manifest.files,actual);
 assert.equal(actual.length,22);
 assert.equal(new Set(actual).size,actual.length);
});
test('Universal Wizard contains twenty-four allowlisted bounded recipes and registry API exposes all twenty-two entries',async()=>{
 assert.equal(UNIVERSAL_RECIPES.length,24);
 const response=await apiResponse('GET','/api/applets');
 assert.equal(response.status,200);
 assert.equal(response.data.applets.length,22);
 const js=await readFile(new URL('../pages-app.js',import.meta.url),'utf8');
 const wizard=await readFile(new URL('../universal-ui.js',import.meta.url),'utf8');
 assert.match(js,/library\/index\.json/);
 assert.match(js,/audk:load-universal/);
 assert.match(wizard,/addEventListener\('audk:load-universal'/);
});
