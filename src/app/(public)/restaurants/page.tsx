import type { Metadata } from 'next';
import Link from 'next/link';
import { RestaurantCard } from '@/components/restaurant-card';
import { getFavoriteIds } from '@/services/public-marketplace';
import { marketplaceRepositories } from '@/services/repositories';

export const metadata: Metadata = { title: 'Restaurants', description: 'Découvrez les restaurants disponibles sur Come & Eat.' };

export default async function RestaurantsPage({ searchParams }: { searchParams: Promise<{ cuisine?: string; q?: string; service?: string }> }) {
  const [params, restaurants, cuisines, favorites] = await Promise.all([searchParams, marketplaceRepositories.restaurantRepository.listPublic(), marketplaceRepositories.cuisineTypeRepository.list(), getFavoriteIds()]);
  const query = (params.q ?? '').trim().toLocaleLowerCase('fr');
  const filtered = restaurants.filter(restaurant => {
    const cuisineMatches = !params.cuisine || restaurant.cuisineTypes?.some(item => item.slug === params.cuisine);
    const serviceMatches = !params.service || (params.service === 'delivery' ? restaurant.deliveryAvailable : restaurant.pickupAvailable);
    const queryMatches = !query || `${restaurant.name} ${restaurant.description} ${restaurant.commune} ${(restaurant.cuisineTypes ?? []).map(item => item.name).join(' ')}`.toLocaleLowerCase('fr').includes(query);
    return cuisineMatches && serviceMatches && queryMatches;
  });
  return <><section className="marketplace-page-hero"><div className="store-container"><p className="section-kicker">À proximité</p><h1>Trouvez votre prochaine table</h1><p>Parcourez les restaurants approuvés et commandez selon vos envies.</p><form action="/restaurants" className="directory-search"><input name="q" defaultValue={params.q} placeholder="Restaurant, commune ou cuisine" /><button>Rechercher</button></form></div></section><section className="section"><div className="store-container"><div className="directory-filters"><Link className={!params.cuisine ? 'active' : ''} href="/restaurants">Toutes les cuisines</Link>{cuisines.map(item => <Link className={params.cuisine === item.slug ? 'active' : ''} href={`/restaurants?cuisine=${item.slug}`} key={item.id}>{item.name}</Link>)}</div><div className="directory-title"><h2>{filtered.length} restaurant{filtered.length > 1 ? 's' : ''}</h2><div><Link href="/restaurants?service=delivery">Livraison</Link><Link href="/restaurants?service=pickup">Retrait</Link></div></div>{filtered.length ? <div className="restaurant-grid">{filtered.map(restaurant => <RestaurantCard key={restaurant.id} restaurant={restaurant} favorite={favorites.restaurantIds.has(restaurant.id)} />)}</div> : <div className="empty-state"><h2>Aucun restaurant trouvé</h2><p>Essayez une autre cuisine ou une recherche plus large.</p><Link className="btn btn-dark" href="/restaurants">Voir tous les restaurants</Link></div>}</div></section></>;
}
