import type { PublicUserContext } from '@/lib/auth/public-user';

export type PublicAccountLink = { href: string; label: string };
export function getPublicAccountLinks(user: PublicUserContext | null): PublicAccountLink[] {
  if (!user) return [{ href: '/login', label: 'Connexion' }, { href: '/signup', label: 'Inscription' }];
  const links: PublicAccountLink[] = [{ href: '/account', label: 'Mon compte' }, { href: '/favorites', label: 'Mes favoris' }];
  if (user.role === 'admin' || user.role === 'super_admin') links.push({ href: '/admin', label: 'Panel admin' });
  if (user.hasRestaurant) links.push({ href: '/vendor', label: 'Mon restaurant' });
  else if (user.role !== 'admin' && user.role !== 'super_admin') links.push({ href: '/vendor/application', label: 'Devenir vendeur' });
  return links;
}
