import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'@playwright/test');
const base=process.env.QA_BASE_URL??'http://127.0.0.1:3211';
const baseline=process.env.QA_BASELINE==='1';
const folder=`artifacts/public-images-${baseline?'before':'after'}`;await mkdir(folder,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});const results=[];
try{for(const width of [375,1440]){
 const page=await browser.newPage({viewport:{width,height:950}});const requests=[],errors=[];
 page.on('request',r=>{if(new URL(r.url()).pathname==='/_next/image')requests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>['GET','HEAD','OPTIONS'].includes(route.request().method())?route.continue():route.abort());
 let detail,category;
 for(const route of ['/','/menu','/search?q=Alloco','CATEGORY','DETAIL']){
  const path=route==='CATEGORY'?category:route==='DETAIL'?detail:route;assert.ok(path,`Missing route ${route}`);
  requests.length=0;errors.length=0;const response=await page.goto(base+path,{waitUntil:'domcontentloaded',timeout:120000});assert.equal(response.status(),200);
  await page.locator(route==='DETAIL'?'.detail-image':route==='CATEGORY'?'.catalog-tools':'.product-card').first().waitFor({timeout:60000});
  if(route==='/'){category=await page.locator('.market-category').first().getAttribute('href');assert.ok(await page.locator('.product-card').count());}
  if(route==='/menu'){const card=page.locator('.product-card').filter({hasText:'Alloco Party'});assert.equal(await card.count(),1);detail=await card.locator('.product-image').getAttribute('href');}
  const images=page.locator('.product-card img,.detail-image img,.bloop-credit img');for(const image of await images.all())await image.scrollIntoViewIfNeeded();
  if(!baseline)await page.waitForFunction(()=>[...document.querySelectorAll('.product-card img,.detail-image img,.bloop-credit img')].every(img=>img.complete&&img.naturalWidth>0),{},{timeout:30000});
  else await page.waitForTimeout(1500);
  const broken=await images.evaluateAll(imgs=>imgs.filter(img=>!img.complete||img.naturalWidth===0).map(img=>img.currentSrc));
  const alloco=page.locator('.product-card').filter({hasText:'Alloco Party'}).locator('img');
  const footer=page.locator('.bloop-credit');assert.equal(await footer.getAttribute('href'),'https://bloop-ci.com');await footer.scrollIntoViewIfNeeded();
  if(!baseline){assert.deepEqual(broken,[],`${width} ${path}: broken images`);assert.deepEqual(requests,[],`${path}: optimizer requests`);assert.deepEqual(errors,[]);if(await alloco.count())assert.equal(await alloco.evaluate(img=>img.naturalWidth>0),true);assert.equal(await footer.locator('img').evaluate(img=>img.naturalWidth>0),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
  if(route==='/')await page.locator('.copyright').screenshot({path:`${folder}/footer-${width}.png`});
  await page.screenshot({path:`${folder}/${width}-${route.replaceAll(/[^a-zA-Z0-9]/g,'_')||'home'}.png`,fullPage:true});results.push({width,path,broken:broken.length,optimizerRequests:requests.length,errors});
 }
 await page.close();
}}finally{await browser.close();await writeFile(`${folder}/results.json`,JSON.stringify(results,null,2));}
console.log(JSON.stringify(results));
