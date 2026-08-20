export function getSupabasePublicEnv(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const anonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!anonKey)throw new Error('Configuration Supabase publique manquante.');
 return {url:url.replace(/\/rest\/v1\/?$/,''),anonKey};
}
export function isSupabaseConfigured(){return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)}
