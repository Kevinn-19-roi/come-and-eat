const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'@playwright/test');
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const output='artifacts/v1-hero-footer';await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});const results=[];
try{
 for(const width of [375,430,1024,1440]){
  const page=await browser.newPage({viewport:{width,height:950},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto('http://127.0.0.1:3211',{waitUntil:'networkidle',timeout:120000});assert.ok(response.ok());
  await page.evaluate(()=>document.fonts.ready);
  const hero=page.locator('.marketplace-hero');await hero.waitFor();
  const snapshot=()=>page.evaluate(()=>{
   const frame=document.querySelector('.hero-food-frame'),copy=document.querySelector('.marketplace-hero-copy');
   const overlay=getComputedStyle(frame,'::after'),kicker=getComputedStyle(copy.querySelector('.section-kicker'));
   const box=copy.getBoundingClientRect();return {content:overlay.content,gradient:overlay.backgroundImage,kicker:kicker.color,geometry:[box.x,box.y,box.width,box.height]};
  });
  const after=await snapshot();const afterImage=await hero.screenshot({path:`${output}/after-${width}.png`,animations:'disabled'});
  const removed=await page.evaluate(()=>{
   for(const sheet of document.styleSheets){let rules;try{rules=sheet.cssRules;}catch{continue;}
    for(let i=0;i<rules.length;i++){const rule=rules[i];if(rule instanceof CSSMediaRule&&rule.conditionText.includes('1101px')&&rule.cssText.includes('.hero-food-frame')){sheet.deleteRule(i);return true;}}
   }return false;
  });assert.equal(removed,true,'Règle desktop effectivement chargée');
  const before=await snapshot();const beforeImage=await hero.screenshot({path:`${output}/before-${width}.png`,animations:'disabled'});
  if(width<=1100){assert.deepEqual(after,before);assert.ok(afterImage.equals(beforeImage),'Hero mobile/tablette identique pixel par pixel');}
  else{assert.equal(after.content,'""');assert.notEqual(after.gradient,before.gradient);assert.deepEqual(after.geometry,before.geometry);}
  const link=page.locator('.bloop-credit');assert.ok(await link.getAttribute('href'));assert.equal(await link.locator('img').count(),1);await link.locator('img').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelector('.bloop-credit img')?.naturalWidth>0);
  await page.locator('.copyright').screenshot({path:`${output}/footer-${width}.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);
  results.push({width,mobileUnchanged:width<=1100?true:undefined,desktopChanged:width>1100?true:undefined,footerLink:await link.getAttribute('href'),errors});await page.close();
 }
 console.log('Edge : hero mobile/tablette inchangé à 375/430/1024, overlay desktop actif à 1440 sans déplacement ; logo Bloop chargé dans le lien existant. Aucun formulaire envoyé.');
}finally{await browser.close();await writeFile(`${output}/results.json`,JSON.stringify(results,null,2));}
