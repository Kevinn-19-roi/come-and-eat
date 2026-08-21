'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {requireAdmin} from '@/lib/auth/admin';
import {createClient} from '@/lib/supabase/server';
export async function reviewSellerApplication(form:FormData){await requireAdmin();const id=String(form.get('application_id')??'');const decision=String(form.get('decision')??'');const note=String(form.get('note')??'').trim();if(!id||!['approved','rejected','changes_requested','under_review'].includes(decision))throw new Error('Décision invalide.');if(['rejected','changes_requested'].includes(decision)&&!note)throw new Error('Indiquez une explication au vendeur.');const db=await createClient();const{error}=await db.rpc('review_seller_application',{target_application_id:id,decision,review_note:note||null});if(error){console.error('[seller-application-review]',{code:error.code});throw new Error('La décision n’a pas pu être enregistrée.')}revalidatePath('/admin');revalidatePath('/admin/seller-applications');revalidatePath(`/admin/seller-applications/${id}`);redirect(`/admin/seller-applications/${id}?saved=1`)}
