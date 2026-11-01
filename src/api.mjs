import { executeMacro, generateJavaScript, checkMacro, validateMacro } from './engine.mjs';
import { loadRegistry } from './registry.mjs';
import {runPipeline,validatePipeline,generatePipelineCode} from './pipeline.mjs';

export async function apiResponse(method,pathname,body) {
  if (method==='GET' && pathname==='/api/health') return {status:200,data:{ok:true,version:'0.2.0',mode:'local-first'}};
  if (method==='GET' && pathname==='/api/applets') return {status:200,data:{applets:await loadRegistry()}};
  if (method==='POST' && pathname==='/api/validate') return {status:200,data:{valid:true,metadata:validateMacro(body)}};
  if (method==='POST' && pathname==='/api/run') return {status:200,data:executeMacro(body)};
  if (method==='POST' && pathname==='/api/code') return {status:200,data:{language:'javascript',source:generateJavaScript(body)}};
  if (method==='POST' && pathname==='/api/test') return {status:200,data:checkMacro(body)};
  if (method==='POST' && pathname==='/api/pipeline/validate') return {status:200,data:{valid:true,metadata:validatePipeline(body)}};
  if (method==='POST' && pathname==='/api/pipeline/run') return {status:200,data:runPipeline(body)};
  if (method==='POST' && pathname==='/api/pipeline/code') return {status:200,data:{source:generatePipelineCode(body)}};
  return {status:404,data:{error:'Endpoint not found'}};
}
