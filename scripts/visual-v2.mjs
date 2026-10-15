import {chromium} from '@playwright/test';
import {mkdir,writeFile,access} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const root='artifacts/visual-v2';await mkdir(root,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[];let restaurant,product;
const loadPhotos=page=>page.evaluate(async()=>{for(const img of document.images)img.loading='eager';await Promise.race([Promise.all([...document.images].map(img=>img.decode().catch(()=>null))),new Promise(resolve=>setTimeout(resolve,8000))]);});
try{
 for(const width of [320,375,390,430,768,1024,1280,1440]){
  const context=await browser.newContext({viewport:{width,height:width===375?812:width===1440?1000:900},locale:'fr-FR',serviceWorkers:'block'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  const resp=await page.goto('http://127.0.0.1:3210/',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1000);
  await loadPhotos(page);
  const evidence=await page.evaluate(()=>({version:document.querySelector('[data-visual-version]')?.getAttribute('data-visual-version'),font:getComputedStyle(document.querySelector('h1')).fontFamily,manropeLoaded:document.fonts.check('700 20px "Manrope Variable"'),background:getComputedStyle(document.querySelector('.marketplace-hero')).backgroundColor,photoRadius:getComputedStyle(document.querySelector('.hero-food-frame')).borderRadius,product:document.querySelector('.hero-food-label strong')?.textContent,overflow:document.documentElement.scrollWidth>innerWidth+1,css:[...document.styleSheets].map(s=>s.href).filter(Boolean)}));
  if(evidence.version!=='food-v2'||!evidence.manropeLoaded||evidence.photoRadius!=='0px'||evidence.overflow||errors.length||!resp.ok())throw new Error(JSON.stringify({width,evidence,errors}));
  await page.screenshot({path:`${root}/accueil-${width}.png`,fullPage:true});results.push({route:'/',width,...evidence,errors:[...errors]});
  if(width===375||width===430){const menu=page.getByRole('button',{name:'Ouvrir le menu',exact:true});await menu.click();await page.getByRole('button',{name:'Fermer le menu',exact:true}).first().waitFor();await page.screenshot({path:`${root}/menu-ouvert-${width}.png`});await page.keyboard.press('Escape');await menu.waitFor();}
  if(!restaurant){await page.goto('http://127.0.0.1:3210/restaurants',{waitUntil:'domcontentloaded'});restaurant=await page.locator('a[href^="/restaurants/"]').first().getAttribute('href');await page.goto('http://127.0.0.1:3210/menu',{waitUntil:'domcontentloaded'});product=await page.locator('a[href^="/menu/"]').first().getAttribute('href');}
  for(const [name,url]of [['restaurant',restaurant],['produit',product]]){
   if(name==='produit'||width===1440)await page.setViewportSize({width,height:900});
   const response=await page.goto(`http://127.0.0.1:3210${url}`,{waitUntil:'domcontentloaded'});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(500);
   await loadPhotos(page);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
   if(name==='produit'){
    const clear=await page.evaluate(()=>document.querySelector('.detail-price').getBoundingClientRect().bottom<=document.querySelector('.detail-order-bar').getBoundingClientRect().top);
    if(!clear)throw new Error(`Prix recouvert à ${width}px`);
    const options=page.locator('.option-row input[type="checkbox"]');
    if(await options.count()>=2){await options.nth(0).check();await options.nth(1).check();if(await page.locator('.option-row input:checked').count()!==2)throw new Error('Multi-sélection cassée');await options.nth(0).uncheck();await options.nth(1).uncheck();}
   }
   if(!response.ok()||overflow||errors.length)throw new Error(JSON.stringify({url,width,overflow,errors}));
   await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(200);
   await page.screenshot({path:`${root}/${name}-${width}.png`,fullPage:true});results.push({route:url,width,status:response.status(),overflow,errors:[...errors]});
  }
  await context.close();
 }
}finally{await browser.close();await writeFile(`${root}/report.json`,JSON.stringify({results,restaurant,product},null,2))}
const exists=async p=>{try{await access(`artifacts/${p}`);return true}catch{return false}};
let html='';
for(const [name,title,old,width]of [['accueil','Accueil desktop','visual-qa-before-20261014-complete/accueil-1440.png',1440],['accueil','Accueil mobile','visual-qa-before-20261014-complete/accueil-375.png',375],['restaurant','Restaurant mobile','visual-qa-before-20261014-complete/restaurant-public-375.png',375],['restaurant','Restaurant desktop','visual-qa-premiere-modernisation/restaurant-public-1440.png',1440],['produit','Produit mobile','visual-qa-premiere-modernisation/produit-375.png',375],['produit','Produit desktop','visual-qa-premiere-modernisation/produit-1440.png',1440]]){
 let displayed=old;let note='';
 if(await exists(old)){const meta=await sharp(`artifacts/${old}`).metadata();if(meta.width>width){displayed=`visual-v2/avant-${name}-${width}.png`;await sharp(`artifacts/${old}`).extract({left:0,top:0,width,height:meta.height}).toFile(`artifacts/${displayed}`);note=' Le blanc capturé hors viewport mobile est recadré ; original inchangé et accessible au clic.';}}
 html+=`<section><h2>${title}</h2><p>${old.includes('premiere')?'Avant = capture réelle de la première modernisation, avant cette correction.':'Avant = capture initiale conservée.'} Aucun historique absent n’est reconstitué.${note}</p><div class="pair"><article><h3>Avant</h3>${await exists(old)?`<a href="${old}"><img src="${displayed}" loading="lazy" alt="Avant ${title}"></a>`:'<p>Capture initiale indisponible.</p>'}</article><article><h3>Après — correction food-v2</h3><a href="visual-v2/${name}-${width}.png"><img src="visual-v2/${name}-${width}.png" loading="lazy" alt="Après ${title}"></a></article></div></section>`;
}
await writeFile('artifacts/come-and-eat-visual-comparison.html',`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Come & Eat — comparaison food-v2</title><style>body{font:16px system-ui;margin:0;padding:32px;background:#f4f1e6;color:#073f31}main{max-width:1500px;margin:auto}.pair{display:grid;grid-template-columns:1fr 1fr;gap:22px}article{padding:16px;background:white;border-radius:18px;min-width:0}img{width:100%;height:auto}section{margin-block:60px}a{color:inherit}@media(max-width:700px){.pair{grid-template-columns:1fr}}</style><main><h1>Come & Eat — transformation food-v2</h1><p>Captures Edge locales sur le build reconstruit. Même restaurant et même produit publics ; police Manrope embarquée, CSS et version vérifiés dans report.json. Cliquez une capture pour l’ouvrir.</p>${html}</main></html>`);
console.log(`Visual v2: ${results.length} contrôles, police/version/CSS/console/overflow validés. Comparaison: ${path.resolve('artifacts/come-and-eat-visual-comparison.html')}`);
