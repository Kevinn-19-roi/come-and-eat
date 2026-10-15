import 'server-only';
import {createClient} from '@/lib/supabase/server';
export type AdminRecentOrder={id:string;reference:string;customerName:string;fulfillment:'delivery'|'pickup';total:number;paymentStatus:string;createdAt:string};
export type AdminDashboardData={ordersToday:number;revenueToday:number;periodStartedAt:string;pendingOrders:number;preparingOrders:number;unavailableProducts:number;pendingRestaurants:number;pendingApplications:number;activeRestaurants:number;suspendedRestaurants:number;activeProducts:number;hiddenProducts:number;users:number;activePromotions:number;recentOrders:AdminRecentOrder[];recentRestaurants:{id:string;name:string;status:string;createdAt:string}[];recentApplications:{id:string;restaurantName:string;status:string;createdAt:string}[]};
function logQueryError(query:string,error:{code?:string}|null){if(error)console.error('[admin-dashboard] query_failed',{query,code:error.code})}
export async function getAdminDashboardData():Promise<AdminDashboardData>{
 const db=await createClient();const{data:period}=await db.from('statistics_periods').select('starts_at').is('ended_at',null).order('starts_at',{ascending:false}).limit(1).maybeSingle();const start=period?.starts_at??new Date(0).toISOString();
 const[summaryResult,ordersResult,restaurantOrdersResult,productsResult,restaurantsResult,applicationsResult,countsResult,recentRestaurantsResult,recentApplicationsResult]=await Promise.all([
  db.rpc('admin_statistics_summary',{period_start:start}),
  db.from('orders').select('id,reference,customer_name,fulfillment,total,payment_status,created_at').gte('created_at',start).order('created_at',{ascending:false}).limit(8),
  db.from('restaurant_orders').select('status').in('status',['pending','confirmed','preparing']),
  db.from('products').select('*',{count:'exact',head:true}).eq('availability',false).eq('is_archived',false),
  db.from('restaurants').select('*',{count:'exact',head:true}).eq('validation_status','pending_review'),
  db.from('seller_applications').select('*',{count:'exact',head:true}).in('status',['submitted','under_review']),
  db.rpc('admin_dashboard_counts'),
  db.from('restaurants').select('id,name,validation_status,created_at').order('created_at',{ascending:false}).limit(5),
  db.from('seller_applications').select('id,restaurant_name,status,created_at').order('created_at',{ascending:false}).limit(5)
 ]);
 [['statistics_summary',summaryResult.error],['recent_orders',ordersResult.error],['restaurant_orders',restaurantOrdersResult.error],['unavailable_products',productsResult.error],['pending_restaurants',restaurantsResult.error],['pending_applications',applicationsResult.error],['dashboard_counts',countsResult.error]].forEach(([name,error])=>logQueryError(String(name),error as {code?:string}|null));
 const summary=(summaryResult.data??{}) as Record<string,number>;const orders=ordersResult.data??[];const operational=restaurantOrdersResult.data??[];const counts=(countsResult.data??{}) as Record<string,number>;
 return{ordersToday:Number(summary.orders??0),revenueToday:Number(summary.revenue??0),periodStartedAt:start,pendingOrders:operational.filter(row=>row.status==='pending'||row.status==='confirmed').length,preparingOrders:operational.filter(row=>row.status==='preparing').length,unavailableProducts:productsResult.count??0,pendingRestaurants:restaurantsResult.count??0,pendingApplications:applicationsResult.count??0,activeRestaurants:counts.activeRestaurants??0,suspendedRestaurants:counts.suspendedRestaurants??0,activeProducts:counts.activeProducts??0,hiddenProducts:counts.hiddenProducts??0,users:counts.users??0,activePromotions:counts.activePromotions??0,recentOrders:orders.map(row=>({id:row.id,reference:row.reference,customerName:row.customer_name??'Client',fulfillment:row.fulfillment,total:row.total??0,paymentStatus:row.payment_status,createdAt:row.created_at})),recentRestaurants:(recentRestaurantsResult.data??[]).map(row=>({id:row.id,name:row.name,status:row.validation_status,createdAt:row.created_at})),recentApplications:(recentApplicationsResult.data??[]).map(row=>({id:row.id,restaurantName:row.restaurant_name,status:row.status,createdAt:row.created_at}))};
}
