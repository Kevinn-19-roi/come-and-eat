import {timingSafeEqual} from 'node:crypto';
import {processV2Notifications} from '@/lib/notifications/v2-worker';
export const maxDuration=60;
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||process.env.V2_NOTIFICATION_WORKER_ENABLED!=='true')return Response.json({error:'Service désactivé'},{status:503});
 const provided=request.headers.get('authorization')??'';const expected=`Bearer ${secret}`;
 if(Buffer.byteLength(provided)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(provided),Buffer.from(expected)))return Response.json({error:'Accès refusé'},{status:401});
 const result=await processV2Notifications();return Response.json(result,{status:result.error?503:200,headers:{'Cache-Control':'no-store'}});
}
