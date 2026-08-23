import Image from 'next/image';
import Link from 'next/link';
import type { Restaurant } from '@/types/marketplace';
import { FavoriteButton } from './favorite-button';

export function RestaurantCard({ restaurant, favorite = false }: { restaurant: Restaurant; favorite?: boolean }) {
  const status = restaurant.operatingStatus === 'paused' ? 'En pause' : restaurant.isOpen ? 'Ouvert' : 'Fermé';
  return <article className="restaurant-card">
    <Link href={`/restaurants/${restaurant.slug}`} className="restaurant-cover">
      {restaurant.coverUrl ? <Image src={restaurant.coverUrl} alt={`Cuisine de ${restaurant.name}`} fill sizes="(max-width: 700px) 92vw, 32vw" /> : <span className="restaurant-cover-placeholder">{restaurant.name.slice(0, 1)}</span>}
    </Link>
    <FavoriteButton restaurantId={restaurant.id} initial={favorite} />
    <div className="restaurant-card-body">
      <div className="restaurant-identity">
        <span className="restaurant-logo">{restaurant.logoUrl ? <Image src={restaurant.logoUrl} alt="" fill sizes="56px" /> : restaurant.name.slice(0, 1)}</span>
        <div><h3><Link href={`/restaurants/${restaurant.slug}`}>{restaurant.name}</Link></h3><p>{(restaurant.cuisineTypes ?? []).slice(0, 3).map(item => item.name).join(' · ') || restaurant.commune || 'Abidjan'}</p></div>
      </div>
      <div className="restaurant-facts"><span className={status === 'Ouvert' ? 'open' : ''}>{status}</span><span>{restaurant.averagePrepMinutes} min</span>{restaurant.deliveryAvailable ? <span>Livraison</span> : null}{restaurant.pickupAvailable ? <span>Retrait</span> : null}</div>
    </div>
  </article>;
}
