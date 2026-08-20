import 'server-only';import {createClient} from '@supabase/supabase-js';import {getSupabasePublicEnv} from './env';
export function createAdminClient(){const {url}=getSupabasePublicEnv();const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!serviceKey)throw new Error('Clé Supabase serveur manquante.');return createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}})}
