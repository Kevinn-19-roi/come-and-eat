import {formatPrice} from '@/lib/utils';

export function SubscriptionCredit({total,credit=0}:{total:number;credit?:number}) {
  if(!credit)return null;
  const due=Math.max(0,total-credit);
  return <div className="finance-breakdown" role="status">
    <span>Déjà réglé par abonnement <strong>{formatPrice(credit)}</strong></span>
    <span>Solde options et livraison <strong>{formatPrice(due)}</strong></span>
    {!due?<p>Ce repas est entièrement réglé par votre abonnement. Aucun nouveau paiement n’est demandé.</p>:null}
  </div>;
}
