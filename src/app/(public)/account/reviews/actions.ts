'use server';
import {createClient} from '@/lib/supabase/server';
import {revalidatePath} from 'next/cache';
export async function reportReview(_state:object,form:FormData){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return {error:'Connectez-vous pour signaler cet avis.'};
 const reason=String(form.get('reason')??'').trim();if(reason.length<5||reason.length>1000)return {error:'Indiquez un motif de 5 à 1 000 caractères.'};
 const {error}=await db.rpc('report_product_review',{target_review:String(form.get('review')),reason});
 if(error)return {error:'Le signalement n’a pas pu être enregistré.'};return {ok:true,message:'Votre signalement a été transmis à Come & Eat.'};
}
export async function publishReview(_state:object,form:FormData){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return {error:'Connectez-vous pour donner votre avis.'};
 const stars=Number(form.get('rating'));const comment=String(form.get('comment')??'').trim();
 if(!Number.isInteger(stars)||stars<1||stars>5||comment.length>2000)return {error:'Vérifiez la note et la longueur du commentaire.'};
 const {error}=await db.rpc('submit_verified_review',{target_item:String(form.get('item')),stars,review_text:comment});
 if(error)return {error:error.code==='23505'?'Vous avez déjà donné votre avis sur ce repas.':'Seul un repas remis et payé peut recevoir un avis.'};
 revalidatePath('/account/reviews');revalidatePath('/menu','layout');return {ok:true,message:'Merci, votre avis a été publié.'};
}
