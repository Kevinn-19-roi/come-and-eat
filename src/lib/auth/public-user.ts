import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export type PublicUserContext = {
  id: string;
  email: string;
  displayName: string;
  role: 'customer' | 'vendor' | 'admin' | 'super_admin';
  hasRestaurant: boolean;
  platformPermissions?:string[];
};

export const getPublicUser = cache(async (): Promise<PublicUserContext | null> => {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const [{ data: profile, error: profileError }, { count, error: memberError }] = await Promise.all([
    db.from('profiles').select('display_name,role').eq('id', user.id).maybeSingle(),
    db.from('restaurant_members').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
  ]);
  if (profileError || memberError) {
    console.error('[public-auth] context_failed', { profile: profileError?.code, members: memberError?.code });
    return null;
  }
  const {data:permissions}=await db.rpc('my_platform_permissions');
  return {
    id: user.id,
    email: user.email ?? '',
    displayName: profile?.display_name ?? '',
    role: (profile?.role ?? 'customer') as PublicUserContext['role'],
    hasRestaurant: (count ?? 0) > 0,
    platformPermissions:(permissions??[]) as string[],
  };
});
