import {timingSafeEqual} from 'node:crypto';
import {createAdminClient} from '@/lib/supabase/admin';

export const maxDuration=60;
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||process.env.V2_SCHEDULING_WORKER_ENABLED!=='true')return Response.json({error:'Service désactivé'},{status:503,headers:{'Cache-Control':'no-store'}});
 const provided=request.headers.get('authorization')??'',expected=`Bearer ${secret}`;
 if(Buffer.byteLength(provided)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(provided),Buffer.from(expected)))return Response.json({error:'Accès refusé'},{status:401});
 const db=createAdminClient();
 const {data:expired,error}=await db.rpc('expire_subscriptions');
 if(error)return Response.json({error:'Expiration indisponible'},{status:503});
 const {data:queued,error:queueError}=await db.rpc('enqueue_due_scheduled_pickups');
 return Response.json({expired,queued,error:queueError?'Rappels indisponibles':undefined},{status:queueError?503:200,headers:{'Cache-Control':'no-store'}});
}
