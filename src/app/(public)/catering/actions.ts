'use server';
import {createHmac} from 'node:crypto';
import {headers} from 'next/headers';
import {createAdminClient} from '@/lib/supabase/admin';
import {createClient} from '@/lib/supabase/server';
export async function requestCatering(_state:object,form:FormData){
 if(form.get('website'))return {ok:true,message:'Votre demande a été reçue.'};
 const get=(key:string)=>String(form.get(key)??'').trim();
 const name=get('name'),email=get('email'),phone=get('phone'),location=get('location'),eventAt=get('event_at'),guests=Number(get('guests'));
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(eventAt)||email.length>254||get('event_type').length<2||get('event_type').length>100||(get('whatsapp')&&!/^\+?[\d ()-]{8,30}$/.test(get('whatsapp'))))return {error:'Vérifiez le type d’événement, la date et vos coordonnées.'};
 if(name.length<2||name.length>100||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)||!/^\+?[\d ()-]{8,30}$/.test(phone)||location.length<3||location.length>500||!Number.isInteger(guests)||guests<1||guests>10000||!eventAt||!Number.isFinite(Date.parse(eventAt))||Date.parse(eventAt+'Z')<=Date.now()||get('message').length>4000||get('dishes').length>2000)return {error:'Vérifiez vos coordonnées, la date future et le nombre de personnes.'};
 try{const db=createAdminClient();const h=await headers();const hash=(s:string)=>createHmac('sha256',process.env.SUPABASE_SERVICE_ROLE_KEY!).update(s).digest('hex');const {data:claim,error:claimError}=await db.rpc('claim_contact_message',{ip_hash:hash(h.get('x-vercel-forwarded-for')||h.get('x-forwarded-for')||'unknown'),email_hash:hash(email.toLowerCase()),message_hash:hash(`catering:${email}:${eventAt}:${location}`)});if(claimError||claim!=='accepted')return {error:'Une demande récente existe déjà ou la limite est atteinte. Réessayez plus tard.'};
 const client=await createClient();const {data:{user}}=await client.auth.getUser();const budget=get('budget')?Number(get('budget')):null;if(budget!==null&&(!Number.isInteger(budget)||budget<0))return {error:'Indiquez un budget valide en FCFA.'};
 const {data,error}=await db.from('catering_requests').insert({user_id:user?.id??null,name,email,phone,whatsapp:get('whatsapp')||null,event_type:get('event_type'),event_at:eventAt+'Z',location,guests,budget,dishes:get('dishes'),message:get('message')}).select('id').single();if(error)return {error:'La demande n’a pas pu être enregistrée. Contactez-nous directement.'};
 const {error:notificationError}=await db.from('v2_notification_jobs').insert({event_key:`catering:${data.id}:received`,event_type:'catering_received',recipient:email,payload:{requestId:data.id,name}});if(notificationError)console.error('[catering] notification_queue_failed',{code:notificationError.code});
 return {ok:true,message:'Votre demande a été reçue. Elle sera étudiée avant toute confirmation.'};
 }catch{return {error:'Le service est momentanément indisponible.'}}
}
