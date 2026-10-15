import type {Metadata} from 'next';
import {getPublicSiteContent} from '@/services/site-content';
import {ContactForm} from '@/components/contact-form';
export const metadata:Metadata={title:'Contact'};
export default async function Page(){const {contact:s}=await getPublicSiteContent();return <><section className="page-hero"><div className="container"><p className="eyebrow">Une question ?</p><h1 className="page-title">Contactez-nous</h1></div></section><section className="section" style={{paddingTop:0}}><div className="container checkout-grid"><div className="card"><h2>Écrivez-nous</h2><ContactForm/></div><aside className="card"><h2>Nos coordonnées</h2><p className="lead">{s.address}</p><p><a href={`tel:${s.phone}`}><strong>{s.phone}</strong></a></p><p><a href={`mailto:${s.email}`}>{s.email}</a></p></aside></div></section></>}
