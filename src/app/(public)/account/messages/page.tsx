import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {ActionForm} from '@/components/vendor-forms';
import {ConversationInbox} from '@/components/conversation-inbox';
import {startConversation} from './actions';
export const metadata={title:'Mes messages',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{q?:string;status?:string;before_time?:string;before_id?:string}>}){
 const query=await searchParams;
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login?next=/account/messages');
 const {data:restaurants}=await db.from('restaurants').select('id,name').eq('accepts_messages',true).eq('validation_status','approved').is('archived_at',null).order('name').limit(100);
 return <section className="store-container section"><p className="section-kicker">À votre écoute</p><h1>Mes messages</h1><ConversationInbox search={query.q} status={query.status} beforeTime={query.before_time} beforeId={query.before_id}/><details className="card"><summary>Écrire un nouveau message</summary><ActionForm action={startConversation} submitLabel="Envoyer mon message"><input type="hidden" name="key" value={crypto.randomUUID()}/><label className="field"><span>Destinataire</span><select name="restaurant"><option value="">L’équipe Come & Eat</option>{restaurants?.map(r=><option value={r.id} key={r.id}>{r.name}</option>)}</select></label><label className="field"><span>Sujet</span><input name="subject" required minLength={3} maxLength={120}/></label><label className="field"><span>Votre message</span><textarea name="message" required rows={5} maxLength={4000}/></label><small>N’envoyez pas de mot de passe, de pièce d’identité ou de coordonnées bancaires.</small></ActionForm></details></section>;
}
