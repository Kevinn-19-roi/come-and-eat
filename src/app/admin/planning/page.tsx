import {requirePermission} from '@/lib/auth/permissions';
import Link from 'next/link';
import {scheduledMealLabels} from '@/lib/scheduled-meals';
export default async function Page(){
 const {db}=await requirePermission('planning.manage');
 const {data:meals,error}=await db.from('scheduled_meals').select('id,order_id,scheduled_at,quantity,estimated_subtotal,estimated_delivery,status,address,fulfillment,products(name),restaurants(name)').order('scheduled_at').limit(100);
 return <><h1>Repas programmés</h1><p>Estimation et disponibilité à confirmer. Aucun stock n’est réservé automatiquement.</p>{error?<p>La planification est en cours d’activation.</p>:null}{!meals?.length&&!error?<p>Aucun repas programmé pour le moment.</p>:null}{meals?.map(m=>{return <article className="admin-card" key={m.id}><h2>{(m.products as unknown as {name:string}|null)?.name??'Repas'} · {(m.restaurants as unknown as {name:string}|null)?.name??'Restaurant'}</h2><p>{new Date(m.scheduled_at).toLocaleString('fr-FR',{timeZone:'Africa/Abidjan'})} · {m.quantity} portions</p><p>{m.fulfillment==='delivery'?'Livraison':'Retrait'} · {m.address}</p><p>{!m.order_id?'Brouillon — commande non confirmée. ':null}{scheduledMealLabels[m.status]} · {m.estimated_subtotal+m.estimated_delivery} FCFA estimés</p>{m.order_id?<Link className="btn btn-outline" href={`/admin/orders/${m.order_id}`}>Traiter la commande</Link>:null}</article>})}</>;
}
