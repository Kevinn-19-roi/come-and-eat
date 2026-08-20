import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';

const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabaseAnonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabasePublicKey=supabasePublishableKey||supabaseAnonKey;

export async function proxy(request:NextRequest){
  const isVendor=request.nextUrl.pathname.startsWith('/vendor');
  const loginPath=isVendor?`/login?next=${encodeURIComponent(request.nextUrl.pathname)}`:'/admin/login';
  try{
    if(!supabaseUrl||!supabasePublicKey){console.error('[auth-proxy] configuration_missing');return NextResponse.redirect(new URL(isVendor?loginPath:`${loginPath}?error=service`,request.url))}
    let response=NextResponse.next({request});
    const db=createServerClient(supabaseUrl.replace(/\/rest\/v1\/?$/,''),supabasePublicKey,{cookies:{getAll:()=>request.cookies.getAll(),setAll(values){values.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});values.forEach(({name,value,options})=>response.cookies.set(name,value,options))}}});
    const{data:{user},error:userError}=await db.auth.getUser();
    if(userError||!user)return NextResponse.redirect(new URL(loginPath,request.url));
    if(isVendor)return response;
    const{data:profile,error:profileError}=await db.from('profiles').select('role').eq('id',user.id).maybeSingle();
    if(profileError){console.error('[admin-auth] proxy_profile_read_failed',{code:profileError.code});return NextResponse.redirect(new URL('/admin/login?error=service',request.url))}
    if(!profile||!['admin','super_admin'].includes(profile.role))return NextResponse.redirect(new URL('/admin/login?error=acces',request.url));
    return response;
  }catch(error){console.error('[auth-proxy] unexpected_failure',{name:(error as{name?:string})?.name});return NextResponse.redirect(new URL(isVendor?loginPath:`${loginPath}?error=service`,request.url))}
}
export const config={matcher:['/admin','/admin/((?!login(?:/|$)).*)','/vendor','/vendor/((?!login(?:/|$)).*)']};
