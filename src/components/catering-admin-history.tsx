import {createClient} from '@/lib/supabase/server';
import {CateringQuoteCard} from './catering-quote';
import {ActionForm,SubmitButton} from './vendor-forms';
import {publishQuote} from '@/app/admin/catering/actions';
import {cateringStatuses} from '@/lib/catering';
export async function CateringAdminHistory({requestId}:{requestId:string}){
 const db=await createClient();const [{data:quotes},{data:events}]=await Promise.all([db.from('catering_quotes').select('id,lines,extra_fee,total,valid_until,conditions,status').eq('request_id',requestId).order('created_at',{ascending:false}).limit(30),db.from('catering_events').select('id,note,status,created_at').eq('request_id',requestId).order('created_at',{ascending:false}).limit(100)]);
 return <details><summary>Devis et historique</summary>{!quotes?.length?<p>Aucun devis enregistré.</p>:null}{quotes?.map(quote=><div key={quote.id}><CateringQuoteCard quote={quote}/>{quote.status==='draft'?<ActionForm action={publishQuote} submitLabel={false}><input type="hidden" name="quote" value={quote.id}/><SubmitButton confirmMessage="Mettre ce devis à disposition du client ? Vérifiez les prix et les conditions." pendingLabel="Publication…">Mettre le devis à disposition</SubmitButton></ActionForm>:null}</div>)}<h3>Historique interne</h3>{events?.map(event=><div key={event.id}><strong>{cateringStatuses[event.status]??'Mise à jour'} · {new Date(event.created_at).toLocaleString('fr-FR',{timeZone:'Africa/Abidjan'})}</strong><p>{event.note}</p></div>)}</details>;
}
