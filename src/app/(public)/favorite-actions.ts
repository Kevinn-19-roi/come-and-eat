'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

type FavoriteTarget = { restaurantId?: string; productId?: string };

export async function toggleFavorite(target: FavoriteTarget) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, loginRequired: true, active: false };
  if (Boolean(target.restaurantId) === Boolean(target.productId)) return { ok: false, active: false };

  let query = db.from('favorites').select('id').eq('user_id', user.id);
  query = target.restaurantId
    ? query.eq('restaurant_id', target.restaurantId)
    : query.eq('product_id', target.productId!);
  const { data: existing, error: readError } = await query.maybeSingle();
  if (readError) return { ok: false, active: false };

  if (existing) {
    const { error } = await db.from('favorites').delete().eq('id', existing.id);
    if (error) return { ok: false, active: true };
  } else {
    const { error } = await db.from('favorites').insert({
      user_id: user.id,
      restaurant_id: target.restaurantId ?? null,
      product_id: target.productId ?? null,
    });
    if (error) return { ok: false, active: false };
  }
  revalidatePath('/favorites');
  return { ok: true, active: !existing };
}
