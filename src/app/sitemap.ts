import type { MetadataRoute } from 'next';
import { marketplaceRepositories } from '@/services/repositories';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://come-and-eat.vercel.app';
  const [restaurants, products] = await Promise.all([
    marketplaceRepositories.restaurantRepository.listPublic().catch(() => []),
    marketplaceRepositories.productRepository.listPublic().catch(() => []),
  ]);
  const staticPages = ['', '/restaurants', '/menu', '/about', '/contact', '/login', '/signup'].map(path => ({ url: `${base}${path}`, lastModified: new Date(), changeFrequency: path === '' ? 'daily' as const : 'weekly' as const, priority: path === '' ? 1 : path === '/restaurants' || path === '/menu' ? .9 : .6 }));
  return [...staticPages, ...restaurants.map(item => ({ url: `${base}/restaurants/${item.slug}`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: .8 })), ...products.map(item => ({ url: `${base}/menu/${item.slug}`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: .7 }))];
}
