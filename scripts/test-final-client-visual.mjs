import {chromium} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:3211';const out='artifacts/final-client-qa';await mkdir(out,{recursive:true});
const buildId=(await readFile('.next/BUILD_ID','utf8')).trim();
const browser=await chromium.launch({channel:'msedge',headless:true});const results=[];
try{
 for(const width of [320,375,390,430,768,1024,1280,1440]){
  const context=await browser.newContext({viewport:{width,height:900}});const page=await context.newPage();const errors=[];let networkRecovery='non exécuté à cette largeur';page.on('pageerror',error=>errors.push(error.message));
  await context.addInitScript(()=>{localStorage.setItem('come-eat-cart-v1',JSON.stringify([{id:'qa-a',productId:'qa-product-a',name:'QA plat A',unitPrice:5000,quantity:2,selections:[{optionId:'qa-option',name:'QA supplément',price:500}]},{id:'qa-b',productId:'qa-product-b',name:'QA plat B',unitPrice:2500,quantity:1,selections:[]}]))});
  const response=await page.goto(base+'/menu',{waitUntil:'networkidle',timeout:120000});assert.ok(response.ok());
  const bar=page.locator('.discovery-cart-bar');await bar.waitFor({state:'attached'});assert.match(await bar.textContent(),/3 articles/);assert.match(await bar.textContent(),/13\s?500/);
  assert.equal(await bar.isVisible(),width<768);
  const categories=page.locator('.filters button');if(await categories.count()>1){await categories.nth(1).click();assert.equal(await categories.nth(1).getAttribute('aria-pressed'),'true');}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:`${out}/menu-cart-${width}.png`,fullPage:true});
  await page.goto(base+'/checkout',{waitUntil:'domcontentloaded'});
  // The persisted cart hydrates after the server document; do not measure the
  // temporary empty-cart branch as if the checkout form had finished rendering.
  await page.locator('.checkout-summary .promo-field label').waitFor({state:'visible',timeout:30000});
  assert.equal(await page.locator('.discovery-cart-bar').count(),0,'Aucune barre concurrente au checkout');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Checkout sans débordement horizontal');
  const contrasts=await page.evaluate(()=>{
   const rgb=value=>value.match(/[\d.]+/g).slice(0,3).map(Number);
   const luminance=value=>rgb(value).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
   return [['.promo-field label','.promo-field'],['.checkout-summary .muted','.checkout-summary']].map(([text,background])=>{
    const a=luminance(getComputedStyle(document.querySelector(text)).color),b=luminance(getComputedStyle(document.querySelector(background)).backgroundColor);
    return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   });
  });
  assert.ok(contrasts.every(ratio=>ratio>=4.5),'Contraste lisible du code promo et de la note financière');
  if(width===375||width===1440)await page.screenshot({path:`${out}/checkout-${width}.png`,fullPage:true});
  if(width===375&&await page.locator('.summary-cta').isEnabled()){
   await page.locator('#name').fill('QA locale sans envoi');
   await page.locator('#phone').fill('+2250700000000');
   if(await page.locator('#address').count())await page.locator('#address').fill('Adresse fictive locale');
   if(await page.locator('#commune').count())await page.locator('#commune').fill('QA locale');
   // Abort the local Server Action before it reaches Next or any remote database.
   await page.route('**/*',route=>route.request().method()==='POST'?route.abort('failed'):route.continue());
   await page.locator('.summary-cta').click();
   await page.getByRole('alert').filter({hasText:'La confirmation a été interrompue'}).waitFor();
   assert.equal(await page.locator('.summary-cta').isEnabled(),true,'Retry possible après interruption réseau');
   assert.equal(JSON.parse(await page.evaluate(()=>localStorage.getItem('come-eat-cart-v1'))).length,2,'Panier conservé après erreur');
   await page.screenshot({path:`${out}/checkout-network-retry-375.png`,fullPage:true});
   networkRecovery='POST local interrompu avant serveur ; bouton et panier conservés';
   await page.unroute('**/*');
  }
  else if(width===375){networkRecovery='non exécuté : aucun mode disponible, bouton désactivé';assert.equal(await page.locator('.summary-cta').isEnabled(),false);}
  await page.goto(base+'/account/messages',{waitUntil:'domcontentloaded'});await page.waitForURL(/\/login\?/);assert.equal(await page.locator('.discovery-cart-bar').count(),0);
  for(const protectedRoute of ['/admin/delivery-hours','/admin/planning/deliveries']){
   await page.goto(base+protectedRoute,{waitUntil:'domcontentloaded'});
   await page.waitForURL(/\/admin\/login/);
  }
  assert.deepEqual(errors,[]);results.push({width,ok:true,buildId,contrasts,cart:'fixture locale uniquement',auth:'redirection anonyme vérifiée',networkRecovery});await context.close();
 }
}finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(results,null,2));}
console.log(`${results.length}/8 largeurs Edge : panier fictif local 3 articles/13 500 FCFA, catégorie active, checkout sans superposition, route messages protégée. Aucune commande, aucun email et aucune écriture Supabase.`);
