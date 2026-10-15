'use server';
import {requirePermission} from '@/lib/auth/permissions';
import {revalidatePath} from 'next/cache';
export async function cancelPaidSubscription(_state:object,form:FormData){const {db}=await requirePermission('refund.approve');const {error}=await db.rpc('cancel_subscription',{target:String(form.get('id'))});if(error)return {error:'Traitez les commandes en cours avant de clôturer cette souscription.'};revalidatePath('/admin/subscriptions');revalidatePath('/subscriptions');return {ok:true,message:'Souscription clôturée. Le prépayé et le reliquat sont conservés ; aucun remboursement n’a été exécuté.'};}
export async function configurePlan(_state:object,form:FormData){
 const {db}=await requirePermission('finance.configure');
 const {error}=await db.rpc('configure_subscription_plan',{target:String(form.get('id')),label:String(form.get('name')),meals:form.get('meals')?Number(form.get('meals')):null,price:Number(form.get('price')),duration:Number(form.get('duration')),delivery:String(form.get('delivery')??''),conditions:String(form.get('conditions')??''),eligible:form.getAll('eligible').map(String)});
 if(error)return {error:'La formule n’a pas été enregistrée. Vérifiez le nombre de repas, le prix et les plats.'};
 revalidatePath('/admin/subscriptions');return {ok:true,message:'Formule enregistrée, non publiée.'};
}
export async function confirmSubscription(_state:object,form:FormData){const {db}=await requirePermission('payment.confirm');const {error}=await db.rpc('confirm_subscription_payment',{target:String(form.get('id'))});if(error)return {error:'Le paiement n’a pas pu être confirmé.'};revalidatePath('/admin/subscriptions');return {ok:true,message:'Paiement confirmé. Abonnement activé.'}}
