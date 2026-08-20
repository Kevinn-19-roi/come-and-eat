'use client';
import {createBrowserClient} from '@supabase/ssr';import {getSupabasePublicEnv} from './env';
let client:ReturnType<typeof createBrowserClient>|undefined;
export function createClient(){const {url,anonKey}=getSupabasePublicEnv();client??=createBrowserClient(url,anonKey);return client}
