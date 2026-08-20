'use client';
import {createBrowserClient} from '@supabase/ssr';import {getSupabasePublicEnv} from './env';
let client:ReturnType<typeof createBrowserClient>|undefined;
export function createClient(){const {url,publicKey}=getSupabasePublicEnv();client??=createBrowserClient(url,publicKey);return client}
