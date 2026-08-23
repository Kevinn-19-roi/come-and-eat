'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';
import { useCart } from './cart-provider';
import { formatPrice } from '@/lib/utils';

export function CartPage() {
  const { items, subtotal, setQuantity, remove } = useCart();
  const groups = useMemo(() => {
    const result = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.restaurantId ?? 'legacy';
      result.set(key, [...(result.get(key) ?? []), item]);
    }
    return [...result.entries()];
  }, [items]);
  if (!items.length) return <div className="store-container"><div className="empty-state cart-empty"><span>▣</span><h2>Votre panier attend son premier plat</h2><p>Explorez les restaurants et ajoutez ce qui vous fait envie.</p><Link className="btn btn-orange" href="/restaurants">Découvrir les restaurants →</Link></div></div>;
  return <div className="store-container cart-layout"><section className="cart-list"><div className="cart-list-head"><div><span>{items.length} article{items.length > 1 ? 's' : ''}</span><h2>Votre sélection</h2></div><Link href="/menu">+ Ajouter un plat</Link></div>{groups.map(([restaurantId, restaurantItems]) => <section className="cart-restaurant-group" key={restaurantId}><div className="cart-restaurant-head"><div><small>Restaurant</small><strong>{restaurantItems[0].restaurantName ?? 'Come & Eat'}</strong></div>{restaurantItems[0].restaurantSlug ? <Link href={`/restaurants/${restaurantItems[0].restaurantSlug}`}>Voir la carte</Link> : null}</div>{restaurantItems.map(item => <article className="cart-item" key={item.id}><div className="cart-thumb">{item.image ? <Image src={item.image} alt="" fill sizes="96px" /> : <span>🍽</span>}</div><div className="cart-item-copy"><strong>{item.name}</strong>{item.selections.length ? <p>{item.selections.map(selection => selection.name).join(' · ')}</p> : <p>Sans option</p>}<div className="quantity-selector small"><button onClick={() => setQuantity(item.id, item.quantity - 1)} aria-label={`Réduire la quantité de ${item.name}`}>−</button><b>{item.quantity}</b><button onClick={() => setQuantity(item.id, item.quantity + 1)} aria-label={`Augmenter la quantité de ${item.name}`}>+</button></div></div><div className="cart-item-end"><strong>{formatPrice((item.unitPrice + item.selections.reduce((sum, option) => sum + option.price, 0)) * item.quantity)}</strong><button onClick={() => remove(item.id)} aria-label={`Supprimer ${item.name}`}>Supprimer</button></div></article>)}</section>)}</section><aside className="order-summary"><span className="summary-eyebrow">Récapitulatif</span><h2>Votre commande</h2><div className="summary-row"><span>Sous-total</span><strong>{formatPrice(subtotal)}</strong></div><div className="summary-row"><span>Livraison</span><span>Calculée à l’étape suivante</span></div><div className="summary-row total"><strong>Total provisoire</strong><strong>{formatPrice(subtotal)}</strong></div><Link href="/checkout" className="btn btn-orange summary-cta">Continuer vers la commande →</Link><p className="cart-marketplace-note">Chaque restaurant prépare sa partie de la commande. Vous gardez un seul récapitulatif.</p></aside><div className="mobile-cart-checkout"><span><small>Total provisoire</small><strong>{formatPrice(subtotal)}</strong></span><Link href="/checkout">Continuer</Link></div></div>;
}
