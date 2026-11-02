#!/usr/bin/env node
/** Compare allowlisted discovery snapshots as metadata only. */
import {readFile,writeFile} from 'node:fs/promises';
const args=process.argv;
const get=(name,defaultValue)=>{const i=args.indexOf(name);return i<0?defaultValue:args[i+1];};
const older=JSON.parse(await readFile(get('--baseline','catalog/python-standard-library.json'),'utf8'));
const newer=JSON.parse(await readFile(get('--current','catalog/python-standard-library.json'),'utf8'));
if(older.schema!=='audk.discovery.v1'||newer.schema!=='audk.discovery.v1'||!Array.isArray(older.entries)||!Array.isArray(newer.entries))throw Error('Invalid catalog schema');
function key(e){
 if(!/^[a-z_][a-z0-9_]*$/i.test(e.module)||!/^[a-z_][a-z0-9_]*$/i.test(e.name))throw Error('Invalid callable identifier');
 return `${e.module}.${e.name}`;
}
const build=entries=>{
 const map=new Map();for(const entry of entries){const id=key(entry);if(map.has(id))throw Error('Duplicate callable: '+id);map.set(id,entry);}return map;
};
const a=build(older.entries),b=build(newer.entries);
const added=[...b.keys()].filter(x=>!a.has(x)).sort();const removed=[...a.keys()].filter(x=>!b.has(x)).sort();
const changed=[...a.keys()].filter(x=>b.has(x)&&(a.get(x).signature!==b.get(x).signature||a.get(x).summary!==b.get(x).summary)).sort();
const report={schema:'audk.discovery-diff.v1',fromPython:older.pythonVersion,toPython:newer.pythonVersion,added,removed,metadataChanged:changed,changed:added.length+removed.length+changed.length>0};
const output=get('--output','');if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({changed:report.changed,added:added.length,removed:removed.length,metadataChanged:changed.length,fromPython:older.pythonVersion,toPython:newer.pythonVersion}));
