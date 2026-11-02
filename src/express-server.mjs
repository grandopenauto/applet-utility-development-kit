/** Optional loopback-only Express adapter for AUDK. */
import express from 'express';
import {readFile} from 'node:fs/promises';
import {dirname,resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {apiResponse} from './api.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const app=express();app.disable('x-powered-by');app.use(express.json({limit:'128kb'}));
for(const path of ['/api/validate','/api/run','/api/code','/api/test','/api/pipeline/validate','/api/pipeline/run','/api/pipeline/code','/api/factory/preview','/api/universal/preview','/api/blueprints/preview','/api/pipeline/python']){
 app.post(path,async(req,res)=>{try{const result=await apiResponse('POST',path,req.body);res.status(result.status).json(result.data)}catch(e){res.status(400).json({error:e.message})}});
}
for(const path of ['/api/applets','/api/health','/api/library/search','/api/universal/functions','/api/blueprints','/api/expansion/queue','/api/assembly/plan']){
 app.get(path,async(req,res)=>{try{const result=await apiResponse('GET',path,null,req.query);res.status(result.status).json(result.data)}catch(e){res.status(500).json({error:e.message})}});
}
const files=new Set(['/','/index.html','/style.css','/pages-app.js','/library-ui.js','/src/catalog-browser.mjs','/src/python-triage.mjs','/composer-ui.js','/src/engine.mjs','/src/pipeline.mjs','/src/factory.mjs','/factory-ui.js','/universal-ui.js','/src/universal-wizard.mjs','/navigation-ui.js','/blueprint-ui.js','/src/blueprints.mjs','/src/registry.mjs','/src/python-export.mjs','/python-discovery-ui.js','/catalog/python-standard-library.json','/expansion-ui.js','/src/expansion.mjs','/assembly-ui.js','/build-service-ui.js','/src/assembly-line.mjs','/catalog/assembly-plan.json','/catalog/expansion-queue.json']);
app.get(/^\/(?!api\/).*/,async(req,res)=>{
 const name=files.has(req.path)?(req.path==='/'?'index.html':req.path.slice(1)):
  (/^\/(?:library|scenarios)\/[a-z0-9-]+\.json$/.test(req.path)||/^\/examples\/pipelines\/[a-z0-9-]+\.json$/.test(req.path)||/^\/downloads\/hta\/audk-(?:loop-planner|slot-matrix)\.hta$/.test(req.path)?req.path.slice(1):null);
 if(!name)return res.status(404).send('Not found');
 try{const content=await readFile(join(root,name));res.type(extname(name)==='.hta'?'application/octet-stream':extname(name)==='.mjs'?'text/javascript':extname(name)==='.js'?'text/javascript':extname(name));return res.send(content)}catch{return res.status(404).send('File unavailable')}
});
const host=process.env.AUDK_HOST||'127.0.0.1',port=Number(process.env.PORT||4173);
if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid PORT');
app.listen(port,host,()=>console.log(`AUDK Express Studio: http://${host}:${port}`));
