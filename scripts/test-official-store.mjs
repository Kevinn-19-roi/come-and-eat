import assert from 'node:assert/strict';
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '');
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(url && key, 'Variables Supabase publiques manquantes.');
const db = createClient(url.replace(/\/rest\/v1\/?$/, ''), key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await db.from('restaurants').select('id,name,slug,is_official,validation_status').eq('is_official', true);
assert.ifError(error);
assert.equal(data?.length, 1, 'Une seule boutique officielle doit exister.');
assert.equal(data?.[0]?.validation_status, 'approved', 'La boutique officielle doit être approuvée.');
console.log('Boutique officielle unique et lisible publiquement: validé.');
