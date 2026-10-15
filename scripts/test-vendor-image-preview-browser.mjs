import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'@playwright/test');
const url=process.env.QA_PUBLIC_IMAGE_URL;
assert.ok(url?.startsWith('https://pazddhyqojhrdinaqryu.supabase.co/storage/v1/object/public/restaurant-media/'));
const browser=await chromium.launch({channel:'msedge',headless:true});
await mkdir('artifacts/vendor-image-preview',{recursive:true});
try{
 for(const width of [375,1440]){
  const page=await browser.newPage({viewport:{width,height:900}});
  // Rendering fixture only: real public Storage GETs, never upload/auth/write.
  await page.setContent('<main><h1>Aperçus — fixture QA</h1><section style="display:flex;flex-wrap:wrap;gap:16px"><figure><figcaption>Logo</figcaption><img width="180" height="180" style="object-fit:cover"></figure><figure><figcaption>Couverture</figcaption><img width="280" height="160" style="object-fit:cover"></figure></section></main>');
  await page.locator('img').evaluateAll((images,src)=>images.forEach(img=>img.src=src),url);
  await page.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0));
  assert.equal(await page.locator('img').count(),2);
  await page.screenshot({path:`artifacts/vendor-image-preview/direct-storage-${width}.png`});
  await page.reload(); // setContent fixture isn't persisted; recheck direct URL separately.
  const response=await page.goto(url);assert.equal(response.status(),200);
  assert.equal(await page.locator('img').evaluate(img=>img.naturalWidth>0),true);
  await page.close();
 }
 console.log('Edge 375/1440: real existing Storage PNG renders directly in logo/cover fixtures and reloads. Not an authenticated upload/persistence test.');
}finally{await browser.close();}
