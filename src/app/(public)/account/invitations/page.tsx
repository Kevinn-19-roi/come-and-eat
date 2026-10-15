import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {ActionForm} from '@/components/vendor-forms';
import {platformRoleLabels} from '@/lib/platform-roles';
import {acceptInvitation} from './actions';
export const metadata={title:'Mes invitations',robots:{index:false,follow:false}};
export default async function Page(){const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login?next=/account/invitations');const {data:invitations}=await db.from('platform_invitations').select('id,responsibilities,expires_at').eq('status','pending').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(20);return <section className="store-container section"><h1>Mes invitations</h1><p>Les invitations apparaissent après vérification de l’email du compte.</p>{!invitations?.length?<p>Aucune invitation en attente.</p>:null}{invitations?.map(invitation=><article className="card" key={invitation.id}><h2>Rejoindre l’équipe Come & Eat</h2><p>{(invitation.responsibilities as string[]).map(role=>platformRoleLabels[role as keyof typeof platformRoleLabels]).join(' · ')}</p><ActionForm action={acceptInvitation} submitLabel="Accepter ces responsabilités"><input type="hidden" name="invitation" value={invitation.id}/></ActionForm></article>)}</section>;}
