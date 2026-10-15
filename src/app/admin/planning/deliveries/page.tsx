import {requirePermission} from '@/lib/auth/permissions';

const labels: Record<string, string> = {pending:'Nouvelle',confirmed:'Confirmée',preparing:'En préparation',ready:'Prête',out_for_delivery:'En livraison',delivered:'Livrée',cancelled:'Annulée'};

export default async function Page({searchParams}: {searchParams: Promise<{from?: string; to?: string}>}) {
  const {db} = await requirePermission('planning.deliveries');
  const query = await searchParams;
  const {data:clock} = await db.rpc('subscription_clock');
  const checkedAt = typeof clock === 'string' ? Date.parse(clock) : NaN;
  const today = Number.isFinite(checkedAt) ? new Date(checkedAt).toISOString().slice(0,10) : '';
  const from = query.from ?? today;
  const to = query.to ?? (Number.isFinite(checkedAt) ? new Date(checkedAt+30*86400000).toISOString().slice(0,10) : '');
  const valid = [from,to].every(value=>/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)));
  const {data,error} = valid ? await db.rpc('delivery_planning', {from_time:`${from}T00:00:00Z`,to_time:`${to}T00:00:00Z`}) : {data:null,error:true};
  return <section className="admin-card">
    <h1>Livraisons programmées</h1><p>Commandes confirmées par le client uniquement, en heure d’Abidjan. Une estimation ne déclenche aucune livraison.</p>
    <form method="get" className="vendor-form"><label className="field"><span>À partir du</span><input type="date" name="from" defaultValue={from} required/></label><label className="field"><span>Jusqu’au, non inclus</span><input type="date" name="to" defaultValue={to} required/></label><button className="btn btn-dark">Afficher</button></form>
    {error?<p role="status">Impossible de charger cette période. Choisissez moins de trois mois et vérifiez l’activation du module.</p>:null}
    {!error&&!data?.length?<p>Aucune livraison programmée sur cette période.</p>:null}
    {data?.map((meal: {meal_id:string;scheduled_at:string;restaurant_name:string;product_name:string;quantity:number;address:string|null;customer_name:string;customer_phone:string;reference:string;status:string})=><article key={meal.meal_id}>
      <h2>{meal.restaurant_name} · {meal.reference}</h2><p>{new Date(meal.scheduled_at).toLocaleString('fr-FR',{timeZone:'Africa/Abidjan'})} · {labels[meal.status]??'À examiner'}</p>
      <p>{meal.quantity} × {meal.product_name}</p><p>{meal.customer_name} · {meal.customer_phone}</p><p>{meal.address}</p>
    </article>)}
    {data?.length===100?<p>100 livraisons affichées au maximum. Réduisez la période pour consulter la suite.</p>:null}
  </section>;
}
