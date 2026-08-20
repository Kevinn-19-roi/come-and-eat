'use client';
import Image from 'next/image';
import Link from 'next/link';
import type { Product } from '@/types';
import { formatPrice } from '@/lib/utils';
import { useCart } from './cart-provider';
import { useToast } from './toast-provider';

export function ProductCard({product,featured=false}:{product:Product;featured?:boolean}){
  const cart=useCart(); const toast=useToast();
  return <article className={`product-card ${featured?'featured':''}`}>
    <Link href={`/menu/${product.slug}`} className="product-image">
      {product.image?<Image src={product.image.url} alt={product.image.alt} fill sizes="(max-width: 600px) 92vw, (max-width: 1024px) 45vw, 25vw"/>:<span className="image-placeholder">COME & EAT</span>}
      <span className="rating">★ 4.{product.id.charCodeAt(product.id.length-1)%3+7}</span>
      <span className="prep-time">◷ {product.optionGroupIds.length?'20':'10'} mins</span>
      {!product.available?<em>Indisponible</em>:null}
    </Link>
    <div className="product-copy"><div><h3><Link href={`/menu/${product.slug}`}>{product.name}</Link></h3><p>{product.description}</p></div>
      <div className="product-bottom"><div className="card-price"><small>Prix unitaire</small><strong>{formatPrice(product.price)}</strong></div><span className="made-badge">Sur-<br/>mesure</span><button className="icon-btn" disabled={!product.available} onClick={()=>{cart.add(product);toast(`${product.name} ajouté au panier`)}} aria-label={`Ajouter ${product.name} au panier`}>▣</button></div>
    </div>
  </article>
}