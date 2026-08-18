// Point d’entrée réservé au futur adaptateur Supabase.
// Les composants dépendent des interfaces repository, jamais de ce module directement.
export const supabaseConfigured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
