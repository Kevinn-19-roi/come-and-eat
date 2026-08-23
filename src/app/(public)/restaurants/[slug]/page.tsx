import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FavoriteButton } from '@/components/favorite-button';
import { ProductCard } from '@/components/product-card';
import { getRestaurantPage } from '@/services/public-marketplace';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getRestaurantPage(slug);
  return data ? { title: data.restaurant.name, description: data.restaurant.description || `Commandez chez ${data.restaurant.name} sur Come & Eat.` } : { title: 'Restaurant introuvable' };
}

export default async function RestaurantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getRestaurantPage(slug);
  if (!data) notFound();
  const { restaurant, products, promotions, favorites } = data;
  const categories = [...new Map(products.flatMap(product => product.categoryName ? [[product.categoryId, product.categoryName] as const] : [])).entries()];
  const accepting = restaurant.operatingStatus === 'open' && restaurant.isOpen;
  return <><section className="restaurant-page-head"><div className="restaurant-page-cover">{restaurant.coverUrl ? <Image src={restaurant.coverUrl} alt={`Cuisine de ${restaurant.name}`} fill priority sizes="100vw" /> : <span />}</div><div className="store-container restaurant-page-identity"><span className="restaurant-page-logo">{restaurant.logoUrl ? <Image src={restaurant.logoUrl} alt="" fill sizes="110px" /> : restaurant.name.slice(0, 1)}</span><div><p className="section-kicker">{restaurant.isOfficial ? 'Boutique officielle' : 'Restaurant partenaire'}</p><h1>{restaurant.name}</h1><p>{restaurant.description}</p><div className="restaurant-page-meta"><span className={accepting ? 'open' : ''}>{restaurant.operatingStatus === 'paused' ? 'En pause' : accepting ? 'Ouvert' : 'Fermé'}</span><span>{restaurant.averagePrepMinutes} min</span>{restaurant.commune ? <span>{restaurant.commune}</span> : null}{restaurant.deliveryAvailable ? <span>Livraison</span> : null}{restaurant.pickupAvailable ? <span>Retrait</span> : null}</div></div><FavoriteButton restaurantId={restaurant.id} initial={favorites.restaurantIds.has(restaurant.id)} /></div></section>
    {promotions.length ? <section className="restaurant-promotions"><div className="store-container">{promotions.map(item => <div key={item.id}><strong>{item.name}</strong><span>{item.discountType === 'percent' ? `−${item.value} %` : `−${new Intl.NumberFormat('fr-FR').format(item.value)} FCFA`}{item.code ? ` · ${item.code}` : ''}</span></div>)}</div></section> : null}
    <section className="section restaurant-menu"><div className="store-container"><div className="restaurant-menu-nav"><strong>La carte</strong>{categories.map(([id, name]) => <a href={`#category-${id}`} key={id}>{name}</a>)}</div>{products.length ? categories.map(([id, name]) => { const rows = products.filter(product => product.categoryId === id); return <section id={`category-${id}`} key={id} className="restaurant-category"><div className="section-head"><div><h2>{name}</h2><p>{rows.length} choix</p></div></div><div className="product-grid">{rows.map(product => <ProductCard key={product.id} product={product} favorite={favorites.productIds.has(product.id)} />)}</div></section>; }) : <div className="empty-state"><h2>La carte est en préparation</h2><p>Ce restaurant n’a pas encore publié de produit.</p><Link href="/restaurants" className="btn btn-dark">Voir les autres restaurants</Link></div>}</div></section>
  </>;
}
