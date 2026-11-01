import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { executeMacro } from '../src/engine.mjs';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
test('Pages demo uses local browser interpreter and relative assets', async () => {
  const html=await readFile(new URL('../index.html', import.meta.url),'utf8');
  const js=await readFile(new URL('../pages-app.js', import.meta.url),'utf8');
  assert.match(html,/src="\.\/pages-app\.js"/);
  assert.match(html,/href="\.\/style\.css"/);
  assert.match(js,/executeMacro\(body\)/);
  assert.doesNotMatch(js,/fetch\('\/api\/applets'\)/);
});
test('CrossDock illustrative slot matrix is bounded and executable', async () => {
  const scenario=JSON.parse(await readFile(new URL('../scenarios/digital-crossdock-slot-matrix.json', import.meta.url),'utf8'));
  assert.equal(executeMacro(scenario.config).metadata.rows,24);
});
