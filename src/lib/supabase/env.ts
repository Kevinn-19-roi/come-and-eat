const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabasePublicKey = supabasePublishableKey || supabaseAnonKey;

export function getSupabasePublicEnv() {
  if (!supabaseUrl) throw new Error("SUPABASE_URL_MISSING");
  if (!supabasePublicKey) throw new Error("SUPABASE_PUBLIC_KEY_MISSING");

  return {
    url: supabaseUrl.replace(/\/rest\/v1\/?$/, ""),
    publicKey: supabasePublicKey,
  };
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabasePublicKey);
}
