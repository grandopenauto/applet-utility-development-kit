/** Discovery metadata is untrusted. It must never become executable via this module. */
import {UNIVERSAL_RECIPES} from './universal-wizard.mjs';
const reviewed=new Set(UNIVERSAL_RECIPES.map(r=>r.id));
export const INTAKE_SCHEMA='audk.python-intake.v1';
const textField=(value,max=350)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
export function qualifiedName(entry){
 if(!entry||!/^[a-z][a-z0-9_]*$/i.test(entry.module)||!/^[a-z_][a-z0-9_]*$/i.test(entry.name))throw Error('Invalid discovered function identifier');
 return `${entry.module}.${entry.name}`;
}
export function classifyDiscovered(entry){
 const name=qualifiedName(entry);
 if(reviewed.has(name))return {name,state:'wizard-supported',action:'Configure in Universal Wizard'};
 return {name,state:'discovery-only',action:'Export review intake (no execution)'};
}
export function makePythonIntake(entry,{purpose='Request a safe applet wizard'}={}){
 const name=qualifiedName(entry);
 if(reviewed.has(name))throw Error('Function already has a reviewed wizard');
 const signature=textField(entry.signature,300),summary=textField(entry.summary,350);
 const request=textField(purpose,150);
 if(!request)throw Error('Request purpose is required');
 return {schema:INTAKE_SCHEMA,qualifiedName:name,source:{language:'python',module:entry.module,function:entry.name,signature,summary},
  request,stage:'discovery-only',runtimeEnabled:false,autoPublish:false,
  requiredReview:['Confirm callable semantics and input types','Implement bounded pure recipe or isolated adapter','Test edge cases and cross-language parity','Open a GitHub pull request for human review']};
}
export function validatePythonIntake(packet){
 if(!packet||packet.schema!==INTAKE_SCHEMA||packet.runtimeEnabled!==false||packet.autoPublish!==false||packet.stage!=='discovery-only')throw Error('Invalid intake safety state');
 if(qualifiedName({module:packet.source?.module,name:packet.source?.function})!==packet.qualifiedName)throw Error('Mismatched intake name');
 if(reviewed.has(packet.qualifiedName))throw Error('Already reviewed');
 return true;
}
