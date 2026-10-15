'use server';
import {createHmac} from 'node:crypto';
import {headers} from 'next/headers';
import {createAdminClient} from '@/lib/supabase/admin';
import {getEmailProvider,isEmailProviderConfigured} from '@/lib/notifications/provider';
import {validateContact} from '@/lib/contact-validation';
export type ContactState={error?:string;message?:string};
export async function sendContact(_state:ContactState,form:FormData):Promise<ContactState>{
  if(String(form.get('website')??'')) return {message:'Votre message a bien été envoyé.'};
  let input:ReturnType<typeof validateContact>;
  try{input=validateContact(form)}catch(error){return {error:(error as Error).message}}
  try{
    const db=createAdminClient();
    const {data,error}=await db.from('site_settings').select('value').eq('key','email').maybeSingle();
    if(error) throw new Error('settings_read_failed');
    const settings=(data?.value??{}) as Record<string,unknown>;
    const recipient=String(process.env.EMAIL_CONTACT_RECIPIENT||settings.contact_recipient||settings.admin_recipient||process.env.EMAIL_ADMIN_RECIPIENT||'');
    if(!isEmailProviderConfigured()||settings.enabled===false||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient)) return {error:'Le formulaire est momentanément indisponible. Utilisez les coordonnées ci-contre.'};
    const h=await headers();
    const ip=h.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()||h.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
    const hash=(v:string)=>createHmac('sha256',process.env.SUPABASE_SERVICE_ROLE_KEY!).update(v).digest('hex');
    const fingerprint=hash(`${input.email}\n${input.name}\n${input.phone}\n${input.message}`);
    const claim=await db.rpc('claim_contact_message',{ip_hash:hash(ip),email_hash:hash(input.email),message_hash:fingerprint});
    if(claim.error) throw new Error('contact_claim_failed');
    if(claim.data==='duplicate') return {error:'Un message identique a été soumis récemment. Attendez dix minutes avant de réessayer.'};
    if(claim.data!=='accepted') return {error:'Vous avez envoyé plusieurs messages récemment. Réessayez dans une heure.'};
    const key=`contact:${fingerprint}:${Math.floor(Date.now()/86400000)}`;
    const event=await db.rpc('claim_email_event',{event_key:key,event_name:'contact_message',target_recipient:recipient});
    if(event.error) throw new Error('email_claim_failed');
    const row=Array.isArray(event.data)?event.data[0]:event.data;
    if(!row?.should_send) return {error:'Ce message est déjà envoyé ou en cours de traitement.'};
    const result=await getEmailProvider(String(settings.sender_name||'Come & Eat')).send({to:recipient,subject:'Nouveau message — Come & Eat',html:input.html,text:input.text,replyTo:input.email,idempotencyKey:key});
    const logged=await db.from('email_events').update({status:result.sent?'sent':'failed',provider_message_id:result.providerId??null,last_error_code:result.errorCode??null,updated_at:new Date().toISOString(),...(result.sent?{sent_at:new Date().toISOString()}:{failed_at:new Date().toISOString()})}).eq('id',row.event_id);
    if(logged.error) console.error('[contact] journal_failed',{code:logged.error.code});
    if(!result.sent) return {error:'Votre message n’a pas pu être envoyé. Réessayez plus tard ou utilisez nos coordonnées.'};
    return {message:'Votre message a bien été envoyé. Merci de nous avoir contactés.'};
  }catch{console.error('[contact] dispatch_failed');return {error:'Le service est momentanément indisponible. Réessayez plus tard.'}}
}
