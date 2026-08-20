import 'server-only';import {createClient} from '@supabase/supabase-js';import {getSupabasePublicEnv} from './env';
export function createPublicClient(){const{url,anonKey}=getSupabasePublicEnv();return createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false}})}
