import 'server-only';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
export async function requirePermission(permission:string){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)redirect('/login?next=/account');
 const {data,error}=await db.rpc('has_platform_permission',{permission});
 if(error||data!==true)redirect('/account?access=denied');
 return {db,user};
}
