import {requireVendor} from '@/lib/auth/vendor';
import {createClient} from '@/lib/supabase/server';
import {cateringStatuses} from '@/lib/catering';
export default async function Page(){
 const context=await requireVendor();const db=await createClient();
 const {data:requests,error}=await db.from('catering_requests').select('id,name,event_type,event_at,guests,location,dishes,status').eq('assigned_restaurant_id',context.restaurant!.id).order('event_at').limit(100);
 return <><h1>Demandes traiteur attribuées</h1><p>Seules les demandes attribuées à votre restaurant apparaissent ici. Les notes internes administratives restent privées.</p>{error?<p>Le module traiteur est en cours d’activation.</p>:!requests?.length?<p>Aucune demande attribuée pour le moment.</p>:null}{requests?.map(request=><article className="admin-card" key={request.id}><h2>{request.event_type} · {request.guests} personnes</h2><p>{request.name} · {request.location}</p><p>{new Date(request.event_at).toLocaleString('fr-FR',{timeZone:'Africa/Abidjan'})}</p><p>{request.dishes}</p><p>{cateringStatuses[request.status]}</p></article>)}</>;
}
