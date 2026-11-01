import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { validateMacro } from './engine.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const libraryDir = join(root, 'library');

export function validateEntry(entry) {
  if (!entry || typeof entry !== 'object') throw new Error('Invalid registry entry');
  if (!/^[a-z][a-z0-9-]{2,49}$/.test(entry.id)) throw new Error('Applet id must be lowercase kebab-case');
  if (typeof entry.description !== 'string' || entry.description.length>300) throw new Error('Missing applet description');
  if (entry.kind!=='macro') throw new Error('Only declarative macros are supported in v0.1');
  validateMacro(entry.config);
  return entry;
}

export async function loadRegistry() {
  const entries=[];
  for (const filename of (await readdir(libraryDir)).filter(x=>x.endsWith('.json')).sort()) {
    const entry = JSON.parse(await readFile(join(libraryDir,filename), 'utf8'));
    entries.push(validateEntry(entry));
  }
  return entries;
}
