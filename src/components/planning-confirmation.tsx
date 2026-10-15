import {ActionForm,SubmitButton} from '@/components/vendor-forms';
import {confirmPlanning} from '@/app/(public)/meal-planner/actions';
import {formatPrice} from '@/lib/utils';

export type PlanningQuote={total:number;credit:number;amount_due:number;meals:{id:string;expected_total?:number}[]};
export function PlanningConfirmation({planId,quote}:{planId:string;quote:PlanningQuote}){
 return <section aria-label="Confirmation du planning">
  <h3>Confirmer mes repas</h3>
  <p>Valeur des repas restant à confirmer et livraisons : <strong>{formatPrice(quote.total)}</strong></p>
  {quote.credit>0?<p>Déjà réglé par abonnement : <strong>{formatPrice(quote.credit)}</strong></p>:null}
  <p>Solde à régler : <strong>{formatPrice(quote.amount_due)}</strong></p>
  <p>Une livraison est facturée par restaurant et créneau, pour une même zone et adresse. Plusieurs plats du même restaurant au même créneau ne doublent pas ces frais.</p>
  <p>Chaque repas conserve sa commande et son suivi. Pour Wave, réglez séparément les soldes affichés dans chaque suivi. Les restaurants ne commencent la préparation qu’à l’approche du créneau.</p>
  <ActionForm action={confirmPlanning} submitLabel={false}>
   <input type="hidden" name="plan" value={planId}/><input type="hidden" name="key" value={crypto.randomUUID()}/><input type="hidden" name="total" value={quote.total}/>
   <label className="field"><span>Votre nom</span><input name="name" required minLength={2} maxLength={100} autoComplete="name"/></label>
   <label className="field"><span>Votre téléphone</span><input type="tel" name="phone" required maxLength={30} autoComplete="tel"/></label>
   <SubmitButton pendingLabel="Confirmation du planning…" confirmMessage={`Créer les ${quote.meals.length} commandes de ce planning ? Le montant et les disponibilités seront revérifiés.`}>Confirmer mes repas</SubmitButton>
  </ActionForm>
 </section>;
}
