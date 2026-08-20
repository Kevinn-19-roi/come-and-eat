import 'server-only';
import {cache} from 'react';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import type {RestaurantMemberRole,RestaurantValidationStatus} from '@/types/marketplace';

export type VendorRestaurant={id:string;name:string;slug:string;role:RestaurantMemberRole;operatingStatus:'open'|'closed'|'paused';validationStatus:RestaurantValidationStatus};
export type VendorContext={userId:string;displayName:string;profileRole:string;restaurants:VendorRestaurant[];restaurant?:VendorRestaurant;canManage:boolean;canOperate:boolean};

export const getVendorContext=cache(async():Promise<VendorContext>=>{
  const db=await createClient();
  const{data:{user},error:userError}=await db.auth.getUser();
  if(userError||!user)redirect('/vendor/login');
  const[{data:profile,error:profileError},{data:members,error:memberError}]=await Promise.all([
    db.from('profiles').select('display_name,role').eq('id',user.id).maybeSingle(),
    db.from('restaurant_members').select('role,restaurant:restaurants(id,name,slug,operating_status,validation_status)').eq('user_id',user.id),
  ]);
  if(profileError||memberError){console.error('[vendor-auth] context_failed',{profile:profileError?.code,members:memberError?.code});throw new Error('VENDOR_CONTEXT_FAILED')}
  const restaurants=(members??[]).flatMap(row=>{const raw=row.restaurant as unknown as Record<string,unknown>|null;if(!raw)return[];return[{id:String(raw.id),name:String(raw.name),slug:String(raw.slug),role:row.role as RestaurantMemberRole,operatingStatus:raw.operating_status as VendorRestaurant['operatingStatus'],validationStatus:raw.validation_status as RestaurantValidationStatus}]});
  const cookieStore=await cookies();const requested=cookieStore.get('ce_vendor_restaurant')?.value;
  const restaurant=restaurants.find(item=>item.id===requested)??restaurants[0];
  return{userId:user.id,displayName:profile?.display_name??'',profileRole:profile?.role??'customer',restaurants,restaurant,canManage:restaurant?.role==='owner'||restaurant?.role==='manager',canOperate:Boolean(restaurant)};
});

export async function requireVendor(){const context=await getVendorContext();if(!context.restaurant)redirect('/vendor/application');if(context.restaurant.validationStatus==='suspended')redirect('/vendor/application?status=suspended');return context}
export async function requireVendorManager(){const context=await requireVendor();if(!context.canManage)redirect('/vendor?error=permissions');return context}
