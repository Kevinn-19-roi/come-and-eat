'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {sendPasswordChangedEmail,sendWelcomeEmail} from '@/lib/notifications/service';

export type PublicAuthState = { error?: string; message?: string };
const field = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
const destination = (form: FormData) => {
  const requested = field(form, 'next');
  return requested.startsWith('/') && !requested.startsWith('//') ? requested : '/account';
};

export async function publicLogin(_state: PublicAuthState, form: FormData): Promise<PublicAuthState> {
  const db = await createClient();
  const { error } = await db.auth.signInWithPassword({ email: field(form, 'email'), password: field(form, 'password') });
  if (error) return { error: error.code === 'invalid_credentials' ? 'Email ou mot de passe incorrect.' : 'Connexion indisponible pour le moment.' };
  redirect(destination(form));
}

export async function publicSignup(_state: PublicAuthState, form: FormData): Promise<PublicAuthState> {
  const name = field(form, 'display_name');
  const email = field(form, 'email');
  const password = field(form, 'password');
  if (name.length < 2) return { error: 'Indiquez votre nom.' };
  if (password.length < 8) return { error: 'Le mot de passe doit contenir au moins 8 caractères.' };
  if (password !== field(form, 'password_confirmation')) return { error: 'Les mots de passe ne correspondent pas.' };
  const db = await createClient();
  const siteUrl=String(process.env.NEXT_PUBLIC_SITE_URL||process.env.SITE_URL||'https://come-and-eat.vercel.app').replace(/\/$/,'');
  const { data, error } = await db.auth.signUp({ email, password, options: { data: { name },emailRedirectTo:`${siteUrl}/auth/callback?flow=signup&next=${encodeURIComponent(destination(form))}` } });
  if (error) return { error: error.code === 'user_already_exists' ? 'Un compte existe déjà avec cet email.' : 'L’inscription est indisponible pour le moment.' };
  if (data.session){await sendWelcomeEmail(data.user!.id,email,name);redirect(destination(form));}
  return { message: 'Compte créé. Consultez votre email pour confirmer votre inscription.' };
}

export async function publicLogout() {
  const db = await createClient();
  await db.auth.signOut();
  redirect('/');
}

export async function requestPasswordReset(_state:PublicAuthState,form:FormData):Promise<PublicAuthState>{const email=field(form,'email');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return{error:'Indiquez une adresse email valide.'};const siteUrl=String(process.env.NEXT_PUBLIC_SITE_URL||process.env.SITE_URL||'https://come-and-eat.vercel.app').replace(/\/$/,'');const db=await createClient();await db.auth.resetPasswordForEmail(email,{redirectTo:`${siteUrl}/auth/callback?flow=recovery&next=/reset-password`});return{message:'Si un compte existe avec cette adresse, vous recevrez un lien de réinitialisation.'}}
export async function updatePassword(_state:PublicAuthState,form:FormData):Promise<PublicAuthState>{const password=field(form,'password');if(password.length<8)return{error:'Le mot de passe doit contenir au moins 8 caractères.'};if(password!==field(form,'password_confirmation'))return{error:'Les mots de passe ne correspondent pas.'};const db=await createClient();const{data:{user}}=await db.auth.getUser();if(!user)return{error:'Ce lien est invalide ou a expiré. Demandez un nouveau lien.'};const{error}=await db.auth.updateUser({password});if(error)return{error:'Le mot de passe n’a pas pu être modifié. Demandez un nouveau lien.'};if(user.email)await sendPasswordChangedEmail(user.id,user.email,String(user.user_metadata?.name??''));return{message:'Votre mot de passe a été modifié.'}}
