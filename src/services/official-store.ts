import 'server-only';
import { createClient } from '@/lib/supabase/server';

export async function getOfficialStore() {
  const db = await createClient();
  const { data, error } = await db.from('restaurants').select('*').eq('is_official', true).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('OFFICIAL_STORE_NOT_FOUND');
  return data;
}

export async function getOfficialStoreDetails() {
  const db = await createClient();
  const store = await getOfficialStore();
  const [{ data: cuisines, error: cuisineError }, { data: hours, error: hoursError }, { data: media, error: mediaError }] = await Promise.all([
    db.from('restaurant_cuisine_types').select('cuisine_type_id').eq('restaurant_id', store.id),
    db.from('restaurant_hours').select('*').eq('restaurant_id', store.id).order('day_of_week'),
    db.from('media').select('id,path,file_name,alt_text,type,restaurant_id,created_at').eq('restaurant_id', store.id).order('created_at', { ascending: false }),
  ]);
  if (cuisineError || hoursError || mediaError) throw cuisineError ?? hoursError ?? mediaError;
  return {
    store,
    cuisineIds: (cuisines ?? []).map((row) => row.cuisine_type_id),
    hours: hours ?? [],
    media: (media ?? []).map((row) => ({ ...row, publicUrl: db.storage.from('restaurant-media').getPublicUrl(row.path).data.publicUrl })),
  };
}
