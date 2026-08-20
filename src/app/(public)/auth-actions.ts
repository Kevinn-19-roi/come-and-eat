'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

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
  const { data, error } = await db.auth.signUp({ email, password, options: { data: { name } } });
  if (error) return { error: error.code === 'user_already_exists' ? 'Un compte existe déjà avec cet email.' : 'L’inscription est indisponible pour le moment.' };
  if (data.session) redirect(destination(form));
  return { message: 'Compte créé. Consultez votre email pour confirmer votre inscription.' };
}

export async function publicLogout() {
  const db = await createClient();
  await db.auth.signOut();
  redirect('/');
}
