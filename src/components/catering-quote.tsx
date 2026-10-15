import Link from 'next/link';
import {cateringQuoteStatuses,quoteLines,type CateringQuote} from '@/lib/catering';
export function CateringQuoteCard({quote}:{quote:CateringQuote}){
 return <article className="card"><h3>Devis · {cateringQuoteStatuses[quote.status]??'À examiner'}</h3>
 {quoteLines(quote.lines).map((line,index)=><div className="summary-row" key={index}><span>{line.quantity} × {line.name} · {line.price.toLocaleString('fr-FR')} FCFA / unité</span><strong>{(line.quantity*line.price).toLocaleString('fr-FR')} FCFA</strong></div>)}
 <p>Frais supplémentaires : {quote.extra_fee.toLocaleString('fr-FR')} FCFA</p><p><strong>Total : {quote.total.toLocaleString('fr-FR')} FCFA</strong></p><p>Valable jusqu’au {new Date(quote.valid_until+'T00:00:00Z').toLocaleDateString('fr-FR',{timeZone:'Africa/Abidjan'})}</p><p style={{whiteSpace:'pre-wrap'}}>{quote.conditions}</p><Link className="btn btn-outline" href={`/catering/quotes/${quote.id}/download`}>Télécharger le devis</Link><p><small>Ce devis n’est ni une facture fiscale ni une confirmation de paiement.</small></p></article>;
}
