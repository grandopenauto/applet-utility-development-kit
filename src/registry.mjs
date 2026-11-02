import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { validateMacro } from './engine.mjs';
import { validatePipeline } from './pipeline.mjs';
import { validatePromotedEntry } from './review.mjs';
import { validateCuratedEntry } from './curated.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const libraryDir = join(root, 'library');

export function validateEntry(entry) {
  if (!entry || typeof entry !== 'object') throw new Error('Invalid registry entry');
  if (!/^[a-z][a-z0-9-]{2,49}$/.test(entry.id)) throw new Error('Applet id must be lowercase kebab-case');
  if (typeof entry.description !== 'string' || entry.description.length>300) throw new Error('Missing applet description');
  if(entry.kind==='macro') validateMacro(entry.config);
  else if(entry.kind==='pipeline') validatePipeline(entry.config);
  else if(entry.kind==='universal-function') validatePromotedEntry(entry);
  else if(entry.kind==='curated-function') validateCuratedEntry(entry);
  else throw new Error('Only reviewed declarative applets are supported');
  return entry;
}

export async function loadRegistry() {
  const entries=[];
  const ids=new Set();
  for (const filename of (await readdir(libraryDir)).filter(x=>x.endsWith('.json')&&x!=='index.json').sort()) {
    const entry = JSON.parse(await readFile(join(libraryDir,filename), 'utf8'));
    validateEntry(entry);
    if(ids.has(entry.id))throw new Error('Duplicate applet id: '+entry.id);
    ids.add(entry.id);entries.push(entry);
  }
  return entries;
}
