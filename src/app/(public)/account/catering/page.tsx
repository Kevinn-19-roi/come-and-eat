import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {CateringQuoteCard} from '@/components/catering-quote';
import {ActionForm,SubmitButton} from '@/components/vendor-forms';
import {cateringStatuses,quoteIsAvailable} from '@/lib/catering';
import {respondToQuote,recoverGuestRequests} from './actions';
export const metadata={title:'Mes demandes traiteur',robots:{index:false,follow:false}};
export default async function Page(){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login?next=/account/catering');
 // Ownership recovery is performed only by a separate explicit action, not by GET rendering.
 const {data:requests,error}=await db.from('catering_requests').select('id,event_type,event_at,guests,location,status,catering_quotes(id,lines,extra_fee,total,valid_until,conditions,status)').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50);
 return <section className="store-container section"><h1>Mes demandes traiteur</h1><ActionForm action={recoverGuestRequests} submitLabel="Retrouver mes demandes avec mon email vérifié"><p>Si vous avez envoyé une demande avant votre inscription, vous pouvez la retrouver avec la même adresse email vérifiée.</p></ActionForm>{error?<p>Le suivi traiteur est en cours d’activation.</p>:!requests?.length?<p>Aucune demande associée à votre compte. Connectez-vous avant de remplir votre prochaine demande pour la retrouver ici.</p>:null}
 {requests?.map(request=><article className="card" key={request.id}><h2>{request.event_type} · {request.guests} personnes</h2><p>{new Date(request.event_at).toLocaleString('fr-FR',{timeZone:'Africa/Abidjan'})} · {request.location}</p><p>{cateringStatuses[request.status]}</p>{request.catering_quotes?.map(quote=><div key={quote.id}><CateringQuoteCard quote={quote}/>{quoteIsAvailable(quote)&&request.status==='quoted'?<ActionForm action={respondToQuote} submitLabel={false}><input type="hidden" name="quote" value={quote.id}/><SubmitButton name="decision" value="accept" pendingLabel="Enregistrement…" confirmMessage="Accepter ce devis et ses conditions ? Aucun paiement automatique ne sera effectué.">Accepter le devis</SubmitButton><SubmitButton name="decision" value="reject" className="btn btn-outline" confirmMessage="Refuser ce devis ?">Refuser le devis</SubmitButton></ActionForm>:null}</div>)}</article>)}</section>;
}
