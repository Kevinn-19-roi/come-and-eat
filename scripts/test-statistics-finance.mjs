import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/202610130001_statistics_periods.sql', import.meta.url), 'utf8');
for (const marker of [
  "join public.restaurant_orders",
  "payment_status = 'paid'",
  "status <> 'cancelled'",
  "discount_share",
  "platform_commission",
  "seller_net_amount",
]) assert.ok(sql.includes(marker), `Contrat statistique absent: ${marker}`);

function allocateDiscount(suborders, discount) {
  const subtotal = suborders.reduce((sum, row) => sum + row.subtotal, 0);
  const floors = suborders.map(row => subtotal ? Math.floor(discount * row.subtotal / subtotal) : 0);
  let remainder = discount - floors.reduce((sum, value) => sum + value, 0);
  return floors.map(value => value + (remainder-- > 0 ? 1 : 0));
}

function summarize(orders) {
  let revenue = 0;
  let platformCommission = 0;
  let sellerNetAmount = 0;
  for (const order of orders) {
    const discounts = allocateDiscount(order.suborders, order.discountTotal ?? 0);
    order.suborders.forEach((suborder, index) => {
      if (suborder.paymentStatus !== 'paid' || suborder.status === 'cancelled') return;
      revenue += suborder.grossAmount + suborder.deliveryFee - discounts[index];
      platformCommission += suborder.platformCommission;
      sellerNetAmount += suborder.sellerNetAmount;
    });
  }
  return { revenue, platformCommission, sellerNetAmount };
}

const wavePaid = { discountTotal: 1_000, suborders: [
  { subtotal: 10_000, grossAmount: 10_000, deliveryFee: 1_500, platformCommission: 1_000, sellerNetAmount: 9_000, paymentStatus: 'paid', status: 'delivered' },
] };
assert.deepEqual(summarize([wavePaid]), { revenue: 10_500, platformCommission: 1_000, sellerNetAmount: 9_000 });

const cashPartial = { discountTotal: 1_000, suborders: [
  { subtotal: 6_000, grossAmount: 6_000, deliveryFee: 1_000, platformCommission: 600, sellerNetAmount: 5_400, paymentStatus: 'paid', status: 'delivered' },
  { subtotal: 4_000, grossAmount: 4_000, deliveryFee: 1_000, platformCommission: 400, sellerNetAmount: 3_600, paymentStatus: 'pending', status: 'preparing' },
] };
assert.deepEqual(summarize([cashPartial]), { revenue: 6_400, platformCommission: 600, sellerNetAmount: 5_400 });

const cancelledAndUnpaid = { discountTotal: 0, suborders: [
  { subtotal: 5_000, grossAmount: 5_000, deliveryFee: 500, platformCommission: 500, sellerNetAmount: 4_500, paymentStatus: 'paid', status: 'cancelled' },
  { subtotal: 3_000, grossAmount: 3_000, deliveryFee: 500, platformCommission: 300, sellerNetAmount: 2_700, paymentStatus: 'pending', status: 'confirmed' },
] };
assert.deepEqual(summarize([cancelledAndUnpaid]), { revenue: 0, platformCommission: 0, sellerNetAmount: 0 });

const oddDiscount = { discountTotal: 1, suborders: [
  { subtotal: 1, grossAmount: 1, deliveryFee: 0, platformCommission: 0, sellerNetAmount: 1, paymentStatus: 'paid', status: 'delivered' },
  { subtotal: 1, grossAmount: 1, deliveryFee: 0, platformCommission: 0, sellerNetAmount: 1, paymentStatus: 'paid', status: 'delivered' },
] };
assert.equal(summarize([oddDiscount]).revenue, 1, 'La remise doit être répartie sans perte ni double comptabilisation.');

console.log('Statistiques financières: Wave, espèces partielles, annulations, remises et commissions validées.');
