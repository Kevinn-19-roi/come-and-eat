'use server';
import {createClient} from '@/lib/supabase/server';
import {revalidatePath} from 'next/cache';
export async function acceptInvitation(_state:object,form:FormData){const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return {error:'Connectez-vous avec l’email invité.'};const {error}=await db.rpc('accept_platform_invitation',{target:String(form.get('invitation'))});if(error)return {error:'Invitation indisponible. Vérifiez votre email ou contactez le responsable de Come & Eat.'};revalidatePath('/','layout');return {ok:true,message:'Invitation acceptée. Vos responsabilités sont disponibles dans le menu de votre compte.'};}
