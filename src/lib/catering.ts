export const cateringStatuses:Record<string,string>={new:'Nouvelle demande',reviewing:'En étude',quoted:'Devis disponible',accepted:'Acceptée',rejected:'Refusée',cancelled:'Annulée',completed:'Terminée'};
export const cateringQuoteStatuses:Record<string,string>={draft:'Brouillon',sent:'À examiner',accepted:'Accepté',rejected:'Refusé',expired:'Expiré'};
export type CateringQuote={id:string;lines:unknown;extra_fee:number;total:number;valid_until:string;conditions:string;status:string};
export function quoteLines(value:unknown):{name:string;quantity:number;price:number}[]{
 if(!Array.isArray(value))return [];
 return value.flatMap(line=>line&&typeof line==='object'&&typeof line.name==='string'&&Number.isSafeInteger(line.quantity)&&Number.isSafeInteger(line.price)?[{name:line.name,quantity:line.quantity,price:line.price}]:[]);
}
export function quoteIsAvailable(quote:Pick<CateringQuote,'status'|'valid_until'>){return quote.status==='sent'&&quote.valid_until>=new Date().toISOString().slice(0,10);}
const htmlEntities:Record<string,string>={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
export function escapeQuoteHtml(value:string){return value.replace(/[&<>"']/g,char=>htmlEntities[char]);}
export function renderQuoteDocument(quote:CateringQuote,recipient:{name:string;event_type:string;event_at:string;location:string}){
 const escape=escapeQuoteHtml;
 const amount=(n:number)=>n.toLocaleString('fr-FR')+' FCFA';
 return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Devis Come &amp; Eat</title><style>body{font:16px system-ui;max-width:900px;margin:3rem auto;padding:1rem;color:#15392e}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #ccc;padding:.8rem}h1{color:#084c3b}.terms{white-space:pre-wrap}@media print{body{margin:0}}</style><h1>Come &amp; Eat — Devis</h1><p>Client : ${escape(recipient.name)}</p><p>${escape(recipient.event_type)} · ${escape(new Date(recipient.event_at).toLocaleString('fr-FR',{timeZone:'Africa/Abidjan'}))}</p><p>${escape(recipient.location)}</p><p>Statut : ${escape(cateringQuoteStatuses[quote.status]??'À examiner')} · Valable jusqu’au ${escape(quote.valid_until)}</p><table><thead><tr><th>Prestation</th><th>Quantité</th><th>Prix unitaire</th><th>Montant</th></tr></thead><tbody>${quoteLines(quote.lines).map(line=>`<tr><td>${escape(line.name)}</td><td>${line.quantity}</td><td>${amount(line.price)}</td><td>${amount(line.quantity*line.price)}</td></tr>`).join('')}</tbody></table><p>Frais supplémentaires : ${amount(quote.extra_fee)}</p><h2>Total : ${amount(quote.total)}</h2><h2>Conditions</h2><p class="terms">${escape(quote.conditions)}</p><p>Ce devis n’est ni une facture fiscale ni une preuve de paiement. Aucun paiement automatique n’est déclenché.</p></html>`;
}
