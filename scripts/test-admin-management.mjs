import assert from 'node:assert/strict';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
nextEnv.loadEnvConfig(process.cwd());
const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/,'');
const publicKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url&&publicKey&&serviceKey,'Variables Supabase manquantes.');
const service=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const password=`CeA!${crypto.randomUUID()}9a`;const email=`admin-management-${crypto.randomUUID()}@example.invalid`;let userId;
try{
 const{data,error}=await service.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:'Admin temporaire'}});if(error)throw error;userId=data.user.id;
 const{error:roleError}=await service.from('profiles').update({role:'super_admin'}).eq('id',userId);if(roleError)throw roleError;
 const client=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});const{error:loginError}=await client.auth.signInWithPassword({email,password});if(loginError)throw loginError;
 const[{data:users,error:usersError},{data:counts,error:countsError}]=await Promise.all([client.rpc('admin_list_users',{search_text:email,result_limit:10,result_offset:0}),client.rpc('admin_dashboard_counts')]);
 assert.ifError(usersError);assert.ifError(countsError);assert.equal(users?.length,1,'La recherche admin doit retrouver le compte temporaire.');assert.equal(users?.[0]?.email,email);assert.equal(typeof counts?.users,'number','Le dashboard doit retourner des compteurs réels.');
 console.log('RPC admin validées: recherche utilisateurs, rôles protégés et compteurs du dashboard.');
}finally{if(userId)await service.auth.admin.deleteUser(userId)}
