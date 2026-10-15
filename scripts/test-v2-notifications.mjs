import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=(await readFile('src/lib/notifications/templates.ts','utf8'))
 .replace(/import\s+["']server-only["'];?/,'')
 .replace(/import\s*\{\s*formatPrice\s*\}\s*from\s*["']@\/lib\/utils["'];?/,'const formatPrice = value => `${value} FCFA`;');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {v2NotificationTemplate,orderReceivedTemplate}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const whatsappJs=ts.transpileModule(await readFile('src/lib/whatsapp.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {buildRestaurantOrderWhatsAppLink}=await import('data:text/javascript;base64,'+Buffer.from(whatsappJs).toString('base64'));
const previous=process.env.NEXT_PUBLIC_SITE_URL;process.env.NEXT_PUBLIC_SITE_URL='https://comeandeat.org';
try{
 for(const event of ['catering_received','catering_quote_published','team_invitation']){
  const template=v2NotificationTemplate(event,{name:'Awa <script>test</script>',url:'https://hostile.invalid'});
  assert.ok(template?.subject);assert.match(template.html,/https:\/\/comeandeat\.org\/brand\/come-eat-email-logo\.png/);
  assert.match(template.html,/alt="Come & Eat"/);assert.ok(!template.html.includes('<script>'));assert.ok(!template.html.includes('hostile.invalid'));assert.match(template.text,/https:\/\/comeandeat\.org\/account\//);
 }
 assert.equal(v2NotificationTemplate('unknown_event',{}),null);
 const prepaid=orderReceivedTemplate({reference:'QA-PREPAID',total:1450,subscriptionCredit:1450,paymentMethod:'wave',paymentStatus:'paid'});
 assert.match(prepaid.text,/Aucun nouveau paiement/);assert.doesNotMatch(prepaid.text,/Paiement à vérifier/);
 const partial=orderReceivedTemplate({reference:'QA-EXTRAS',total:3150,subscriptionCredit:1450,paymentMethod:'wave',paymentStatus:'pending'});
 assert.match(partial.text,/1700 FCFA/);assert.match(partial.text,/Paiement à vérifier/);
 const link=buildRestaurantOrderWhatsAppLink({number:'+225 07 00 00 00 00',restaurantName:'Chez A',reference:'QA-PREPAID',customerName:'Awa',customerPhone:'+2250700000000',fulfillment:'pickup',zone:null,address:null,instructions:null,items:[{quantity:1,product_name:'Attiéké',options:[{name:'Alloco'}]}],amount:1450,subscriptionCredit:1450,paymentMethod:'wave',paymentStatus:'paid'});
 const parsed=new URL(link);assert.equal(parsed.pathname,'/2250700000000');assert.match(parsed.searchParams.get('text'),/réglé par abonnement prépayé/);assert.doesNotMatch(parsed.searchParams.get('text'),/Wave — Vérifié/);assert.match(parsed.searchParams.get('text'),/Attiéké/);
 const reminder=v2NotificationTemplate('scheduled_order_ready',{name:'Restaurant <script>',reference:'CEA-TEST',scheduledAt:'20/10/2026 12:00'});
 assert.match(reminder.html,/CEA-TEST/);assert.match(reminder.text,/20\/10\/2026 12:00/);assert.match(reminder.text,/\/vendor\/planning/);assert.ok(!reminder.html.includes('<script>'));assert.match(reminder.text,/ne confirme pas un encaissement/);
 const worker=await readFile('src/lib/notifications/v2-worker.ts','utf8');
 assert.ok(worker.indexOf("V2_NOTIFICATION_WORKER_ENABLED!=='true'")<worker.indexOf('const db=createAdminClient()'));
 const route=await readFile('src/app/api/internal/v2-notifications/route.ts','utf8');assert.match(route,/timingSafeEqual/);assert.match(route,/Cache-Control.*no-store/);
 console.log('Templates V2 réellement exécutés après transpilation isolée : HTML/texte, branding, échappement, liens fixes et événement inconnu validés. Worker désactivé par défaut. Aucun envoi Resend effectué.');
}finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_SITE_URL;else process.env.NEXT_PUBLIC_SITE_URL=previous;}
