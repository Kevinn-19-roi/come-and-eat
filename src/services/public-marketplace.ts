import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { marketplaceRepositories } from '@/services/repositories';

export async function getFavoriteIds() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { restaurantIds: new Set<string>(), productIds: new Set<string>() };
  const { data, error } = await db.from('favorites').select('restaurant_id,product_id').eq('user_id', user.id).limit(500);
  if (error) {
    console.error('[marketplace] favorites_read_failed', { code: error.code });
    return { restaurantIds: new Set<string>(), productIds: new Set<string>() };
  }
  return {
    restaurantIds: new Set((data ?? []).flatMap(item => item.restaurant_id ? [item.restaurant_id] : [])),
    productIds: new Set((data ?? []).flatMap(item => item.product_id ? [item.product_id] : [])),
  };
}

export async function getRestaurantPage(slug: string) {
  const restaurant = await marketplaceRepositories.restaurantRepository.getBySlug(slug);
  if (!restaurant) return null;
  const [products, promotions, favorites] = await Promise.all([
    marketplaceRepositories.productRepository.listByRestaurant(restaurant.id),
    marketplaceRepositories.promotionRepository.listPublic(),
    getFavoriteIds(),
  ]);
  return {
    restaurant,
    products,
    promotions: promotions.filter(item => !item.restaurantId || item.restaurantId === restaurant.id),
    favorites,
  };
}

export async function getAlreadyOrderedProducts(limit = 8) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return [];
  const { data, error } = await db.from('orders').select('restaurant_orders(order_items(product_id))').eq('customer_user_id', user.id).order('created_at', { ascending: false }).limit(20);
  if (error) return [];
  const ids = [...new Set((data ?? []).flatMap(order => order.restaurant_orders ?? []).flatMap(subOrder => subOrder.order_items ?? []).flatMap(item => item.product_id ? [item.product_id] : []))].slice(0, limit);
  if (!ids.length) return [];
  const products = await marketplaceRepositories.productRepository.listPublic();
  return ids.flatMap(id => products.find(product => product.id === id) ?? []);
}
