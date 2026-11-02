/** AUDK v0.9 — navigation is the single source of truth for tabs, breadcrumbs and URLs. */
export const SECTIONS=Object.freeze({
 configure:{title:'Nested Loop Wizard',subtitle:'Configure and run nested loops with step-by-step tracing.',group:'Applet Studio'},
 visualize:{title:'Execution Visualization',subtitle:'Step through iterations and inspect results.',group:'Applet Studio'},
 compose:{title:'Applet Composer',subtitle:'Assemble reusable functions into executable JSON macros.',group:'Macro Runtime'},
 factory:{title:'Applet Factory',subtitle:'Build and validate reusable applet packages from templates.',group:'Applet Factory'},
 blueprints:{title:'Function Blueprint Lab',subtitle:'Configure a function, generate its wizard, and export a tested applet.',group:'Function Blueprints'},
 library:{title:'Applet Library Browser',subtitle:'Search verified applets, inspect examples and open their configuration wizards.',group:'Applet Library'},
 universal:{title:'Universal Applet Wizard',subtitle:'Configure reviewed Python callables using generated parameter forms.',group:'Universal Wizard'},
 review:{title:'Applet Review Desk',subtitle:'Verify candidate evidence and prepare a human-reviewed promotion proposal.',group:'Review & Promotion'},
 'build-service':{title:'Private Build Requests',subtitle:'Prepare validated, local-only build requests without exposing VPS controls.',group:'Private Build Service'},
 assembly:{title:'Applet Assembly Line',subtitle:'Compare SDK functions to published applets and export candidate development specs.',group:'Assembly Line'},
 expansion:{title:'Applet Expansion Queue',subtitle:'Rank discovery candidates and prepare review-only applet proposals.',group:'Expansion Engine'},
 python:{title:'Python Function Explorer',subtitle:'Explore a curated Python standard-library discovery snapshot.',group:'Python Explorer'},
 windows:{title:'Windows HTA Companions',subtitle:'Download offline Windows configuration utilities.',group:'Windows HTA Apps'},
 code:{title:'Generated JavaScript',subtitle:'Inspect source generated from your nested-loop macro.',group:'Applet Studio'},
 macro:{title:'Macro JSON',subtitle:'Edit and reuse an interpreted nested-loop configuration.',group:'Applet Studio'},
 tests:{title:'Test Laboratory',subtitle:'Check nested-loop behavior before reusing it.',group:'Applet Studio'},
 api:{title:'API Reference',subtitle:'Use AUDK through local development endpoints.',group:'API Reference'}
});
export function sectionFromHash(hash){const tab=decodeURIComponent(String(hash||'').replace(/^#\/?/,''));return Object.hasOwn(SECTIONS,tab)?tab:'configure';}
export function initializeNavigation(doc=document,win=window){
 const buttons=[...doc.querySelectorAll('[data-tab]')];
 const panels=[...doc.querySelectorAll('.panel')];
 const navs=[...doc.querySelectorAll('[data-jump]')];
 const title=doc.getElementById('workspace-title'),summary=doc.getElementById('workspace-subtitle');
 const crumb=doc.getElementById('current-location');
 const actions=doc.getElementById('wizard-actions');
 function activate(tab,{url=true}={}){
  if(!Object.hasOwn(SECTIONS,tab))tab='configure';
  const current=SECTIONS[tab];
  buttons.forEach(b=>{const active=b.dataset.tab===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
  panels.forEach(p=>{const active=p.id===`panel-${tab}`;p.classList.toggle('active',active);p.hidden=!active;});
  navs.forEach(b=>{const active=b.dataset.jump===tab;b.classList.toggle('selected',active);b.setAttribute('aria-current',active?'page':'false');});
  title.textContent=current.title;summary.textContent=current.subtitle;
  crumb.textContent=`${current.group} / ${current.title}`;
  actions.hidden=!['configure','visualize','code','macro','tests'].includes(tab);
  doc.title=`${current.title} · AUDK Studio`;
  if(url && win.location.hash!==`#${tab}`)win.history.pushState(null,'',`#${tab}`);
  doc.dispatchEvent(new CustomEvent('audk:sectionchange',{detail:{tab,title:current.title}}));
 }
 buttons.forEach((b,i)=>{
  b.setAttribute('role','tab');b.id='tab-'+b.dataset.tab;b.setAttribute('aria-controls','panel-'+b.dataset.tab);
  b.addEventListener('click',()=>activate(b.dataset.tab));
  b.addEventListener('keydown',e=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
   e.preventDefault();let next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
   buttons[next].focus();activate(buttons[next].dataset.tab);
  });
 });
 panels.forEach(p=>{p.setAttribute('role','tabpanel');p.setAttribute('aria-labelledby','tab-'+p.id.replace('panel-',''));});
 navs.forEach(b=>b.addEventListener('click',()=>activate(b.dataset.jump)));
 win.addEventListener('hashchange',()=>activate(sectionFromHash(win.location.hash),{url:false}));
 win.addEventListener('popstate',()=>activate(sectionFromHash(win.location.hash),{url:false}));
 activate(sectionFromHash(win.location.hash),{url:false});
 return activate;
}
