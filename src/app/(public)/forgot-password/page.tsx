import type{Metadata}from'next';import{ForgotPasswordForm}from'@/components/password-recovery-form';
export const metadata:Metadata={title:'Mot de passe oublié',robots:{index:false,follow:false}};
export default function Page(){return <section className="public-auth-page"><div className="public-auth-card"><p className="section-kicker">Votre compte</p><h1>Mot de passe oublié ?</h1><p>Indiquez votre email. Nous vous enverrons un lien sécurisé si un compte correspond.</p><ForgotPasswordForm/></div></section>}
