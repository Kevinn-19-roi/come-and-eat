'use client';
import {useActionState} from 'react';
import {sendContact,type ContactState} from '@/app/(public)/contact/actions';
export function ContactForm(){
  const [state,action,pending]=useActionState<ContactState,FormData>(sendContact,{});
  return <form action={action} className="form-grid">
    <label className="field"><span>Nom</span><input name="name" required minLength={2} maxLength={100} autoComplete="name"/></label>
    <label className="field"><span>Email</span><input name="email" type="email" required maxLength={254} autoComplete="email"/></label>
    <label className="field full"><span>Téléphone (facultatif)</span><input name="phone" type="tel" maxLength={30} autoComplete="tel"/></label>
    <label className="field full"><span>Message</span><textarea name="message" rows={6} required minLength={10} maxLength={4000}/></label>
    <label hidden aria-hidden="true">Site web<input name="website" tabIndex={-1} autoComplete="off"/></label>
    {state.error?<p className="form-error field full" role="alert">{state.error}</p>:null}
    {state.message?<p className="form-feedback success field full" role="status">{state.message}</p>:null}
    <button className="btn btn-dark" disabled={pending} aria-busy={pending}>{pending?'Envoi en cours…':'Envoyer le message'}</button>
  </form>;
}
