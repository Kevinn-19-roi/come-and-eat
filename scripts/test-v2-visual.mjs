import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const base='http://127.0.0.1:3211';
const out='artifacts/v2-modules';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[];
try{
 for(const width of [320,375,390,430,768,1024,1280,1440]){
  const context=await browser.newContext({viewport:{width,height:900}});const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const route of ['/catering','/subscriptions','/meal-planner','/admin/reviews','/account/catering','/account/invitations','/admin/team','/vendor/catering']){
   const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:120000});
   const protectedRoute=!['/catering','/subscriptions'].includes(route);
   if(protectedRoute)await page.waitForURL(/\/(admin\/)?login(?:\?|$)/,{waitUntil:'domcontentloaded',timeout:120000});
   await page.locator('h1').first().waitFor();
   await page.evaluate(()=>document.fonts.ready);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
   const path=new URL(page.url()).pathname;
   const ok=response?.ok()&&!overflow&&!errors.length&&(!protectedRoute||['/login','/admin/login'].includes(path));
   results.push({width,route,path,status:response?.status(),overflow,errors:[...errors],ok});
   await page.screenshot({path:`${out}/${route.replaceAll('/','-')}-${width}.png`,fullPage:true});
  }
  await context.close();
 }
 const api=await browser.newContext();
 const quote=await api.request.get(base+'/catering/quotes/00000000-0000-0000-0000-000000000001/download');
 if(quote.status()!==401)throw new Error('Le téléchargement anonyme doit être refusé');
 const worker=await api.request.get(base+'/api/internal/v2-notifications');
 if(worker.status()!==503)throw new Error('Le traitement email local doit rester désactivé');
 await api.close();
}finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(results,null,2));}
console.log(`${results.filter(r=>r.ok).length}/${results.length} contrôles Edge anonymes réussis. Aucun formulaire envoyé. Aucune recette authentifiée simulée.`);
if(results.some(r=>!r.ok))process.exitCode=1;
