'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { publicLogin, publicSignup, type PublicAuthState } from '@/app/(public)/auth-actions';
import { PasswordField } from '@/components/password-field';

function Submit({ signup }: { signup?: boolean }) {
  const { pending } = useFormStatus();
  return <button className="btn btn-dark auth-submit" disabled={pending}>{pending ? 'Un instant…' : signup ? 'Créer mon compte' : 'Se connecter'}</button>;
}

export function PublicAuthForm({ mode, next = '' }: { mode: 'login' | 'signup'; next?: string }) {
  const signup = mode === 'signup';
  const [state, action] = useActionState<PublicAuthState, FormData>(signup ? publicSignup : publicLogin, {});
  const suffix = next ? `?next=${encodeURIComponent(next)}` : '';
  return <form action={action} className="public-auth-form">
    <input type="hidden" name="next" value={next} />
    {signup ? <label><span>Votre nom</span><input name="display_name" autoComplete="name" required placeholder="Ex. Awa Koné" /></label> : null}
    <label><span>Email</span><input name="email" type="email" autoComplete="email" required placeholder="vous@exemple.com" /></label>
    <PasswordField name="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={8} />
    {!signup ? <p className="auth-switch"><Link href="/forgot-password">Mot de passe oublié ?</Link></p> : null}
    {signup ? <PasswordField name="password_confirmation" label="Confirmer le mot de passe" autoComplete="new-password" minLength={8} /> : null}
    {state.error ? <p className="auth-feedback error" role="alert">{state.error}</p> : null}
    {state.message ? <p className="auth-feedback success" role="status">{state.message}</p> : null}
    <Submit signup={signup} />
    <p className="auth-switch">{signup ? 'Vous avez déjà un compte ?' : 'Nouveau sur Come & Eat ?'} <Link href={`${signup ? '/login' : '/signup'}${suffix}`}>{signup ? 'Se connecter' : 'Créer un compte'}</Link></p>
  </form>;
}
