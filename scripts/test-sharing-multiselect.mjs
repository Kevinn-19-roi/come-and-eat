import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const detail = read('src/components/product-detail.tsx');
const share = read('src/components/share-button.tsx');
const restaurant = read('src/app/(public)/restaurants/[slug]/page.tsx');
const product = read('src/app/(public)/menu/[slug]/page.tsx');
const vendor = read('src/app/vendor/actions.ts');
const admin = read('src/app/admin/store/actions.ts');
const migration = read('supabase/migrations/202609070002_multiselect_product_options.sql');

assert.match(share, /navigator\.share/);
assert.match(share, /navigator\.clipboard\.writeText/);
assert.match(share, /https:\/\/comeandeat\.org/);
assert.match(restaurant, /alternates:\s*\{ canonical/);
assert.match(product, /openGraph:/);
assert.match(detail, /type="checkbox"/);
assert.doesNotMatch(detail, /type=\{group\.multiple\?'checkbox':'radio'\}/);
assert.match(detail, /group\.maxChoices&&inGroup\.length>=group\.maxChoices/);
assert.match(detail, /old\.filter\(x=>x\.optionId!==option\.id\)/);
assert.match(vendor, /limit_enabled/);
assert.match(admin, /limit_enabled/);
assert.match(migration, /max_choices = null/);
console.log('Partage canonique, feedback et options multi-sélection: contrats validés.');
