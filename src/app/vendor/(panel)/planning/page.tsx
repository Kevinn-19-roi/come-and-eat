import {requireVendor} from '@/lib/auth/vendor';
import {createClient} from '@/lib/supabase/server';
import {scheduledMealLabels} from '@/lib/scheduled-meals';
export default async function Page(){
 const context=await requireVendor();
 const db=await createClient();
 const {data:meals,error}=await db.from('scheduled_meals').select('id,scheduled_at,status,quantity,address,fulfillment,products(name)').eq('restaurant_id',context.restaurant!.id).order('scheduled_at').limit(100);
 return <><h1>Mes repas programmés</h1><p>Chaque créneau doit être confirmé. Aucune préparation anticipée n’est déclenchée.</p>{error?<p>La planification est en cours d’activation.</p>:null}{!meals?.length&&!error?<p>Aucun repas programmé pour votre restaurant.</p>:null}{meals?.map(m=><article className="admin-card" key={m.id}><h2>{(m.products as unknown as {name:string}|null)?.name??'Repas'}</h2><p>{new Date(m.scheduled_at).toLocaleString('fr-FR',{timeZone:'Africa/Abidjan'})} · {m.quantity} portions</p><p>{scheduledMealLabels[m.status]} · {m.fulfillment==='delivery'?'Livraison':'Retrait'}</p><p>{m.address}</p></article>)}</>;
}
