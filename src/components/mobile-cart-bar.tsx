'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useCart} from './cart-provider';
import {formatPrice} from '@/lib/utils';

export function MobileCartBar(){
 const path=usePathname();const {count,subtotal}=useCart();
 // Product detail and checkout already have their own primary actions.
 const relevant=path==='/menu'||path==='/restaurants'||path.startsWith('/restaurants/')||path==='/search'||path==='/favorites';
 if(!relevant||!count)return null;
 return <><div className="discovery-cart-space" aria-hidden="true"/><aside className="discovery-cart-bar" aria-label="Votre panier"><div aria-live="polite" aria-atomic="true"><strong>Panier · {count} article{count>1?'s':''}</strong><span>Sous-total : {formatPrice(subtotal)}</span></div><Link href="/cart">Voir le panier <span aria-hidden="true">→</span></Link></aside></>;
}
