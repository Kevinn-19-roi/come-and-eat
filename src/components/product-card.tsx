'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Product } from '@/types';
import { formatPrice } from '@/lib/utils';
import { useCart } from './cart-provider';
import { FavoriteButton } from './favorite-button';
import { useToast } from './toast-provider';

export function ProductCard({ product, featured = false, favorite = false }: { product: Product; featured?: boolean; favorite?: boolean }) {
  const cart = useCart();
  const toast = useToast();
  return <article className={`product-card ${featured ? 'featured' : ''}`}>
    <Link href={`/menu/${product.slug}`} className="product-image">
      {product.image ? <Image src={product.image.url} alt={product.image.alt} fill sizes="(max-width: 600px) 92vw, (max-width: 1024px) 45vw, 25vw" /> : <span className="image-placeholder">Come & Eat</span>}
      {!product.available ? <em>Indisponible</em> : null}<span className="product-discover" aria-hidden>Voir le plat →</span>
    </Link>
    <FavoriteButton productId={product.id} initial={favorite} />
    <div className="product-copy"><div>
      {product.restaurantName ? <Link href={`/restaurants/${product.restaurantSlug}`} className="product-restaurant">{product.restaurantName}</Link> : null}
      <h3><Link href={`/menu/${product.slug}`}>{product.name}</Link></h3><p>{product.description}</p>
    </div><div className="product-bottom"><strong className="premium-price">{formatPrice(product.price)}</strong>{product.optionGroupIds.length && product.available ? <Link className="icon-btn" href={`/menu/${product.slug}`} aria-label={`Personnaliser ${product.name}`}><span>Personnaliser</span></Link> : <button className="icon-btn" disabled={!product.available} onClick={() => { cart.add(product); toast(`${product.name} ajouté au panier`); }} aria-label={`Ajouter ${product.name} au panier`}><span aria-hidden>+</span><span>{product.available ? 'Ajouter' : 'Indisponible'}</span></button>}</div></div>
  </article>;
}
