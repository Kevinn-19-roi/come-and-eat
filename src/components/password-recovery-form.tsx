'use client';
import Link from 'next/link';
import {useActionState} from 'react';
import {useFormStatus} from 'react-dom';
import {requestPasswordReset,updatePassword,type PublicAuthState} from '@/app/(public)/auth-actions';
import {PasswordField} from '@/components/password-field';
function Submit({reset}:{reset?:boolean}){const{pending}=useFormStatus();return <button className="btn btn-dark auth-submit" disabled={pending}>{pending?'Un instant…':reset?'Modifier mon mot de passe':'Envoyer le lien'}</button>}
export function ForgotPasswordForm(){const[state,action]=useActionState<PublicAuthState,FormData>(requestPasswordReset,{});return <form action={action} className="public-auth-form"><label><span>Email</span><input name="email" type="email" autoComplete="email" required/></label>{state.error?<p className="auth-feedback error" role="alert">{state.error}</p>:null}{state.message?<p className="auth-feedback success" role="status">{state.message}</p>:null}<Submit/><p className="auth-switch"><Link href="/login">Retour à la connexion</Link></p></form>}
export function ResetPasswordForm(){const[state,action]=useActionState<PublicAuthState,FormData>(updatePassword,{});return <form action={action} className="public-auth-form"><PasswordField name="password" label="Nouveau mot de passe" autoComplete="new-password" minLength={8}/><PasswordField name="password_confirmation" label="Confirmer le mot de passe" autoComplete="new-password" minLength={8}/>{state.error?<p className="auth-feedback error" role="alert">{state.error}</p>:null}{state.message?<><p className="auth-feedback success" role="status">{state.message}</p><Link className="btn btn-outline" href="/login">Se connecter</Link></>:<Submit reset/>}</form>}
