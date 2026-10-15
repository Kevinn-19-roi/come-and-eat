import Link from 'next/link';
import {siteConfig} from '@/config/site';

export function ScheduledOrderLinks({order}:{order:unknown}){
 const relation=Array.isArray(order)?order[0]:order;
 if(!relation||typeof relation!=='object')return null;
 const row=relation as Record<string,unknown>;
 if(typeof row.reference!=='string'||typeof row.public_tracking_token!=='string')return null;
 return <p><Link className="btn btn-outline" href={`/order/${encodeURIComponent(row.reference)}?token=${encodeURIComponent(row.public_tracking_token)}`}>Suivre ma commande</Link>{row.payment_method==='wave'&&row.payment_status!=='paid'?<a className="btn btn-orange" href={siteConfig.payment.wave.checkoutUrl} target="_blank" rel="noopener noreferrer">Payer avec Wave</a>:null}</p>;
}
