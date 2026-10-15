'use server';
import {createClient} from '@/lib/supabase/server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
const text=(form:FormData,key:string)=>String(form.get(key)??'').trim();
function feedback(message:string){return {error:message==='RATE_LIMIT'?'Vous avez envoyé plusieurs messages. Patientez avant de réessayer.':message==='CONVERSATION_CLOSED'?'Cette conversation est terminée.':'L’action n’a pas pu être effectuée. Vérifiez les champs et réessayez.'};}
async function session(){const db=await createClient();const {data:{user}}=await db.auth.getUser();return {db,user};}
function refresh(id?:string){revalidatePath('/account/messages');revalidatePath('/admin/messages');revalidatePath('/vendor/messages');if(id)revalidatePath(`/account/messages/${id}`);}
export async function startConversation(_state:object,form:FormData){
 const {db,user}=await session();if(!user)return {error:'Connectez-vous pour écrire.'};
 const {data,error}=await db.rpc('open_conversation',{subject:text(form,'subject'),message:text(form,'message'),request:text(form,'key'),restaurant:text(form,'restaurant')||null});
 if(error)return feedback(error.message);refresh();redirect(`/account/messages/${data}`);
}
export async function replyConversation(_state:object,form:FormData){
 const {db,user}=await session();if(!user)return {error:'Connectez-vous pour répondre.'};const id=text(form,'conversation');
 const {error}=await db.rpc('send_conversation_message',{target:id,message:text(form,'message'),request:text(form,'key')});
 if(error)return feedback(error.message);refresh(id);return {ok:true,message:'Message envoyé.'};
}
export async function readConversation(_state:object,form:FormData){
 const {db,user}=await session();if(!user)return {error:'Connectez-vous pour continuer.'};const id=text(form,'conversation');
 const {error}=await db.rpc('mark_conversation_read',{target:id,through_message:text(form,'message')});if(error)return feedback(error.message);refresh(id);return {ok:true,message:'Messages marqués comme lus.'};
}
export async function finishConversation(_state:object,form:FormData){
 const {db,user}=await session();if(!user)return {error:'Connectez-vous pour continuer.'};const id=text(form,'conversation');
 const {error}=await db.rpc('close_conversation',{target:id});if(error)return feedback(error.message);refresh(id);return {ok:true,message:'Conversation terminée. Historique conservé.'};
}
