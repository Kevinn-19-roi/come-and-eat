import type{Metadata}from'next';import{ResetPasswordForm}from'@/components/password-recovery-form';
export const metadata:Metadata={title:'Nouveau mot de passe',robots:{index:false,follow:false}};
export default function Page(){return <section className="public-auth-page"><div className="public-auth-card"><p className="section-kicker">Sécurité</p><h1>Choisir un nouveau mot de passe</h1><p>Utilisez au moins 8 caractères.</p><ResetPasswordForm/></div></section>}
