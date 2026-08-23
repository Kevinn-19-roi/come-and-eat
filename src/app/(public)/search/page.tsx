import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductCard } from '@/components/product-card';
import { RestaurantCard } from '@/components/restaurant-card';
import { getFavoriteIds } from '@/services/public-marketplace';
import { marketplaceRepositories } from '@/services/repositories';

export const metadata: Metadata = { title: 'Recherche', robots: { index: false, follow: true } };
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const query = q.trim();
  const [restaurants, products, categories, cuisines, favorites] = query ? await Promise.all([marketplaceRepositories.restaurantRepository.search(query), marketplaceRepositories.productRepository.search(query), marketplaceRepositories.categoryRepository.listPublic(), marketplaceRepositories.cuisineTypeRepository.list(), getFavoriteIds()]) : [[], [], [], [], await getFavoriteIds()];
  const needle = query.toLocaleLowerCase('fr');
  const matchingCategories = categories.filter(item => item.name.toLocaleLowerCase('fr').includes(needle));
  const matchingCuisines = cuisines.filter(item => item.name.toLocaleLowerCase('fr').includes(needle));
  const total = restaurants.length + products.length + matchingCategories.length + matchingCuisines.length;
  return <><section className="marketplace-page-hero search-page-head"><div className="store-container"><p className="section-kicker">Recherche</p><h1>Que souhaitez-vous manger ?</h1><form action="/search" className="directory-search"><input name="q" defaultValue={query} autoFocus placeholder="Plat, restaurant, catégorie…" /><button>Rechercher</button></form>{query ? <p>{total} résultat{total > 1 ? 's' : ''} pour « {query} »</p> : null}</div></section><section className="section"><div className="store-container search-results">{restaurants.length ? <section><h2>Restaurants</h2><div className="restaurant-grid">{restaurants.map(item => <RestaurantCard key={item.id} restaurant={item} favorite={favorites.restaurantIds.has(item.id)} />)}</div></section> : null}{products.length ? <section><h2>Plats</h2><div className="product-grid">{products.map(item => <ProductCard key={item.id} product={item} favorite={favorites.productIds.has(item.id)} />)}</div></section> : null}{matchingCategories.length || matchingCuisines.length ? <section><h2>Explorer</h2><div className="cuisine-links">{matchingCategories.map(item => <Link href={`/menu?category=${item.slug}`} key={item.id}>{item.name}</Link>)}{matchingCuisines.map(item => <Link href={`/restaurants?cuisine=${item.slug}`} key={item.id}>{item.name}</Link>)}</div></section> : null}{query && !total ? <div className="empty-state"><h2>Aucun résultat</h2><p>Essayez le nom d’un plat, d’un restaurant ou d’une cuisine.</p></div> : null}</div></section></>;
}
