import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[];const root='artifacts/visual-qa';await mkdir(root,{recursive:true});
try{
for(const width of [375,1440]){
 const context=await browser.newContext({viewport:{width,height:900},locale:'fr-FR'});
 // Client-only fixture: no order submitted, no Supabase mutation.
 await context.addInitScript(()=>localStorage.setItem('come-eat-cart-v1',JSON.stringify([{id:'local-qa',productId:'local-qa',name:'Panier de démonstration locale',unitPrice:1500,quantity:2,selections:[]}])));
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:3210/menu',{waitUntil:'domcontentloaded'});
 const product=await page.locator('a[href^="/menu/"]').first().getAttribute('href').catch(()=>null);
 await page.goto('http://127.0.0.1:3210/restaurants',{waitUntil:'domcontentloaded'});
 const restaurant=await page.locator('a[href^="/restaurants/"]').first().getAttribute('href').catch(()=>null);
 for(const [name,url] of [['restaurant-public',restaurant],['produit',product],['panier','/cart'],['checkout','/checkout'],['contact','/contact']]){
  if(!url){results.push({name,width,skipped:'Aucune donnée publique disponible'});continue}
  const response=await page.goto(`http://127.0.0.1:3210${url}`,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(800);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
  await page.screenshot({path:`${root}/${name}-${width}.png`,fullPage:true});
  results.push({name,width,status:response.status(),overflow,fixture:['panier','checkout'].includes(name)});
  if(response.status()>=400||overflow)throw new Error(`${name} ${width}: ${response.status()} overflow=${overflow}`);
 }
 await context.close();
}
}finally{await browser.close();await writeFile(`${root}/final-pages-report.json`,JSON.stringify(results,null,2))}
console.log('Captures finales: pages publiques, panier/checkout avec fixture locale; aucune soumission.');
