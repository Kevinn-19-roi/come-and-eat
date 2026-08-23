import assert from 'node:assert/strict';import fs from 'node:fs';
const sql=fs.readFileSync(new URL('../supabase/migrations/202608230001_secure_payments_checkout.sql',import.meta.url),'utf8');
for(const marker of ['payment_attempts','payment_events','checkout_idempotency_key','public_tracking_token','platform_commission','seller_net_amount','get_public_order_status','place_marketplace_order'])assert.ok(sql.includes(marker),`Élément paiement manquant: ${marker}`);
assert.match(sql,/unique\(provider,idempotency_key\)/);assert.match(sql,/p\.availability and not p\.is_archived and not p\.hidden_by_admin/);assert.match(sql,/r\.validation_status='approved' and r\.operating_status='open'/);assert.match(sql,/grant execute on function public\.get_public_order_status\(text,uuid\) to anon,authenticated/);
const checkout=fs.readFileSync(new URL('../src/components/checkout-form.tsx',import.meta.url),'utf8');assert.ok(!checkout.includes('unitPrice:item.unitPrice'));assert.ok(checkout.includes('idempotencyKey:key.current'));assert.ok(checkout.includes('optionIds:item.selections.map'));
const config=fs.readFileSync(new URL('../src/config/site.ts',import.meta.url),'utf8');assert.ok(config.includes('https://pay.wave.com/m/M_ci_4k5NBZ8a_cwl/c/ci/'));
console.log('Checkout serveur, idempotence, suivi privé, Wave et commissions validés.');
