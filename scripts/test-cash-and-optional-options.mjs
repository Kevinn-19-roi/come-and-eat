import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [migration, checkout, checkoutAction, vendorAction, tracking, adminOrder, vendorOrder, whatsapp, emails, adminCsv, vendorCsv, about, content] = await Promise.all([
  read("supabase/migrations/202609070001_cash_payments_optional_options_story.sql"),
  read("src/components/checkout-form.tsx"), read("src/app/(public)/checkout/actions.ts"),
  read("src/app/vendor/actions.ts"), read("src/components/order-status.tsx"),
  read("src/app/admin/orders/[id]/page.tsx"), read("src/app/vendor/(panel)/orders/[id]/page.tsx"),
  read("src/lib/whatsapp.ts"), read("src/lib/notifications/templates.ts"),
  read("src/app/admin/orders/export/route.ts"), read("src/app/vendor/(panel)/orders/export/route.ts"),
  read("src/app/(public)/about/page.tsx"), read("src/app/admin/content/page.tsx"),
]);

assert.match(migration, /payment_method in \('wave','cash'\)/);
assert.match(migration, /confirm_cash_collection/);
assert.match(migration, /public\.is_restaurant_member\(v_sub\.restaurant_id\)/);
assert.match(migration, /v_order\.payment_method<>'cash'/);
assert.match(migration, /if v_method='wave' then insert into public\.payment_attempts/);
assert.match(migration, /type in \('accompaniment','drink','supplement'\)/);
assert.match(migration, /set is_required=false,min_choices=0/);
assert.match(checkout, /Choisissez votre moyen de paiement/);
assert.match(checkout, /value="cash"/);
assert.match(checkoutAction, /payment_method:input\.paymentMethod/);
assert.match(checkoutAction, /sendCashOrderNotifications/);
assert.doesNotMatch(vendorAction, /Accompagnements", required: true/);
assert.match(tracking, /À régler à la livraison/);
assert.match(adminOrder, /Marquer comme encaissé/);
assert.match(vendorOrder, /Marquer comme encaissé/);
assert.match(whatsapp, /Espèces —/);
assert.match(emails, /Paiement en espèces/);
for (const csv of [adminCsv, vendorCsv]) {
  assert.match(csv, /Moyen de paiement/);
  assert.match(csv, /Statut du paiement/);
}
assert.match(about, /getPublicSiteContent/);
assert.match(content, /Photo de la section Histoire|Section Histoire/);
console.log("Paiement espèces, options facultatives, histoire et exports validés.");
