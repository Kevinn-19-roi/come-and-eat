export function getSupabasePublicEnv(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const anonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY??process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url)throw new Error('SUPABASE_URL_MISSING');if(!anonKey)throw new Error('SUPABASE_PUBLIC_KEY_MISSING');
 return {url:url.replace(/\/rest\/v1\/?$/,''),anonKey};
}
export function isSupabaseConfigured(){return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY??process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY))}
