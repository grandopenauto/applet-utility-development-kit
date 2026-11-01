import {writeFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {validateMacro,DEFAULT_MACRO} from '../src/engine.mjs';
const name=process.argv[2];
if(!/^[a-z][a-z0-9-]{1,48}$/.test(name||'')){console.error('Usage: npm run generate -- my-new-applet');process.exit(1)}
const path=resolve('library',name+'.json');
try{await access(path);throw Error('Applet already exists: '+name)}catch(e){if(e.code!=='ENOENT')throw e}
const config=JSON.parse(JSON.stringify(DEFAULT_MACRO));config.name=name.replaceAll('-',' ');
validateMacro(config);
await writeFile(path,JSON.stringify({id:name,kind:'macro',version:'0.1.0',description:'Template-generated applet; review before publishing',config},null,2)+'\n',{flag:'wx'});
console.log('Created '+path);
