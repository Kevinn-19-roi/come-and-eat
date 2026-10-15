'use server';
import {requirePermission} from '@/lib/auth/permissions';
import {revalidatePath} from 'next/cache';
export async function moderateReview(_state:object,form:FormData){const {db}=await requirePermission('reviews.moderate');const {error}=await db.rpc('moderate_product_review',{target_review:String(form.get('review')),visible:form.get('visible')==='true',reason:String(form.get('reason')??'')});if(error)return {error:'Vérifiez le motif et vos droits de modération.'};revalidatePath('/admin/reviews');revalidatePath('/menu','layout');return {ok:true,message:'Avis mis à jour.'}}
