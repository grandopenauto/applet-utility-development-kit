import { executeMacro, generateJavaScript, checkMacro, validateMacro } from './engine.mjs';
import { loadRegistry } from './registry.mjs';
import {filterCatalog} from './catalog-browser.mjs';
import {runPipeline,validatePipeline,generatePipelineCode} from './pipeline.mjs';
import {createApplet} from './factory.mjs';
import {generatePipelinePython} from './python-export.mjs';
import {createFunctionBlueprint,FUNCTION_BLUEPRINTS} from './blueprints.mjs';
import {UNIVERSAL_RECIPES,buildUniversalCandidate} from './universal-wizard.mjs';
import {createReviewPacket,verifyReviewPacket,preparePromotionProposal} from './review.mjs';

export async function apiResponse(method,pathname,body,query={}) {
  if (method==='GET' && pathname==='/api/health') return {status:200,data:{ok:true,version:'0.9.0',mode:'local-first'}};
  if (method==='GET' && pathname==='/api/applets') return {status:200,data:{applets:await loadRegistry()}};
  if (method==='GET' && pathname==='/api/library/search') return {status:200,data:{applets:filterCatalog(await loadRegistry(),{search:query.search||'',category:query.category||'All',kind:query.kind||'All'})}};
  if (method==='POST' && pathname==='/api/validate') return {status:200,data:{valid:true,metadata:validateMacro(body)}};
  if (method==='POST' && pathname==='/api/run') return {status:200,data:executeMacro(body)};
  if (method==='POST' && pathname==='/api/code') return {status:200,data:{language:'javascript',source:generateJavaScript(body)}};
  if (method==='POST' && pathname==='/api/test') return {status:200,data:checkMacro(body)};
  if (method==='GET' && pathname==='/api/universal/functions') return {status:200,data:{recipes:UNIVERSAL_RECIPES}};
  if (method==='POST' && pathname==='/api/universal/preview') return {status:200,data:buildUniversalCandidate(body)};
  if (method==='POST' && pathname==='/api/review/packet') return {status:200,data:await createReviewPacket(body)};
  if (method==='POST' && pathname==='/api/review/verify') return {status:200,data:await verifyReviewPacket(body)};
  if (method==='POST' && pathname==='/api/review/proposal') return {status:200,data:await preparePromotionProposal(body?.packet,body?.review)};
  if (method==='GET' && pathname==='/api/blueprints') return {status:200,data:{blueprints:FUNCTION_BLUEPRINTS}};
  if (method==='POST' && pathname==='/api/blueprints/preview') return {status:200,data:createFunctionBlueprint(body)};
  if (method==='POST' && pathname==='/api/factory/preview') return {status:200,data:createApplet(body)};
  if (method==='POST' && pathname==='/api/pipeline/validate') return {status:200,data:{valid:true,metadata:validatePipeline(body)}};
  if (method==='POST' && pathname==='/api/pipeline/run') return {status:200,data:runPipeline(body)};
  if (method==='POST' && pathname==='/api/pipeline/python') return {status:200,data:{language:'python',source:generatePipelinePython(body)}};
  if (method==='POST' && pathname==='/api/pipeline/code') return {status:200,data:{source:generatePipelineCode(body)}};
  return {status:404,data:{error:'Endpoint not found'}};
}
