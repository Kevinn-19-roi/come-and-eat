import 'server-only';
import {requireAdmin} from '@/lib/auth/admin';
import {createAdminClient} from '@/lib/supabase/admin';
import {collectUserPage,type UserSource} from '@/lib/admin-users-data';
export async function authorizedUserSource():Promise<UserSource>{
 await requireAdmin(); // Must precede creation of the privileged server-only client.
 const db=createAdminClient();
 return {
  async accounts(page){const {data,error}=await db.auth.admin.listUsers({page,perPage:200});if(error)throw error;return data.users;},
  async profiles(ids){const {data,error}=await db.from('profiles').select('id,display_name,phone,role').in('id',ids);if(error)throw error;return data??[];},
  async memberships(ids){const result:Record<string,Array<{name:string;member_role:string}>>={};for(let start=0;;start+=1000){const {data,error}=await db.from('restaurant_members').select('user_id,role,restaurant:restaurants(name)').in('user_id',ids).order('restaurant_id').order('user_id').range(start,start+999);if(error)throw error;for(const member of data??[]){const restaurant=Array.isArray(member.restaurant)?member.restaurant[0]:member.restaurant;if(restaurant?.name)(result[member.user_id]??=[]).push({name:restaurant.name,member_role:member.role});}if(!data||data.length<1000)return result;}},
 };
}
export async function getUserPage(filters:{q?:string;role?:string},page:number){return collectUserPage(await authorizedUserSource(),filters,page);}
