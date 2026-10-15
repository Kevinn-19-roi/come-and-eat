'use server';
import {requireVendorManager} from '@/lib/auth/vendor';
import {createClient} from '@/lib/supabase/server';
import {revalidatePath} from 'next/cache';
export async function replyReview(_state:object,form:FormData){await requireVendorManager();const db=await createClient();const {error}=await db.rpc('reply_product_review',{target_review:String(form.get('review')),reply:String(form.get('reply')??'')});if(error)return {error:'La réponse n’a pas pu être enregistrée.'};revalidatePath('/vendor/reviews');revalidatePath('/menu','layout');return {ok:true,message:'Réponse publiée.'}}
