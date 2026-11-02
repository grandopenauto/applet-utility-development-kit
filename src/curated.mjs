/** First-party, CI-verified pure function presets. Not human-approved proposals.
 * Only these explicitly pinned presets may use the curated-function registry kind.
 * All other contributions must follow the review packet and PR process.
 */
import {UNIVERSAL_RECIPES,UNIVERSAL_SCHEMA,validateUniversalConfig,executeUniversal} from './universal-wizard.mjs';
export const CURATED_SCHEMA='audk.curated.v1';
export const CURATED_FUNCTIONS=Object.freeze([
 'math.sqrt','math.factorial','math.gcd','statistics.mean',
 'statistics.median','builtins.sum','builtins.sorted','builtins.len',
 'math.trunc','math.fabs','math.degrees','math.radians','math.log10',
 'math.log2','math.lcm','math.prod','math.sin','math.cos',
 'math.isqrt','math.floor','math.ceil','builtins.abs','builtins.min','builtins.max'
]);
export function buildCuratedEntry(functionId){
 if(!CURATED_FUNCTIONS.includes(functionId))throw Error('Function is not a pinned first-party preset');
 const recipe=UNIVERSAL_RECIPES.find(x=>x.id===functionId);
 if(!recipe)throw Error('Pinned recipe missing: '+functionId);
 const id='python-'+functionId.replace('.','-');
 const config=validateUniversalConfig({schema:UNIVERSAL_SCHEMA,id,
  name:recipe.title+' utility',description:recipe.description,
  functionId,arguments:recipe.examples[0].args});
 return {id,kind:'curated-function',version:CURATED_FUNCTIONS.indexOf(functionId)<8?'0.8.0':CURATED_FUNCTIONS.indexOf(functionId)<18?'1.1.0':'1.2.0',name:config.name,
  description:recipe.description,config,
  verification:{schema:CURATED_SCHEMA,status:'automated-cross-language-tests',
   provenance:'AUDK first-party reviewed recipe',
   reviewNote:'Source and numerical behavior tested in CI. No external candidate is automatically published.'}};
}
export function validateCuratedEntry(entry){
 if(!entry||entry.kind!=='curated-function')throw Error('Invalid curated applet entry');
 const expected=buildCuratedEntry(entry.config?.functionId);
 if(JSON.stringify(entry)!==JSON.stringify(expected))throw Error('Curated applet differs from the pinned first-party preset');
 executeUniversal(expected.config);
 return entry;
}
