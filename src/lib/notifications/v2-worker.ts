import 'server-only';
import {createAdminClient} from '@/lib/supabase/admin';
import {getEmailProvider,isEmailProviderConfigured} from './provider';
import {v2NotificationTemplate} from './templates';
export async function processV2Notifications(){
 if(process.env.V2_NOTIFICATION_WORKER_ENABLED!=='true'||!isEmailProviderConfigured())return {enabled:false,processed:0};
 const db=createAdminClient();const {data:setting,error:settingError}=await db.from('site_settings').select('value').eq('key','email').maybeSingle();
 if(settingError)return {enabled:true,processed:0,error:'settings_unavailable'};
 const settings=(setting?.value??{}) as Record<string,unknown>;if(settings.enabled===false||settings.enabled==='false')return {enabled:false,processed:0};
 if(process.env.V2_SCHEDULING_WORKER_ENABLED==='true'){
  const {error:queueError}=await db.rpc('enqueue_due_scheduled_pickups');
  if(queueError)return {enabled:true,processed:0,error:'scheduled_queue_failed'};
 }
 const {data:jobs,error}=await db.rpc('claim_v2_notifications',{batch_size:3});if(error)return {enabled:true,processed:0,error:'claim_failed'};
 let processed=0;for(const job of (jobs??[]) as {id:string;event_key:string;event_type:string;recipient:string;payload:Record<string,unknown>;lock_token:string}[]){
  const template=v2NotificationTemplate(job.event_type,job.payload??{});
  const validRecipient=/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(job.recipient)&&job.recipient.length<=254;
  const result=template&&validRecipient?await getEmailProvider(String(settings.sender_name||'Come & Eat')).send({...template,to:job.recipient,idempotencyKey:job.event_key,replyTo:typeof settings.reply_to==='string'?settings.reply_to:undefined}):{sent:false,errorCode:'unsupported_event_or_recipient',providerId:undefined};
  const {error:finishError}=await db.rpc('finish_v2_notification',{target:job.id,lease:job.lock_token,success:result.sent,result_code:result.errorCode?.slice(0,100)??null,provider_message:result.providerId?.slice(0,200)??null});
  if(finishError)console.error('[v2-notifications] acknowledgement_failed',{code:finishError.code});else processed++;
 }
 return {enabled:true,processed};
}
