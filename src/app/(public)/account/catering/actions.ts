'use server';
import {createClient} from '@/lib/supabase/server';
import {revalidatePath} from 'next/cache';
export async function recoverGuestRequests(){const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return {error:'Connectez-vous.'};const {data,error}=await db.rpc('claim_my_catering_requests');if(error)return {error:'Les demandes n’ont pas pu être retrouvées.'};revalidatePath('/account/catering');return {ok:true,message:data?'Vos demandes ont été associées à votre compte.':'Aucune demande non associée n’a été trouvée pour votre email vérifié.'};}
export async function respondToQuote(_state:object,form:FormData){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return {error:'Connectez-vous pour répondre à votre devis.'};
 const decision=String(form.get('decision'));if(!['accept','reject'].includes(decision))return {error:'Choisissez une réponse au devis.'};
 const {error}=await db.rpc('respond_catering_quote',{target_quote:String(form.get('quote')),accept:decision==='accept'});
 if(error)return {error:'Ce devis n’est plus disponible ou ne vous appartient pas.'};
 revalidatePath('/account/catering');revalidatePath('/admin/catering');return {ok:true,message:decision==='accept'?'Devis accepté. Aucun paiement n’a été déclenché.':'Devis refusé.'};
}
