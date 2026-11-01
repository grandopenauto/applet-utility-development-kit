import http from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import {join,resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {executeMacro,validateMacro,generateJavaScript,checkMacro} from './engine.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const host=process.env.AUDK_HOST||'127.0.0.1',port=Number(process.env.PORT||4173);
if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid PORT');
const routes=new Set(['/','/index.html','/style.css','/pages-app.js','/src/engine.mjs']);
function safeFile(path){
 if(routes.has(path))return path==='/'?'index.html':path.slice(1);
 if(/^\/(?:library|scenarios)\/[a-z0-9-]+\.json$/.test(path))return path.slice(1);
 return null;
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Cache-Control','no-store');
 const url=new URL(req.url,'http://localhost'),path=url.pathname;
 if(path.startsWith('/api/')){
  try{
   let input=null;
   if(req.method==='POST'){
    let raw='';for await(const chunk of req){raw+=chunk.toString('utf8');if(raw.length>131072)throw Error('Payload too large')}
    input=JSON.parse(raw);
   }
   let data;
   if(req.method==='GET'&&path==='/api/health')data={ok:true,version:'0.1.0'};
   else if(req.method==='GET'&&path==='/api/applets'){
    const names=(await readdir(join(root,'library'))).filter(n=>n.endsWith('.json'));
    data={applets:await Promise.all(names.map(async n=>JSON.parse(await readFile(join(root,'library',n),'utf8'))))};
   }else if(req.method==='POST'&&path==='/api/validate')data={valid:true,metadata:validateMacro(input)};
   else if(req.method==='POST'&&path==='/api/run')data=executeMacro(input);
   else if(req.method==='POST'&&path==='/api/code')data={source:generateJavaScript(input)};
   else if(req.method==='POST'&&path==='/api/test')data=checkMacro(input);
   else{res.writeHead(404);res.end('Unknown endpoint');return}
   res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));
  }catch(e){res.writeHead(400,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:e.message}))}return;
 }
 const file=safeFile(path);
 if(req.method!=='GET'||!file){res.writeHead(404);res.end('Not found');return}
 try{const body=await readFile(join(root,file));res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(body)}
 catch{res.writeHead(404);res.end('File unavailable')}
}).listen(port,host,()=>console.log('AUDK local studio: http://'+host+':'+port));
