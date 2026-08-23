import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ProductCard } from '@/components/product-card';
import { RestaurantCard } from '@/components/restaurant-card';
import { getPublicUser } from '@/lib/auth/public-user';
import { getFavoriteIds } from '@/services/public-marketplace';
import { marketplaceRepositories } from '@/services/repositories';

export const metadata: Metadata = { title: 'Mes favoris', robots: { index: false, follow: false } };
export default async function FavoritesPage() {
  const user = await getPublicUser();
  if (!user) redirect('/login?next=/favorites');
  const [favorites, restaurants, products] = await Promise.all([getFavoriteIds(), marketplaceRepositories.restaurantRepository.listPublic(), marketplaceRepositories.productRepository.listPublic()]);
  const savedRestaurants = restaurants.filter(item => favorites.restaurantIds.has(item.id));
  const savedProducts = products.filter(item => favorites.productIds.has(item.id));
  return <><section className="marketplace-page-hero compact"><div className="store-container"><p className="section-kicker">Pour plus tard</p><h1>Mes favoris</h1><p>Retrouvez les restaurants et les plats que vous avez enregistrés.</p></div></section><section className="section"><div className="store-container favorites-sections">{savedRestaurants.length ? <section><h2>Restaurants</h2><div className="restaurant-grid">{savedRestaurants.map(item => <RestaurantCard key={item.id} restaurant={item} favorite />)}</div></section> : null}{savedProducts.length ? <section><h2>Plats</h2><div className="product-grid">{savedProducts.map(item => <ProductCard key={item.id} product={item} favorite />)}</div></section> : null}{!savedRestaurants.length && !savedProducts.length ? <div className="empty-state"><h2>Aucun favori pour le moment</h2><p>Utilisez le cœur sur un restaurant ou un plat pour le retrouver ici.</p><Link className="btn btn-orange" href="/restaurants">Découvrir les restaurants</Link></div> : null}</div></section></>;
}
