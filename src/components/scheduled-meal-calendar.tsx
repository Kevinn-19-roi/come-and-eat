import {ActionForm, SubmitButton} from '@/components/vendor-forms';
import {ScheduledOrderLinks} from '@/components/scheduled-order-links';
import {scheduledMealLabels} from '@/lib/scheduled-meals';
import {confirmScheduledPickup, removeDraftMeal} from '@/app/(public)/meal-planner/actions';

type Meal = {
  id: string; order_id: string | null; subscription_id: string | null;
  scheduled_at: string; fulfillment: string; status: string; quantity: number;
  estimated_subtotal: number; estimated_delivery: number; address: string | null;
  products: unknown; restaurants: unknown; orders: unknown;
};

function nameOf(relation: unknown, fallback: string) {
  const value = Array.isArray(relation) ? relation[0] : relation;
  return value && typeof value === 'object' && 'name' in value && typeof value.name === 'string' ? value.name : fallback;
}

export function ScheduledMealCalendar({meals, editable,showConfirmation=true,quotedMeals}: {meals: Meal[]; editable: boolean;showConfirmation?:boolean;quotedMeals?:{id:string;expected_total?:number}[]}) {
  const valueOf=(meal:Meal)=>quotedMeals?.find(row=>row.id===meal.id)?.expected_total??meal.estimated_subtotal+meal.estimated_delivery;
  const days = new Map<string, Meal[]>();
  for (const meal of [...meals].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))) {
    // Côte d’Ivoire stays at UTC+00:00; still format the customer-facing time explicitly below.
    const day = new Date(meal.scheduled_at).toISOString().slice(0, 10);
    days.set(day, [...(days.get(day) ?? []), meal]);
  }
  if (!meals.length) return <p>Aucun repas pour le moment. Choisissez un premier plat ci-dessous.</p>;
  return <div aria-label="Repas par journée">
    {[...days].map(([day, entries]) => <section key={day}>
      <h3>{new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', {timeZone: 'Africa/Abidjan', weekday: 'long', day: 'numeric', month: 'long'})}</h3>
      {entries.map(meal => <article key={meal.id}>
        <h4>{meal.quantity} × {nameOf(meal.products, 'Plat')}</h4>
        <p>{nameOf(meal.restaurants, 'Restaurant')} · {new Date(meal.scheduled_at).toLocaleTimeString('fr-FR', {timeZone: 'Africa/Abidjan', hour: '2-digit', minute: '2-digit'})} · {meal.fulfillment === 'delivery' ? 'Livraison' : 'Retrait'}</p>
        {meal.fulfillment === 'delivery' && meal.address ? <p>{meal.address}</p> : null}
        <div className="summary-row"><span>{scheduledMealLabels[meal.status] ?? 'À examiner'}</span><strong>{new Intl.NumberFormat('fr-FR').format(valueOf(meal))} FCFA {meal.order_id ? 'confirmés' : 'estimés'}</strong></div>
        <ScheduledOrderLinks order={meal.orders}/>
        {showConfirmation && !meal.order_id && meal.status === 'requested' ? <ActionForm action={confirmScheduledPickup} submitLabel={false}>
          <input type="hidden" name="meal" value={meal.id}/><input type="hidden" name="total" value={meal.estimated_subtotal + meal.estimated_delivery}/>
          <label className="field"><span>Votre nom</span><input name="name" required minLength={2} maxLength={100} autoComplete="name"/></label>
          <label className="field"><span>Votre téléphone</span><input name="phone" type="tel" required maxLength={30} autoComplete="tel"/></label>
          <p>Le prix, les frais et les horaires seront revérifiés. Le restaurant doit encore confirmer la disponibilité. Le prix du repas prépayé est déduit du solde à régler ; seuls les frais et options non couverts restent dus.</p>
          <SubmitButton confirmMessage="Créer cette commande au montant affiché ? Le moyen de paiement du planning sera conservé." pendingLabel="Confirmation…">Confirmer ce repas</SubmitButton>
        </ActionForm> : !meal.order_id && meal.status === 'requested' ? <p>Confirmez ce repas avec le planning ci-dessous. Le brouillon seul ne crée aucune commande.</p> : null}
        {editable && meal.status === 'requested' && !meal.order_id ? <ActionForm action={removeDraftMeal} submitLabel={false}>
          <input type="hidden" name="meal" value={meal.id}/><SubmitButton confirmMessage="Retirer ce repas du brouillon ? Son quota réservé sera libéré." pendingLabel="Retrait…">Retirer ce repas</SubmitButton>
        </ActionForm> : null}
      </article>)}
      <p>Sous-total de la journée, hors repas annulés : {new Intl.NumberFormat('fr-FR').format(entries.filter(meal => meal.status !== 'cancelled').reduce((sum, meal) => sum + valueOf(meal), 0))} FCFA</p>
    </section>)}
  </div>;
}
