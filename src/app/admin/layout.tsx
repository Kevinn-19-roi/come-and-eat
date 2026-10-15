import {AdminShell} from '@/components/admin-shell';
import {AdminV2Navigation} from '@/components/admin-v2-navigation';
import {createClient} from '@/lib/supabase/server';
export const metadata={title:'Administration | Come & Eat',robots:{index:false,follow:false}};
export default async function Layout({children}:{children:React.ReactNode}){const db=await createClient();const {data:{user}}=await db.auth.getUser();const [{data},{data:profile}]=await Promise.all([user?db.rpc('my_platform_permissions'):Promise.resolve({data:[]}),user?db.from('profiles').select('role').eq('id',user.id).maybeSingle():Promise.resolve({data:null})]);const navigation=<AdminV2Navigation permissions={(data??[]) as string[]}/>;if(user&&profile&&!['admin','super_admin'].includes(profile.role))return <div className="admin-content"><h1>Mon espace Come & Eat</h1>{navigation}{children}</div>;return <AdminShell>{navigation}{children}</AdminShell>}
