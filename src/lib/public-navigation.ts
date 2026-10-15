import type { PublicUserContext } from '@/lib/auth/public-user';
import {v2Modules} from '@/lib/v2-modules';

export type PublicAccountLink = { href: string; label: string };
export function getPublicAccountLinks(user: PublicUserContext | null): PublicAccountLink[] {
  if (!user) return [{ href: '/login', label: 'Connexion' }, { href: '/signup', label: 'Inscription' }];
  const links: PublicAccountLink[] = [{ href: '/account', label: 'Mon compte' }, { href: '/favorites', label: 'Mes favoris' },{href:'/account/messages',label:'Mes messages'}];
  if (user.role === 'admin' || user.role === 'super_admin') links.push({ href: '/admin', label: 'Panel admin' });
  else {const destination=v2Modules.find(m=>user.platformPermissions?.includes(m.permission));if(destination)links.push({href:destination.href,label:'Mon espace équipe'});}
  if (user.hasRestaurant) links.push({ href: '/vendor', label: 'Mon restaurant' });
  else if (user.role !== 'admin' && user.role !== 'super_admin') links.push({ href: '/vendor/application', label: 'Devenir vendeur' });
  return links;
}
