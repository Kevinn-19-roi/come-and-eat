'use server';
import {requirePermission} from '@/lib/auth/permissions';
import {revalidatePath} from 'next/cache';
export async function updatePlanning(_state:object,form:FormData){
 const {db}=await requirePermission('planning.manage');
 const {error}=await db.rpc('update_scheduled_meal',{target:String(form.get('id')),next_status:String(form.get('status')),note:String(form.get('note')??'')});
 if(error)return {error:'Cette transition n’est pas autorisée. La préparation ne commence qu’à proximité du créneau.'};
 revalidatePath('/admin/planning');revalidatePath('/vendor/planning');revalidatePath('/meal-planner');
 return {ok:true,message:'Repas programmé mis à jour.'};
}
