import 'server-only';import {createClient} from '@supabase/supabase-js';import {getSupabasePublicEnv} from './env';
export function createPublicClient(){const{url,publicKey}=getSupabasePublicEnv();return createClient(url,publicKey,{auth:{autoRefreshToken:false,persistSession:false}})}
